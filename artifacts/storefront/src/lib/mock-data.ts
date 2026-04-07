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

export const MOCK_PRODUCTS: MockProduct[] = [
  {
    id: 1, name: "Windows 11 Pro", slug: "windows-11-pro",
    imageUrl: null, categorySlug: "operating-systems",
    avgRating: 4.8, reviewCount: 342,
    variants: [{ id: 1, name: "Digital Key", sku: "WIN11PRO-KEY", platform: "WINDOWS", priceUsd: "29.99", compareAtPriceUsd: "199.99", stockCount: 500 }],
    isFeatured: true, isNew: false,
  },
  {
    id: 2, name: "Windows 11 Home", slug: "windows-11-home",
    imageUrl: null, categorySlug: "operating-systems",
    avgRating: 4.7, reviewCount: 285,
    variants: [{ id: 2, name: "Digital Key", sku: "WIN11HOME-KEY", platform: "WINDOWS", priceUsd: "19.99", compareAtPriceUsd: "139.99", stockCount: 800 }],
    isFeatured: false, isNew: false,
  },
  {
    id: 3, name: "Windows 10 Pro", slug: "windows-10-pro",
    imageUrl: null, categorySlug: "operating-systems",
    avgRating: 4.9, reviewCount: 1024,
    variants: [{ id: 3, name: "Digital Key", sku: "WIN10PRO-KEY", platform: "WINDOWS", priceUsd: "14.99", compareAtPriceUsd: "199.99", stockCount: 999 }],
    isFeatured: true, isNew: false,
  },
  {
    id: 4, name: "Office 2024 Professional Plus", slug: "office-2024-pro-plus",
    imageUrl: null, categorySlug: "office-productivity",
    avgRating: 4.6, reviewCount: 189,
    variants: [{ id: 4, name: "Lifetime License", sku: "OFF2024PP-KEY", platform: "WINDOWS", priceUsd: "69.99", compareAtPriceUsd: "439.99", stockCount: 200 }],
    isFeatured: true, isNew: true,
  },
  {
    id: 5, name: "Office 2024 Home & Business", slug: "office-2024-home",
    imageUrl: null, categorySlug: "office-productivity",
    avgRating: 4.5, reviewCount: 95,
    variants: [{ id: 5, name: "Lifetime License", sku: "OFF2024HB-KEY", platform: "WINDOWS", priceUsd: "49.99", compareAtPriceUsd: "249.99", stockCount: 300 }],
    isFeatured: false, isNew: true,
  },
  {
    id: 6, name: "Office 2021 Professional Plus", slug: "office-2021-pro-plus",
    imageUrl: null, categorySlug: "office-productivity",
    avgRating: 4.8, reviewCount: 567,
    variants: [{ id: 6, name: "Lifetime License", sku: "OFF2021PP-KEY", platform: "WINDOWS", priceUsd: "39.99", compareAtPriceUsd: "399.99", stockCount: 450 }],
    isFeatured: true, isNew: false,
  },
  {
    id: 7, name: "Norton 360 Deluxe", slug: "norton-360-deluxe",
    imageUrl: null, categorySlug: "antivirus-security",
    avgRating: 4.4, reviewCount: 210,
    variants: [{ id: 7, name: "1 Year / 3 Devices", sku: "NORTON360-3D", platform: "WINDOWS", priceUsd: "19.99", compareAtPriceUsd: "49.99", stockCount: 150 }],
    isFeatured: false, isNew: true,
  },
  {
    id: 8, name: "Kaspersky Total Security", slug: "kaspersky-total",
    imageUrl: null, categorySlug: "antivirus-security",
    avgRating: 4.3, reviewCount: 178,
    variants: [{ id: 8, name: "1 Year / 5 Devices", sku: "KASP-TOTAL-5D", platform: "WINDOWS", priceUsd: "24.99", compareAtPriceUsd: "79.99", stockCount: 120 }],
    isFeatured: false, isNew: true,
  },
  {
    id: 9, name: "Elden Ring", slug: "elden-ring",
    imageUrl: null, categorySlug: "games",
    avgRating: 4.9, reviewCount: 3200,
    variants: [{ id: 9, name: "Steam Key", sku: "ELDEN-STEAM", platform: "STEAM", priceUsd: "39.99", compareAtPriceUsd: "59.99", stockCount: 75 }],
    isFeatured: true, isNew: false,
  },
  {
    id: 10, name: "Cyberpunk 2077", slug: "cyberpunk-2077",
    imageUrl: null, categorySlug: "games",
    avgRating: 4.5, reviewCount: 2100,
    variants: [{ id: 10, name: "Steam Key", sku: "CP2077-STEAM", platform: "STEAM", priceUsd: "29.99", compareAtPriceUsd: "59.99", stockCount: 60 }],
    isFeatured: false, isNew: false,
  },
  {
    id: 11, name: "Windows Server 2022", slug: "windows-server-2022",
    imageUrl: null, categorySlug: "servers-development",
    avgRating: 4.7, reviewCount: 89,
    variants: [{ id: 11, name: "Standard License", sku: "WINSRV2022-STD", platform: "WINDOWS", priceUsd: "149.99", compareAtPriceUsd: "1099.99", stockCount: 30 }],
    isFeatured: false, isNew: true,
  },
  {
    id: 12, name: "Visual Studio 2022 Enterprise", slug: "vs-2022-enterprise",
    imageUrl: null, categorySlug: "servers-development",
    avgRating: 4.6, reviewCount: 145,
    variants: [{ id: 12, name: "License Key", sku: "VS2022-ENT", platform: "WINDOWS", priceUsd: "89.99", compareAtPriceUsd: "599.99", stockCount: 50 }],
    isFeatured: false, isNew: true,
  },
];

export const MOCK_BANNERS = [
  {
    id: 1,
    title: "Windows 11 Pro — Save 85%",
    subtitle: "Instant digital delivery. Genuine license keys.",
    ctaText: "Shop Now",
    ctaLink: "/product/windows-11-pro",
    bgColor: "from-blue-600 to-blue-800",
  },
  {
    id: 2,
    title: "Office 2024 — Just Released",
    subtitle: "Lifetime license at a fraction of the retail price.",
    ctaText: "Get Office 2024",
    ctaLink: "/product/office-2024-pro-plus",
    bgColor: "from-orange-500 to-red-600",
  },
  {
    id: 3,
    title: "Game Keys — Up to 50% Off",
    subtitle: "Steam, Origin, Epic — all platforms available.",
    ctaText: "Browse Games",
    ctaLink: "/category/games",
    bgColor: "from-purple-600 to-indigo-700",
  },
];
