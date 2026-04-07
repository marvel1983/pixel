import {
  pgTable,
  serial,
  integer,
  varchar,
  timestamp,
  numeric,
  pgEnum,
  boolean,
} from "drizzle-orm/pg-core";
import { products } from "./products";
import { productVariants } from "./products";

export const alertTypeEnum = pgEnum("alert_type", [
  "PRICE_DROP",
  "BACK_IN_STOCK",
]);

export const productAlerts = pgTable("product_alerts", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  userId: integer("user_id"),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  variantId: integer("variant_id")
    .references(() => productVariants.id, { onDelete: "cascade" }),
  alertType: alertTypeEnum("alert_type").notNull(),
  targetPriceUsd: numeric("target_price_usd", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  notifiedAt: timestamp("notified_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const alertNotifications = pgTable("alert_notifications", {
  id: serial("id").primaryKey(),
  alertId: integer("alert_id")
    .notNull()
    .references(() => productAlerts.id, { onDelete: "cascade" }),
  alertType: alertTypeEnum("alert_type").notNull(),
  emailSentAt: timestamp("email_sent_at").notNull().defaultNow(),
  oldPriceUsd: numeric("old_price_usd", { precision: 10, scale: 2 }),
  newPriceUsd: numeric("new_price_usd", { precision: 10, scale: 2 }),
  newStockCount: integer("new_stock_count"),
});
