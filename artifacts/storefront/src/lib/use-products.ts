import { useState, useEffect } from "react";
import type { ListingFilters } from "./use-listing-filters";

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

interface ProductsResult {
  items: ApiProduct[];
  total: number;
  facets: Facets;
  loading: boolean;
  error: string | null;
}

export function useProducts(filters: ListingFilters, perPage: number): ProductsResult {
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
    perPage,
  ]);

  return state;
}
