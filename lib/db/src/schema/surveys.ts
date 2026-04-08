import {
  pgTable, serial, varchar, text, integer, boolean, timestamp, jsonb,
} from "drizzle-orm/pg-core";
import { orders } from "./orders";
import { users } from "./users";

export const surveyResponses = pgTable("survey_responses", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id).notNull(),
  userId: integer("user_id").references(() => users.id),
  token: varchar("token", { length: 64 }).notNull().unique(),
  rating: integer("rating"),
  comment: text("comment"),
  submittedAt: timestamp("submitted_at"),
  emailSentAt: timestamp("email_sent_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const surveySettings = pgTable("survey_settings", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(true),
  delayDays: integer("delay_days").notNull().default(3),
  emailSubject: varchar("email_subject", { length: 200 }).notNull().default("How was your experience?"),
  emailBody: text("email_body"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type SurveyResponse = typeof surveyResponses.$inferSelect;
export type SurveySetting = typeof surveySettings.$inferSelect;
