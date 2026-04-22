// In-memory ring buffer for webhook debug logs (last 50 events)
const MAX_ENTRIES = 50;

export interface WebhookLogEntry {
  ts: string;
  direction: "in" | "out";
  source: "metenzi" | "stripe" | "checkout";
  event: string;
  status: number;
  outcome: "ok" | "invalid_sig" | "replay" | "bad_body" | "handler_error" | "challenge" | "duplicate" | "unknown";
  headers?: Record<string, string>;
  body?: unknown;
  error?: string;
}

const log: WebhookLogEntry[] = [];

export function appendWebhookLog(entry: Omit<WebhookLogEntry, "ts">): void {
  log.push({ ts: new Date().toISOString(), ...entry });
  if (log.length > MAX_ENTRIES) log.splice(0, log.length - MAX_ENTRIES);
}

export function getWebhookLog(): WebhookLogEntry[] {
  return [...log].reverse(); // newest first
}
