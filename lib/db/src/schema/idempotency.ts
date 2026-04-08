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

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: serial("id").primaryKey(),
    key: varchar("key", { length: 64 }).notNull().unique(),
    requestHash: varchar("request_hash", { length: 64 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("PROCESSING"),
    responseCode: integer("response_code"),
    responseBody: jsonb("response_body").$type<Record<string, unknown>>(),
    route: varchar("route", { length: 100 }).notNull(),
    userId: integer("user_id"),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_idempotency_key").on(t.key),
    index("idx_idempotency_expires").on(t.expiresAt),
  ],
);
