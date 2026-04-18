import { createWriteStream } from "node:fs";
import { rename, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { products, productVariants, categories, productFeeds } from "@workspace/db/schema";
import type { ProductFeed } from "@workspace/db/schema";
import { evaluateFilters } from "./feed-engine/filter-evaluator";
import { enrichProduct, transformProduct } from "./feed-engine/transformer";
import { rowToXmlItem, xmlHeader, XML_FOOTER, rowToCsvLine, csvHeaderLine } from "./feed-engine/feed-formats";
import { logger } from "../lib/logger";

const FEED_DIR = process.env.FEED_OUTPUT_DIR ?? join(process.cwd(), "feeds");
const BATCH = 200;

type ProductRow = Record<string, unknown>;

async function* productBatches(includeVariations: boolean): AsyncGenerator<ProductRow> {
  let offset = 0;
  const seenProducts = new Set<number>();

  while (true) {
    const rows = await db
      .select({
        id: products.id, variantId: productVariants.id,
        name: products.name, variantName: productVariants.name,
        slug: products.slug, description: products.description,
        shortDescription: products.shortDescription,
        sku: productVariants.sku,
        price: productVariants.priceUsd,
        compareAtPrice: productVariants.compareAtPriceUsd,
        stock: productVariants.stockCount,
        platform: productVariants.platform,
        imageUrl: products.imageUrl,
        isActive: products.isActive,
        category: categories.name,
      })
      .from(products)
      .innerJoin(productVariants, eq(productVariants.productId, products.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(eq(products.isActive, true), eq(productVariants.isActive, true)))
      .orderBy(products.id, productVariants.id)
      .limit(BATCH)
      .offset(offset);

    if (rows.length === 0) break;

    for (const row of rows) {
      if (!includeVariations) {
        if (seenProducts.has(row.id)) continue;
        seenProducts.add(row.id);
      }
      yield row as ProductRow;
    }

    if (rows.length < BATCH) break;
    offset += BATCH;
  }
}

export interface GenerationResult {
  success: boolean;
  rowCount?: number;
  path?: string;
  error?: string;
}

export async function generateFeed(feed: ProductFeed): Promise<GenerationResult> {
  const ext = feed.format === "csv" ? "csv" : "xml";
  const tmpPath = join(FEED_DIR, `${feed.slug}.tmp`);
  const finalPath = join(FEED_DIR, `${feed.slug}.${ext}`);

  await mkdir(FEED_DIR, { recursive: true });
  const ws = createWriteStream(tmpPath);

  const writeAsync = (chunk: string) =>
    new Promise<void>((res, rej) => ws.write(chunk, (e) => (e ? rej(e) : res())));

  try {
    const cfg = feed.currencyConfig ?? { baseCurrency: "USD", targetCurrency: "USD", exchangeRate: 1, taxOffset: 0, rateMode: "manual" };
    const storeUrl = feed.storeUrl ?? "";
    const mappings = feed.fieldMappings ?? [];
    const filterRules = feed.filterRules ?? { id: "root", type: "group", condition: "AND", rules: [] };
    const headers = mappings.map((m) => m.feedKey);

    if (feed.format === "xml") {
      await writeAsync(xmlHeader(feed.name));
    } else {
      await writeAsync(csvHeaderLine(headers));
    }

    let rowCount = 0;
    for await (const raw of productBatches(feed.includeVariations)) {
      const enriched = enrichProduct(raw, cfg, storeUrl);
      if (!evaluateFilters(enriched, filterRules)) continue;
      const row = transformProduct(enriched, mappings);
      if (Object.keys(row).length === 0) continue;
      await writeAsync(feed.format === "xml" ? rowToXmlItem(row) : rowToCsvLine(row, headers));
      rowCount++;
    }

    if (feed.format === "xml") await writeAsync(XML_FOOTER);

    await new Promise<void>((res, rej) => ws.end((e?: Error | null) => (e ? rej(e) : res())));
    await rename(tmpPath, finalPath);

    logger.info({ feedId: feed.id, slug: feed.slug, rowCount }, "Feed generated");
    return { success: true, rowCount, path: finalPath };
  } catch (err) {
    ws.destroy();
    logger.error({ err, feedId: feed.id }, "Feed generation failed");
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Called by cron and the manual trigger endpoint
export async function runFeedGeneration(feedId: number): Promise<void> {
  const [feed] = await db.select().from(productFeeds).where(eq(productFeeds.id, feedId));
  if (!feed) return;

  await db.update(productFeeds).set({ status: "generating", updatedAt: new Date() }).where(eq(productFeeds.id, feedId));
  const result = await generateFeed(feed);

  await db.update(productFeeds).set({
    status: result.success ? "active" : "error",
    lastGeneratedAt: result.success ? new Date() : undefined,
    lastRowCount: result.rowCount ?? undefined,
    outputPath: result.path ?? undefined,
    lastError: result.error ?? null,
    updatedAt: new Date(),
  }).where(eq(productFeeds.id, feedId));
}
