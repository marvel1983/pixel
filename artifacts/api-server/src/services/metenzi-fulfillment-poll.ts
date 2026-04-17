import { eq, and, isNotNull, lt } from "drizzle-orm";
import { db } from "@workspace/db";
import { orders } from "@workspace/db/schema";
import { getMetenziConfig } from "../lib/metenzi-config";
import { getOrderById } from "../lib/metenzi-endpoints";
import { handleWebhookEvent } from "./webhook-handlers";
import { logger } from "../lib/logger";

// Metenzi order statuses that mean "fulfilled with keys assigned"
const FULFILLED_STATUSES = new Set(["paid", "fulfilled", "completed"]);

/**
 * Polls Metenzi for any PROCESSING orders that haven't received keys yet.
 * Runs every 10 minutes as fallback when webhooks are unavailable.
 */
export async function pollMetenziFulfillment(): Promise<{ checked: number; fulfilled: number; errors: number }> {
  const config = await getMetenziConfig();
  if (!config) return { checked: 0, fulfilled: 0, errors: 0 };

  // Only check orders older than 2 minutes (give webhook a chance first)
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

  const pending = await db
    .select({ id: orders.id, externalOrderId: orders.externalOrderId })
    .from(orders)
    .where(
      and(
        eq(orders.status, "PROCESSING"),
        isNotNull(orders.externalOrderId),
        lt(orders.updatedAt, twoMinutesAgo),
      ),
    )
    .limit(20);

  if (pending.length === 0) return { checked: 0, fulfilled: 0, errors: 0 };

  let fulfilled = 0;
  let errors = 0;

  for (const order of pending) {
    if (!order.externalOrderId) continue;
    try {
      const metenziOrder = await getOrderById(config, order.externalOrderId);
      if (!metenziOrder) continue;

      const isFulfilled = FULFILLED_STATUSES.has(metenziOrder.status?.toLowerCase() ?? "");
      const hasKeys = (metenziOrder.keys?.length ?? 0) > 0;

      if (isFulfilled && hasKeys) {
        logger.info({ orderId: order.id, metenziOrderId: metenziOrder.id, status: metenziOrder.status }, "Metenzi poll: delivering keys for fulfilled order");
        await handleWebhookEvent("order.fulfilled", {
          id: metenziOrder.id,
          keys: metenziOrder.keys,
        });
        fulfilled++;
      }
    } catch (err) {
      errors++;
      logger.error({ err, orderId: order.id, externalOrderId: order.externalOrderId }, "Metenzi poll: error checking order");
    }
  }

  return { checked: pending.length, fulfilled, errors };
}
