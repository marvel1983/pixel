export interface MockProduct {
  id: number;
  name: string;
  slug: string;
  imageUrl: string | null;
  categorySlug: string;
  avgRating: number;
  reviewCount: number;
  variants: MockVariant[];
  isFeatured: boolean;
  isNew: boolean;
  description?: string;
  warranty?: string;
  regionRestrictions?: string[];
  platformType?: string | null;
}

export interface MockVariant {
  id: number;
  name: string;
  sku: string;
  platform: string;
  priceUsd: string;
  compareAtPriceUsd: string | null;
  stockCount: number;
}

export { MOCK_PRODUCTS } from "./mock-products";

export const MOCK_BANNERS = [
  {
    id: 1,
    title: "Windows 11 Pro — Save 85%",
    subtitle: "Instant digital delivery. Genuine license keys.",
    ctaText: "Shop Now",
    ctaLink: "/product/windows-11-pro",
    imageUrl: "/banners/windows-sale-banner.png",
  },
  {
    id: 2,
    title: "Office 2024 — Just Released",
    subtitle: "Lifetime license at a fraction of the retail price.",
    ctaText: "Get Office 2024",
    ctaLink: "/product/office-2024-pro-plus",
    imageUrl: "/banners/office-sale-banner.png",
  },
  {
    id: 3,
    title: "Game Keys — Up to 50% Off",
    subtitle: "Steam, Origin, Epic — all platforms available.",
    ctaText: "Browse Games",
    ctaLink: "/category/games",
    imageUrl: "/banners/gaming-sale-banner.png",
  },
  {
    id: 4,
    title: "Stay Protected — Up to 80% Off",
    subtitle: "Norton, Kaspersky, Bitdefender — all top brands.",
    ctaText: "Shop Security",
    ctaLink: "/category/antivirus-security",
    imageUrl: "/banners/security-banner.png",
  },
];
