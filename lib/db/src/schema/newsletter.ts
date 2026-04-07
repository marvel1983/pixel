import {
  pgTable,
  serial,
  varchar,
  boolean,
  timestamp,
  text,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { integer } from "drizzle-orm/pg-core";

export const newsletterStatusEnum = pgEnum("newsletter_status", [
  "PENDING",
  "CONFIRMED",
  "UNSUBSCRIBED",
]);

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  status: newsletterStatusEnum("status").notNull().default("PENDING"),
  userId: integer("user_id").references(() => users.id),
  source: varchar("source", { length: 50 }).notNull().default("footer"),
  confirmToken: varchar("confirm_token", { length: 100 }),
  unsubToken: varchar("unsub_token", { length: 100 }),
  discountCode: varchar("discount_code", { length: 50 }),
  ipAddress: varchar("ip_address", { length: 45 }),
  confirmedAt: timestamp("confirmed_at"),
  unsubscribedAt: timestamp("unsubscribed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const newsletterSettings = pgTable("newsletter_settings", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(true),
  doubleOptIn: boolean("double_opt_in").notNull().default(true),
  exitIntentEnabled: boolean("exit_intent_enabled").notNull().default(true),
  exitIntentDiscount: integer("exit_intent_discount").notNull().default(10),
  exitIntentHeadline: text("exit_intent_headline").notNull().default("Wait! Get 10% off your first order"),
  exitIntentBody: text("exit_intent_body").notNull().default("Subscribe to our newsletter and receive an exclusive discount code."),
  welcomeSubject: text("welcome_subject").notNull().default("Welcome to PixelCodes!"),
  welcomeBody: text("welcome_body"),
  mailchimpApiKey: varchar("mailchimp_api_key", { length: 255 }),
  mailchimpListId: varchar("mailchimp_list_id", { length: 50 }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
export type NewsletterSettingsRow = typeof newsletterSettings.$inferSelect;
