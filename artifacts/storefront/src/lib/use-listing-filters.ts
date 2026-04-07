import { useMemo } from "react";
import { useSearch, useLocation } from "wouter";
import type { MockProduct } from "./mock-data";

export interface ListingFilters {
  categories: string[];
  platforms: string[];
  minPrice: number;
  maxPrice: number;
  inStockOnly: boolean;
  sort: string;
  page: number;
}

const PER_PAGE = 24;

export function useListingFilters() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search);

  const filters: ListingFilters = {
    categories: params.get("cat")?.split(",").filter(Boolean) ?? [],
    platforms: params.get("plat")?.split(",").filter(Boolean) ?? [],
    minPrice: parseFloat(params.get("min") ?? "0") || 0,
    maxPrice: parseFloat(params.get("max") ?? "9999") || 9999,
    inStockOnly: params.get("stock") === "1",
    sort: params.get("sort") ?? "newest",
    page: parseInt(params.get("page") ?? "1", 10) || 1,
  };

  function setFilters(update: Partial<ListingFilters>) {
    const merged = { ...filters, ...update };
    if (update.page === undefined && Object.keys(update).some((k) => k !== "page")) {
      merged.page = 1;
    }
    const p = new URLSearchParams();
    if (merged.categories.length) p.set("cat", merged.categories.join(","));
    if (merged.platforms.length) p.set("plat", merged.platforms.join(","));
    if (merged.minPrice > 0) p.set("min", merged.minPrice.toString());
    if (merged.maxPrice < 9999) p.set("max", merged.maxPrice.toString());
    if (merged.inStockOnly) p.set("stock", "1");
    if (merged.sort !== "newest") p.set("sort", merged.sort);
    if (merged.page > 1) p.set("page", merged.page.toString());
    const qs = p.toString();
    const path = window.location.pathname;
    setLocation(qs ? `${path}?${qs}` : path, { replace: true });
  }

  return { filters, setFilters, perPage: PER_PAGE };
}

export function applyFilters(
  products: MockProduct[],
  filters: ListingFilters,
): MockProduct[] {
  let result = [...products];

  if (filters.categories.length > 0) {
    result = result.filter((p) => filters.categories.includes(p.categorySlug));
  }

  if (filters.platforms.length > 0) {
    result = result.filter((p) =>
      p.variants.some((v) => filters.platforms.includes(v.platform)),
    );
  }

  result = result.filter((p) => {
    const price = parseFloat(p.variants[0]?.priceUsd ?? "0");
    return price >= filters.minPrice && price <= filters.maxPrice;
  });

  if (filters.inStockOnly) {
    result = result.filter((p) =>
      p.variants.some((v) => v.stockCount > 0),
    );
  }

  switch (filters.sort) {
    case "name-asc":
      result.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "name-desc":
      result.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case "price-asc":
      result.sort(
        (a, b) =>
          parseFloat(a.variants[0]?.priceUsd ?? "0") -
          parseFloat(b.variants[0]?.priceUsd ?? "0"),
      );
      break;
    case "price-desc":
      result.sort(
        (a, b) =>
          parseFloat(b.variants[0]?.priceUsd ?? "0") -
          parseFloat(a.variants[0]?.priceUsd ?? "0"),
      );
      break;
    default:
      result.sort((a, b) => b.id - a.id);
  }

  return result;
}

export function paginate<T>(items: T[], page: number, perPage: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * perPage;
  return {
    items: items.slice(start, start + perPage),
    totalPages,
    currentPage: safePage,
    totalItems: items.length,
  };
}
