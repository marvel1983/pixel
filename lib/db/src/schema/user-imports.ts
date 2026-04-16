import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userImportJobs = pgTable(
  "user_import_jobs",
  {
    id: serial("id").primaryKey(),
    /** Filename of the uploaded CSV */
    filename: varchar("filename", { length: 255 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    /** JSON mapping of csv column → user field */
    columnMapping: jsonb("column_mapping").$type<Record<string, string>>().default({}),
    /** "skip" | "update" | "error" */
    duplicatePolicy: varchar("duplicate_policy", { length: 20 }).notNull().default("skip"),
    totalRows: integer("total_rows").notNull().default(0),
    processedRows: integer("processed_rows").notNull().default(0),
    successCount: integer("success_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    skippedCount: integer("skipped_count").notNull().default(0),
    /** job_queue id for the background processor */
    jobQueueId: integer("job_queue_id"),
    /** CSV content stored temporarily until job runs (cleared after completion) */
    csvContent: text("csv_content"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: integer("created_by"),
  },
  (t) => [
    index("idx_user_import_jobs_status").on(t.status),
    index("idx_user_import_jobs_created").on(t.createdAt),
  ],
);

export const userImportErrors = pgTable(
  "user_import_errors",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id").notNull(),
    rowNumber: integer("row_number").notNull(),
    errorCode: varchar("error_code", { length: 50 }).notNull(),
    errorMessage: text("error_message").notNull(),
    rawData: jsonb("raw_data").$type<Record<string, string>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_user_import_errors_job").on(t.jobId)],
);

export const insertUserImportJobSchema = createInsertSchema(userImportJobs).omit({
  id: true,
  processedRows: true,
  successCount: true,
  errorCount: true,
  skippedCount: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
});

export type UserImportJob = typeof userImportJobs.$inferSelect;
export type UserImportError = typeof userImportErrors.$inferSelect;
export type InsertUserImportJob = z.infer<typeof insertUserImportJobSchema>;
