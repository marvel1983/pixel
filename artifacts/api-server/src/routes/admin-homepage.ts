import { Router } from "express";
import { db } from "@workspace/db";
import { homepageSections } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";

const router = Router();

const DEFAULT_SECTIONS = [
  { type: "HERO_SLIDER" as const, title: "Hero Slider", sortOrder: 0, config: {} },
  { type: "CATEGORY_ROW" as const, title: "Shop by Category", sortOrder: 1, config: {} },
  { type: "BRAND_SECTIONS" as const, title: "Brand Partners", sortOrder: 2, config: {} },
  { type: "NEW_ADDITIONS" as const, title: "New Additions", sortOrder: 3, config: { limit: 12 } },
  { type: "PRODUCT_SPOTLIGHT" as const, title: "Product Spotlight", sortOrder: 4, config: {} },
  { type: "FEATURED_TEXT_BANNER" as const, title: "Featured Banner", sortOrder: 5, config: { text: "", link: "" } },
];

router.get("/admin/homepage-sections", requireAuth, requireAdmin, requirePermission("manageContent"), async (_req, res) => {
  let sections = await db.select().from(homepageSections).orderBy(asc(homepageSections.sortOrder));
  if (sections.length === 0) {
    await db.insert(homepageSections).values(DEFAULT_SECTIONS);
    sections = await db.select().from(homepageSections).orderBy(asc(homepageSections.sortOrder));
  }
  res.json({ sections });
});

router.put("/admin/homepage-sections/reorder", requireAuth, requireAdmin, requirePermission("manageContent"), async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order) || !order.every((id) => typeof id === "number" && Number.isInteger(id))) { res.status(400).json({ error: "order must be an array of integer IDs" }); return; }
  for (let i = 0; i < order.length; i++) {
    await db.update(homepageSections).set({ sortOrder: i, updatedAt: new Date() }).where(eq(homepageSections.id, order[i]));
  }
  res.json({ success: true });
});

router.put("/admin/homepage-sections/:id", requireAuth, requireAdmin, requirePermission("manageContent"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { title, isEnabled, config } = req.body;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof title === "string") updates.title = title;
  if (typeof isEnabled === "boolean") updates.isEnabled = isEnabled;
  if (config && typeof config === "object") updates.config = config;
  await db.update(homepageSections).set(updates).where(eq(homepageSections.id, id));
  res.json({ success: true });
});

router.get("/homepage-sections", async (_req, res) => {
  let sections = await db.select().from(homepageSections).where(eq(homepageSections.isEnabled, true)).orderBy(asc(homepageSections.sortOrder));
  if (sections.length === 0) {
    const all = await db.select().from(homepageSections);
    if (all.length === 0) {
      await db.insert(homepageSections).values(DEFAULT_SECTIONS);
      sections = await db.select().from(homepageSections).where(eq(homepageSections.isEnabled, true)).orderBy(asc(homepageSections.sortOrder));
    }
  }
  res.json({ sections });
});

export default router;
