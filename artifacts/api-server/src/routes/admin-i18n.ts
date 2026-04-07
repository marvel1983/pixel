import { Router } from "express";
import { db } from "@workspace/db";
import { localeOverrides, enabledLocales } from "@workspace/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";

const router = Router();
const auth = [requireAuth, requireAdmin, requirePermission("manageSettings")];

router.get("/admin/locales", ...auth, async (_req, res) => {
  const rows = await db.select().from(enabledLocales).orderBy(asc(enabledLocales.code));
  res.json({ locales: rows });
});

router.post("/admin/locales/seed", ...auth, async (_req, res) => {
  const existing = await db.select().from(enabledLocales);
  if (existing.length > 0) {
    res.json({ message: "Locales already seeded", count: existing.length });
    return;
  }
  const defaults = [
    { code: "en", name: "English", flag: "🇬🇧", enabled: true, isDefault: true },
    { code: "pl", name: "Polski", flag: "🇵🇱", enabled: true, isDefault: false },
    { code: "cs", name: "Čeština", flag: "🇨🇿", enabled: true, isDefault: false },
    { code: "de", name: "Deutsch", flag: "🇩🇪", enabled: true, isDefault: false },
    { code: "fr", name: "Français", flag: "🇫🇷", enabled: true, isDefault: false },
  ];
  await db.insert(enabledLocales).values(defaults);
  res.json({ message: "Locales seeded", count: defaults.length });
});

router.put("/admin/locales/:code", ...auth, async (req, res) => {
  const { code } = req.params;
  const { enabled, isDefault } = req.body;
  const [row] = await db.select().from(enabledLocales).where(eq(enabledLocales.code, code));
  if (!row) { res.status(404).json({ error: "Locale not found" }); return; }

  if (isDefault) {
    await db.update(enabledLocales).set({ isDefault: false });
    await db.update(enabledLocales).set({ isDefault: true, enabled: true }).where(eq(enabledLocales.code, code));
  } else if (enabled !== undefined) {
    if (!enabled && row.isDefault) {
      res.status(400).json({ error: "Cannot disable the default locale" });
      return;
    }
    await db.update(enabledLocales).set({ enabled }).where(eq(enabledLocales.code, code));
  }
  res.json({ success: true });
});

router.get("/admin/locales/overrides", ...auth, async (req, res) => {
  const locale = req.query.locale as string | undefined;
  const where = locale ? eq(localeOverrides.locale, locale) : undefined;
  const rows = await db.select().from(localeOverrides).where(where).orderBy(asc(localeOverrides.key));
  res.json({ overrides: rows });
});

router.post("/admin/locales/overrides", ...auth, async (req, res) => {
  const { locale, key, value } = req.body;
  if (!locale || !key || !value) {
    res.status(400).json({ error: "locale, key, and value are required" });
    return;
  }
  const [existing] = await db.select().from(localeOverrides)
    .where(and(eq(localeOverrides.locale, locale), eq(localeOverrides.key, key)));
  if (existing) {
    await db.update(localeOverrides)
      .set({ value, updatedAt: new Date() })
      .where(eq(localeOverrides.id, existing.id));
  } else {
    await db.insert(localeOverrides).values({ locale, key, value });
  }
  res.json({ success: true });
});

router.delete("/admin/locales/overrides/:id", ...auth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(localeOverrides).where(eq(localeOverrides.id, id));
  res.json({ success: true });
});

export default router;
