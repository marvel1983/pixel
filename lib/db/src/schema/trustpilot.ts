import { pgTable, serial, varchar, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const trustpilotInvites = pgTable("trustpilot_invites", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  orderNumber: varchar("order_number", { length: 100 }).notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  sentAt: timestamp("sent_at"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  failed: boolean("failed").notNull().default(false),
  lastError: varchar("last_error", { length: 500 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
