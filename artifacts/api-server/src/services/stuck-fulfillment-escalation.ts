import { eq, and, isNotNull, isNull, lt, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { orders, orderItems, licenseKeys, siteSettings, auditLog } from "@workspace/db/schema";
import { enqueueEmail } from "../lib/email/queue";
import { notifySlack } from "../lib/slack-notify";
import { logger } from "../lib/logger";

const WARN_THRESHOLD_MINUTES = 30;
const CRITICAL_THRESHOLD_HOURS = 24;

interface StuckRow {
  id: number;
  orderNumber: string;
  externalOrderId: string | null;
  guestEmail: string | null;
  totalUsd: string;
  createdAt: Date;
  stuckAlertSentAt: Date | null;
}

/**
 * Finds PROCESSING orders that have been stuck without license keys past the
 * warning threshold and emails the admin once per order.
 *
 * Designed to run alongside `pollMetenziFulfillment` on the same cron tick.
 */
export async function escalateStuckFulfillments(): Promise<{
  scanned: number;
  warned: number;
  critical: number;
  errors: number;
}> {
  const warnCutoff = new Date(Date.now() - WARN_THRESHOLD_MINUTES * 60 * 1000);

  // Cheap pre-filter: PROCESSING + has a Metenzi order id + not yet alerted + old enough
  const candidates = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      externalOrderId: orders.externalOrderId,
      guestEmail: orders.guestEmail,
      totalUsd: orders.totalUsd,
      createdAt: orders.createdAt,
      stuckAlertSentAt: orders.stuckAlertSentAt,
    })
    .from(orders)
    .where(
      and(
        eq(orders.status, "PROCESSING"),
        isNotNull(orders.externalOrderId),
        isNull(orders.stuckAlertSentAt),
        lt(orders.createdAt, warnCutoff),
      ),
    )
    .limit(50);

  if (candidates.length === 0) return { scanned: 0, warned: 0, critical: 0, errors: 0 };

  // Batch-load delivered key counts so we can confirm the order really has zero keys
  const orderIds = candidates.map((c) => c.id);
  const itemRows = await db
    .select({ id: orderItems.id, orderId: orderItems.orderId })
    .from(orderItems)
    .where(inArray(orderItems.orderId, orderIds));
  const itemIdsByOrder: Record<number, number[]> = {};
  for (const r of itemRows) (itemIdsByOrder[r.orderId] ??= []).push(r.id);

  const allItemIds = itemRows.map((r) => r.id);
  const keyRows = allItemIds.length > 0
    ? await db
        .select({ orderItemId: licenseKeys.orderItemId })
        .from(licenseKeys)
        .where(inArray(licenseKeys.orderItemId, allItemIds))
    : [];
  const deliveredCountByItem: Record<number, number> = {};
  for (const r of keyRows) {
    if (r.orderItemId != null) deliveredCountByItem[r.orderItemId] = (deliveredCountByItem[r.orderItemId] ?? 0) + 1;
  }

  const truelyStuck = candidates.filter((c) => {
    const ids = itemIdsByOrder[c.id] ?? [];
    const delivered = ids.reduce((s, id) => s + (deliveredCountByItem[id] ?? 0), 0);
    return delivered === 0;
  });

  if (truelyStuck.length === 0) return { scanned: candidates.length, warned: 0, critical: 0, errors: 0 };

  const adminEmail = await getAdminAlertEmail();
  const criticalCutoff = new Date(Date.now() - CRITICAL_THRESHOLD_HOURS * 60 * 60 * 1000);

  let warned = 0;
  let critical = 0;
  let errors = 0;
  const now = new Date();

  for (const o of truelyStuck) {
    const isCritical = o.createdAt < criticalCutoff;
    try {
      const ageMinutes = Math.floor((now.getTime() - o.createdAt.getTime()) / 60000);
      if (adminEmail) {
        const subject = isCritical
          ? `[CRITICAL] Order ${o.orderNumber} stuck >24h without keys`
          : `[WARN] Order ${o.orderNumber} stuck without keys for ${ageMinutes}min`;
        await enqueueEmail(adminEmail, subject, renderAlertHtml(o, ageMinutes, isCritical), {
          type: "stuck_fulfillment_alert",
          orderId: o.id,
          severity: isCritical ? "critical" : "warn",
        });
      }
      // Fire-and-forget Slack alert (no-op when SLACK_WEBHOOK_URL is unset)
      notifySlack({
        text: `${isCritical ? ":rotating_light:" : ":warning:"} Order *${o.orderNumber}* stuck in PROCESSING for ${ageMinutes}m. Metenzi order: \`${o.externalOrderId ?? "—"}\`. Total: ${o.totalUsd}.`,
      }).catch((err) => logger.warn({ err, orderId: o.id }, "Slack notify threw (suppressed)"));

      await db.update(orders).set({ stuckAlertSentAt: now }).where(eq(orders.id, o.id));

      await db.insert(auditLog).values({
        action: "UPDATE",
        entityType: "order",
        entityId: o.id,
        details: {
          kind: "stuck_fulfillment_alert_sent",
          severity: isCritical ? "critical" : "warn",
          ageMinutes: Math.floor((now.getTime() - o.createdAt.getTime()) / 60000),
          metenziOrderId: o.externalOrderId,
          adminNotified: !!adminEmail,
        },
      }).catch((err) => logger.error({ err, orderId: o.id }, "Failed to write stuck-alert audit log"));

      if (isCritical) critical++; else warned++;
    } catch (err) {
      errors++;
      logger.error({ err, orderId: o.id }, "Stuck escalation: error processing order");
    }
  }

  if (warned > 0 || critical > 0) {
    logger.warn({ warned, critical, scanned: candidates.length, adminEmail: adminEmail ?? "none" }, "Stuck fulfillment escalation");
  }

  return { scanned: candidates.length, warned, critical, errors };
}

