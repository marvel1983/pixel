import crypto from "node:crypto";
import { logger } from "./logger";
import { metenziCircuit } from "./circuit-instances";
import { CircuitOpenError } from "./circuit-breaker";

export interface MetenziClientConfig {
  baseUrl: string;
  apiKey: string;
  hmacSecret: string;
  webhookSecret?: string;
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
const MAX_DELAY_MS = 30000;

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

function computeSignatureHeaders(
  config: MetenziClientConfig,
  method: string,
  path: string,
  bodyStr?: string,
): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = bodyStr ?? "";
  // Metenzi format: timestamp + "." + METHOD + "." + path + "." + body
  const signaturePayload = `${timestamp}.${method.toUpperCase()}.${path}.${body}`;
  const signature = signPayload(signaturePayload, config.hmacSecret);
  return { "X-Signature": signature, "X-Signature-Timestamp": timestamp };
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = parseInt(header, 10);
  if (Number.isNaN(seconds) || seconds <= 0) return null;
  return Math.min(seconds * 1000, MAX_DELAY_MS);
}

async function rawMetenziRequest<T = unknown>(
  config: MetenziClientConfig,
  options: MetenziRequestOptions,
): Promise<MetenziResponse<T>> {
  const { method, path, body, query } = options;
  const url = buildUrl(config.baseUrl, path, query);
  const isWrite = method !== "GET";
  const isIdempotent = method === "GET" || method === "PUT";

  const bodyStr = body ? JSON.stringify(body) : undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    };

    if (isWrite) {
      Object.assign(headers, computeSignatureHeaders(config, method, path, bodyStr));
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: bodyStr,
      });

      if (response.status === 429 && attempt < MAX_RETRIES) {
        const delayMs =
          parseRetryAfter(response.headers.get("Retry-After")) ??
          Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
        logger.warn(
          { attempt, delayMs, path },
          "Metenzi rate limited, retrying",
        );
        await sleep(delayMs);
        continue;
      }

      if (response.status >= 500) {
        throw new Error(`Metenzi server error: ${response.status}`);
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
      if (isIdempotent && attempt < MAX_RETRIES) {
        const delayMs = Math.min(
          BASE_DELAY_MS * Math.pow(2, attempt),
          MAX_DELAY_MS,
        );
        logger.warn(
          { attempt, delayMs, path, error },
          "Metenzi request failed, retrying (idempotent)",
        );
        await sleep(delayMs);
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Metenzi request failed after ${MAX_RETRIES + 1} attempts`);
}

export async function metenziRequest<T = unknown>(
  config: MetenziClientConfig,
  options: MetenziRequestOptions,
): Promise<MetenziResponse<T>> {
  return metenziCircuit.exec(() => rawMetenziRequest<T>(config, options));
}

export { CircuitOpenError };
