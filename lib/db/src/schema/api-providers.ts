import {
  pgTable,
  serial,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const apiProviders = pgTable("api_providers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  baseUrl: text("base_url").notNull(),
  apiKeyEncrypted: text("api_key_encrypted"),
  hmacSecretEncrypted: text("hmac_secret_encrypted"),
  isActive: boolean("is_active").notNull().default(true),
  rateLimit: integer("rate_limit").default(60),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertApiProviderSchema = createInsertSchema(apiProviders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertApiProvider = z.infer<typeof insertApiProviderSchema>;
export type ApiProvider = typeof apiProviders.$inferSelect;
