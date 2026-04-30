import { eq, inArray, and, asc } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  orders, orderItems, licenseKeys, auditLog, metenziWebhookEvents,
} from "@workspace/db/schema";

export type TimelineKind =
  | "order"
  | "payment"
  | "metenzi"
  | "webhook"
  | "key"
  | "alert"
  | "manual";

export interface TimelineEntry {
  event: string;
  date: string; // ISO
  kind: TimelineKind;
  details?: Record<string, unknown>;
}

/**
 * Builds a unified, time-sorted activity log for an order by merging:
 *   - the order's own lifecycle markers (created, payment, sent to supplier, completed)
 *   - audit_log rows scoped to this order
 *   - metenzi_webhook_events rows
 *   - license_keys soldAt timestamps
 */
export async function buildOrderTimeline(orderId: number): Promise<TimelineEntry[]> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return [];

  const itemRows = await db.select({ id: orderItems.id })
    .from(orderItems).where(eq(orderItems.orderId, orderId));
  const itemIds = itemRows.map((r) => r.id);

  const [auditRows, webhookRows, keyRows] = await Promise.all([
    db.select({
      id: auditLog.id, action: auditLog.action, details: auditLog.details, createdAt: auditLog.createdAt,
    }).from(auditLog).where(and(eq(auditLog.entityType, "order"), eq(auditLog.entityId, orderId))).orderBy(asc(auditLog.createdAt)),
    db.select({
      id: metenziWebhookEvents.id, eventType: metenziWebhookEvents.eventType,
      receivedAt: metenziWebhookEvents.receivedAt, processedAt: metenziWebhookEvents.processedAt,
      success: metenziWebhookEvents.success, outcomeNote: metenziWebhookEvents.outcomeNote,
      errorMsg: metenziWebhookEvents.errorMsg,
    }).from(metenziWebhookEvents).where(eq(metenziWebhookEvents.relatedOrderId, orderId)).orderBy(asc(metenziWebhookEvents.receivedAt)),
    itemIds.length > 0
      ? db.select({
          id: licenseKeys.id, source: licenseKeys.source, soldAt: licenseKeys.soldAt, keyMask: licenseKeys.keyMask,
        }).from(licenseKeys).where(inArray(licenseKeys.orderItemId, itemIds))
      : Promise.resolve([] as { id: number; source: string; soldAt: Date | null; keyMask: string | null }[]),
  ]);

  const out: TimelineEntry[] = [];

  out.push({ event: "Order created", date: order.createdAt.toISOString(), kind: "order" });

  if (order.paymentIntentId) {
    out.push({
      event: "Payment processed",
      date: order.updatedAt.toISOString(),
      kind: "payment",
      details: { paymentIntentId: order.paymentIntentId, method: order.paymentMethod },
    });
  }
  if (order.externalOrderId) {
    out.push({
      event: "Sent to Metenzi",
      date: order.updatedAt.toISOString(),
      kind: "metenzi",
      details: { metenziOrderId: order.externalOrderId },
    });
  }

  for (const w of webhookRows) {
    const status = w.processedAt == null ? "pending" : w.success ? "ok" : "error";
    out.push({
      event: `Webhook: ${w.eventType} (${status})`,
      date: w.receivedAt.toISOString(),
      kind: "webhook",
      details: {
        webhookId: w.id, outcomeNote: w.outcomeNote ?? undefined,
        error: w.errorMsg ?? undefined,
      },
    });
  }

  for (const k of keyRows) {
    if (!k.soldAt) continue;
    out.push({
      event: `Key delivered (${k.source})`,
      date: k.soldAt.toISOString(),
      kind: "key",
      details: { keyMask: k.keyMask ?? undefined },
    });
  }

  for (const a of auditRows) {
    const detailKind = (a.details as { kind?: string } | null)?.kind;
    if (detailKind === "manual_keys_assigned") {
      out.push({
        event: `Admin manually assigned ${(a.details as { keysAdded?: number } | null)?.keysAdded ?? "?"} key(s)`,
        date: a.createdAt.toISOString(), kind: "manual", details: a.details ?? {},
      });
    } else if (detailKind === "stuck_fulfillment_alert_sent") {
      const sev = (a.details as { severity?: string } | null)?.severity ?? "warn";
      out.push({
        event: `Stuck-fulfillment alert (${sev})`,
        date: a.createdAt.toISOString(), kind: "alert", details: a.details ?? {},
      });
    } else if (detailKind || (a.details as { webhookEvent?: string } | null)?.webhookEvent) {
      // Skip: covered by other rows above
    } else {
      out.push({
        event: `Audit ${a.action.toLowerCase()}`,
        date: a.createdAt.toISOString(), kind: "order", details: a.details ?? {},
      });
    }
  }

  if (order.status === "COMPLETED") {
    out.push({ event: "Order completed", date: order.updatedAt.toISOString(), kind: "order" });
  } else if (order.status === "REFUNDED") {
    out.push({ event: "Order refunded", date: order.updatedAt.toISOString(), kind: "order" });
  } else if (order.status === "FAILED") {
    out.push({ event: "Order failed", date: order.updatedAt.toISOString(), kind: "order" });
  }

  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}
