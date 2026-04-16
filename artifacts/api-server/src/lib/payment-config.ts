import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { apiCredentials } from "@workspace/db/schema";
import { decrypt } from "./encryption";
import { logger } from "./logger";

export type PaymentProvider = "stripe" | "checkout";
export type PaymentMode = "sandbox" | "live";

export interface PaymentProviderConfig {
  provider: PaymentProvider;
  mode: PaymentMode;
  secretKey: string;
  publishableKey?: string;
  webhookSecret?: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedConfig: PaymentProviderConfig | null = null;
let cacheTimestamp = 0;

export async function getActivePaymentConfig(): Promise<PaymentProviderConfig | null> {
  const now = Date.now();
  if (cachedConfig && now - cacheTimestamp < CACHE_TTL_MS) return cachedConfig;

  try {
    const [row] = await db
      .select()
      .from(apiCredentials)
      .where(eq(apiCredentials.isActive, true))
      .limit(1);

    const extra = (row.extra ?? {}) as Record<string, string>;
    const mode: PaymentMode = extra.mode === "live" ? "live" : "sandbox";

    // Keys are stored per-mode in extra: e.g. extra.sandbox_secretKeyEncrypted
    const sk = extra[`${mode}_secretKeyEncrypted`];
    const pk = extra[`${mode}_publicKeyEncrypted`];
    const wh = extra[`${mode}_webhookSecretEncrypted`];

    if (!sk) {
      cachedConfig = null;
      cacheTimestamp = now;
      return null;
    }

    cachedConfig = {
      provider: row.provider as PaymentProvider,
      mode,
      secretKey: decrypt(sk),
      publishableKey: pk ? decrypt(pk) : undefined,
      webhookSecret: wh ? decrypt(wh) : undefined,
    };
    cacheTimestamp = now;
    return cachedConfig;
  } catch (err) {
    logger.error({ err }, "Failed to load active payment config");
    return null;
  }
}

export function clearPaymentConfigCache() {
  cachedConfig = null;
  cacheTimestamp = 0;
}
