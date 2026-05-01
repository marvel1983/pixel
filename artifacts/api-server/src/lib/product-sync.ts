import { eq, or, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  products,
  productVariants,
  categories,
  categoryMeta,
  metenziProductMappings,
} from "@workspace/db/schema";
import { getProducts, type MetenziProduct } from "./metenzi-endpoints";
import { getMetenziConfig } from "./metenzi-config";
import { logger } from "./logger";
import { checkPriceDropAlerts, checkBackInStockAlerts } from "../services/alert-service";

async function findOrCreateCategory(categoryName: string): Promise<number> {
  const slug = categoryName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const [byName] = await db
    .select()
    .from(categories)
    .where(eq(categories.name, categoryName))
    .limit(1);

  if (byName) return byName.id;

  const [bySlug] = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);

  if (bySlug) return bySlug.id;

  const [created] = await db
    .insert(categories)
    .values({ name: categoryName, slug })
    .returning({ id: categories.id });

  await db.insert(categoryMeta).values({
    categoryId: created.id,
    displayName: categoryName,
    showInNav: true,
    sortOrder: 0,
  });

  return created.id;
}

function mapPlatform(platform: string | undefined | null): string {
  if (!platform) return "OTHER";
  const platformMap: Record<string, string> = {
    // Windows / PC
    "windows": "WINDOWS", "pc": "WINDOWS", "microsoft": "WINDOWS", "skype": "WINDOWS",
    // Cross-platform
    "windows/mac": "WINDOWS_MAC",
    // Mac / macOS
    "mac": "MAC", "macos": "MAC", "mac os": "MAC",
    // iOS (mobile — separate from macOS)
    "ios": "IOS",
    // Linux
    "linux": "LINUX",
    // Steam
    "steam": "STEAM",
    // EA App / Origin
    "origin": "ORIGIN", "ea app": "ORIGIN", "ea": "ORIGIN",
    // Ubisoft
    "uplay": "UPLAY", "ubisoft": "UPLAY", "ubisoft connect": "UPLAY",
    // GOG
    "gog": "GOG",
    // Epic
    "epic": "EPIC", "epic games": "EPIC",
    // Xbox
    "xbox": "XBOX", "microsoft xbox": "XBOX", "xbox one": "XBOX", "xbox series": "XBOX",
    // PlayStation
    "playstation": "PLAYSTATION", "sony playstation": "PLAYSTATION", "sony": "PLAYSTATION",
    "playstation 4": "PLAYSTATION", "playstation 5": "PLAYSTATION", "ps4": "PLAYSTATION", "ps5": "PLAYSTATION",
    // Nintendo
    "nintendo": "NINTENDO", "switch": "NINTENDO",
    // Music
    "spotify": "SPOTIFY",
    // Streaming
    "netflix": "NETFLIX", "hulu": "HULU",
    "disney": "DISNEY", "disney+": "DISNEY",
    "paramount": "PARAMOUNT", "paramount+": "PARAMOUNT",
    // Gift cards / payments
    "amazon": "AMAZON", "amazon prime": "AMAZON",
    "paysafe": "PAYSAFE", "paysafecard": "PAYSAFE",
    // Gaming platforms (brand-specific)
    "roblox": "ROBLOX",
    "minecraft": "MINECRAFT", "minecraft.net": "MINECRAFT",
    "battle.net": "BATTLE_NET", "blizzard": "BATTLE_NET", "blizzard entertainment": "BATTLE_NET",
    "rockstar": "ROCKSTAR", "rockstar games": "ROCKSTAR",
    "pubg": "PUBG", "pubg mobile": "PUBG",
    "razer": "RAZER", "razer gold": "RAZER",
  };
  return platformMap[platform.toLowerCase().trim()] ?? "OTHER";
}

function mapProductType(
  type: string,
): (typeof products.$inferInsert)["type"] {
  const typeMap: Record<string, string> = {
    software: "SOFTWARE",
    game: "GAME",
    subscription: "SUBSCRIPTION",
    dlc: "DLC",
    gift_card: "GIFT_CARD",
  };
  const mapped = typeMap[type.toLowerCase()];
  return (mapped ?? "SOFTWARE") as (typeof products.$inferInsert)["type"];
}

