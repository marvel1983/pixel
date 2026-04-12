import { Router } from "express";
import { db } from "@workspace/db";
import {
  socialProofEvents,
  siteSettings,
} from "@workspace/db/schema";
import { eq, and, gte, sql, desc } from "drizzle-orm";
import { paramString } from "../lib/route-params";

const router = Router();

const defaults = {
  viewersEnabled: true, viewersMin: 3, soldEnabled: true, soldMin: 5,
  toastEnabled: true, toastIntervalMin: 45, toastIntervalMax: 90, toastMaxPerSession: 3,
  stockUrgencyEnabled: true, stockLowThreshold: 10, stockCriticalThreshold: 3,
};

router.get("/social-proof/config", async (_req, res) => {
  const rows = await db.select().from(siteSettings).limit(1);
  const s = rows[0];
  if (!s) return res.json(defaults);
  res.json({
    viewersEnabled: s.spViewersEnabled ?? defaults.viewersEnabled,
    viewersMin: s.spViewersMin ?? defaults.viewersMin,
    soldEnabled: s.spSoldEnabled ?? defaults.soldEnabled,
    soldMin: s.spSoldMin ?? defaults.soldMin,
    toastEnabled: s.spToastEnabled ?? defaults.toastEnabled,
    toastIntervalMin: s.spToastIntervalMin ?? defaults.toastIntervalMin,
    toastIntervalMax: s.spToastIntervalMax ?? defaults.toastIntervalMax,
    toastMaxPerSession: s.spToastMaxPerSession ?? defaults.toastMaxPerSession,
    stockUrgencyEnabled: s.spStockUrgencyEnabled ?? defaults.stockUrgencyEnabled,
    stockLowThreshold: s.spStockLowThreshold ?? defaults.stockLowThreshold,
    stockCriticalThreshold: s.spStockCriticalThreshold ?? defaults.stockCriticalThreshold,
  });
});

router.post("/social-proof/view", async (req, res) => {
  const { productId, sessionId } = req.body;
  const pid = Number(productId);
  if (!pid || pid <= 0 || !Number.isInteger(pid)) return res.status(400).json({ error: "valid productId required" });
  const sid = typeof sessionId === "string" ? sessionId.slice(0, 100) : null;
  await db.insert(socialProofEvents).values({ productId: pid, eventType: "VIEW", sessionId: sid });
  res.json({ ok: true });
});

router.get("/social-proof/viewers/:productId", async (req, res) => {
  const productId = Number(paramString(req.params, "productId"));
  if (!productId || productId <= 0 || !Number.isInteger(productId)) return res.json({ viewers: 0 });
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const result = await db
    .select({ count: sql<number>`count(distinct ${socialProofEvents.sessionId})` })
    .from(socialProofEvents)
    .where(
      and(
        eq(socialProofEvents.productId, productId),
        eq(socialProofEvents.eventType, "VIEW"),
        gte(socialProofEvents.createdAt, fiveMinAgo)
      )
    );
  res.json({ viewers: Number(result[0]?.count ?? 0) });
});

router.get("/social-proof/sold/:productId", async (req, res) => {
  const productId = Number(paramString(req.params, "productId"));
  if (!productId || productId <= 0 || !Number.isInteger(productId)) return res.json({ sold: 0 });
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(socialProofEvents)
    .where(
      and(
        eq(socialProofEvents.productId, productId),
        eq(socialProofEvents.eventType, "PURCHASE"),
        gte(socialProofEvents.createdAt, oneDayAgo)
      )
    );
  res.json({ sold: Number(result[0]?.count ?? 0) });
});

router.get("/social-proof/recent-purchases", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 20);
  const recent = await db
    .select({
      productName: socialProofEvents.productName,
      productImageUrl: socialProofEvents.productImageUrl,
      customerName: socialProofEvents.customerName,
      customerCity: socialProofEvents.customerCity,
      createdAt: socialProofEvents.createdAt,
    })
    .from(socialProofEvents)
    .where(eq(socialProofEvents.eventType, "PURCHASE"))
    .orderBy(desc(socialProofEvents.createdAt))
    .limit(limit);
  res.json(recent);
});

export default router;
