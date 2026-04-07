import { Router } from "express";
import { db } from "@workspace/db";
import { brandSections } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

router.get("/admin/brand-sections", requireAuth, requireAdmin, async (_req, res) => {
  const brands = await db.select().from(brandSections).orderBy(asc(brandSections.sortOrder));
  res.json({ brands });
});

router.post("/admin/brand-sections", requireAuth, requireAdmin, async (req, res) => {
  const { name, slug, bannerImage, bgColor, title, description, marketingPoints, productIds } = req.body;
  if (!name || typeof name !== "string") { res.status(400).json({ error: "name is required" }); return; }
  if (!slug || typeof slug !== "string") { res.status(400).json({ error: "slug is required" }); return; }
  if (name.length > 200) { res.status(400).json({ error: "name max 200 chars" }); return; }
  const existing = await db.select({ id: brandSections.id }).from(brandSections).where(eq(brandSections.slug, slug));
  if (existing.length > 0) { res.status(409).json({ error: "A brand with this slug already exists" }); return; }
  const maxOrder = await db.select({ sortOrder: brandSections.sortOrder }).from(brandSections).orderBy(asc(brandSections.sortOrder));
  const nextOrder = maxOrder.length > 0 ? Math.max(...maxOrder.map((r) => r.sortOrder)) + 1 : 0;
  const [row] = await db.insert(brandSections).values({
    name, slug, bannerImage: bannerImage ?? null, bgColor: bgColor ?? "bg-blue-600",
    title: title ?? null, description: description ?? null,
    marketingPoints: marketingPoints ?? [], productIds: productIds ?? [],
    sortOrder: nextOrder,
  }).returning();
  res.json({ brand: row });
});

router.put("/admin/brand-sections/reorder", requireAuth, requireAdmin, async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order) || !order.every((id) => typeof id === "number" && Number.isInteger(id))) { res.status(400).json({ error: "order must be an array of integer IDs" }); return; }
  for (let i = 0; i < order.length; i++) {
    await db.update(brandSections).set({ sortOrder: i, updatedAt: new Date() }).where(eq(brandSections.id, order[i]));
  }
  res.json({ success: true });
});

router.put("/admin/brand-sections/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { name, slug, bannerImage, bgColor, title, description, marketingPoints, productIds, isEnabled } = req.body;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof name === "string") updates.name = name;
  if (typeof slug === "string") updates.slug = slug;
  if (bannerImage !== undefined) updates.bannerImage = bannerImage;
  if (typeof bgColor === "string") updates.bgColor = bgColor;
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (Array.isArray(marketingPoints)) updates.marketingPoints = marketingPoints;
  if (Array.isArray(productIds)) updates.productIds = productIds;
  if (typeof isEnabled === "boolean") updates.isEnabled = isEnabled;
  await db.update(brandSections).set(updates).where(eq(brandSections.id, id));
  res.json({ success: true });
});

router.delete("/admin/brand-sections/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(brandSections).where(eq(brandSections.id, id));
  res.json({ success: true });
});

router.get("/brand-sections", async (_req, res) => {
  const brands = await db.select().from(brandSections).where(eq(brandSections.isEnabled, true)).orderBy(asc(brandSections.sortOrder));
  res.json({ brands });
});

export default router;
