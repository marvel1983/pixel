import { eq, and } from "drizzle-orm";
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
import { enqueueConflict, nameSimilarity, writeMappingAudit } from "../services/mapping-conflicts";

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

  // Resolve the matching pixel product (or queue a conflict for admin review).
  // See resolveExistingProduct for the full cascade.
  const resolution = await resolveExistingProduct(mp);
  if (resolution.kind === "queued") return; // conflict surfaced to admin; do not write

  let existing = resolution.kind === "found" ? resolution.product : undefined;

  let productId: number;

  if (existing) {
    // Keep any image the admin uploaded locally; never overwrite with a Metenzi server path.
    const keepImage = existing.imageUrl && !existing.imageUrl.startsWith("/uploads/product-images/");
    // isActive intentionally NOT updated — admin's Active/Inactive toggle is the
    // source of truth on existing products. Otherwise the sync flips manually
    // disabled items back to active every 30 min.
    // categoryId intentionally NOT updated — admin assigns products to specific
    // sub-categories (antivirus, office, etc.); Metenzi always sends "Software"
    // which would overwrite manual assignments on every 30-min sync.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db
      .update(products)
      .set({
        name: mp.name,
        description: mp.description,
        shortDescription: mp.shortDescription,
        type: mapProductType(mp.type ?? "software"),
        imageUrl: keepImage ? existing.imageUrl : null,
        galleryImages: mp.galleryImages ?? null,
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
    .select({
      id: metenziProductMappings.id,
      pixelProductId: metenziProductMappings.pixelProductId,
      disabled: metenziProductMappings.disabled,
    })
    .from(metenziProductMappings)
    .where(eq(metenziProductMappings.metenziProductId, mp.id))
    .limit(1);

  // Respect admin's "Unmap" decision — disabled rows are owned by the admin
  // and sync must not touch them. This is the contract that makes manual
  // unmapping actually stick.
  if (existing?.disabled) {
    logger.info({ metenziProductId: mp.id, mappingId: existing.id }, "Skipping disabled mapping (admin unmapped)");
    return;
  }

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
      await writeMappingAudit({
        action: "UPDATE",
        pixelProductId,
        metenziProductId: mp.id,
        details: { fromPixelProductId: existing.pixelProductId, toPixelProductId: pixelProductId, reason: "variant_migration" },
      });
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
    await writeMappingAudit({
      action: "CREATE",
      pixelProductId,
      metenziProductId: mp.id,
      details: { metenziSku: mp.sku ?? null, metenziName: mp.name },
    });
  }
}

type ProductResolution =
  | { kind: "found"; product: typeof products.$inferSelect }
  | { kind: "new" }
  | { kind: "queued" };

/**
 * Lookup cascade for an incoming Metenzi product. Three outcomes:
 *   - found   → caller should UPDATE this pixel product in place
 *   - queued  → caller should do nothing (an admin conflict was enqueued)
 *   - new     → caller should INSERT a fresh pixel product
 *
 * Order of attempts (first match wins, all skip rows where mapping.disabled=true):
 *   1. UUID match in metenzi_product_mappings
 *   2. SKU match in metenzi_product_mappings → if UUID differs, this is a
 *      potential UUID rotation: ENQUEUE conflict, do not auto-migrate
 *   3. external_id match on products
 *   4. slug match on products
 *   5. fuzzy name match against existing products → ENQUEUE conflict
 *   6. fall through → "new"
 */
async function resolveExistingProduct(mp: MetenziProduct): Promise<ProductResolution> {
  // 1. UUID via mapping (active only)
  if (mp.id) {
    const [byUUID] = await db
      .select()
      .from(products)
      .innerJoin(metenziProductMappings, eq(metenziProductMappings.pixelProductId, products.id))
      .where(and(eq(metenziProductMappings.metenziProductId, mp.id), eq(metenziProductMappings.disabled, false)))
      .limit(1);
    if (byUUID) return { kind: "found", product: byUUID.products };

    // The UUID exists as a disabled mapping → admin said "leave this Metenzi
    // product alone." Honour that and don't process further.
    const [disabledByUUID] = await db
      .select({ id: metenziProductMappings.id })
      .from(metenziProductMappings)
      .where(and(eq(metenziProductMappings.metenziProductId, mp.id), eq(metenziProductMappings.disabled, true)))
      .limit(1);
    if (disabledByUUID) {
      logger.info({ metenziProductId: mp.id }, "Sync skipped: Metenzi product is admin-disabled");
      return { kind: "queued" };
    }
  }

  // 2. SKU via mapping → potential UUID rotation
  if (mp.sku) {
    const [bySku] = await db
      .select({
        mappingId: metenziProductMappings.id,
        mappingUUID: metenziProductMappings.metenziProductId,
        pixelProductId: metenziProductMappings.pixelProductId,
      })
      .from(metenziProductMappings)
      .where(and(eq(metenziProductMappings.metenziSku, mp.sku), eq(metenziProductMappings.disabled, false)))
      .limit(1);
    if (bySku && bySku.mappingUUID !== mp.id && bySku.pixelProductId != null) {
      await enqueueConflict({
        type: "uuid_rotation",
        metenziProduct: mp,
        candidatePixelProductId: bySku.pixelProductId,
        candidateMappingId: bySku.mappingId,
      });
      return { kind: "queued" };
    }
  }

  // 3. external_id on product (legacy: mapping table empty but product was tagged)
  if (mp.id) {
    const [byExt] = await db.select().from(products).where(eq(products.externalId, mp.id)).limit(1);
    if (byExt) return { kind: "found", product: byExt };
  }

  // 4. slug match
  if (mp.slug) {
    const [bySlug] = await db.select().from(products).where(eq(products.slug, mp.slug)).limit(1);
    if (bySlug) return { kind: "found", product: bySlug };
  }

  // 5a. fuzzy name match against INACTIVE products → silently merge (preserves
  //     admin's deactivation decision; prevents duplicate active products).
  if (mp.name) {
    const inactiveCandidate = await findFuzzyNameCandidate(mp.name, false);
    if (inactiveCandidate) {
      const [product] = await db.select().from(products).where(eq(products.id, inactiveCandidate.id)).limit(1);
      if (product) return { kind: "found", product };
    }
  }

  // 5b. fuzzy name match against ACTIVE products → conflict (do not auto-link)
  if (mp.name) {
    const candidate = await findFuzzyNameCandidate(mp.name, true);
    if (candidate) {
      await enqueueConflict({
        type: "fuzzy_name_match",
        metenziProduct: mp,
        candidatePixelProductId: candidate.id,
        similarityScore: candidate.score,
      });
      return { kind: "queued" };
    }
  }

  return { kind: "new" };
}

const FUZZY_NAME_THRESHOLD = 0.7;
const FUZZY_NAME_CANDIDATE_LIMIT = 500;

async function findFuzzyNameCandidate(name: string, activeOnly: boolean): Promise<{ id: number; name: string; score: number } | null> {
  const candidates = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(eq(products.isActive, activeOnly))
    .limit(FUZZY_NAME_CANDIDATE_LIMIT);
  let best: { id: number; name: string; score: number } | null = null;
  for (const c of candidates) {
    const score = nameSimilarity(name, c.name);
    if (score >= FUZZY_NAME_THRESHOLD && (!best || score > best.score)) {
      best = { id: c.id, name: c.name, score };
    }
  }
  return best;
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
