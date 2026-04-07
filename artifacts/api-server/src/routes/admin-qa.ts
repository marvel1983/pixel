import { Router } from "express";
import { db } from "@workspace/db";
import { productQuestions, productAnswers, products } from "@workspace/db/schema";
import { eq, and, desc, count, ilike, or, inArray, type SQL } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { enqueueEmail } from "../lib/email/queue";
import { qaAnsweredEmail } from "../services/qa-emails";

const router = Router();
const guard = [requireAuth, requireAdmin, requirePermission("manageProducts")];

router.get("/admin/qa/stats", ...guard, async (_req, res) => {
  const [pendingRow] = await db.select({ c: count() }).from(productQuestions)
    .where(eq(productQuestions.status, "PENDING"));
  const [approvedRow] = await db.select({ c: count() }).from(productQuestions)
    .where(eq(productQuestions.status, "APPROVED"));
  const [rejectedRow] = await db.select({ c: count() }).from(productQuestions)
    .where(eq(productQuestions.status, "REJECTED"));
  const [totalRow] = await db.select({ c: count() }).from(productQuestions);

  res.json({
    pending: pendingRow?.c ?? 0,
    approved: approvedRow?.c ?? 0,
    rejected: rejectedRow?.c ?? 0,
    total: totalRow?.c ?? 0,
  });
});

router.get("/admin/qa", ...guard, async (req, res) => {
  const { status, search, page: pg, limit: lm } = req.query;
  const page = Math.max(1, parseInt(pg as string) || 1);
  const limit = Math.min(100, parseInt(lm as string) || 25);
  const offset = (page - 1) * limit;

  const validStatuses = ["PENDING", "APPROVED", "REJECTED"] as const;
  const conditions: SQL[] = [];
  if (status && status !== "ALL") {
    if (!validStatuses.includes(status as typeof validStatuses[number])) {
      res.status(400).json({ error: "Invalid status filter" }); return;
    }
    conditions.push(eq(productQuestions.status, status as typeof validStatuses[number]));
  }
  if (search) {
    const s = `%${search}%`;
    conditions.push(or(
      ilike(productQuestions.questionText, s),
      ilike(productQuestions.askerName, s),
      ilike(productQuestions.askerEmail, s),
      ilike(products.name, s),
    )!);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db.select({
    question: productQuestions,
    productName: products.name,
    productSlug: products.slug,
  })
    .from(productQuestions)
    .innerJoin(products, eq(products.id, productQuestions.productId))
    .where(where)
    .orderBy(desc(productQuestions.createdAt))
    .limit(limit).offset(offset);

  const [totalRow] = where
    ? await db.select({ c: count() }).from(productQuestions).innerJoin(products, eq(products.id, productQuestions.productId)).where(where)
    : await db.select({ c: count() }).from(productQuestions);

  const qIds = rows.map((r) => r.question.id);
  type AnswerRow = typeof productAnswers.$inferSelect;
  let answers: AnswerRow[] = [];
  if (qIds.length > 0) {
    answers = await db.select().from(productAnswers)
      .where(inArray(productAnswers.questionId, qIds));
  }

  const answerMap = new Map<number, AnswerRow[]>();
  for (const a of answers) {
    const arr = answerMap.get(a.questionId) ?? [];
    arr.push(a);
    answerMap.set(a.questionId, arr);
  }
  const result = rows.map((r) => ({
    ...r,
    answers: answerMap.get(r.question.id) ?? [],
  }));

  res.json({ questions: result, total: totalRow?.c ?? 0, page, limit });
});

function parseId(raw: string): number | null {
  const id = parseInt(raw);
  return isNaN(id) || id <= 0 ? null : id;
}

router.patch("/admin/qa/:id/status", ...guard, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid question ID" }); return; }
  const { status } = req.body;
  if (!["APPROVED", "REJECTED"].includes(status)) {
    res.status(400).json({ error: "Invalid status" }); return;
  }
  const [updated] = await db.update(productQuestions).set({ status, updatedAt: new Date() })
    .where(eq(productQuestions.id, id)).returning({ id: productQuestions.id });
  if (!updated) { res.status(404).json({ error: "Question not found" }); return; }
  res.json({ success: true });
});

router.post("/admin/qa/bulk-status", ...guard, async (req, res) => {
  const { ids, status } = req.body;
  if (!Array.isArray(ids) || !["APPROVED", "REJECTED"].includes(status)) {
    res.status(400).json({ error: "Invalid request" }); return;
  }
  const numIds = ids.filter((id): id is number => typeof id === "number" && id > 0);
  if (numIds.length === 0) { res.status(400).json({ error: "No valid IDs" }); return; }
  await db.update(productQuestions).set({ status, updatedAt: new Date() })
    .where(inArray(productQuestions.id, numIds));
  res.json({ success: true, count: numIds.length });
});

router.post("/admin/qa/:id/answer", ...guard, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid question ID" }); return; }
  const { answer } = req.body;
  if (!answer || typeof answer !== "string" || answer.length < 1) {
    res.status(400).json({ error: "Answer is required" }); return;
  }

  const [exists] = await db.select({ id: productQuestions.id }).from(productQuestions)
    .where(eq(productQuestions.id, id));
  if (!exists) { res.status(404).json({ error: "Question not found" }); return; }

  await db.insert(productAnswers).values({
    questionId: id,
    answerText: answer,
    isAdmin: true,
    authorName: "Store Admin",
  });

  await db.update(productQuestions).set({ status: "APPROVED", updatedAt: new Date() })
    .where(eq(productQuestions.id, id));

  const [q] = await db.select({
    question: productQuestions,
    productName: products.name,
    productSlug: products.slug,
  }).from(productQuestions)
    .innerJoin(products, eq(products.id, productQuestions.productId))
    .where(eq(productQuestions.id, id));

  if (q) {
    const baseUrl = process.env.APP_PUBLIC_URL
      ?? `https://${process.env["REPLIT_DEV_DOMAIN"] ?? "localhost"}`;
    const productUrl = `${baseUrl}/product/${q.productSlug}`;
    const { subject, html } = qaAnsweredEmail({
      askerName: q.question.askerName,
      productName: q.productName,
      questionText: q.question.questionText,
      answerText: answer,
      productUrl,
    });
    await enqueueEmail(q.question.askerEmail, subject, html, { type: "qa_answered", questionId: id });
  }

  res.json({ success: true });
});

router.delete("/admin/qa/:id", ...guard, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid question ID" }); return; }
  const [deleted] = await db.delete(productQuestions).where(eq(productQuestions.id, id))
    .returning({ id: productQuestions.id });
  if (!deleted) { res.status(404).json({ error: "Question not found" }); return; }
  res.json({ success: true });
});

router.post("/admin/qa/bulk-delete", ...guard, async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) { res.status(400).json({ error: "Invalid request" }); return; }
  const numIds = ids.filter((id): id is number => typeof id === "number" && id > 0);
  if (numIds.length === 0) { res.status(400).json({ error: "No valid IDs" }); return; }
  await db.delete(productQuestions).where(inArray(productQuestions.id, numIds));
  res.json({ success: true, count: numIds.length });
});

export default router;
