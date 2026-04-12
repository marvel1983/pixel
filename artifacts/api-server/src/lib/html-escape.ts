/**
 * Escapes user-supplied strings before inserting them into HTML email bodies.
 * Prevents XSS / email injection attacks.
 */
export function he(raw: unknown): string {
  return String(raw ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
