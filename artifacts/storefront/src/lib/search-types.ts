export interface SearchVariant {
  id: number;
  productId: number;
  name: string;
  sku: string;
  platform: string | null;
  priceUsd: string;
  compareAtPriceUsd: string | null;
  stockCount: number;
  backorderAllowed?: boolean;
  backorderEta?: string | null;
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

export interface SearchBundleHit {
  id: number;
  name: string;
  slug: string;
  imageUrl: string | null;
  bundlePriceUsd: string;
  itemCount: number;
  primaryProductId?: number | null;
  anchorImageUrl?: string | null;
  anchorAvgRating?: string | null;
  anchorReviewCount?: number | null;
}

export interface SearchResponse {
  items: SearchProduct[];
  total: number;
  limit: number;
  offset: number;
  bundleHits?: SearchBundleHit[];
}
