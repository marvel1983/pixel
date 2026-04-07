import {
  pgTable,
  serial,
  varchar,
  integer,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";

export const socialProofEventTypeEnum = pgEnum("social_proof_event_type", [
  "VIEW",
  "PURCHASE",
]);

export const socialProofEvents = pgTable("social_proof_events", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  eventType: socialProofEventTypeEnum("event_type").notNull(),
  sessionId: varchar("session_id", { length: 100 }),
  customerName: varchar("customer_name", { length: 100 }),
  customerCity: varchar("customer_city", { length: 100 }),
  productName: varchar("product_name", { length: 300 }),
  productImageUrl: varchar("product_image_url", { length: 500 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("sp_events_product_type_created").on(table.productId, table.eventType, table.createdAt),
  index("sp_events_type_created").on(table.eventType, table.createdAt),
]);
