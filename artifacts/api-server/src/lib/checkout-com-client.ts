import crypto from "node:crypto";

export interface CheckoutComConfig {
  secretKey: string;
  mode: "sandbox" | "live";
}

const baseUrl = (mode: "sandbox" | "live") =>
  mode === "live" ? "https://api.checkout.com" : "https://api.sandbox.checkout.com";

export interface CreatePaymentLinkParams {
  amountCents: number;
  currency: string;
  reference: string;
  description: string;
  customerEmail: string;
  customerName: string;
  successUrl: string;
  failureUrl: string;
  expiresAt: Date;
  metadata: Record<string, string>;
}

export interface PaymentLinkResult {
  id: string;
  redirectUrl: string;
}

export async function createCheckoutPaymentLink(
  config: CheckoutComConfig,
  params: CreatePaymentLinkParams,
): Promise<PaymentLinkResult> {
  const res = await fetch(`${baseUrl(config.mode)}/payment-links`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: params.amountCents,
      currency: params.currency.toUpperCase(),
      reference: params.reference,
      description: params.description,
      customer: { email: params.customerEmail, name: params.customerName },
      success_url: params.successUrl,
      failure_url: params.failureUrl,
      expires_on: params.expiresAt.toISOString(),
      metadata: params.metadata,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Checkout.com payment link failed (${res.status}): ${body}`);
  }

  const data = await res.json() as { id: string; _links: { redirect: { href: string } } };
  return { id: data.id, redirectUrl: data._links.redirect.href };
}

/** Verify a Checkout.com webhook signature.
 *  Checkout.com signs with HMAC-SHA256, base64-encoded, in the Cko-Signature header.
 */
export function verifyCheckoutSignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
