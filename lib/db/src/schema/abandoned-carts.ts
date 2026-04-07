import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  numeric,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const abandonedCartStatusEnum = pgEnum("abandoned_cart_status", [
  "ACTIVE",
  "RECOVERED",
  "EXPIRED",
  "UNSUBSCRIBED",
]);

export const abandonedCarts = pgTable("abandoned_carts", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  userId: integer("user_id").references(() => users.id),
  recoveryToken: varchar("recovery_token", { length: 64 }).notNull().unique(),
  status: abandonedCartStatusEnum("status").notNull().default("ACTIVE"),
  cartData: jsonb("cart_data").$type<CartSnapshot>().notNull(),
  cartTotal: numeric("cart_total", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  emailsSent: integer("emails_sent").notNull().default(0),
  lastEmailAt: timestamp("last_email_at"),
  recoveredAt: timestamp("recovered_at"),
  recoveredOrderId: integer("recovered_order_id"),
  couponCode: varchar("coupon_code", { length: 50 }),
  unsubscribedAt: timestamp("unsubscribed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const abandonedCartEmails = pgTable("abandoned_cart_emails", {
  id: serial("id").primaryKey(),
  abandonedCartId: integer("abandoned_cart_id")
    .notNull()
    .references(() => abandonedCarts.id),
  emailNumber: integer("email_number").notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
});

export const abandonedCartSettings = pgTable("abandoned_cart_settings", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  minCartValue: numeric("min_cart_value", { precision: 10, scale: 2 })
    .notNull()
    .default("5.00"),
  email1DelayMinutes: integer("email1_delay_minutes").notNull().default(60),
  email2DelayMinutes: integer("email2_delay_minutes").notNull().default(1440),
  email3DelayMinutes: integer("email3_delay_minutes").notNull().default(4320),
  discountPercent: integer("discount_percent").notNull().default(10),
  expirationDays: integer("expiration_days").notNull().default(7),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export interface CartSnapshotItem {
  variantId: number;
  productId: number;
  productName: string;
  variantName: string;
  quantity: number;
  priceUsd: string;
  imageUrl?: string;
}

export interface CartSnapshot {
  items: CartSnapshotItem[];
  coupon?: string;
}
