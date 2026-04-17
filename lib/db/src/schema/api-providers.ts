import {
  pgTable,
  serial,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
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
  webhookSecretEncrypted: text("webhook_secret_encrypted"),
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

export const apiCredentials = pgTable("api_credentials", {
  id: serial("id").primaryKey(),
  provider: varchar("provider", { length: 100 }).notNull().unique(),
  publicKeyEncrypted: text("public_key_encrypted"),
  secretKeyEncrypted: text("secret_key_encrypted"),
  extra: jsonb("extra").$type<Record<string, string>>().default({}),
  isActive: boolean("is_active").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type InsertApiProvider = z.infer<typeof insertApiProviderSchema>;
export type ApiProvider = typeof apiProviders.$inferSelect;
export type ApiCredential = typeof apiCredentials.$inferSelect;
