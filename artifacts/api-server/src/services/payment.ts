import { logger } from "../lib/logger";

export interface PaymentRequest {
  amount: string;
  currency: string;
  cardToken: string;
  email: string;
}

export interface PaymentResult {
  success: boolean;
  paymentIntentId: string;
  error?: string;
}

export async function processPayment(params: PaymentRequest): Promise<PaymentResult> {
  logger.info(
    { amount: params.amount, email: params.email },
    "Checkout.com: processing payment",
  );

  await new Promise((r) => setTimeout(r, 300));

  if (params.cardToken.includes("_fail_")) {
    return {
      success: false,
      paymentIntentId: "",
      error: "Payment declined by card issuer",
    };
  }

  const paymentIntentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  logger.info(
    { paymentIntentId, amount: params.amount },
    "Checkout.com: payment authorized",
  );

  return { success: true, paymentIntentId };
}
