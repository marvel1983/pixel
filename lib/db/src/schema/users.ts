import {
  pgTable,
  text,
  serial,
  integer,
  date,
  timestamp,
  varchar,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userRoleEnum = pgEnum("user_role", [
  "CUSTOMER",
  "ADMIN",
  "SUPER_ADMIN",
]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 50 }),
  passwordHash: text("password_hash").notNull(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  role: userRoleEnum("role").notNull().default("CUSTOMER"),
  avatarUrl: text("avatar_url"),
  googleId: varchar("google_id", { length: 255 }),
  isActive: boolean("is_active").notNull().default(true),
  emailVerified: boolean("email_verified").notNull().default(false),
  marketingConsent: boolean("marketing_consent").notNull().default(false),
  preferredLocale: varchar("preferred_locale", { length: 10 }),
  preferredTheme: varchar("preferred_theme", { length: 10 }),
  adminNotes: text("admin_notes"),
  isBusinessAccount: boolean("is_business_account").notNull().default(false),
  businessApproved: boolean("business_approved").notNull().default(false),
  companyName: varchar("company_name", { length: 255 }),
  lastLoginAt: timestamp("last_login_at"),
  dateOfBirth: date("date_of_birth"),
  referredByUserId: integer("referred_by_user_id"),
  /** Default billing address — used to pre-fill checkout */
  billingCountry: varchar("billing_country", { length: 3 }),
  billingCity: varchar("billing_city", { length: 120 }),
  billingAddress: varchar("billing_address", { length: 500 }),
  billingZip: varchar("billing_zip", { length: 32 }),
  billingVatNumber: varchar("billing_vat_number", { length: 50 }),
  billingPhone: varchar("billing_phone", { length: 40 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
