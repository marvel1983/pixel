import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  timestamp,
  numeric,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";
import { productVariants } from "./products";
import { coupons } from "./coupons";

export const orderStatusEnum = pgEnum("order_status", [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "CARD",
  "WALLET",
  "MIXED",
]);

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: varchar("order_number", { length: 50 }).notNull().unique(),
  userId: integer("user_id").references(() => users.id),
  guestEmail: varchar("guest_email", { length: 255 }),
  status: orderStatusEnum("status").notNull().default("PENDING"),
  paymentMethod: paymentMethodEnum("payment_method"),
  subtotalUsd: numeric("subtotal_usd", { precision: 10, scale: 2 }).notNull(),
  discountUsd: numeric("discount_usd", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  totalUsd: numeric("total_usd", { precision: 10, scale: 2 }).notNull(),
  walletAmountUsed: numeric("wallet_amount_used", {
    precision: 10,
    scale: 2,
  }).default("0"),
  currencyCode: varchar("currency_code", { length: 3 })
    .notNull()
    .default("USD"),
  currencyRate: numeric("currency_rate", { precision: 12, scale: 6 })
    .notNull()
    .default("1"),
  couponId: integer("coupon_id").references(() => coupons.id),
  paymentIntentId: varchar("payment_intent_id", { length: 255 }),
  externalOrderId: varchar("external_order_id", { length: 255 }),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  variantId: integer("variant_id")
    .notNull()
    .references(() => productVariants.id),
  productName: varchar("product_name", { length: 300 }).notNull(),
  variantName: varchar("variant_name", { length: 200 }).notNull(),
  priceUsd: numeric("price_usd", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
  createdAt: true,
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;
