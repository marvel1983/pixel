import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { trackingEvents, trackingSessions } from "@workspace/db/schema";
import { and, eq, gte, lte, inArray, countDistinct } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";

const router = Router();

const FUNNEL_STEPS = [
  { key: "landed", label: "Landed", eventType: "page_view" },
  { key: "added_to_cart", label: "Added to cart", eventType: "add_to_cart" },
  { key: "entered_checkout", label: "Entered checkout", eventType: "enter_checkout" },
  { key: "clicked_place_order", label: "Clicked Place Order", eventType: "place_order_clicked" },
  { key: "order_created", label: "Order created", eventType: "order_created" },
] as const;

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  device: z.enum(["mobile", "desktop", "tablet"]).optional(),
  country: z.string().regex(/^[A-Z]{2}$/i).optional(),
});

router.get(
  "/admin/analytics/funnel",
  requireAuth,
  requireAdmin,
  requirePermission("manageOrders"),
  async (req, res) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query parameters" });
      return;
    }

    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 30 * 86400_000);
    const fromDate = parsed.data.from ? new Date(parsed.data.from + "T00:00:00Z") : defaultFrom;
    const toDate = parsed.data.to ? new Date(parsed.data.to + "T23:59:59.999Z") : now;
    const deviceFilter = parsed.data.device ?? null;
    const countryFilter = parsed.data.country?.toUpperCase() ?? null;

    const stepEventTypes = FUNNEL_STEPS.map((s) => s.eventType);

    const conditions = [
      inArray(trackingEvents.eventType, stepEventTypes),
      gte(trackingEvents.occurredAt, fromDate),
      lte(trackingEvents.occurredAt, toDate),
    ];
    if (deviceFilter) conditions.push(eq(trackingSessions.deviceType, deviceFilter));
    if (countryFilter) conditions.push(eq(trackingSessions.geoCountry, countryFilter));

    const rows = await db
      .select({
        eventType: trackingEvents.eventType,
        sessions: countDistinct(trackingEvents.sessionId),
      })
      .from(trackingEvents)
      .innerJoin(trackingSessions, eq(trackingSessions.id, trackingEvents.sessionId))
      .where(and(...conditions))
      .groupBy(trackingEvents.eventType);

    const byType = new Map(rows.map((r) => [r.eventType, Number(r.sessions)]));

    const startCount = byType.get(FUNNEL_STEPS[0].eventType) ?? 0;
    const steps = FUNNEL_STEPS.map((step, idx) => {
      const sessions = byType.get(step.eventType) ?? 0;
      const prevSessions = idx === 0 ? sessions : (byType.get(FUNNEL_STEPS[idx - 1].eventType) ?? 0);
      const stepConversion = prevSessions > 0 ? sessions / prevSessions : 0;
      const startConversion = startCount > 0 ? sessions / startCount : 0;
      return {
        key: step.key,
        label: step.label,
        sessions,
        stepConversionPct: Math.round(stepConversion * 1000) / 10,
        startConversionPct: Math.round(startConversion * 1000) / 10,
      };
    });

    res.json({
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      filters: { device: deviceFilter, country: countryFilter },
      steps,
    });
  },
);

export default router;
