/**
 * Express 5 types `req.params` values as `string | string[]`.
 * Normalise to a single string for Drizzle / parseInt / etc.
 */
export function paramString(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const v = params[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v[0] !== undefined) return v[0];
  return "";
}
