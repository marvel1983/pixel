import { logger } from "../lib/logger";

export interface PaymentResult {
  success: boolean;
  paymentIntentId: string;
  error?: string;
}

export async function processPayment(params: {
  amount: string;
  currency: string;
  cardToken: string;
  email: string;
}): Promise<PaymentResult> {
  logger.info({ amount: params.amount, email: params.email }, "Processing payment");

  await new Promise((r) => setTimeout(r, 500));

  const paymentIntentId = `pi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return {
    success: true,
    paymentIntentId,
  };
}
