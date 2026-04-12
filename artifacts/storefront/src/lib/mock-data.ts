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

export interface MockHeroBanner {
  id: number;
  badge?: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
}

/** Homepage hero slides — visuals are CSS-driven in `HeroBanner` (no raster assets). */
export const MOCK_BANNERS: MockHeroBanner[] = [
  {
    id: 1,
    badge: "Instant delivery",
    title: "Windows & Office keys, without the sticker shock",
    subtitle:
      "Genuine digital licenses, email in minutes. Same activation as retail — a fraction of the price.",
    ctaText: "Shop Windows & OS",
    ctaLink: "/category/operating-systems",
  },
  {
    id: 2,
    badge: "Productivity",
    title: "Lifetime Office suites for teams and freelancers",
    subtitle:
      "Word, Excel, PowerPoint, Outlook — one payment, no subscription treadmill.",
    ctaText: "Browse Office",
    ctaLink: "/category/office-productivity",
  },
  {
    id: 3,
    badge: "PC gaming",
    title: "Game keys for Steam, Epic & more",
    subtitle:
      "Digital codes ready when you are. Stock updated often — grab titles before they’re gone.",
    ctaText: "See game deals",
    ctaLink: "/category/games",
  },
  {
    id: 4,
    badge: "Peace of mind",
    title: "Antivirus from brands you already trust",
    subtitle:
      "Layered protection for every device. Compare top suites and renew for less.",
    ctaText: "Shop security",
    ctaLink: "/category/antivirus-security",
  },
];
