import {
  pgTable,
  serial,
  integer,
  text,
  jsonb,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { products } from "./products";

/**
 * Cached, AI-generated unique copy for the programmatic /buy/:slug landing
 * pages. Generated once per product (not per request) so the pSEO pages stay
 * fast and the content is stable for crawlers. One row per product.
 *
 * Unique-content-per-page is the core of working programmatic SEO — Google
 * deindexes "scaled content abuse" (N identical templated pages), so each
 * product gets its own intro / value props / FAQ / activation steps.
 */
export const productSeoContent = pgTable(
  "product_seo_content",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    /** ~60-word intent-matching intro paragraph. */
    intro: text("intro").notNull(),
    /** 3–4 product-specific value props (rendered as bullets). */
    whyBuy: jsonb("why_buy").$type<string[]>().notNull().default([]),
    /** 4–5 Q&A pairs — also emitted as FAQPage JSON-LD. */
    faq: jsonb("faq").$type<{ q: string; a: string }[]>().notNull().default([]),
    /** Short numbered activation steps. */
    activationSteps: jsonb("activation_steps").$type<string[]>().notNull().default([]),
    generatedAt: timestamp("generated_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    productUnique: uniqueIndex("product_seo_content_product_id_uq").on(t.productId),
  }),
);

export type ProductSeoContent = typeof productSeoContent.$inferSelect;
export type InsertProductSeoContent = typeof productSeoContent.$inferInsert;
