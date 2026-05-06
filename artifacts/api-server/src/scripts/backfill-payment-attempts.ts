import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import { orders, paymentAttempts } from "@workspace/db/schema";
import { getActivePaymentConfig } from "../lib/payment-config";
import { createStripeClient } from "../lib/stripe-client";
import { recordPaymentAttempt, mapPaymentIntentStatus } from "../services/payment-attempts";

async function main(): Promise<void> {
  const payConfig = await getActivePaymentConfig();
  if (payConfig?.provider !== "stripe" || !payConfig.secretKey) {
    console.error("Stripe payment config not active. Aborting.");
    process.exit(1);
  }
  const stripe = createStripeClient(payConfig.secretKey);

  const orderedWithoutAttempts = await db.select({
    id: orders.id,
    orderNumber: orders.orderNumber,
    paymentIntentId: orders.paymentIntentId,
    paymentMethod: orders.paymentMethod,
    status: orders.status,
  })
    .from(orders)
    .where(and(
      inArray(orders.paymentMethod, ["CARD", "MIXED"]),
      sql`NOT EXISTS (SELECT 1 FROM ${paymentAttempts} WHERE ${paymentAttempts.orderId} = ${orders.id})`,
    ));

  console.log(`Found ${orderedWithoutAttempts.length} orders without payment attempts`);
  let ok = 0, skipped = 0, failed = 0;

  for (const o of orderedWithoutAttempts) {
    try {
      let pi: import("stripe").Stripe.PaymentIntent | null = null;
      if (o.paymentIntentId) {
        pi = await stripe.paymentIntents.retrieve(o.paymentIntentId, { expand: ["latest_charge"] });
      } else {
        const results = await stripe.paymentIntents.search({
          query: `metadata['orderNumber']:'${o.orderNumber}'`,
          expand: ["data.latest_charge"],
          limit: 1,
        });
        if (results.data.length > 0) pi = results.data[0];
      }
      if (!pi) { skipped++; continue; }

      const charge = typeof pi.latest_charge === "object" && pi.latest_charge
        ? pi.latest_charge as import("stripe").Stripe.Charge
        : null;

      await recordPaymentAttempt({
        orderId: o.id,
        status: "PROCESSING",
        paymentIntent: { ...pi, latest_charge: null },
        eventType: "payment_intent.created",
        rawEventId: `backfill:created:${pi.id}`,
        occurredAt: new Date(pi.created * 1000),
      });

      const finalOccurredAt = charge?.created
        ? new Date(charge.created * 1000)
        : new Date(pi.created * 1000 + 1000);

      await recordPaymentAttempt({
        orderId: o.id,
        status: mapPaymentIntentStatus(pi.status),
        paymentIntent: pi,
        charge,
        eventType: pi.status === "succeeded" ? "payment_intent.succeeded"
          : pi.status === "canceled" ? "payment_intent.canceled"
          : pi.status === "requires_payment_method" ? "payment_intent.payment_failed"
          : `payment_intent.${pi.status}`,
        rawEventId: `backfill:final:${pi.id}`,
        occurredAt: finalOccurredAt,
      });
      ok++;
      if (ok % 25 === 0) console.log(`Progress: ${ok} backfilled, ${skipped} skipped, ${failed} failed`);
    } catch (err) {
      failed++;
      console.error(`Failed to backfill order ${o.orderNumber}:`, (err as Error).message);
    }
    await new Promise((r) => setTimeout(r, 50));
  }

  console.log(`\nDone. Backfilled: ${ok}, Skipped (no Stripe match): ${skipped}, Failed: ${failed}`);
  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
