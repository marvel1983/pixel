import { db, pool } from "@workspace/db";
import {
  users,
  categories,
  products,
  productVariants,
  siteSettings,
  faqs,
  apiProviders,
} from "@workspace/db/schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("Seeding database...");

  const existingAdmin = await db
    .select()
    .from(users)
    .where(eq(users.email, "admin@store.com"))
    .limit(1);

  if (existingAdmin.length > 0) {
    console.log("Database already seeded. Skipping.");
    await pool.end();
    return;
  }

  const passwordHash = await bcrypt.hash("Admin123!", 10);

  await db.insert(users).values({
    email: "admin@store.com",
    passwordHash,
    firstName: "Admin",
    lastName: "User",
    role: "SUPER_ADMIN",
    emailVerified: true,
  });

  await db.insert(siteSettings).values({
    siteName: "PixelCodes",
    siteDescription: "Your trusted source for digital software licenses",
    contactEmail: "support@pixelcodes.com",
    supportEmail: "support@pixelcodes.com",
    defaultCurrency: "USD",
    enabledCurrencies: ["USD", "EUR", "GBP", "CAD", "AUD", "PLN"],
    metaTitleTemplate: "{title} | PixelCodes",
    metaDescription:
      "Buy genuine software license keys at the best prices. Instant digital delivery.",
  });

  const [os] = await db
    .insert(categories)
    .values({
      name: "Operating Systems",
      slug: "operating-systems",
      description: "Windows, macOS and other operating system licenses",
      sortOrder: 1,
    })
    .returning();

  const [office] = await db
    .insert(categories)
    .values({
      name: "Office & Productivity",
      slug: "office-productivity",
      description: "Microsoft Office, Adobe and productivity suites",
      sortOrder: 2,
    })
    .returning();

  const [security] = await db
    .insert(categories)
    .values({
      name: "Antivirus & Security",
      slug: "antivirus-security",
      description: "Antivirus, VPN and security software",
      sortOrder: 3,
    })
    .returning();

  const [gaming] = await db
    .insert(categories)
    .values({
      name: "Games",
      slug: "games",
      description: "PC games and gaming platform keys",
      sortOrder: 4,
    })
    .returning();

  const [servers] = await db
    .insert(categories)
    .values({
      name: "Servers & Development",
      slug: "servers-development",
      description: "Server licenses and development tools",
      sortOrder: 5,
    })
    .returning();

  const seedProducts = [
    {
      name: "Windows 11 Pro",
      slug: "windows-11-pro",
      shortDescription: "Genuine Windows 11 Professional license key",
      type: "SOFTWARE" as const,
      categoryId: os.id,
      isFeatured: true,
      variants: [
        { name: "Digital License", sku: "WIN11PRO-01", priceUsd: "29.99", compareAtPriceUsd: "199.99", stockCount: 50, platform: "WINDOWS" as const },
      ],
    },
    {
      name: "Windows 10 Pro",
      slug: "windows-10-pro",
      shortDescription: "Genuine Windows 10 Professional license key",
      type: "SOFTWARE" as const,
      categoryId: os.id,
      isFeatured: true,
      variants: [
        { name: "Digital License", sku: "WIN10PRO-01", priceUsd: "19.99", compareAtPriceUsd: "139.99", stockCount: 100, platform: "WINDOWS" as const },
      ],
    },
    {
      name: "Microsoft Office 2021 Professional Plus",
      slug: "office-2021-pro-plus",
      shortDescription: "Full Office suite with Word, Excel, PowerPoint & more",
      type: "SOFTWARE" as const,
      categoryId: office.id,
      isFeatured: true,
      variants: [
        { name: "PC Key", sku: "OFF2021PP-PC", priceUsd: "49.99", compareAtPriceUsd: "439.99", stockCount: 30, platform: "WINDOWS" as const },
        { name: "Mac Key", sku: "OFF2021PP-MAC", priceUsd: "54.99", compareAtPriceUsd: "439.99", stockCount: 20, platform: "MAC" as const },
      ],
    },
    {
      name: "Microsoft Office 2024 Home & Business",
      slug: "office-2024-home-business",
      shortDescription: "Latest Office suite for home and business use",
      type: "SOFTWARE" as const,
      categoryId: office.id,
      isFeatured: true,
      variants: [
        { name: "PC Key", sku: "OFF2024HB-PC", priceUsd: "89.99", compareAtPriceUsd: "249.99", stockCount: 25, platform: "WINDOWS" as const },
      ],
    },
    {
      name: "Norton 360 Deluxe",
      slug: "norton-360-deluxe",
      shortDescription: "Complete protection for up to 5 devices - 1 year",
      type: "SUBSCRIPTION" as const,
      categoryId: security.id,
      variants: [
        { name: "1 Year / 5 Devices", sku: "NRT360DLX-1Y", priceUsd: "24.99", compareAtPriceUsd: "89.99", stockCount: 40, platform: "WINDOWS" as const },
      ],
    },
    {
      name: "Kaspersky Total Security",
      slug: "kaspersky-total-security",
      shortDescription: "Premium antivirus with VPN and password manager",
      type: "SUBSCRIPTION" as const,
      categoryId: security.id,
      variants: [
        { name: "1 Year / 3 Devices", sku: "KTS-1Y3D", priceUsd: "19.99", compareAtPriceUsd: "49.99", stockCount: 35, platform: "WINDOWS" as const },
      ],
    },
    {
      name: "Elden Ring",
      slug: "elden-ring",
      shortDescription: "Epic action RPG by FromSoftware",
      type: "GAME" as const,
      categoryId: gaming.id,
      isFeatured: true,
      variants: [
        { name: "Steam Key", sku: "ELDEN-STEAM", priceUsd: "34.99", compareAtPriceUsd: "59.99", stockCount: 15, platform: "STEAM" as const },
      ],
    },
    {
      name: "Cyberpunk 2077",
      slug: "cyberpunk-2077",
      shortDescription: "Open-world RPG set in Night City",
      type: "GAME" as const,
      categoryId: gaming.id,
      isFeatured: true,
      variants: [
        { name: "Steam Key", sku: "CP2077-STEAM", priceUsd: "24.99", compareAtPriceUsd: "59.99", stockCount: 20, platform: "STEAM" as const },
        { name: "GOG Key", sku: "CP2077-GOG", priceUsd: "22.99", compareAtPriceUsd: "59.99", stockCount: 10, platform: "GOG" as const },
      ],
    },
    {
      name: "Windows Server 2022 Standard",
      slug: "windows-server-2022-standard",
      shortDescription: "Server operating system for businesses",
      type: "SOFTWARE" as const,
      categoryId: servers.id,
      variants: [
        { name: "License Key", sku: "WINSRV2022-STD", priceUsd: "299.99", compareAtPriceUsd: "1069.99", stockCount: 10, platform: "WINDOWS" as const },
      ],
    },
    {
      name: "Visual Studio 2022 Professional",
      slug: "visual-studio-2022-pro",
      shortDescription: "Professional IDE for .NET and C++ development",
      type: "SOFTWARE" as const,
      categoryId: servers.id,
      variants: [
        { name: "License Key", sku: "VS2022PRO-01", priceUsd: "149.99", compareAtPriceUsd: "499.99", stockCount: 15, platform: "WINDOWS" as const },
      ],
    },
    {
      name: "Adobe Creative Cloud",
      slug: "adobe-creative-cloud",
      shortDescription: "Full Adobe CC suite - Photoshop, Illustrator & more",
      type: "SUBSCRIPTION" as const,
      categoryId: office.id,
      isFeatured: true,
      variants: [
        { name: "1 Year Subscription", sku: "ADOBECC-1Y", priceUsd: "199.99", compareAtPriceUsd: "659.88", stockCount: 20, platform: "WINDOWS" as const },
      ],
    },
    {
      name: "Hogwarts Legacy",
      slug: "hogwarts-legacy",
      shortDescription: "Open-world action RPG in the Wizarding World",
      type: "GAME" as const,
      categoryId: gaming.id,
      variants: [
        { name: "Steam Key", sku: "HOGWARTS-STEAM", priceUsd: "29.99", compareAtPriceUsd: "59.99", stockCount: 25, platform: "STEAM" as const },
      ],
    },
  ];

  for (const p of seedProducts) {
    const { variants, ...productData } = p;
    const [product] = await db.insert(products).values(productData).returning();
    for (const v of variants) {
      await db
        .insert(productVariants)
        .values({ ...v, productId: product.id });
    }
  }

  await db.insert(faqs).values([
    {
      question: "How do I receive my license key?",
      answer:
        "After your payment is confirmed, your license key will be instantly available in your order confirmation page and sent to your email.",
      categoryLabel: "Orders",
      sortOrder: 1,
    },
    {
      question: "Are these keys genuine?",
      answer:
        "Yes, all our keys are 100% genuine and sourced from authorized distributors. Every key is guaranteed to activate successfully.",
      categoryLabel: "Products",
      sortOrder: 2,
    },
    {
      question: "What payment methods do you accept?",
      answer:
        "We accept all major credit and debit cards through our secure payment processor. You can also pay using your PixelCodes wallet balance.",
      categoryLabel: "Payment",
      sortOrder: 3,
    },
    {
      question: "Can I get a refund?",
      answer:
        "If your key fails to activate, contact our support team and we will provide a replacement or full refund within 30 days of purchase.",
      categoryLabel: "Refunds",
      sortOrder: 4,
    },
  ]);

  await db.insert(apiProviders).values({
    name: "Metenzi",
    slug: "metenzi",
    baseUrl: "https://metenzi.com/api",
    isActive: false,
    rateLimit: 60,
  });

  console.log("Seeding complete!");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
