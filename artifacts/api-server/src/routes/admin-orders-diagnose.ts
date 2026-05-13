import { Router } from "express";
import { db } from "@workspace/db";
import {
  orders,
  orderItems,
  licenseKeys,
  productVariants,
  products,
  metenziProductMappings,
  auditLog,
  jobQueue,
  jobFailures,
} from "@workspace/db/schema";
import { eq, inArray, desc, and, or, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { paramString } from "../lib/route-params";
import { getMetenziConfig } from "../lib/metenzi-config";
import { getOrderById, getProductById } from "../lib/metenzi-endpoints";
import { logger } from "../lib/logger";

const router = Router();

/**
 * Order fulfillment diagnostics. Returns everything needed to figure out
 * "why is this order stuck?":
 *   - Local DB state (order, items, license keys, mappings, stock cache)
 *   - Live Metenzi state (current order, current stock for the mapped product)
 *   - Recent audit log + job queue entries scoped to this order
 *
 * Read-only — calls Metenzi but never mutates.
 */
router.get(
  "/admin/orders/:id/diagnose",
  requireAuth, requireAdmin, requirePermission("manageOrders"),
  async (req, res) => {
    const id = Number(paramString(req.params, "id"));
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid order ID" });
      return;
    }

    try {
      // 1. Order
      const [order] = await db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          status: orders.status,
          externalOrderId: orders.externalOrderId,
          totalUsd: orders.totalUsd,
          currencyCode: orders.currencyCode,
          createdAt: orders.createdAt,
          updatedAt: orders.updatedAt,
          guestEmail: orders.guestEmail,
          userId: orders.userId,
        })
        .from(orders).where(eq(orders.id, id)).limit(1);
      if (!order) { res.status(404).json({ error: "Order not found" }); return; }

      // 2. Items + delivered keys + cached Pixel stock
      const items = await db
        .select({
          id: orderItems.id,
          productName: orderItems.productName,
          variantName: orderItems.variantName,
          quantity: orderItems.quantity,
          variantId: orderItems.variantId,
          productId: productVariants.productId,
          pixelProductSlug: products.slug,
          stockCount: productVariants.stockCount,
          backorderAllowed: productVariants.backorderAllowed,
        })
        .from(orderItems)
        .innerJoin(productVariants, eq(orderItems.variantId, productVariants.id))
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(eq(orderItems.orderId, id));

      const itemIds = items.map((it) => it.id);
      const keys = itemIds.length > 0
        ? await db.select({ id: licenseKeys.id, orderItemId: licenseKeys.orderItemId, keyMask: licenseKeys.keyMask, createdAt: licenseKeys.createdAt })
            .from(licenseKeys).where(inArray(licenseKeys.orderItemId, itemIds))
        : [];
      const deliveredByItem = new Map<number, typeof keys>();
      for (const k of keys) {
        const list = deliveredByItem.get(k.orderItemId!) ?? [];
        list.push(k);
        deliveredByItem.set(k.orderItemId!, list);
      }

      // 3. Metenzi mappings for the Pixel products in this order. We go the
      // other direction (pixel→metenzi) to make sure we cover every metenzi id
      // that could have keys for this order.
      const orderPixelIds = [...new Set(items.map((i) => i.productId))];
      const mappingsRaw = orderPixelIds.length > 0
        ? await db
            .select({
              id: metenziProductMappings.id,
              metenziProductId: metenziProductMappings.metenziProductId,
              metenziSku: metenziProductMappings.metenziSku,
              metenziName: metenziProductMappings.metenziName,
              pixelProductId: metenziProductMappings.pixelProductId,
              autoSyncStock: metenziProductMappings.autoSyncStock,
              disabled: metenziProductMappings.disabled,
              lastStockSyncAt: metenziProductMappings.lastStockSyncAt,
            })
            .from(metenziProductMappings)
            .where(inArray(metenziProductMappings.pixelProductId, orderPixelIds))
        : [];

      // Also pull *all* sibling mappings (any Pixel product) for those Metenzi
      // ids so the admin can see if this order's product is competing with
      // other Pixel products for the same key pool.
      const metenziIdsForOrder = [...new Set(mappingsRaw.map((m) => m.metenziProductId))];
      const allSiblingMappings = metenziIdsForOrder.length > 0
        ? await db
            .select({
              id: metenziProductMappings.id,
              metenziProductId: metenziProductMappings.metenziProductId,
              pixelProductId: metenziProductMappings.pixelProductId,
              pixelProductName: products.name,
              pixelProductSlug: products.slug,
              disabled: metenziProductMappings.disabled,
              autoSyncStock: metenziProductMappings.autoSyncStock,
            })
            .from(metenziProductMappings)
            .leftJoin(products, eq(metenziProductMappings.pixelProductId, products.id))
            .where(inArray(metenziProductMappings.metenziProductId, metenziIdsForOrder))
        : [];

      // 4. Live Metenzi state — current order and current product stocks.
      const config = await getMetenziConfig();
      let metenziOrder: { status: string | null; keyCount: number; keys: Array<{ productId: string | null; codeMasked: string }>; error: string | null } = {
        status: null, keyCount: 0, keys: [], error: null,
      };
      if (!config) {
        metenziOrder.error = "Metenzi not configured";
      } else if (!order.externalOrderId) {
        metenziOrder.error = "Order has no externalOrderId (never created at Metenzi)";
      } else {
        try {
          const live = await getOrderById(config, order.externalOrderId);
          if (!live) {
            metenziOrder.error = "Metenzi returned no order for this externalOrderId";
          } else {
            metenziOrder.status = live.status ?? null;
            const liveKeys = live.keys ?? [];
            metenziOrder.keyCount = liveKeys.length;
            metenziOrder.keys = liveKeys.map((k) => ({
              productId: k.productId ?? null,
              codeMasked: k.code ? (k.code.length <= 8 ? k.code.slice(0, 2) + "****" : k.code.slice(0, 4) + "****" + k.code.slice(-4)) : "(empty)",
            }));
          }
        } catch (err) {
          metenziOrder.error = (err as Error).message ?? "Metenzi API call failed";
        }
      }

      const metenziProductStocks: Array<{ metenziProductId: string; stock: number | null; status: string | null; error: string | null }> = [];
      if (config) {
        for (const mid of metenziIdsForOrder) {
          try {
            const mp = await getProductById(config, mid);
            metenziProductStocks.push({
              metenziProductId: mid,
              stock: mp?.stock ?? mp?.textKeyStock ?? null,
              status: mp?.status ?? null,
              error: mp ? null : "Metenzi returned no product",
            });
          } catch (err) {
            metenziProductStocks.push({
              metenziProductId: mid,
              stock: null,
              status: null,
              error: (err as Error).message ?? "fetch failed",
            });
          }
        }
      }

      // 5. Audit log entries for this order
      const recentAudit = await db
        .select({
          id: auditLog.id,
          action: auditLog.action,
          entityType: auditLog.entityType,
          entityId: auditLog.entityId,
          details: auditLog.details,
          createdAt: auditLog.createdAt,
        })
        .from(auditLog)
        .where(or(
          and(eq(auditLog.entityType, "order"), eq(auditLog.entityId, id)),
          sql`${auditLog.details}::text ILIKE ${'%"orderId":' + id + '%'}`,
        ))
        .orderBy(desc(auditLog.createdAt))
        .limit(30);

      // 6. Job queue entries for this order
      const recentJobs = await db
        .select({
          id: jobQueue.id,
          queue: jobQueue.queue,
          name: jobQueue.name,
          status: jobQueue.status,
          attempts: jobQueue.attempts,
          maxAttempts: jobQueue.maxAttempts,
          lastError: jobQueue.lastError,
          scheduledAt: jobQueue.scheduledAt,
          startedAt: jobQueue.startedAt,
          completedAt: jobQueue.completedAt,
          createdAt: jobQueue.createdAt,
          payload: jobQueue.payload,
        })
        .from(jobQueue)
        .where(sql`${jobQueue.payload}::text ILIKE ${'%"orderId":' + id + '%'}`)
        .orderBy(desc(jobQueue.createdAt))
        .limit(15);

      const recentJobFailures = await db
        .select({
          id: jobFailures.id,
          jobId: jobFailures.jobId,
          queue: jobFailures.queue,
          name: jobFailures.name,
          error: jobFailures.error,
          attempt: jobFailures.attempt,
          failedAt: jobFailures.failedAt,
          payload: jobFailures.payload,
        })
        .from(jobFailures)
        .where(sql`${jobFailures.payload}::text ILIKE ${'%"orderId":' + id + '%'}`)
        .orderBy(desc(jobFailures.failedAt))
        .limit(15);

      // Build summary verdict
      const totalExpected = items.reduce((s, it) => s + it.quantity, 0);
      const totalDelivered = keys.length;
      const verdict = (() => {
        if (totalDelivered >= totalExpected && totalExpected > 0) return { code: "fulfilled", msg: "All keys delivered." };
        if (!order.externalOrderId) return { code: "no_external_order", msg: "Order has no externalOrderId — never created at Metenzi." };
        if (metenziOrder.error) return { code: "metenzi_api_error", msg: `Metenzi API issue: ${metenziOrder.error}` };
        if (metenziOrder.keyCount === 0 && metenziProductStocks.some((p) => p.stock === 0)) return { code: "metenzi_out_of_stock", msg: "Metenzi has paid the order but their stock for the mapped product is 0 — they have no key to assign." };
        if (metenziOrder.keyCount === 0) return { code: "metenzi_no_keys_yet", msg: "Metenzi has accepted the order but hasn't assigned a key from their pool yet. Could be latency, or a Metenzi-side issue." };
        // Metenzi DID return keys but local has none — local pipeline issue
        return { code: "local_delivery_pipeline", msg: `Metenzi returned ${metenziOrder.keyCount} key(s) but local has 0 delivered. Either the webhook never fired, the mapping is wrong, or the keys never matched an order item.` };
      })();

      res.json({
        verdict,
        order,
        items: items.map((it) => ({
          ...it,
          delivered: deliveredByItem.get(it.id)?.length ?? 0,
          deliveredKeys: deliveredByItem.get(it.id)?.map((k) => ({ id: k.id, mask: k.keyMask, at: k.createdAt })) ?? [],
        })),
        mappings: mappingsRaw,
        siblingMappings: allSiblingMappings,
        metenziOrder,
        metenziProductStocks,
        recentAudit,
        recentJobs,
        recentJobFailures,
      });
    } catch (err) {
      logger.error({ err, orderId: id }, "Order diagnostics failed");
      res.status(500).json({ error: (err as Error).message ?? "Diagnostics failed" });
    }
  },
);

export default router;
