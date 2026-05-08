import {
  pgTable,
  varchar,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";

export const trackingSessions = pgTable("tracking_sessions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  geoCountry: varchar("geo_country", { length: 2 }),
  deviceType: varchar("device_type", { length: 20 }),
  referrer: text("referrer"),
  utmSource: varchar("utm_source", { length: 100 }),
  utmMedium: varchar("utm_medium", { length: 100 }),
  utmCampaign: varchar("utm_campaign", { length: 100 }),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
}, (t) => ({
  userIdx: index("tracking_sessions_user_idx").on(t.userId),
  lastSeenIdx: index("tracking_sessions_last_seen_idx").on(t.lastSeenAt),
}));

export const insertTrackingSessionSchema = createInsertSchema(trackingSessions).omit({
  startedAt: true,
  lastSeenAt: true,
});

export type InsertTrackingSession = z.infer<typeof insertTrackingSessionSchema>;
export type TrackingSession = typeof trackingSessions.$inferSelect;
