import { Router } from "express";
import { db } from "@workspace/db";
import { taxSettings, taxRates } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

const EU_VAT_RATES = [
  { countryCode: "AT", countryName: "Austria", rate: "20" },
  { countryCode: "BE", countryName: "Belgium", rate: "21" },
  { countryCode: "BG", countryName: "Bulgaria", rate: "20" },
  { countryCode: "HR", countryName: "Croatia", rate: "25" },
  { countryCode: "CY", countryName: "Cyprus", rate: "19" },
  { countryCode: "CZ", countryName: "Czech Republic", rate: "21" },
  { countryCode: "DK", countryName: "Denmark", rate: "25" },
  { countryCode: "EE", countryName: "Estonia", rate: "22" },
  { countryCode: "FI", countryName: "Finland", rate: "25.5" },
  { countryCode: "FR", countryName: "France", rate: "20" },
  { countryCode: "DE", countryName: "Germany", rate: "19" },
  { countryCode: "GR", countryName: "Greece", rate: "24" },
  { countryCode: "HU", countryName: "Hungary", rate: "27" },
  { countryCode: "IE", countryName: "Ireland", rate: "23" },
  { countryCode: "IT", countryName: "Italy", rate: "22" },
  { countryCode: "LV", countryName: "Latvia", rate: "21" },
  { countryCode: "LT", countryName: "Lithuania", rate: "21" },
  { countryCode: "LU", countryName: "Luxembourg", rate: "17" },
  { countryCode: "MT", countryName: "Malta", rate: "18" },
  { countryCode: "NL", countryName: "Netherlands", rate: "21" },
  { countryCode: "PL", countryName: "Poland", rate: "23" },
  { countryCode: "PT", countryName: "Portugal", rate: "23" },
  { countryCode: "RO", countryName: "Romania", rate: "19" },
  { countryCode: "SK", countryName: "Slovakia", rate: "23" },
  { countryCode: "SI", countryName: "Slovenia", rate: "22" },
  { countryCode: "ES", countryName: "Spain", rate: "21" },
  { countryCode: "SE", countryName: "Sweden", rate: "25" },
];

async function getOrCreateSettings() {
  let [s] = await db.select().from(taxSettings);
  if (!s) {
    [s] = await db.insert(taxSettings).values({}).returning();
    await db.insert(taxRates).values(EU_VAT_RATES).onConflictDoNothing();
  }
  return s;
}

router.get("/admin/tax-settings", requireAuth, requireAdmin, async (_req, res) => {
  const settings = await getOrCreateSettings();
  const rates = await db.select().from(taxRates).orderBy(asc(taxRates.countryName));
  res.json({ settings, rates });
});

router.put("/admin/tax-settings", requireAuth, requireAdmin, async (req, res) => {
  const s = await getOrCreateSettings();
  const { enabled, priceDisplay, taxLabel, defaultRate, merchantVatNumber, b2bExemptionEnabled } = req.body;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof enabled === "boolean") updates.enabled = enabled;
  if (priceDisplay === "inclusive" || priceDisplay === "exclusive") updates.priceDisplay = priceDisplay;
  if (typeof taxLabel === "string") updates.taxLabel = taxLabel;
  if (typeof defaultRate === "string" || typeof defaultRate === "number") updates.defaultRate = String(defaultRate);
  if (typeof merchantVatNumber === "string") updates.merchantVatNumber = merchantVatNumber;
  if (typeof b2bExemptionEnabled === "boolean") updates.b2bExemptionEnabled = b2bExemptionEnabled;
  await db.update(taxSettings).set(updates).where(eq(taxSettings.id, s.id));
  const [updated] = await db.select().from(taxSettings).where(eq(taxSettings.id, s.id));
  res.json({ settings: updated });
});

router.post("/admin/tax-rates", requireAuth, requireAdmin, async (req, res) => {
  const { countryCode, countryName, rate } = req.body;
  if (!countryCode || !countryName || rate === undefined) { res.status(400).json({ error: "countryCode, countryName, rate required" }); return; }
  const existing = await db.select({ id: taxRates.id }).from(taxRates).where(eq(taxRates.countryCode, countryCode.toUpperCase()));
  if (existing.length > 0) { res.status(409).json({ error: "Rate for this country already exists" }); return; }
  const [row] = await db.insert(taxRates).values({ countryCode: countryCode.toUpperCase(), countryName, rate: String(rate) }).returning();
  res.json({ rate: row });
});

router.put("/admin/tax-rates/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { rate, isEnabled, countryName } = req.body;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof rate === "string" || typeof rate === "number") updates.rate = String(rate);
  if (typeof isEnabled === "boolean") updates.isEnabled = isEnabled;
  if (typeof countryName === "string") updates.countryName = countryName;
  await db.update(taxRates).set(updates).where(eq(taxRates.id, id));
  res.json({ success: true });
});

router.delete("/admin/tax-rates/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(taxRates).where(eq(taxRates.id, id));
  res.json({ success: true });
});

router.get("/tax/lookup", async (req, res) => {
  const country = (req.query.country as string || "").toUpperCase();
  const vatNumber = req.query.vatNumber as string || "";
  const [s] = await db.select().from(taxSettings);
  if (!s || !s.enabled) { res.json({ taxRate: 0, taxLabel: "VAT", exempt: false }); return; }
  let rate = parseFloat(s.defaultRate);
  if (country) {
    const [cr] = await db.select().from(taxRates).where(eq(taxRates.countryCode, country));
    if (cr && cr.isEnabled) rate = parseFloat(cr.rate);
  }
  const exempt = s.b2bExemptionEnabled && vatNumber.length >= 8;
  res.json({ taxRate: exempt ? 0 : rate, taxLabel: s.taxLabel, exempt, priceDisplay: s.priceDisplay });
});

export default router;
