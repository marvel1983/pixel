import { Router } from "express";
import { db } from "@workspace/db";
import { jobQueue, jobFailures } from "@workspace/db/schema";
import { eq, desc, sql, count, and, gte } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { getQueueStats, getFailedJobs, retryJob, enqueueJob, type QueueName } from "../lib/job-queue";

const router = Router();
const auth = [requireAuth, requireAdmin, requirePermission("manageSettings")] as const;

router.get("/admin/jobs/stats", ...auth, async (_req, res) => {
  const stats = await getQueueStats();
  res.json(stats);
});

router.get("/admin/jobs/metrics", ...auth, async (_req, res) => {
  const oneHourAgo = new Date(Date.now() - 3600_000);
  const rows = await db.select({
    queue: jobQueue.queue,
    total: count(),
    completed: sql<number>`count(*) filter (where ${jobQueue.status} = 'completed')`,
    failed: sql<number>`count(*) filter (where ${jobQueue.status} = 'failed')`,
    avgDuration: sql<number>`avg(extract(epoch from (${jobQueue.completedAt} - ${jobQueue.startedAt})) * 1000) filter (where ${jobQueue.completedAt} is not null)`,
  }).from(jobQueue)
    .where(gte(jobQueue.createdAt, oneHourAgo))
    .groupBy(jobQueue.queue);

  const metrics = rows.map((r) => ({
    queue: r.queue,
    throughput: Number(r.completed),
    failed: Number(r.failed),
    total: Number(r.total),
    failureRate: Number(r.total) > 0 ? (Number(r.failed) / Number(r.total) * 100).toFixed(1) : "0.0",
    avgDurationMs: r.avgDuration ? Math.round(Number(r.avgDuration)) : null,
  }));
  res.json(metrics);
});

router.get("/admin/jobs/failures", ...auth, async (req, res) => {
  const queue = req.query.queue as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const failures = await getFailedJobs(queue, limit);
  res.json(failures);
});

router.post("/admin/jobs/:jobId/retry", ...auth, async (req, res) => {
  const jobId = Number(req.params.jobId);
  if (isNaN(jobId)) { res.status(400).json({ error: "Invalid job ID" }); return; }
  const [job] = await db.select().from(jobQueue).where(eq(jobQueue.id, jobId)).limit(1);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  if (job.status !== "failed") { res.status(400).json({ error: "Only failed jobs can be retried" }); return; }
  await retryJob(jobId);
  res.json({ ok: true });
});

router.post("/admin/jobs/enqueue", ...auth, async (req, res) => {
  const { queue, name, payload, priority } = req.body;
  if (!queue || !name) { res.status(400).json({ error: "queue and name are required" }); return; }
  const validQueues: QueueName[] = ["email", "product-sync", "order-processing", "abandoned-cart", "alerts", "reports"];
  if (!validQueues.includes(queue)) { res.status(400).json({ error: "Invalid queue name" }); return; }
  const job = await enqueueJob({ queue, name, payload: payload ?? {}, priority: priority ?? 1 });
  res.json(job);
});

router.delete("/admin/jobs/completed", ...auth, async (_req, res) => {
  const result = await db.delete(jobQueue).where(eq(jobQueue.status, "completed"));
  res.json({ ok: true, deleted: (result as any).rowCount ?? 0 });
});

router.get("/admin/jobs/recent", ...auth, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const queue = req.query.queue as string | undefined;
  let q = db.select().from(jobQueue).orderBy(desc(jobQueue.createdAt)).limit(limit);
  if (queue) q = q.where(eq(jobQueue.queue, queue)) as any;
  const jobs = await q;
  res.json(jobs);
});

export default router;