async function upsertProduct(mp: MetenziProduct): Promise<void> {
  if (!mp.slug && !mp.id) return;

  const categoryId = mp.category
    ? await findOrCreateCategory(mp.category)
    : null;

  // Look up the existing pixel product. Order of strategies (first match wins):
  //   1. metenzi_product_mappings table — the most stable link, survives renames/
  //      slug regenerations on the Metenzi side
  //   2. products.external_id — same Metenzi UUID stored directly on the product
  //      (introduced after some legacy rows were created without it)
  //   3. products.slug — for legacy rows where neither mapping nor external_id exist
  //   4. exact lowercased+trimmed name match — last-resort dedup against manually
  //      created products that share a name with a Metenzi catalog item
  let existing: typeof products.$inferSelect | undefined;

  if (mp.id) {
    const [byMapping] = await db
      .select()
      .from(products)
      .innerJoin(metenziProductMappings, eq(metenziProductMappings.pixelProductId, products.id))
      .where(eq(metenziProductMappings.metenziProductId, mp.id))
      .limit(1);
    if (byMapping) existing = byMapping.products;
  }

  if (!existing) {
    const conditions = [];
    if (mp.id) conditions.push(eq(products.externalId, mp.id));
    if (mp.slug) conditions.push(eq(products.slug, mp.slug));
    if (mp.name) conditions.push(eq(sql`LOWER(TRIM(${products.name}))`, mp.name.toLowerCase().trim()));
    if (conditions.length > 0) {
      const [byOther] = await db.select().from(products).where(or(...conditions)).limit(1);
      if (byOther) existing = byOther;
    }
  }

  let productId: number;

  if (existing) {
    // Keep any image the admin uploaded locally; never overwrite with a Metenzi server path.
    const keepImage = existing.imageUrl && !existing.imageUrl.startsWith("/uploads/product-images/");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db
      .update(products)
      .set({
        name: mp.name,
        description: mp.description,
        shortDescription: mp.shortDescription,
        type: mapProductType(mp.type ?? "software"),
        categoryId,
        imageUrl: keepImage ? existing.imageUrl : null,
        galleryImages: mp.galleryImages ?? null,
        isActive: isProductActive(mp),
        externalId: mp.id ?? existing.externalId,
        // slug intentionally NOT updated — preserve the original URL forever
        updatedAt: new Date(),
      } as any)
      .where(eq(products.id, existing.id));
    productId = existing.id;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [created] = await db
      .insert(products)
      .values({
        name: mp.name,
        slug: mp.slug ?? deriveSlug(mp),
        externalId: mp.id ?? null,
        description: mp.description,
        shortDescription: mp.shortDescription,
        type: mapProductType(mp.type ?? "software"),
        categoryId,
        imageUrl: null,
        galleryImages: mp.galleryImages ?? null,
        isActive: isProductActive(mp),
      } as any)
      .returning({ id: products.id });
    productId = created.id;
  }

  // Keep metenzi_product_mappings in sync with where the variants actually live.
  // Without this, renaming a Metenzi product orphans the old mapping (which is
  // exactly how order PC-MON3F5IG-9AVW0448 ended up unfulfillable).
  if (mp.id) {
    await syncMappingRow(productId, mp);
  }

  const backorderEta = mp.estimatedRestockDate ?? mp.backorderEta ?? mp.restockEta ?? null;
  if (mp.variants?.length) {
    for (const v of mp.variants) {
      await upsertVariant(productId, v, backorderEta);
    }
  } else if (mp.sku) {
    // Metenzi product has no variants array — synthesize one from top-level fields
    await upsertVariant(productId, {
      sku: mp.sku,
      name: mp.name,
      platform: mp.platform ?? "WINDOWS",
      priceUsd: (mp.retailPriceCents ?? 0) / 100,
      compareAtPriceUsd: null,
      stockCount: mp.stock ?? mp.textKeyStock ?? 0,
    }, backorderEta);
  }
}

