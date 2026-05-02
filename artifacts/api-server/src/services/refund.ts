import type Stripe from "stripe";
import { logger } from "../lib/logger";
import { stripeCircuit } from "../lib/circuit-instances";
import { getActivePaymentConfig } from "../lib/payment-config";
import { createStripeClient } from "../lib/stripe-client";

export interface RefundRequest {
  paymentIntentId: string;
  amountMinor: number;
  reason: string;
  internalRefundId: number;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  error?: string;
}

function mapReason(reason: string): Stripe.RefundCreateParams.Reason {
  const r = reason.toLowerCase();
  if (r.includes("duplicate")) return "duplicate";
  if (r.includes("fraud")) return "fraudulent";
  return "requested_by_customer";
}

async function rawProcessProviderRefund(params: RefundRequest): Promise<RefundResult> {
  if (!params.paymentIntentId) {
    return { success: false, refundId: "", error: "Order has no Stripe payment intent on file" };
  }
  if (!Number.isFinite(params.amountMinor) || params.amountMinor <= 0) {
    return { success: false, refundId: "", error: `Invalid refund amount: ${params.amountMinor}` };
  }

  const config = await getActivePaymentConfig();
  if (!config) {
    return { success: false, refundId: "", error: "No active payment provider configured" };
  }
  if (config.provider !== "stripe") {
    return { success: false, refundId: "", error: `Active provider is ${config.provider}, refund flow only supports Stripe` };
  }

  const stripe = createStripeClient(config.secretKey);

  try {
    const refund = await stripe.refunds.create(
      {
        payment_intent: params.paymentIntentId,
        amount: params.amountMinor,
        reason: mapReason(params.reason),
        metadata: { internal_refund_id: String(params.internalRefundId), internal_reason: params.reason.slice(0, 500) },
      },
      { idempotencyKey: `refund:${params.internalRefundId}` },
    );

    logger.info(
      { stripeRefundId: refund.id, amountMinor: params.amountMinor, status: refund.status, paymentIntentId: params.paymentIntentId },
      "Stripe refund created",
    );

    if (refund.status === "succeeded" || refund.status === "pending") {
      return { success: true, refundId: refund.id };
    }
    return { success: false, refundId: refund.id, error: refund.failure_reason ?? `Stripe refund returned status: ${refund.status}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err, paymentIntentId: params.paymentIntentId }, "Stripe refund call failed");
    return { success: false, refundId: "", error: msg };
  }
}

export async function processProviderRefund(params: RefundRequest): Promise<RefundResult> {
  return stripeCircuit.exec(
    () => rawProcessProviderRefund(params),
    async () => ({
      success: false,
      refundId: "",
      error: "Stripe is temporarily unavailable, please try again shortly",
    }),
  );
}
