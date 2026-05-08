const FORBIDDEN_KEYS = new Set([
  "password",
  "currentPassword",
  "newPassword",
  "passwordConfirm",
  "cvc",
  "cvv",
  "cardNumber",
  "card_number",
  "pan",
  "ccnumber",
  "expiry",
  "expiryMonth",
  "expiryYear",
  "secret",
  "token",
  "authToken",
  "bearerToken",
  "apiKey",
  "ssn",
]);

const MAX_VALUE_LENGTH = 500;

export function sanitizeMetadata(
  input: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!input) return null;
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(input)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    out[key] = sanitizeValue(raw);
  }
  return out;
}

function sanitizeValue(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (typeof v === "string") {
    return v.length > MAX_VALUE_LENGTH ? v.slice(0, MAX_VALUE_LENGTH) : v;
  }
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (Array.isArray(v)) {
    return v.slice(0, 50).map(sanitizeValue);
  }
  if (typeof v === "object") {
    return sanitizeMetadata(v as Record<string, unknown>);
  }
  return null;
}
