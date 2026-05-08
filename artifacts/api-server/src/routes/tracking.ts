import { Router } from "express";
import { z } from "zod";
import { TRACKING_EVENT_TYPES } from "@workspace/db/schema";
import { optionalAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { enqueueJob } from "../lib/job-queue";
import { logger } from "../lib/logger";

const router = Router();

const eventSchema = z.object({
  eventType: z.enum(TRACKING_EVENT_TYPES),
  occurredAt: z.string().datetime(),
  pagePath: z.string().max(2048).nullish(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
});

const cartItemSchema = z.object({
  variantId: z.number().int(),
  productId: z.number().int(),
  productName: z.string().max(300),
  variantName: z.string().max(200),
  quantity: z.number().int().min(0),
  priceUsd: z.string(),
  imageUrl: z.string().max(500).optional(),
});

const cartTotalsSchema = z.object({
  subtotalUsd: z.string(),
  discountUsd: z.string(),
  taxUsd: z.string(),
  totalUsd: z.string(),
  currency: z.string().min(2).max(8),
  couponCode: z.string().max(100).optional(),
});

const snapshotSchema = z.object({
  triggerEvent: z.string().max(50),
  capturedAt: z.string().datetime(),
  items: z.array(cartItemSchema).max(100),
  totals: cartTotalsSchema,
});

const sessionInitSchema = z.object({
  referrer: z.string().max(2048).nullish(),
  utmSource: z.string().max(100).nullish(),
  utmMedium: z.string().max(100).nullish(),
  utmCampaign: z.string().max(100).nullish(),
  deviceType: z.enum(["mobile", "desktop", "tablet"]).nullish(),
});

const trackBatchSchema = z.object({
  events: z.array(eventSchema).max(50),
  snapshots: z.array(snapshotSchema).max(20).optional(),
  sessionInit: sessionInitSchema.optional(),
});

const trackLimit = rateLimit({
  windowMs: 60_000,
  max: 120,
  name: "tracking:ingest",
  keyFn: (req) => req.sessionId ?? req.ip ?? "unknown",
});

router.post("/track", trackLimit, optionalAuth, async (req, res) => {
  const sessionId = req.sessionId;
  if (!sessionId) {
    res.status(400).json({ error: "Missing session id" });
    return;
  }

  const parsed = trackBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  const { events, snapshots, sessionInit } = parsed.data;
  if (events.length === 0 && (!snapshots || snapshots.length === 0)) {
    res.status(202).json({ accepted: 0 });
    return;
  }

  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.ip ||
    null;
  const userAgent = (req.headers["user-agent"] as string | undefined) ?? null;
  const userId = req.user?.userId ?? null;

  try {
    await enqueueJob({
      queue: "analytics",
      name: "ingest-events",
      payload: {
        sessionId,
        userId,
        ipAddress: ip,
        userAgent: userAgent ? userAgent.slice(0, 1000) : null,
        geoCountry: null,
        events,
        snapshots: snapshots ?? [],
        sessionInit: sessionInit ?? null,
      },
      maxAttempts: 2,
    });
    res.status(202).json({ accepted: events.length + (snapshots?.length ?? 0) });
  } catch (err) {
    logger.error({ err, sessionId }, "Failed to enqueue tracking batch");
    res.status(500).json({ error: "Ingest unavailable" });
  }
});

export default router;
