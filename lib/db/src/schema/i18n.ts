import {
  pgTable,
  serial,
  varchar,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const localeOverrides = pgTable("locale_overrides", {
  id: serial("id").primaryKey(),
  locale: varchar("locale", { length: 10 }).notNull(),
  namespace: varchar("namespace", { length: 50 }).notNull().default("common"),
  key: varchar("key", { length: 255 }).notNull(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const enabledLocales = pgTable("enabled_locales", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 10 }).notNull().unique(),
  name: varchar("name", { length: 50 }).notNull(),
  flag: varchar("flag", { length: 10 }).notNull(),
  enabled: boolean("enabled").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type LocaleOverride = typeof localeOverrides.$inferSelect;
export type EnabledLocale = typeof enabledLocales.$inferSelect;
