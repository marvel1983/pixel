import type { MockProduct } from "./mock-data";

export function searchProducts(
  products: MockProduct[],
  query: string,
): MockProduct[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const terms = q.split(/\s+/).filter(Boolean);

  return products
    .map((p) => {
      const fields = [
        p.name,
        p.slug,
        p.description ?? "",
        p.categorySlug,
        ...p.variants.map((v) => v.sku),
        ...p.variants.map((v) => v.name),
        ...p.variants.map((v) => v.platform),
      ];
      const text = fields.join(" ").toLowerCase();

      let score = 0;
      for (const term of terms) {
        if (!text.includes(term)) return { product: p, score: 0 };
        if (p.name.toLowerCase().includes(term)) score += 10;
        if (p.name.toLowerCase().startsWith(term)) score += 5;
        if (p.description?.toLowerCase().includes(term)) score += 3;
        if (p.variants.some((v) => v.sku.toLowerCase().includes(term)))
          score += 4;
        score += 1;
      }
      return { product: p, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.product);
}
