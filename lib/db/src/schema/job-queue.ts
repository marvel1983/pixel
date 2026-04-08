import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const jobQueue = pgTable(
  "job_queue",
  {
    id: serial("id").primaryKey(),
    queue: varchar("queue", { length: 50 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
    priority: integer("priority").notNull().default(0),
    status: varchar("status", { length: 20 }).notNull().default("waiting"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    lastError: text("last_error"),
    scheduledAt: timestamp("scheduled_at").notNull().defaultNow(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_job_queue_status_scheduled").on(t.status, t.scheduledAt),
    index("idx_job_queue_queue").on(t.queue),
  ],
);

export const jobFailures = pgTable("job_failures", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(),
  queue: varchar("queue", { length: 50 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
  error: text("error").notNull(),
  attempt: integer("attempt").notNull(),
  failedAt: timestamp("failed_at").notNull().defaultNow(),
});

export const insertJobSchema = createInsertSchema(jobQueue).omit({
  id: true,
  status: true,
  attempts: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
});

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobQueue.$inferSelect;
export type JobFailure = typeof jobFailures.$inferSelect;