async function syncMappingRow(pixelProductId: number, mp: MetenziProduct): Promise<void> {
  const [existing] = await db
    .select({ id: metenziProductMappings.id, pixelProductId: metenziProductMappings.pixelProductId })
    .from(metenziProductMappings)
    .where(eq(metenziProductMappings.metenziProductId, mp.id))
    .limit(1);

  const baseFields = {
    metenziSku: mp.sku ?? null,
    metenziName: mp.name,
    updatedAt: new Date(),
  };

  if (existing) {
    if (existing.pixelProductId !== pixelProductId) {
      logger.info(
        { metenziProductId: mp.id, fromPixelProductId: existing.pixelProductId, toPixelProductId: pixelProductId },
        "Re-pointing Metenzi mapping to follow variant migration",
      );
    }
    await db
      .update(metenziProductMappings)
      .set({ pixelProductId, ...baseFields })
      .where(eq(metenziProductMappings.id, existing.id));
  } else {
    await db.insert(metenziProductMappings).values({
      metenziProductId: mp.id,
      pixelProductId,
      ...baseFields,
    });
    logger.info({ metenziProductId: mp.id, pixelProductId }, "Created Metenzi mapping during sync");
  }
}

type MetenziVariant = NonNullable<MetenziProduct["variants"]>[number];

async function upsertVariant(
  productId: number,
  v: MetenziVariant,
  backorderEta: string | null = null,
): Promise<void> {
  const [existing] = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.sku, v.sku))
    .limit(1);

  const data = {
    productId,
    name: v.name,
    sku: v.sku,
    platform: mapPlatform(v.platform),
    priceUsd: v.priceUsd.toString(),
    compareAtPriceUsd: v.compareAtPriceUsd?.toString() ?? null,
    stockCount: v.stockCount,
    backorderAllowed: true, // Metenzi fulfills orders even when stock is 0
    backorderEta,
    updatedAt: new Date(),
  };


  if (existing) {
    const oldPrice = existing.priceUsd;
    const oldStock = existing.stockCount;

    await db
      .update(productVariants)
      .set(data)
      .where(eq(productVariants.id, existing.id));

    checkPriceDropAlerts(existing.id, productId, oldPrice, data.priceUsd).catch((err) => {
      logger.error({ err, variantId: existing.id }, "Price drop alert check failed");
    });

    checkBackInStockAlerts(existing.id, productId, oldStock, data.stockCount, data.priceUsd).catch((err) => {
      logger.error({ err, variantId: existing.id }, "Back-in-stock alert check failed");
    });
  } else {
    await db.insert(productVariants).values(data);
  }
}

// Metenzi uses status:"active"|"in_stock"|"disabled" — isActive is optional and often absent.
function isProductActive(p: MetenziProduct): boolean {
  if (typeof p.isActive === "boolean") return p.isActive;
  const s = (p.status ?? "").toLowerCase();
  return s !== "disabled" && s !== "inactive" && s !== "archived";
}

// Generate a URL-safe slug from name + id suffix when Metenzi omits the slug field.
function deriveSlug(mp: MetenziProduct): string {
  const base = mp.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
  return `${base}-${mp.id.slice(-6)}`;
}

export async function syncProducts(): Promise<{
  synced: number;
  errors: number;
  totalFetched: number;
}> {
  const config = await getMetenziConfig();
  if (!config) {
    logger.warn("Skipping product sync: Metenzi not configured");
    return { synced: 0, errors: 0, totalFetched: 0 };
  }

  logger.info("Starting Metenzi product sync");
  let synced = 0;
  let errors = 0;
  let totalFetched = 0;

  try {
    const allProducts = await getProducts(config);
    totalFetched = allProducts.length;
    const metenziProducts = allProducts.filter(isProductActive);
    logger.info(
      { total: allProducts.length, active: metenziProducts.length },
      "Fetched Metenzi products",
    );

    for (const mp of metenziProducts) {
      try {
        await upsertProduct(mp);
        synced++;
      } catch (error) {
        errors++;
        logger.error({ error, slug: mp.slug }, "Failed to sync product");
      }
    }
  } catch (error) {
    logger.error({ error }, "Failed to fetch Metenzi products");
    return { synced: 0, errors: 1, totalFetched: 0 };
  }

  logger.info({ synced, errors }, "Metenzi product sync complete");
  return { synced, errors, totalFetched };
}
