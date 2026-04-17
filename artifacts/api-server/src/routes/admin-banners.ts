import { Router } from "express";
import { db } from "@workspace/db";
import { banners } from "@workspace/db/schema";
import { eq, asc, count } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { paramString } from "../lib/route-params";

const router = Router();

router.get("/admin/banners", requireAuth, requireAdmin, requirePermission("manageContent"), async (_req, res) => {
  const rows = await db.select().from(banners).orderBy(asc(banners.sortOrder), asc(banners.id));
  const [{ total }] = await db.select({ total: count() }).from(banners);
  const active = rows.filter((r) => r.isActive).length;
  res.json({ banners: rows, total, active });
});

router.get("/admin/banners/:id", requireAuth, requireAdmin, requirePermission("manageContent"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [banner] = await db.select().from(banners).where(eq(banners.id, id));
  if (!banner) { res.status(404).json({ error: "Banner not found" }); return; }
  res.json({ banner });
});

router.post("/admin/banners", requireAuth, requireAdmin, requirePermission("manageContent"), async (req, res) => {
  const data = parseBannerBody(req.body);
  if (!data) { res.status(400).json({ error: "Title is required" }); return; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [banner] = await db.insert(banners).values(data as any).returning();
  res.json({ banner });
});

router.put("/admin/banners/:id", requireAuth, requireAdmin, requirePermission("manageContent"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  const data = parseBannerBody(req.body);
  if (!data) { res.status(400).json({ error: "Title is required" }); return; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.update(banners).set({ ...data, updatedAt: new Date() } as any).where(eq(banners.id, id));
  const [updated] = await db.select().from(banners).where(eq(banners.id, id));
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ banner: updated });
});

router.patch("/admin/banners/:id/toggle", requireAuth, requireAdmin, requirePermission("manageContent"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [b] = await db.select({ isActive: banners.isActive }).from(banners).where(eq(banners.id, id));
  if (!b) { res.status(404).json({ error: "Not found" }); return; }
  await db.update(banners).set({ isActive: !b.isActive, updatedAt: new Date() }).where(eq(banners.id, id));
  res.json({ isActive: !b.isActive });
});

router.delete("/admin/banners/:id", requireAuth, requireAdmin, requirePermission("manageContent"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(banners).where(eq(banners.id, id));
  res.json({ success: true });
});

router.post("/admin/banners/reorder", requireAuth, requireAdmin, requirePermission("manageContent"), async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: "IDs array required" }); return; }
  for (let i = 0; i < ids.length; i++) {
    const id = Number(ids[i]);
    if (Number.isInteger(id) && id > 0) {
      await db.update(banners).set({ sortOrder: i, updatedAt: new Date() }).where(eq(banners.id, id));
    }
  }
  res.json({ success: true });
});

function parseBannerBody(body: Record<string, unknown>) {
  const title = String(body.title ?? "").trim();
  if (!title) return null;
  return {
    title,
    subtitle: body.subtitle ? String(body.subtitle) : null,
    imageUrl: body.imageUrl ? String(body.imageUrl) : null,
    linkUrl: body.linkUrl ? String(body.linkUrl) : null,
    position: (body.position as string) || "HOMEPAGE_HERO",
    backgroundColor: body.backgroundColor ? String(body.backgroundColor) : null,
    textColor: body.textColor ? String(body.textColor) : null,
    ctaText: body.ctaText ? String(body.ctaText) : null,
    ctaColor: body.ctaColor ? String(body.ctaColor) : null,
    sortOrder: Number(body.sortOrder) || 0,
    isActive: body.isActive !== false,
    startsAt: body.startsAt ? new Date(body.startsAt as string) : null,
    expiresAt: body.expiresAt ? new Date(body.expiresAt as string) : null,
  };
}

export default router;
