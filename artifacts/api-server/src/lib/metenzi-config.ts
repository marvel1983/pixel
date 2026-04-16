import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { apiProviders } from "@workspace/db/schema";
import { decrypt } from "./encryption";
import type { MetenziClientConfig } from "./metenzi-client";
import { logger } from "./logger";

let cachedConfig: MetenziClientConfig | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getMetenziConfig(): Promise<MetenziClientConfig | null> {
  const now = Date.now();
  if (cachedConfig && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedConfig;
  }

  try {
    const [provider] = await db
      .select()
      .from(apiProviders)
      .where(eq(apiProviders.slug, "metenzi"))
      .limit(1);

    if (!provider) {
      logger.warn("Metenzi provider not found");
      return null;
    }

    if (!provider.apiKeyEncrypted || !provider.hmacSecretEncrypted) {
      logger.warn("Metenzi provider missing API key or HMAC secret");
      return null;
    }

    cachedConfig = {
      baseUrl: provider.baseUrl,
      apiKey: decrypt(provider.apiKeyEncrypted),
      hmacSecret: decrypt(provider.hmacSecretEncrypted),
      rateLimit: provider.rateLimit ?? 60,
    };
    cacheTimestamp = now;
    return cachedConfig;
  } catch (error) {
    logger.error({ error }, "Failed to load Metenzi config");
    return null;
  }
}

export function clearMetenziConfigCache(): void {
  cachedConfig = null;
  cacheTimestamp = 0;
}
