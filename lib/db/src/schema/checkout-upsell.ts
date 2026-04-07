import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { products } from "./products";

export const checkoutUpsell = pgTable("checkout_upsell", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .references(() => products.id)
    .notNull(),
  isActive: boolean("is_active").notNull().default(true),
  displayPrice: numeric("display_price", { precision: 10, scale: 2 }),
  strikethroughPrice: numeric("strikethrough_price", { precision: 10, scale: 2 }),
  urgencyMessage: varchar("urgency_message", { length: 200 }),
  checkboxLabel: varchar("checkbox_label", { length: 200 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type CheckoutUpsell = typeof checkoutUpsell.$inferSelect;
