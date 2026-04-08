import { db } from "@workspace/db";
import { jobQueue, jobFailures } from "@workspace/db/schema";
import { eq, and, lte, sql, desc, count } from "drizzle-orm";
import { logger } from "./logger";

export type QueueName = "email" | "product-sync" | "order-processing" | "abandoned-cart" | "alerts" | "reports";
export type Priority = 0 | 1 | 2 | 3;

const PRIORITY_LABELS: Record<number, string> = { 0: "low", 1: "normal", 2: "high", 3: "critical" };

export interface EnqueueOptions {
  queue: QueueName;
  name: string;
  payload?: Record<string, unknown>;
  priority?: Priority;
  maxAttempts?: number;
  scheduledAt?: Date;
}

export async function enqueueJob(opts: EnqueueOptions) {
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

export async function enqueueRecurring(opts: EnqueueOptions & { intervalMs: number }) {
  const existing = await db.select({ id: jobQueue.id }).from(jobQueue)
    .where(and(
      eq(jobQueue.queue, opts.queue),
      eq(jobQueue.name, opts.name),
      eq(jobQueue.status, "waiting"),
    )).limit(1);
  if (existing.length > 0) return null;
  return enqueueJob(opts);
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

async function claimJob() {
  const now = new Date();
  const rows = await db.execute(sql`
    UPDATE job_queue SET status = 'active', started_at = NOW(), attempts = attempts + 1
    WHERE id = (
      SELECT id FROM job_queue
      WHERE status = 'waiting' AND scheduled_at <= ${now}
      ORDER BY priority DESC, scheduled_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `);
  return (rows as any).rows?.[0] ?? (rows as any)[0] ?? null;
}

function backoffMs(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt), 300_000);
}

async function processJob(row: any) {
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
      jobId: row.id,
      queue: row.queue,
      name: row.name,
      payload: row.payload ?? {},
      error: errorMsg,
      attempt: row.attempts,
    });
    if (row.attempts >= (row.max_attempts ?? 3)) {
      await db.update(jobQueue).set({ status: "failed", lastError: errorMsg, completedAt: new Date() }).where(eq(jobQueue.id, row.id));
      logger.error({ jobId: row.id, error: errorMsg }, "Job permanently failed");
    } else {
      const retryAt = new Date(Date.now() + backoffMs(row.attempts));
      await db.update(jobQueue).set({ status: "waiting", lastError: errorMsg, scheduledAt: retryAt }).where(eq(jobQueue.id, row.id));
      logger.warn({ jobId: row.id, retryAt, attempt: row.attempts }, "Job failed, scheduling retry");
    }
  }
}

let polling = false;
let pollTimer: ReturnType<typeof setTimeout> | null = null;

export function startJobProcessor(intervalMs = 2000) {
  if (polling) return;
  polling = true;
  logger.info("Job queue processor started");
  async function tick() {
    if (!polling) return;
    try {
      const job = await claimJob();
      if (job) {
        await processJob(job);
        if (polling) { pollTimer = setTimeout(tick, 100); return; }
      }
    } catch (err) {
      logger.error({ err }, "Job processor error");
    }
    if (polling) pollTimer = setTimeout(tick, intervalMs);
  }
  tick();
}

export function stopJobProcessor() {
  polling = false;
  if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
  logger.info("Job queue processor stopped");
}

export async function getQueueStats() {
  const rows = await db.select({
    queue: jobQueue.queue,
    status: jobQueue.status,
    cnt: count(),
  }).from(jobQueue).groupBy(jobQueue.queue, jobQueue.status);

  const queues: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    if (!queues[r.queue]) queues[r.queue] = { waiting: 0, active: 0, completed: 0, failed: 0 };
    queues[r.queue][r.status] = Number(r.cnt);
  }
  return queues;
}

export async function getFailedJobs(queue?: string, limit = 50) {
  const q = db.select().from(jobFailures).orderBy(desc(jobFailures.failedAt)).limit(limit);
  if (queue) return q.where(eq(jobFailures.queue, queue));
  return q;
}

export async function retryJob(jobId: number) {
  await db.update(jobQueue).set({ status: "waiting", scheduledAt: new Date(), lastError: null }).where(eq(jobQueue.id, jobId));
}

export { PRIORITY_LABELS };