async function getAdminAlertEmail(): Promise<string | null> {
  const [row] = await db.select({ email: siteSettings.contactEmail }).from(siteSettings).limit(1);
  return row?.email ?? null;
}

function renderAlertHtml(o: StuckRow, ageMinutes: number, critical: boolean): string {
  const ageLabel = ageMinutes >= 60 ? `${(ageMinutes / 60).toFixed(1)} hours` : `${ageMinutes} minutes`;
  const banner = critical
    ? `<div style="background:#7f1d1d;color:#fff;padding:10px 14px;border-radius:4px;font-weight:bold;margin-bottom:14px;">CRITICAL: stuck for over ${CRITICAL_THRESHOLD_HOURS} hours — manual intervention needed</div>`
    : `<div style="background:#92400e;color:#fff;padding:10px 14px;border-radius:4px;font-weight:bold;margin-bottom:14px;">WARNING: stuck past ${WARN_THRESHOLD_MINUTES} min threshold</div>`;
  return `<div style="font-family:sans-serif;font-size:14px;line-height:1.5;color:#222;">
${banner}
<p>An order has been in <strong>PROCESSING</strong> status without any license keys delivered.</p>
<table style="border-collapse:collapse;margin:8px 0 14px 0;">
  <tr><td style="padding:4px 12px 4px 0;color:#555;">Order #</td><td style="padding:4px 0;font-family:monospace;"><strong>${o.orderNumber}</strong></td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#555;">Internal ID</td><td style="padding:4px 0;">${o.id}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#555;">Metenzi order</td><td style="padding:4px 0;font-family:monospace;">${o.externalOrderId ?? "—"}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#555;">Total</td><td style="padding:4px 0;">${o.totalUsd}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#555;">Customer</td><td style="padding:4px 0;">${o.guestEmail ?? "—"}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#555;">Stuck for</td><td style="padding:4px 0;"><strong>${ageLabel}</strong></td></tr>
</table>
<p>Open this order in admin to retry fulfillment, sync keys from Metenzi, or assign keys manually.</p>
<p style="color:#777;font-size:12px;margin-top:18px;">This alert is sent once per stuck order. Resolving the order will not re-trigger it.</p>
</div>`;
}
