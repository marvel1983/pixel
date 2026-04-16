import { Router } from "express";
import { db } from "@workspace/db";
import { userImportJobs, userImportErrors } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { enqueueJob } from "../lib/job-queue";
import { AVAILABLE_FIELDS, WOOCOMMERCE_PRESET, parseCSV } from "../services/user-import-service";
import { logger } from "../lib/logger";

const router = Router();
const auth = [requireAuth, requireAdmin, requirePermission("manageUsers")] as const;

/** List all import jobs */
router.get("/admin/imports", ...auth, async (_req, res) => {
  const jobs = await db
    .select({
      id: userImportJobs.id,
      filename: userImportJobs.filename,
      status: userImportJobs.status,
      duplicatePolicy: userImportJobs.duplicatePolicy,
      totalRows: userImportJobs.totalRows,
      processedRows: userImportJobs.processedRows,
      successCount: userImportJobs.successCount,
      errorCount: userImportJobs.errorCount,
      skippedCount: userImportJobs.skippedCount,
      startedAt: userImportJobs.startedAt,
      completedAt: userImportJobs.completedAt,
      createdAt: userImportJobs.createdAt,
    })
    .from(userImportJobs)
    .orderBy(desc(userImportJobs.createdAt))
    .limit(50);

  res.json(jobs);
});

/** Get single import job + its errors */
router.get("/admin/imports/:id", ...auth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  const [job] = await db
    .select({
      id: userImportJobs.id,
      filename: userImportJobs.filename,
      status: userImportJobs.status,
      columnMapping: userImportJobs.columnMapping,
      duplicatePolicy: userImportJobs.duplicatePolicy,
      totalRows: userImportJobs.totalRows,
      processedRows: userImportJobs.processedRows,
      successCount: userImportJobs.successCount,
      errorCount: userImportJobs.errorCount,
      skippedCount: userImportJobs.skippedCount,
      startedAt: userImportJobs.startedAt,
      completedAt: userImportJobs.completedAt,
      createdAt: userImportJobs.createdAt,
    })
    .from(userImportJobs)
    .where(eq(userImportJobs.id, id))
    .limit(1);

  if (!job) { res.status(404).json({ error: "Not found" }); return; }

  const errors = await db
    .select()
    .from(userImportErrors)
    .where(eq(userImportErrors.jobId, id))
    .limit(500);

  res.json({ job, errors });
});

/** Upload CSV and create import job */
router.post("/admin/imports", ...auth, async (req, res) => {
  const { csvContent, filename, columnMapping, duplicatePolicy } = req.body as {
    csvContent?: string;
    filename?: string;
    columnMapping?: Record<string, string>;
    duplicatePolicy?: string;
  };

  if (!csvContent || typeof csvContent !== "string") {
    res.status(400).json({ error: "csvContent is required" });
    return;
  }

  const safeFilename = typeof filename === "string" && filename.trim() ? filename.trim().slice(0, 255) : "import.csv";
  const policy = duplicatePolicy === "update" || duplicatePolicy === "error" ? duplicatePolicy : "skip";

  // Auto-detect WooCommerce mapping if no mapping provided
  const { headers } = parseCSV(csvContent);
  let mapping: Record<string, string> = columnMapping ?? {};
  if (Object.keys(mapping).length === 0) {
    for (const h of headers) {
      if (WOOCOMMERCE_PRESET[h]) mapping[h] = WOOCOMMERCE_PRESET[h];
    }
  }

  if (!Object.values(mapping).includes("email")) {
    res.status(400).json({ error: "Column mapping must include an email field" });
    return;
  }

  const [job] = await db.insert(userImportJobs).values({
    filename: safeFilename,
    status: "pending",
    columnMapping: mapping,
    duplicatePolicy: policy,
    csvContent,
    createdBy: req.user?.userId,
  }).returning({ id: userImportJobs.id });

  const queuedJob = await enqueueJob({
    queue: "imports",
    name: "process-user-import",
    payload: { importJobId: job.id },
    priority: 1,
  });

  await db.update(userImportJobs)
    .set({ status: "queued", jobQueueId: queuedJob.id })
    .where(eq(userImportJobs.id, job.id));

  logger.info({ importJobId: job.id, filename: safeFilename }, "User import job created");
  res.status(201).json({ id: job.id, status: "queued" });
});

/** Delete an import job (only completed/failed) */
router.delete("/admin/imports/:id", ...auth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  const [job] = await db.select({ status: userImportJobs.status }).from(userImportJobs).where(eq(userImportJobs.id, id)).limit(1);
  if (!job) { res.status(404).json({ error: "Not found" }); return; }
  if (job.status === "processing" || job.status === "queued") {
    res.status(409).json({ error: "Cannot delete an active import job" });
    return;
  }

  await db.delete(userImportErrors).where(eq(userImportErrors.jobId, id));
  await db.delete(userImportJobs).where(eq(userImportJobs.id, id));
  res.json({ ok: true });
});

/** Metadata: available fields + WooCommerce preset */
router.get("/admin/imports/meta/fields", ...auth, (_req, res) => {
  res.json({ availableFields: AVAILABLE_FIELDS, woocommercePreset: WOOCOMMERCE_PRESET });
});

export default router;
