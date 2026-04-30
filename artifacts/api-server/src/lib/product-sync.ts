import { eq, or } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  products,
  productVariants,
  categories,
  categoryMeta,
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

function mapPlatform(
  platform: string | undefined | null,
): (typeof productVariants.$inferInsert)["platform"] {
  if (!platform) return "OTHER" as (typeof productVariants.$inferInsert)["platform"];
  const platformMap: Record<string, string> = {
    windows: "WINDOWS",
    mac: "MAC",
    linux: "LINUX",
    steam: "STEAM",
    origin: "ORIGIN",
    uplay: "UPLAY",
    gog: "GOG",
    epic: "EPIC",
    xbox: "XBOX",
    playstation: "PLAYSTATION",
    nintendo: "NINTENDO",
  };
  const mapped = platformMap[platform.toLowerCase()];
  return (mapped ?? "OTHER") as (typeof productVariants.$inferInsert)["platform"];
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

  // Look up by stable Metenzi ID first, then fall back to slug.
  // This preserves existing slugs even when Metenzi renames their product URLs.
  const conditions = [];
  if (mp.id) conditions.push(eq(products.externalId, mp.id));
  if (mp.slug) conditions.push(eq(products.slug, mp.slug));

  const [existing] = conditions.length > 0
    ? await db.select().from(products).where(or(...conditions)).limit(1)
    : [];

  let productId: number;

  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db
      .update(products)
      .set({
        name: mp.name,
        description: mp.description,
        shortDescription: mp.shortDescription,
        type: mapProductType(mp.type ?? "software"),
        categoryId,
        imageUrl: mp.imageUrl,
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
        imageUrl: mp.imageUrl,
        galleryImages: mp.galleryImages ?? null,
        isActive: isProductActive(mp),
      } as any)
      .returning({ id: products.id });
    productId = created.id;
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
