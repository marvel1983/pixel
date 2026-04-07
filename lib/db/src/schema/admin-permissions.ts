import { pgTable, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const adminPermissions = pgTable("admin_permissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id).unique(),
  manageProducts: boolean("manage_products").notNull().default(true),
  manageOrders: boolean("manage_orders").notNull().default(true),
  manageCustomers: boolean("manage_customers").notNull().default(false),
  manageDiscounts: boolean("manage_discounts").notNull().default(true),
  manageContent: boolean("manage_content").notNull().default(false),
  manageSettings: boolean("manage_settings").notNull().default(false),
  manageAdmins: boolean("manage_admins").notNull().default(false),
  viewAnalytics: boolean("view_analytics").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AdminPermission = typeof adminPermissions.$inferSelect;
