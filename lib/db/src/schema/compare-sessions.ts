import {
  pgTable,
  serial,
  integer,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";
import { products } from "./products";

export const compareSessions = pgTable("compare_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  sessionToken: varchar("session_token", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
});

export const compareSessionItems = pgTable("compare_session_items", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => compareSessions.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  addedAt: timestamp("added_at").notNull().defaultNow(),
});

export const insertCompareSessionSchema = createInsertSchema(
  compareSessions,
).omit({
  id: true,
  createdAt: true,
});

export const insertCompareSessionItemSchema = createInsertSchema(
  compareSessionItems,
).omit({
  id: true,
  addedAt: true,
});

export type InsertCompareSession = z.infer<typeof insertCompareSessionSchema>;
export type CompareSession = typeof compareSessions.$inferSelect;
export type InsertCompareSessionItem = z.infer<
  typeof insertCompareSessionItemSchema
>;
export type CompareSessionItem = typeof compareSessionItems.$inferSelect;
