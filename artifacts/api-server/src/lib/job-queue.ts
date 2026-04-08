import { db } from "@workspace/db";
import { jobQueue, jobFailures, type Job } from "@workspace/db/schema";
import { eq, and, sql, desc, count } from "drizzle-orm";
import { logger } from "./logger";

export type QueueName = "email" | "product-sync" | "order-processing" | "abandoned-cart" | "alerts" | "reports";
export type Priority = 0 | 1 | 2 | 3;

export interface EnqueueOptions {
  queue: QueueName;
  name: string;
  payload?: Record<string, unknown>;
  priority?: Priority;
  maxAttempts?: number;
  scheduledAt?: Date;
}

export async function enqueueJob(opts: EnqueueOptions): Promise<Job> {
  const [job] = await db.insert(jobQueue).values({
    queue: opts.queue,
    name: opts.name,
    payload: opts.payload ?? {},
    priority: opts.priority ?? 1,
    maxAttempts: opts.maxAttempts ?? 3,
    scheduledAt: opts.scheduledAt ?? new Date(),
  }).returning();
  return job;
}

export async function enqueueRecurringIfDue(queue: QueueName, name: string, intervalMs: number): Promise<Job | null> {
  const existing = await db.select({ id: jobQueue.id, status: jobQueue.status, completedAt: jobQueue.completedAt })
    .from(jobQueue).where(and(eq(jobQueue.queue, queue), eq(jobQueue.name, name)))
    .orderBy(desc(jobQueue.createdAt)).limit(1);

  if (existing.length > 0) {
    const last = existing[0];
    if (last.status === "waiting" || last.status === "active") return null;
    if (last.completedAt && Date.now() - last.completedAt.getTime() < intervalMs) return null;
  }
  return enqueueJob({ queue, name, priority: 1, maxAttempts: 3 });
}

type JobHandler = (payload: Record<string, unknown>) => Promise<void>;
const handlers = new Map<string, JobHandler>();

export function registerWorker(queue: QueueName, name: string, handler: JobHandler) {
  handlers.set(`${queue}:${name}`, handler);
}

export function registerQueueWorker(queue: QueueName, handler: JobHandler) {
  handlers.set(`${queue}:*`, handler);
}

function getHandler(queue: string, name: string): JobHandler | undefined {
  return handlers.get(`${queue}:${name}`) ?? handlers.get(`${queue}:*`);
}

interface ClaimedRow { id: number; queue: string; name: string; payload: Record<string, unknown>; attempts: number; max_attempts: number; }

async function claimJob(queueName: string): Promise<ClaimedRow | null> {
  const now = new Date();
  const result = await db.execute(sql`
    UPDATE job_queue SET status = 'active', started_at = NOW(), attempts = attempts + 1
    WHERE id = (
      SELECT id FROM job_queue
      WHERE status = 'waiting' AND queue = ${queueName} AND scheduled_at <= ${now}
      ORDER BY priority DESC, scheduled_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, queue, name, payload, attempts, max_attempts
  `);
  const rows = (result as { rows: ClaimedRow[] }).rows;
  return rows.length > 0 ? rows[0] : null;
}

function backoffMs(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt), 300_000);
}

async function processJob(row: ClaimedRow) {
  const handler = getHandler(row.queue, row.name);
  if (!handler) {
    logger.warn({ queue: row.queue, name: row.name }, "No handler registered for job");
    await db.update(jobQueue).set({ status: "failed", lastError: "No handler registered", completedAt: new Date() }).where(eq(jobQueue.id, row.id));
    return;
  }
  try {
    await handler(row.payload ?? {});
    await db.update(jobQueue).set({ status: "completed", completedAt: new Date() }).where(eq(jobQueue.id, row.id));
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await db.insert(jobFailures).values({
      jobId: row.id, queue: row.queue, name: row.name,
      payload: row.payload ?? {}, error: errorMsg, attempt: row.attempts,
    });
    if (row.attempts >= row.max_attempts) {
      await db.update(jobQueue).set({ status: "failed", lastError: errorMsg, completedAt: new Date() }).where(eq(jobQueue.id, row.id));
      logger.error({ jobId: row.id, error: errorMsg }, "Job permanently failed");
    } else {
      const retryAt = new Date(Date.now() + backoffMs(row.attempts));
      await db.update(jobQueue).set({ status: "waiting", lastError: errorMsg, scheduledAt: retryAt }).where(eq(jobQueue.id, row.id));
    }
  }
}

const CONCURRENCY: Record<string, number> = {
  email: 3, "product-sync": 1, "order-processing": 2,
  "abandoned-cart": 1, alerts: 2, reports: 1,
};

let running = false;
const timers: ReturnType<typeof setTimeout>[] = [];

export function startJobProcessor(intervalMs = 2000) {
  if (running) return;
  running = true;
  let totalWorkers = 0;
  for (const [queue, concurrency] of Object.entries(CONCURRENCY)) {
    for (let i = 0; i < concurrency; i++) {
      totalWorkers++;
      const offset = Math.floor(Math.random() * 500);
      const worker = async () => {
        if (!running) return;
        try {
          const job = await claimJob(queue);
          if (job) { await processJob(job); if (running) { const t = setTimeout(worker, 50); timers.push(t); } return; }
        } catch (err) { logger.error({ err, queue }, "Job processor error"); }
        if (running) { const t = setTimeout(worker, intervalMs); timers.push(t); }
      };
      const t = setTimeout(worker, offset);
      timers.push(t);
    }
  }
  logger.info({ totalWorkers, concurrency: CONCURRENCY }, "Job queue processor started");
}

export function stopJobProcessor() {
  running = false;
  for (const t of timers) clearTimeout(t);
  timers.length = 0;
  logger.info("Job queue processor stopped");
}

export async function getQueueStats() {
  const rows = await db.select({
    queue: jobQueue.queue, status: jobQueue.status, cnt: count(),
  }).from(jobQueue).groupBy(jobQueue.queue, jobQueue.status);
  const queues: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    if (!queues[r.queue]) queues[r.queue] = { waiting: 0, active: 0, completed: 0, failed: 0 };
    queues[r.queue][r.status] = Number(r.cnt);
  }
  return queues;
}

export async function getFailedJobsList(queue?: string, limit = 50) {
  const baseWhere = eq(jobQueue.status, "failed");
  const where = queue ? and(baseWhere, eq(jobQueue.queue, queue)) : baseWhere;
  return db.select().from(jobQueue).where(where).orderBy(desc(jobQueue.completedAt)).limit(limit);
}

export async function getFailureHistory(queue?: string, limit = 50) {
  const where = queue ? eq(jobFailures.queue, queue) : undefined;
  return db.select().from(jobFailures).where(where).orderBy(desc(jobFailures.failedAt)).limit(limit);
}

export async function retryJob(jobId: number) {
  const [job] = await db.select({ status: jobQueue.status }).from(jobQueue).where(eq(jobQueue.id, jobId)).limit(1);
  if (!job || job.status !== "failed") throw new Error("Only failed jobs can be retried");
  await db.update(jobQueue).set({ status: "waiting", scheduledAt: new Date(), lastError: null }).where(eq(jobQueue.id, jobId));
}
