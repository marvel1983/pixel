import { Router } from "express";
import { db } from "@workspace/db";
import { productQuestions, productAnswers, products } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { optionalAuth } from "../middleware/auth";
import { z } from "zod";

const router = Router();

const askSchema = z.object({
  productId: z.coerce.number().int().positive(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  question: z.string().min(5).max(2000),
});

router.post("/qa/ask", optionalAuth, async (req, res) => {
  const parsed = askSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const { productId, name, email, question } = parsed.data;
  const userId = req.user?.userId ?? null;

  await db.insert(productQuestions).values({
    productId,
    userId,
    askerName: name,
    askerEmail: email,
    questionText: question,
  });

  res.json({ success: true, message: "Your question has been submitted and will appear after review." });
});

router.get("/qa/product/:productId", async (req, res) => {
  const productId = parseInt(req.params.productId);
  if (isNaN(productId)) { res.status(400).json({ error: "Invalid product ID" }); return; }

  const questions = await db.select({
    question: productQuestions,
  })
    .from(productQuestions)
    .where(and(
      eq(productQuestions.productId, productId),
      eq(productQuestions.status, "APPROVED"),
    ))
    .orderBy(desc(productQuestions.createdAt))
    .limit(50);

  const qIds = questions.map((q) => q.question.id);
  let answers: { questionId: number; id: number; answerText: string; isAdmin: boolean; authorName: string; createdAt: Date }[] = [];

  if (qIds.length > 0) {
    answers = await db.select({
      questionId: productAnswers.questionId,
      id: productAnswers.id,
      answerText: productAnswers.answerText,
      isAdmin: productAnswers.isAdmin,
      authorName: productAnswers.authorName,
      createdAt: productAnswers.createdAt,
    }).from(productAnswers);

    answers = answers.filter((a) => qIds.includes(a.questionId));
  }

  const result = questions.map((q) => ({
    ...q.question,
    answers: answers
      .filter((a) => a.questionId === q.question.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
  }));

  res.json({ questions: result, total: result.length });
});

export default router;
