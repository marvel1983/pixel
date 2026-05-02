import { useState, useEffect } from "react";
import type { ListingFilters } from "./use-listing-filters";
import type { MockProduct } from "./mock-data";

const API = import.meta.env.VITE_API_URL ?? "/api";

export interface ApiVariant {
  id: number;
  name: string;
  sku: string;
  platform: string | null;
  priceUsd: string;
  priceOverrideUsd: string | null;
  compareAtPriceUsd: string | null;
  stockCount: number;
  backorderAllowed?: boolean;
  backorderEta?: string | null;
}

export interface ApiProduct {
  id: number;
  name: string;
  slug: string;
  imageUrl: string | null;
  avgRating: string | null;
  reviewCount: number;
  isFeatured: boolean;
  categorySlug: string | null;
  variants: ApiVariant[];
}

export interface FacetTag {
  id: number;
  name: string;
  slug: string;
  colorHex: string;
  count: number;
}

export interface FacetOption {
  id: number;
  value: string;
  slug: string;
  colorHex: string | null;
  count: number;
}

export interface FacetAttribute {
  id: number;
  name: string;
  slug: string;
  options: FacetOption[];
}

export interface Facets {
  tags: FacetTag[];
  attributes: FacetAttribute[];
}

export function toMockProduct(p: ApiProduct): MockProduct {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    imageUrl: p.imageUrl,
    categorySlug: p.categorySlug ?? "",
    avgRating: parseFloat(p.avgRating ?? "0") || 0,
    reviewCount: p.reviewCount,
    isFeatured: p.isFeatured,
    isNew: false,
    platformType: (p as any).platformType ?? null,
    regionRestrictions: (p as any).regionRestrictions ?? [],
    keyFeatures: (p as any).keyFeatures ?? [],
    systemRequirements: (p as any).systemRequirements ?? {},
    description: (p as any).description ?? undefined,
    tags: (p as any).tags ?? [],
    productAttributes: (p as any).productAttributes ?? [],
    customInfoTiles: (p as any).customInfoTiles ?? [],
    variants: p.variants.map((v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku,
      platform: v.platform ?? "",
      priceUsd: v.priceUsd,
      compareAtPriceUsd: v.compareAtPriceUsd,
      stockCount: v.stockCount,
      backorderAllowed: v.backorderAllowed,
      backorderEta: v.backorderEta,
    })),
  };
}

interface ProductsResult {
  items: ApiProduct[];
  total: number;
  facets: Facets;
  loading: boolean;
  error: string | null;
}

export function useProducts(filters: ListingFilters, perPage: number, extraParams?: Record<string, string>): ProductsResult {
  const [state, setState] = useState<ProductsResult>({
    items: [],
    total: 0,
    facets: { tags: [], attributes: [] },
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    const p = new URLSearchParams();
    if (filters.q) p.set("q", filters.q);
    if (filters.categories.length) p.set("cat", filters.categories.join(","));
    if (filters.platforms.length) p.set("plat", filters.platforms.join(","));
    if (filters.minPrice > 0) p.set("min", filters.minPrice.toString());
    if (filters.maxPrice < 9999) p.set("max", filters.maxPrice.toString());
    if (filters.inStockOnly) p.set("stock", "1");
    if (filters.sort !== "newest") p.set("sort", filters.sort);
    if (filters.tags.length) p.set("tags", filters.tags.join(","));
    if (Object.keys(filters.attrs).length) p.set("attrs", JSON.stringify(filters.attrs));
    p.set("limit", String(perPage));
    p.set("offset", String((filters.page - 1) * perPage));
    if (extraParams) {
      for (const [k, v] of Object.entries(extraParams)) p.set(k, v);
    }

    fetch(`${API}/products?${p.toString()}`)
      .then((r) => r.json())
      .then((data: { items: ApiProduct[]; total: number; facets: Facets }) => {
        if (cancelled) return;
        setState({
          items: data.items ?? [],
          total: data.total ?? 0,
          facets: data.facets ?? { tags: [], attributes: [] },
          loading: false,
          error: null,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setState((s) => ({ ...s, loading: false, error: String(err) }));
      });

    return () => { cancelled = true; };
  }, [
    filters.q, filters.categories.join(","), filters.platforms.join(","),
    filters.minPrice, filters.maxPrice, filters.inStockOnly, filters.sort,
    filters.page, filters.tags.join(","), JSON.stringify(filters.attrs),
    perPage, JSON.stringify(extraParams ?? null),
  ]);

  return state;
}
