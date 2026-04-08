import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";

export const healthIncidents = pgTable(
  "health_incidents",
  {
    id: serial("id").primaryKey(),
    service: varchar("service", { length: 50 }).notNull(),
    status: varchar("status", { length: 10 }).notNull(),
    latencyMs: integer("latency_ms"),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_health_incidents_service").on(t.service),
    index("idx_health_incidents_created").on(t.createdAt),
  ],
);
