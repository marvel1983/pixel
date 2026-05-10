export type DiscountType = "PERCENTAGE" | "FIXED" | "BUY_X_GET_Y_FREE";

export interface ProductOption {
  id: number;
  name: string;
  imageUrl: string | null;
  priceUsd?: string | null;
}

export interface BundleFormState {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  imageUrl: string | null;
  isActive: boolean;
  isFeatured: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  sortOrder: number;
  primaryProductId: number | null;
  discountType: DiscountType;
  discountValue: string;
}

export interface PricingPreview {
  sumOriginalUsd: string;
  finalUsd: string;
  savingsUsd: string;
}

export interface BundleProduct {
  productId: number;
  productName: string;
  productImage: string | null;
  productPrice: string | null;
  isFree: boolean;
  sortOrder: number;
}

export interface AdminBundle extends Omit<BundleFormState, "id"> {
  id: number;
  bundlePriceUsd: string;
  createdAt: string;
  items: BundleProduct[];
  freeProductIds: number[];
}

export const emptyBundle = (): BundleFormState => ({
  id: 0, name: "", slug: "",
  description: null, shortDescription: null, imageUrl: null,
  isActive: true, isFeatured: false,
  metaTitle: null, metaDescription: null, sortOrder: 0,
  primaryProductId: null,
  discountType: "PERCENTAGE", discountValue: "10",
});

export const toFormState = (b: AdminBundle): BundleFormState => ({
  id: b.id, name: b.name, slug: b.slug,
  description: b.description, shortDescription: b.shortDescription, imageUrl: b.imageUrl,
  isActive: b.isActive, isFeatured: b.isFeatured,
  metaTitle: b.metaTitle, metaDescription: b.metaDescription, sortOrder: b.sortOrder,
  primaryProductId: b.primaryProductId, discountType: b.discountType,
  discountValue: b.discountValue,
});

export function slugify(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
