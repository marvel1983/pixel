import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { campaigns } from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";

const router = Router();

// ── Public ────────────────────────────────────────────────────────────────────

router.get("/campaigns/:slug", async (req, res) => {
  const [campaign] = await db.select().from(campaigns)
    .where(eq(campaigns.slug, String(req.params.slug))).limit(1);

  if (!campaign || campaign.status !== "active") {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  // Increment view count (fire-and-forget)
  db.update(campaigns)
    .set({ viewCount: sql`${campaigns.viewCount} + 1` })
    .where(eq(campaigns.id, campaign.id))
    .catch(() => {});

  // Fetch products if any are assigned
  let products: unknown[] = [];
  const ids = Array.isArray(campaign.productIds) ? campaign.productIds as number[] : [];
  if (ids.length > 0) {
    const { products: productsTable, productVariants } = await import("@workspace/db/schema");
    const { inArray } = await import("drizzle-orm");
    const rows = await db.select({
      id: productsTable.id,
      name: productsTable.name,
      slug: productsTable.slug,
      imageUrl: productsTable.imageUrl,
      description: productsTable.shortDescription,
    }).from(productsTable)
      .where(inArray(productsTable.id, ids))
      .limit(50);

    const variantRows = await db.select({
      productId: productVariants.productId,
      id: productVariants.id,
      name: productVariants.name,
      priceUsd: productVariants.priceUsd,
      stockCount: productVariants.stockCount,
    }).from(productVariants)
      .where(inArray(productVariants.productId, ids))
      .orderBy(productVariants.priceUsd);

    products = rows.map((p) => ({
      ...p,
      variants: variantRows.filter((v) => v.productId === p.id),
    }));
  }

  res.json({ campaign, products });
});

// ── Admin ─────────────────────────────────────────────────────────────────────

const campaignSchema = z.object({
  title: z.string().min(1).max(300),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers and hyphens"),
  headline: z.string().min(1).max(300),
  subtext: z.string().max(2000).optional(),
  heroImageUrl: z.string().url().max(500).optional().or(z.literal("")),
  heroBgColor: z.string().max(20).optional(),
  endsAt: z.string().datetime().optional().nullable(),
  couponCode: z.string().max(50).optional().nullable(),
  productIds: z.array(z.number().int().positive()).optional(),
  status: z.enum(["draft", "active"]),
});

router.get("/admin/campaigns", requireAuth, requireAdmin, async (_req, res) => {
  const rows = await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
  res.json({ campaigns: rows });
});

router.get("/admin/campaigns/:id", requireAuth, requireAdmin, async (req, res) => {
  const [campaign] = await db.select().from(campaigns)
    .where(eq(campaigns.id, parseInt(String(req.params.id)))).limit(1);
  if (!campaign) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ campaign });
});

router.post("/admin/campaigns", requireAuth, requireAdmin, requirePermission("manageSettings"), async (req, res) => {
  const parsed = campaignSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid data" }); return; }

  const [existing] = await db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.slug, parsed.data.slug));
  if (existing) { res.status(409).json({ error: "A campaign with this slug already exists" }); return; }

  const [campaign] = await db.insert(campaigns).values({
    ...parsed.data,
    heroImageUrl: parsed.data.heroImageUrl || null,
    couponCode: parsed.data.couponCode || null,
    endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
    productIds: parsed.data.productIds ?? [],
  }).returning();

  res.status(201).json({ campaign });
});

router.put("/admin/campaigns/:id", requireAuth, requireAdmin, requirePermission("manageSettings"), async (req, res) => {
  const id = parseInt(String(req.params.id));
  const parsed = campaignSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid data" }); return; }

  const [existing] = await db.select({ id: campaigns.id }).from(campaigns)
    .where(eq(campaigns.slug, parsed.data.slug));
  if (existing && existing.id !== id) { res.status(409).json({ error: "Slug already used by another campaign" }); return; }

  await db.update(campaigns).set({
    ...parsed.data,
    heroImageUrl: parsed.data.heroImageUrl || null,
    couponCode: parsed.data.couponCode || null,
    endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
    productIds: parsed.data.productIds ?? [],
    updatedAt: new Date(),
  }).where(eq(campaigns.id, id));

  res.json({ success: true });
});

router.delete("/admin/campaigns/:id", requireAuth, requireAdmin, requirePermission("manageSettings"), async (req, res) => {
  await db.delete(campaigns).where(eq(campaigns.id, parseInt(String(req.params.id))));
  res.json({ success: true });
});

export default router;
