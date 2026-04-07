import { eq } from "drizzle-orm";
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

async function findOrCreateCategory(categoryName: string): Promise<number> {
  const slug = categoryName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const [existing] = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);

  if (existing) return existing.id;

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
  platform: string,
): (typeof productVariants.$inferInsert)["platform"] {
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
  const categoryId = mp.category
    ? await findOrCreateCategory(mp.category)
    : null;

  const [existing] = await db
    .select()
    .from(products)
    .where(eq(products.slug, mp.slug))
    .limit(1);

  let productId: number;

  if (existing) {
    await db
      .update(products)
      .set({
        name: mp.name,
        description: mp.description,
        shortDescription: mp.shortDescription,
        type: mapProductType(mp.type),
        categoryId,
        imageUrl: mp.imageUrl,
        galleryImages: mp.galleryImages,
        isActive: mp.isActive,
        updatedAt: new Date(),
      })
      .where(eq(products.id, existing.id));
    productId = existing.id;
  } else {
    const [created] = await db
      .insert(products)
      .values({
        name: mp.name,
        slug: mp.slug,
        description: mp.description,
        shortDescription: mp.shortDescription,
        type: mapProductType(mp.type),
        categoryId,
        imageUrl: mp.imageUrl,
        galleryImages: mp.galleryImages,
        isActive: mp.isActive,
      })
      .returning({ id: products.id });
    productId = created.id;
  }

  if (mp.variants?.length) {
    for (const v of mp.variants) {
      await upsertVariant(productId, v);
    }
  }
}

async function upsertVariant(
  productId: number,
  v: MetenziProduct["variants"][0],
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
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .update(productVariants)
      .set(data)
      .where(eq(productVariants.id, existing.id));
  } else {
    await db.insert(productVariants).values(data);
  }
}

export async function syncProducts(): Promise<{
  synced: number;
  errors: number;
}> {
  const config = await getMetenziConfig();
  if (!config) {
    logger.warn("Skipping product sync: Metenzi not configured");
    return { synced: 0, errors: 0 };
  }

  logger.info("Starting Metenzi product sync");
  let synced = 0;
  let errors = 0;

  try {
    const allProducts = await getProducts(config);
    const metenziProducts = allProducts.filter((p) => p.isActive);
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
    return { synced: 0, errors: 1 };
  }

  logger.info({ synced, errors }, "Metenzi product sync complete");
  return { synced, errors };
}
