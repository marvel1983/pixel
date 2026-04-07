import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  pgEnum,
  boolean,
} from "drizzle-orm/pg-core";
import { products } from "./products";

export const qaStatusEnum = pgEnum("qa_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

export const productQuestions = pgTable("product_questions", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  userId: integer("user_id"),
  askerName: varchar("asker_name", { length: 100 }).notNull(),
  askerEmail: varchar("asker_email", { length: 320 }).notNull(),
  questionText: text("question_text").notNull(),
  status: qaStatusEnum("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const productAnswers = pgTable("product_answers", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id")
    .notNull()
    .references(() => productQuestions.id, { onDelete: "cascade" }),
  answerText: text("answer_text").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  authorName: varchar("author_name", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
