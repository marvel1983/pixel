import { db, pool } from "@workspace/db";
import {
  users,
  categories,
  products,
  productVariants,
  siteSettings,
  faqs,
  pages,
  apiProviders,
  currencyRates,
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
    defaultCurrency: "EUR",
    enabledCurrencies: ["EUR", "USD", "GBP", "CAD", "AUD", "PLN"],
    metaTitleTemplate: "{title} | PixelCodes",
    metaDescription:
      "Buy genuine software license keys at the best prices. Instant digital delivery.",
  });

  const [os] = await db.insert(categories).values({ name: "Operating Systems", slug: "operating-systems", description: "Windows, macOS and other operating system licenses", sortOrder: 1 }).returning();
  const [office] = await db.insert(categories).values({ name: "Office & Productivity", slug: "office-productivity", description: "Microsoft Office, Adobe and productivity suites", sortOrder: 2 }).returning();
  const [security] = await db.insert(categories).values({ name: "Antivirus & Security", slug: "antivirus-security", description: "Antivirus, VPN and security software", sortOrder: 3 }).returning();
  const [gaming] = await db.insert(categories).values({ name: "Games", slug: "games", description: "PC games and gaming platform keys", sortOrder: 4 }).returning();
  const [servers] = await db.insert(categories).values({ name: "Servers & Development", slug: "servers-development", description: "Server licenses and development tools", sortOrder: 5 }).returning();

  const seedProducts = [
    { name: "Windows 11 Pro", slug: "windows-11-pro", shortDescription: "Genuine Windows 11 Professional license key", type: "SOFTWARE" as const, categoryId: os.id, isFeatured: true, imageUrl: "/products/windows-11-pro.png", variants: [{ name: "Digital License", sku: "WIN11PRO-01", priceUsd: "29.99", compareAtPriceUsd: "199.99", stockCount: 50, platform: "WINDOWS" as const }] },
    { name: "Windows 11 Home", slug: "windows-11-home", shortDescription: "Windows 11 Home edition with modern interface", type: "SOFTWARE" as const, categoryId: os.id, imageUrl: "/products/windows-11-home.png", variants: [{ name: "Digital License", sku: "WIN11HOME-01", priceUsd: "19.99", compareAtPriceUsd: "139.99", stockCount: 80, platform: "WINDOWS" as const }] },
    { name: "Windows 10 Pro", slug: "windows-10-pro", shortDescription: "Genuine Windows 10 Professional license key", type: "SOFTWARE" as const, categoryId: os.id, isFeatured: true, imageUrl: "/products/windows-10-pro.png", variants: [{ name: "Digital License", sku: "WIN10PRO-01", priceUsd: "14.99", compareAtPriceUsd: "199.99", stockCount: 100, platform: "WINDOWS" as const }] },
    { name: "Windows 10 Home", slug: "windows-10-home", shortDescription: "Windows 10 Home edition with Cortana and Edge", type: "SOFTWARE" as const, categoryId: os.id, imageUrl: "/products/windows-10-home.png", variants: [{ name: "Digital License", sku: "WIN10HOME-01", priceUsd: "12.99", compareAtPriceUsd: "139.99", stockCount: 70, platform: "WINDOWS" as const }] },
    { name: "Windows Server 2022 Standard", slug: "windows-server-2022-standard", shortDescription: "Server operating system for businesses", type: "SOFTWARE" as const, categoryId: os.id, imageUrl: "/products/windows-server-2022.png", variants: [{ name: "License Key", sku: "WINSRV2022-STD", priceUsd: "149.99", compareAtPriceUsd: "1099.99", stockCount: 10, platform: "WINDOWS" as const }] },
    { name: "Windows Server 2019 Standard", slug: "windows-server-2019-standard", shortDescription: "Reliable server OS with Hyper-V and Storage Spaces", type: "SOFTWARE" as const, categoryId: os.id, imageUrl: "/products/windows-server-2019.png", variants: [{ name: "License Key", sku: "WINSRV2019-STD", priceUsd: "99.99", compareAtPriceUsd: "899.99", stockCount: 25, platform: "WINDOWS" as const }] },
    { name: "Office 2024 Professional Plus", slug: "office-2024-pro-plus", shortDescription: "Full Office suite with Word, Excel, PowerPoint & more", type: "SOFTWARE" as const, categoryId: office.id, isFeatured: true, isNew: true, imageUrl: "/products/office-2024-pro-plus.png", variants: [{ name: "PC Key", sku: "OFF2024PP-PC", priceUsd: "69.99", compareAtPriceUsd: "439.99", stockCount: 30, platform: "WINDOWS" as const }] },
    { name: "Office 2024 Home & Business", slug: "office-2024-home-business", shortDescription: "Latest Office suite for home and business use", type: "SOFTWARE" as const, categoryId: office.id, isNew: true, imageUrl: "/products/office-2024-home.png", variants: [{ name: "PC Key", sku: "OFF2024HB-PC", priceUsd: "49.99", compareAtPriceUsd: "249.99", stockCount: 25, platform: "WINDOWS" as const }] },
    { name: "Office 2021 Professional Plus", slug: "office-2021-pro-plus", shortDescription: "Previous-gen Office suite with all Pro apps", type: "SOFTWARE" as const, categoryId: office.id, isFeatured: true, imageUrl: "/products/office-2021-pro-plus.png", variants: [{ name: "PC Key", sku: "OFF2021PP-PC", priceUsd: "39.99", compareAtPriceUsd: "399.99", stockCount: 30, platform: "WINDOWS" as const }] },
    { name: "Microsoft 365 Family", slug: "microsoft-365-family", shortDescription: "1-year subscription for up to 6 people with 1TB OneDrive", type: "SUBSCRIPTION" as const, categoryId: office.id, imageUrl: "/products/microsoft-365.png", variants: [{ name: "12-Month Key", sku: "M365FAM-1Y", priceUsd: "54.99", compareAtPriceUsd: "99.99", stockCount: 35, platform: "WINDOWS" as const }] },
    { name: "Microsoft Project 2021 Professional", slug: "project-2021-pro", shortDescription: "Professional project management with Gantt charts", type: "SOFTWARE" as const, categoryId: office.id, imageUrl: "/products/project-2021.png", variants: [{ name: "License Key", sku: "PROJ2021-PRO", priceUsd: "59.99", compareAtPriceUsd: "349.99", stockCount: 10, platform: "WINDOWS" as const }] },
    { name: "Microsoft Visio 2021 Professional", slug: "visio-2021-pro", shortDescription: "Professional diagramming with flowcharts and org charts", type: "SOFTWARE" as const, categoryId: office.id, imageUrl: "/products/visio-2021.png", variants: [{ name: "License Key", sku: "VISIO2021-PRO", priceUsd: "44.99", compareAtPriceUsd: "299.99", stockCount: 8, platform: "WINDOWS" as const }] },
    { name: "Norton 360 Deluxe", slug: "norton-360-deluxe", shortDescription: "Complete protection for up to 5 devices - 1 year", type: "SUBSCRIPTION" as const, categoryId: security.id, isNew: true, imageUrl: "/products/norton-360.png", variants: [{ name: "1 Year / 5 Devices", sku: "NRT360DLX-1Y", priceUsd: "19.99", compareAtPriceUsd: "49.99", stockCount: 40, platform: "WINDOWS" as const }] },
    { name: "Kaspersky Total Security", slug: "kaspersky-total-security", shortDescription: "Premium antivirus with VPN and password manager", type: "SUBSCRIPTION" as const, categoryId: security.id, imageUrl: "/products/kaspersky-total.png", variants: [{ name: "1 Year / 3 Devices", sku: "KTS-1Y3D", priceUsd: "24.99", compareAtPriceUsd: "79.99", stockCount: 35, platform: "WINDOWS" as const }] },
    { name: "Bitdefender Total Security", slug: "bitdefender-total", shortDescription: "Top-rated antivirus with ransomware protection for 5 devices", type: "SUBSCRIPTION" as const, categoryId: security.id, isFeatured: true, imageUrl: "/products/bitdefender-total.png", variants: [{ name: "1 Year / 5 Devices", sku: "BITDEF-TOT-5D", priceUsd: "22.99", compareAtPriceUsd: "89.99", stockCount: 20, platform: "WINDOWS" as const }] },
    { name: "McAfee Total Protection", slug: "mcafee-total", shortDescription: "All-in-one protection with identity monitoring for unlimited devices", type: "SUBSCRIPTION" as const, categoryId: security.id, imageUrl: "/products/mcafee-total.png", variants: [{ name: "1 Year / Unlimited", sku: "MCAFEE-UNL-1Y", priceUsd: "17.99", compareAtPriceUsd: "59.99", stockCount: 18, platform: "WINDOWS" as const }] },
    { name: "Malwarebytes Premium", slug: "malwarebytes-premium", shortDescription: "Advanced malware detection and removal with real-time protection", type: "SUBSCRIPTION" as const, categoryId: security.id, imageUrl: "/products/malwarebytes.png", variants: [{ name: "1 Year / 3 Devices", sku: "MWBYTES-3D-1Y", priceUsd: "14.99", compareAtPriceUsd: "44.99", stockCount: 25, platform: "WINDOWS" as const }] },
    { name: "ESET NOD32 Antivirus", slug: "eset-nod32", shortDescription: "Lightweight antivirus with low system impact and gamer mode", type: "SUBSCRIPTION" as const, categoryId: security.id, imageUrl: "/products/eset-nod32.png", variants: [{ name: "1 Year / 1 Device", sku: "ESET-NOD32-1D", priceUsd: "15.99", compareAtPriceUsd: "39.99", stockCount: 16, platform: "WINDOWS" as const }] },
    { name: "Elden Ring", slug: "elden-ring", shortDescription: "Epic action RPG by FromSoftware", type: "GAME" as const, categoryId: gaming.id, isFeatured: true, imageUrl: "/products/elden-ring.png", variants: [{ name: "Steam Key", sku: "ELDEN-STEAM", priceUsd: "39.99", compareAtPriceUsd: "59.99", stockCount: 15, platform: "STEAM" as const }] },
    { name: "Cyberpunk 2077", slug: "cyberpunk-2077", shortDescription: "Open-world RPG set in Night City", type: "GAME" as const, categoryId: gaming.id, imageUrl: "/products/cyberpunk-2077.png", variants: [{ name: "Steam Key", sku: "CP2077-STEAM", priceUsd: "29.99", compareAtPriceUsd: "59.99", stockCount: 20, platform: "STEAM" as const }] },
    { name: "Hogwarts Legacy", slug: "hogwarts-legacy", shortDescription: "Open-world action RPG in the Wizarding World", type: "GAME" as const, categoryId: gaming.id, isNew: true, imageUrl: "/products/hogwarts-legacy.png", variants: [{ name: "Steam Key", sku: "HOGWARTS-STEAM", priceUsd: "29.99", compareAtPriceUsd: "59.99", stockCount: 25, platform: "STEAM" as const }] },
    { name: "Red Dead Redemption 2", slug: "red-dead-redemption-2", shortDescription: "Epic tale of life in America at the dawn of the modern age", type: "GAME" as const, categoryId: gaming.id, isFeatured: true, imageUrl: "/products/rdr2.png", variants: [{ name: "Steam Key", sku: "RDR2-STEAM", priceUsd: "19.99", compareAtPriceUsd: "59.99", stockCount: 80, platform: "STEAM" as const }] },
    { name: "Baldur's Gate 3", slug: "baldurs-gate-3", shortDescription: "Gather your party and return to the Forgotten Realms", type: "GAME" as const, categoryId: gaming.id, isFeatured: true, isNew: true, imageUrl: "/products/baldurs-gate-3.png", variants: [{ name: "Steam Key", sku: "BG3-STEAM", priceUsd: "44.99", compareAtPriceUsd: "59.99", stockCount: 35, platform: "STEAM" as const }] },
    { name: "GTA V Premium Edition", slug: "gta-v", shortDescription: "Open world with GTA Online and Criminal Enterprise bonus", type: "GAME" as const, categoryId: gaming.id, imageUrl: "/products/gta-v.png", variants: [{ name: "Steam Key", sku: "GTAV-STEAM", priceUsd: "14.99", compareAtPriceUsd: "29.99", stockCount: 120, platform: "STEAM" as const }] },
    { name: "Visual Studio 2022 Professional", slug: "visual-studio-2022-pro", shortDescription: "Professional IDE for .NET and C++ development", type: "SOFTWARE" as const, categoryId: servers.id, imageUrl: "/products/visual-studio-2022.png", variants: [{ name: "License Key", sku: "VS2022PRO-01", priceUsd: "89.99", compareAtPriceUsd: "599.99", stockCount: 15, platform: "WINDOWS" as const }] },
    { name: "Adobe Creative Cloud", slug: "adobe-creative-cloud", shortDescription: "Full Adobe CC suite - Photoshop, Illustrator & more", type: "SUBSCRIPTION" as const, categoryId: servers.id, isFeatured: true, imageUrl: "/products/adobe-cc.png", variants: [{ name: "1 Year Subscription", sku: "ADOBECC-1Y", priceUsd: "199.99", compareAtPriceUsd: "659.88", stockCount: 20, platform: "WINDOWS" as const }] },
    { name: "AutoCAD 2024", slug: "autocad-2024", shortDescription: "Industry-leading 2D and 3D CAD software", type: "SUBSCRIPTION" as const, categoryId: servers.id, isNew: true, imageUrl: "/products/autocad-2024.png", variants: [{ name: "1 Year License", sku: "AUTOCAD-2024", priceUsd: "279.99", compareAtPriceUsd: "1775.00", stockCount: 20, platform: "WINDOWS" as const }] },
    { name: "SQL Server 2022 Standard", slug: "sql-server-2022", shortDescription: "Enterprise database with built-in intelligence", type: "SOFTWARE" as const, categoryId: servers.id, imageUrl: "/products/sql-server-2022.png", variants: [{ name: "License Key", sku: "SQLSRV2022-STD", priceUsd: "349.99", compareAtPriceUsd: "1539.99", stockCount: 15, platform: "WINDOWS" as const }] },
    { name: "JetBrains IntelliJ IDEA", slug: "intellij-idea", shortDescription: "Professional Java IDE with smart code completion", type: "SUBSCRIPTION" as const, categoryId: servers.id, isNew: true, imageUrl: "/products/intellij-idea.png", variants: [{ name: "1 Year License", sku: "INTELLIJ-1Y", priceUsd: "129.99", compareAtPriceUsd: "499.00", stockCount: 30, platform: "WINDOWS" as const }] },
    { name: "VMware Workstation Pro", slug: "vmware-workstation", shortDescription: "Desktop virtualization software for running multiple OS", type: "SOFTWARE" as const, categoryId: servers.id, imageUrl: "/products/vmware-workstation.png", variants: [{ name: "License Key", sku: "VMWARE-WS-PRO", priceUsd: "99.99", compareAtPriceUsd: "199.99", stockCount: 40, platform: "WINDOWS" as const }] },
  ];

  for (const p of seedProducts) {
    const { variants, ...productData } = p;
    const [product] = await db.insert(products).values(productData).returning();
    for (const v of variants) {
      await db.insert(productVariants).values({ ...v, productId: product.id });
    }
  }

  await db.insert(faqs).values([
    { question: "How do I receive my license key?", answer: "After your payment is confirmed, your license key will be instantly available in your order confirmation page and sent to your email.", categoryLabel: "Orders", sortOrder: 1 },
    { question: "Are these keys genuine?", answer: "Yes, all our keys are 100% genuine and sourced from authorized distributors. Every key is guaranteed to activate successfully.", categoryLabel: "Products", sortOrder: 2 },
    { question: "What payment methods do you accept?", answer: "We accept all major credit and debit cards through our secure payment processor. You can also pay using your PixelCodes wallet balance.", categoryLabel: "Payment", sortOrder: 3 },
    { question: "Can I get a refund?", answer: "If your key fails to activate, contact our support team and we will provide a replacement or full refund within 30 days of purchase.", categoryLabel: "Refunds", sortOrder: 4 },
  ]);

  const defaultPages = [
    { title: "About Us", slug: "about-us", content: "<h1>About Us</h1><p>Content coming soon.</p>", isPublished: true, sortOrder: 0 },
    { title: "Terms of Service", slug: "terms", content: "<h1>Terms of Service</h1><p>Content coming soon.</p>", isPublished: true, sortOrder: 1 },
    { title: "Privacy Policy", slug: "privacy-policy", content: "<h1>Privacy Policy</h1><p>Content coming soon.</p>", isPublished: true, sortOrder: 2 },
    { title: "Refund Policy", slug: "refund-policy", content: "<h1>Refund Policy</h1><p>Content coming soon.</p>", isPublished: true, sortOrder: 3 },
    { title: "Delivery Terms", slug: "delivery-terms", content: "<h1>Delivery Terms</h1><p>Content coming soon.</p>", isPublished: true, sortOrder: 4 },
    { title: "Payment Methods", slug: "payment-methods", content: "<h1>Payment Methods</h1><p>Content coming soon.</p>", isPublished: true, sortOrder: 5 },
    { title: "FAQ", slug: "faq", content: "<h1>FAQ</h1><p>Content coming soon.</p>", isPublished: true, sortOrder: 6 },
    { title: "How to Buy", slug: "how-to-buy", content: "<h1>How to Buy</h1><p>Content coming soon.</p>", isPublished: true, sortOrder: 7 },
    { title: "Reseller Application", slug: "reseller-application", content: "<h1>Reseller Application</h1><p>Content coming soon.</p>", isPublished: true, sortOrder: 8 },
    { title: "Contact", slug: "contact", content: "<h1>Contact</h1><p>Content coming soon.</p>", isPublished: true, sortOrder: 9 },
    { title: "Cookie Policy", slug: "cookie-policy", content: "<h1>Cookie Policy</h1><p>Content coming soon.</p>", isPublished: true, sortOrder: 10 },
    { title: "Careers", slug: "careers", content: "<h1>Careers</h1><p>Content coming soon.</p>", isPublished: true, sortOrder: 11 },
    { title: "Press", slug: "press", content: "<h1>Press</h1><p>Content coming soon.</p>", isPublished: true, sortOrder: 12 },
  ];
  await db.insert(pages).values(defaultPages);

  await db.insert(apiProviders).values({
    name: "Metenzi",
    slug: "metenzi",
    baseUrl: "https://metenzi.com/api",
    isActive: false,
    rateLimit: 60,
  });

  // Rates are relative to EUR base (1 EUR = X of that currency). EUR=1.0 is the anchor.
  await db.insert(currencyRates).values([
    { currencyCode: "EUR", symbol: "€",  rateToUsd: "1.00",   sortOrder: 0 },
    { currencyCode: "USD", symbol: "$",  rateToUsd: "1.08",   sortOrder: 1 },
    { currencyCode: "GBP", symbol: "£",  rateToUsd: "0.86",   sortOrder: 2 },
    { currencyCode: "PLN", symbol: "zł", rateToUsd: "4.30",   sortOrder: 3 },
    { currencyCode: "CZK", symbol: "Kč", rateToUsd: "25.30",  sortOrder: 4 },
    { currencyCode: "HUF", symbol: "Ft", rateToUsd: "395.00", sortOrder: 5 },
    { currencyCode: "CAD", symbol: "C$", rateToUsd: "1.47",   sortOrder: 6 },
    { currencyCode: "AUD", symbol: "A$", rateToUsd: "1.66",   sortOrder: 7 },
    { currencyCode: "BRL", symbol: "R$", rateToUsd: "5.50",   sortOrder: 8 },
    { currencyCode: "TRY", symbol: "₺",  rateToUsd: "35.20",  sortOrder: 9 },
  ]);

  console.log("Seeding complete!");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
