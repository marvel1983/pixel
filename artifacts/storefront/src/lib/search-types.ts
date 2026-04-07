export interface SearchVariant {
  id: number;
  productId: number;
  name: string;
  sku: string;
  platform: string | null;
  priceUsd: string;
  compareAtPriceUsd: string | null;
  stockCount: number;
}

export interface SearchProduct {
  id: number;
  name: string;
  slug: string;
  imageUrl: string | null;
  avgRating: string | null;
  reviewCount: number;
  isFeatured: boolean;
  categorySlug: string | null;
  variants: SearchVariant[];
}

export interface SearchResponse {
  items: SearchProduct[];
  total: number;
  limit: number;
  offset: number;
}
