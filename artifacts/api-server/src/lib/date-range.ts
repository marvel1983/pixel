// Parse a yyyy-mm-dd string as server-local time, not UTC.
// `new Date("2026-05-10")` parses as UTC midnight, which combined with
// later setHours() in a non-UTC server shifts the day boundary by the
// TZ offset and drops late-day rows from "today" filters.

export function startOfLocalDay(dateStr: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
}

export function endOfLocalDay(dateStr: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999);
}
