import { Router } from "express";
import { db } from "@workspace/db";
import { localeOverrides, enabledLocales, users } from "@workspace/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/locales", async (_req, res) => {
  const rows = await db
    .select()
    .from(enabledLocales)
    .where(eq(enabledLocales.enabled, true))
    .orderBy(asc(enabledLocales.code));
  res.json({ locales: rows });
});

router.get("/locales/overrides/:locale", async (req, res) => {
  const { locale } = req.params;
  if (!locale || locale.length > 10) {
    res.json({ overrides: {} });
    return;
  }
  const rows = await db
    .select({ key: localeOverrides.key, value: localeOverrides.value })
    .from(localeOverrides)
    .where(eq(localeOverrides.locale, locale));
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  res.json({ overrides: map });
});

router.put("/user/locale", requireAuth, async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { locale } = req.body;
  if (!locale || typeof locale !== "string" || locale.length > 10) {
    res.status(400).json({ error: "Invalid locale" });
    return;
  }
  await db.update(users).set({ preferredLocale: locale, updatedAt: new Date() }).where(eq(users.id, userId));
  res.json({ success: true });
});

export default router;
