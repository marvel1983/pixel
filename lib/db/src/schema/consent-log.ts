import {
  pgTable,
  serial,
  varchar,
  boolean,
  timestamp,
  text,
  integer,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const consentLogs = pgTable("consent_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  ipHash: varchar("ip_hash", { length: 64 }),
  userAgent: text("user_agent"),
  necessary: boolean("necessary").notNull().default(true),
  analytics: boolean("analytics").notNull().default(false),
  marketing: boolean("marketing").notNull().default(false),
  preferences: boolean("preferences").notNull().default(false),
  consentAction: varchar("consent_action", { length: 30 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ConsentLog = typeof consentLogs.$inferSelect;
export type InsertConsentLog = typeof consentLogs.$inferInsert;
