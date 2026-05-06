import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { paymentAttempts, orders, type InsertPaymentAttempt } from "@workspace/db/schema";
import { logger } from "../lib/logger";

type Stripe = typeof import("stripe");
type PaymentIntent = import("stripe").Stripe.PaymentIntent;
type Charge = import("stripe").Stripe.Charge;

type AttemptStatus = NonNullable<InsertPaymentAttempt["status"]>;

function mapPaymentIntentStatus(status: PaymentIntent["status"]): AttemptStatus {
  switch (status) {
    case "succeeded": return "SUCCEEDED";
    case "canceled": return "CANCELED";
    case "requires_action":
    case "requires_confirmation":
    case "requires_payment_method":
    case "requires_capture":
      return "REQUIRES_ACTION";
    case "processing": return "PROCESSING";
    default: return "FAILED";
  }
}

function mapChargeStatus(status: Charge["status"]): AttemptStatus {
  switch (status) {
    case "succeeded": return "SUCCEEDED";
    case "pending": return "PROCESSING";
    case "failed":
    default:
      return "FAILED";
  }
}

interface RecordOptions {
  orderId: number;
  status: AttemptStatus;
  paymentIntent?: PaymentIntent | null;
  charge?: Charge | null;
  eventType?: string;
  rawEventId?: string;
  rawPayload?: unknown;
  occurredAt?: Date;
}

export async function recordPaymentAttempt(opts: RecordOptions): Promise<void> {
  const { orderId, status, paymentIntent: pi, charge, eventType, rawEventId, rawPayload, occurredAt } = opts;

  const card = charge?.payment_method_details?.card;
  const outcome = charge?.outcome;
  const lastError = pi?.last_payment_error;

  const failureCode = charge?.failure_code ?? lastError?.code ?? null;
  const outcomeReasonValue = outcome?.reason ?? null;
  const looksLikeDeclineReason = outcomeReasonValue && outcome?.type !== "authorized" && outcome?.network_status !== "approved_by_network";
  const declineCode = lastError?.decline_code
    ?? (looksLikeDeclineReason ? outcomeReasonValue : null)
    ?? (charge as unknown as { outcome?: { network_decline_code?: string } })?.outcome?.network_decline_code
    ?? null;
  const failureMessage = charge?.failure_message ?? lastError?.message ?? null;

  const amount = pi?.amount ?? charge?.amount;
  const currency = pi?.currency ?? charge?.currency ?? null;

  const chargePaymentIntentId = typeof charge?.payment_intent === "string"
    ? charge.payment_intent
    : charge?.payment_intent?.id ?? null;

  const row: InsertPaymentAttempt = {
    orderId,
    provider: "stripe",
    paymentIntentId: pi?.id ?? chargePaymentIntentId,
    chargeId: charge?.id ?? null,
    status,
    amountUsd: amount != null ? (amount / 100).toFixed(2) : null,
    currency: currency ? currency.toUpperCase() : null,
    cardBrand: card?.brand ?? null,
    cardLast4: card?.last4 ?? null,
    cardExpMonth: card?.exp_month ?? null,
    cardExpYear: card?.exp_year ?? null,
    cardCountry: card?.country ?? null,
    cardFunding: card?.funding ?? null,
    failureCode,
    declineCode,
    failureMessage,
    outcomeNetworkStatus: outcome?.network_status ?? null,
    outcomeReason: outcome?.reason ?? null,
    outcomeRiskLevel: outcome?.risk_level ?? null,
    outcomeSellerMessage: outcome?.seller_message ?? null,
    threeDsResult: card?.three_d_secure?.result ?? null,
    threeDsAuthenticationFlow: (card?.three_d_secure as unknown as { authentication_flow?: string })?.authentication_flow ?? null,
    threeDsVersion: card?.three_d_secure?.version ?? null,
    eventType: eventType ?? null,
    rawEventId: rawEventId ?? null,
    rawPayload: (rawPayload ?? null) as InsertPaymentAttempt["rawPayload"],
    occurredAt: occurredAt ?? new Date(),
  };

  try {
    await db.insert(paymentAttempts).values(row).onConflictDoNothing({ target: paymentAttempts.rawEventId });
  } catch (err) {
    logger.error({ err, orderId, eventId: rawEventId }, "Failed to record payment attempt");
  }

  if (row.paymentIntentId) {
    await db.update(orders)
      .set({ paymentIntentId: row.paymentIntentId, updatedAt: new Date() })
      .where(eq(orders.id, orderId))
      .catch((err) => logger.warn({ err, orderId }, "Failed to cache paymentIntentId on order (non-fatal)"));
  }
}

export { mapPaymentIntentStatus, mapChargeStatus };
