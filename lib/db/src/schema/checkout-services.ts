import {
  pgTable,
  serial,
  varchar,
  text,
  numeric,
  boolean,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { orders } from "./orders";

export const checkoutServices = pgTable("checkout_services", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description").notNull(),
  shortDescription: varchar("short_description", { length: 200 }).notNull(),
  priceUsd: numeric("price_usd", { precision: 10, scale: 2 }).notNull(),
  icon: varchar("icon", { length: 50 }).notNull().default("shield"),
  enabled: boolean("enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const orderServices = pgTable("order_services", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  serviceId: integer("service_id")
    .notNull()
    .references(() => checkoutServices.id),
  serviceName: varchar("service_name", { length: 100 }).notNull(),
  priceUsd: numeric("price_usd", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type CheckoutService = typeof checkoutServices.$inferSelect;
export type OrderService = typeof orderServices.$inferSelect;
