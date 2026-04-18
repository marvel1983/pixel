import type { FieldMapping, CurrencyConfig } from "@workspace/db/schema";

// Price_target = (Price_base × ExchangeRate) + TaxOffset — precise integer arithmetic
function convertPrice(priceUsd: number, cfg: CurrencyConfig): number {
  const raw = priceUsd * cfg.exchangeRate + cfg.taxOffset;
  return Math.round(raw * 100) / 100;
}

function formatPrice(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`;
}

// Strip HTML tags and style/script block contents for description fields
function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// Enrich raw DB row with derived fields used in mappings
export function enrichProduct(
  row: Record<string, unknown>,
  cfg: CurrencyConfig,
  storeUrl: string,
): Record<string, unknown> {
  const priceUsd = Number(row.price ?? 0);
  const compareUsd = row.compareAtPrice ? Number(row.compareAtPrice) : null;
  const stock = Number(row.stock ?? 0);

  return {
    ...row,
    price: formatPrice(convertPrice(priceUsd, cfg), cfg.targetCurrency),
    compareAtPrice: compareUsd !== null
      ? formatPrice(convertPrice(compareUsd, cfg), cfg.targetCurrency)
      : "",
    availability: stock > 0 ? "in stock" : "out of stock",
    condition: "new",
    slug: `${storeUrl}/product/${row.slug ?? ""}?currency=${cfg.targetCurrency}`,
    description: row.description ? stripHtml(String(row.description)) : "",
    // Raw price in target currency as a number (used by filter evaluator)
    _priceConverted: convertPrice(priceUsd, cfg),
  };
}

export function transformProduct(
  enriched: Record<string, unknown>,
  mappings: FieldMapping[],
): Record<string, string> {
  const row: Record<string, string> = {};
  for (const m of mappings) {
    const raw = m.sourceType === "static"
      ? m.sourceValue
      : (enriched[m.sourceValue] !== undefined && enriched[m.sourceValue] !== null
          ? String(enriched[m.sourceValue])
          : "");
    row[m.feedKey] = `${m.prefix ?? ""}${raw}${m.suffix ?? ""}`;
  }
  return row;
}
