import crypto from "node:crypto";
import { logger } from "./logger";

export interface MetenziClientConfig {
  baseUrl: string;
  apiKey: string;
  hmacSecret: string;
  rateLimit?: number;
}

export interface MetenziRequestOptions {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: Record<string, unknown>;
  query?: Record<string, string>;
}

interface MetenziResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

function signPayload(payload: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
}

function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, string>,
): string {
  const url = new URL(path, baseUrl);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function metenziRequest<T = unknown>(
  config: MetenziClientConfig,
  options: MetenziRequestOptions,
): Promise<MetenziResponse<T>> {
  const { method, path, body, query } = options;
  const url = buildUrl(config.baseUrl, path, query);
  const isWrite = method !== "GET";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  };

  let bodyStr: string | undefined;
  if (body) {
    bodyStr = JSON.stringify(body);
  }

  if (isWrite) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payloadToSign = bodyStr ?? "";
    const signaturePayload = `${timestamp}.${payloadToSign}`;
    const signature = signPayload(signaturePayload, config.hmacSecret);
    headers["X-Signature"] = signature;
    headers["X-Timestamp"] = timestamp;
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: bodyStr,
      });

      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          const retryAfter = response.headers.get("Retry-After");
          const delayMs = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : BASE_DELAY_MS * Math.pow(2, attempt);
          logger.warn(
            { attempt, delayMs, path },
            "Metenzi rate limited, retrying",
          );
          await sleep(delayMs);
          continue;
        }
      }

      let data: T;
      const contentType = response.headers.get("content-type");
      if (
        response.status === 204 ||
        !contentType?.includes("application/json")
      ) {
        data = {} as T;
      } else {
        data = (await response.json()) as T;
      }
      return { ok: response.ok, status: response.status, data };
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        const delayMs = BASE_DELAY_MS * Math.pow(2, attempt);
        logger.warn(
          { attempt, delayMs, path, error },
          "Metenzi request failed, retrying",
        );
        await sleep(delayMs);
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Metenzi request failed after ${MAX_RETRIES + 1} attempts`);
}
