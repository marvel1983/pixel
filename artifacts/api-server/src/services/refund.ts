import { logger } from "../lib/logger";
import { stripeCircuit } from "../lib/circuit-instances";

export interface RefundRequest {
  paymentIntentId: string;
  amount: string;
  reason: string;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  error?: string;
}

async function rawProcessProviderRefund(params: RefundRequest): Promise<RefundResult> {
  logger.info(
    { paymentIntentId: params.paymentIntentId, amount: params.amount },
    "Checkout.com: processing refund",
  );

  await new Promise((r) => setTimeout(r, 300));

  if (params.paymentIntentId.includes("_fail_refund_")) {
    return {
      success: false,
      refundId: "",
      error: "Refund declined by payment provider",
    };
  }

  const refundId = `rf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  logger.info(
    { refundId, amount: params.amount },
    "Checkout.com: refund processed",
  );

  return { success: true, refundId };
}

export async function processProviderRefund(params: RefundRequest): Promise<RefundResult> {
  return stripeCircuit.exec(
    () => rawProcessProviderRefund(params),
    async () => ({
      success: false,
      refundId: "",
      error: "Payment processing temporarily unavailable, please try again shortly",
    }),
  );
}
