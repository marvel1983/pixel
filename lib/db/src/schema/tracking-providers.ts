import { pgTable, serial, varchar, boolean, timestamp } from "drizzle-orm/pg-core";

export const TRACKING_PROVIDER_TYPES = ["GA4", "META_PIXEL", "GTM", "CLARITY", "TIKTOK"] as const;
export type TrackingProviderType = (typeof TRACKING_PROVIDER_TYPES)[number];

export const trackingProviders = pgTable("tracking_providers", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 50 }).notNull().unique(),
  trackingId: varchar("tracking_id", { length: 200 }).notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
