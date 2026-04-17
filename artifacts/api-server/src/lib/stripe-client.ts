import Stripe from "stripe";

export function createStripeClient(secretKey: string): Stripe {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Stripe(secretKey, { apiVersion: "2025-03-31.basil" as any });
}
