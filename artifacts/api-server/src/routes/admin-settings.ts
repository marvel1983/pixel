import { Router } from "express";
import { db } from "@workspace/db";
import { siteSettings, apiProviders, apiCredentials } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { encrypt, decrypt } from "../lib/encryption";
import { logger } from "../lib/logger";
import { clearMetenziConfigCache } from "../lib/metenzi-config";
import { getCatalogPage } from "../lib/metenzi-endpoints";
import type { MetenziClientConfig } from "../lib/metenzi-client";

const router = Router();

const VALID_FIELDS: Record<string, string[]> = {
  metenzi: ["apiKey", "hmacSecret", "webhookSecret"],
  checkout: ["publicKey", "secretKey"],
};

function validateProviderField(provider: string, field: string): string | null {
  const allowed = VALID_FIELDS[provider];
  if (!allowed) return "Unknown provider";
  if (!allowed.includes(field)) return `Invalid field for ${provider}`;
  return null;
}

router.get("/admin/settings/general", requireAuth, requireAdmin, requirePermission("manageSettings"), async (_req, res) => {
  const rows = await db.select().from(siteSettings);
  if (rows.length === 0) { res.json({ settings: null }); return; }
  const s = rows[0];
  res.json({
    settings: {
      siteName: s.siteName, siteDescription: s.siteDescription, logoUrl: s.logoUrl,
      faviconUrl: s.faviconUrl, contactEmail: s.contactEmail, supportEmail: s.supportEmail,
      fromEmail: s.fromEmail, phone: s.phone, companyName: s.companyName,
      companyAddress: s.companyAddress, companyCity: s.companyCity,
      companyCountry: s.companyCountry, companyZip: s.companyZip, companyTaxId: s.companyTaxId,
      tagline: s.tagline, copyright: s.copyright, socialLinks: s.socialLinks,
      announcementBar: s.announcementBar, maintenanceMode: s.maintenanceMode,
      defaultCurrency: s.defaultCurrency, enabledCurrencies: s.enabledCurrencies,
      metaTitleTemplate: s.metaTitleTemplate, metaDescription: s.metaDescription,
    },
  });
});

router.put("/admin/settings/general", requireAuth, requireAdmin, requirePermission("manageSettings"), async (req, res) => {
  const rows = await db.select({ id: siteSettings.id }).from(siteSettings);
  const data = {
    siteName: String(req.body.siteName ?? "PixelCodes"),
    siteDescription: req.body.siteDescription ?? null,
    logoUrl: req.body.logoUrl ?? null,
    faviconUrl: req.body.faviconUrl ?? null,
    contactEmail: req.body.contactEmail ?? null,
    supportEmail: req.body.supportEmail ?? null,
    fromEmail: req.body.fromEmail ?? null,
    phone: req.body.phone ?? null,
    companyName: req.body.companyName ?? null,
    companyAddress: req.body.companyAddress ?? null,
    companyCity: req.body.companyCity ?? null,
    companyCountry: req.body.companyCountry ?? null,
    companyZip: req.body.companyZip ?? null,
    companyTaxId: req.body.companyTaxId ?? null,
    tagline: req.body.tagline ?? null,
    copyright: req.body.copyright ?? null,
    socialLinks: req.body.socialLinks ?? {},
    announcementBar: req.body.announcementBar ?? null,
    metaTitleTemplate: req.body.metaTitleTemplate ?? null,
    metaDescription: req.body.metaDescription ?? null,
    updatedAt: new Date(),
  };
  if (rows.length > 0) {
    await db.update(siteSettings).set(data).where(eq(siteSettings.id, rows[0].id));
  } else {
    await db.insert(siteSettings).values(data);
  }
  res.json({ success: true });
});

router.get("/admin/settings/api-keys", requireAuth, requireAdmin, requirePermission("manageSettings"), async (_req, res) => {
  const [metenzi] = await db.select().from(apiProviders).where(eq(apiProviders.slug, "metenzi"));
  const [checkout] = await db.select().from(apiCredentials).where(eq(apiCredentials.provider, "checkout"));
  res.json({
    metenzi: {
      hasApiKey: !!metenzi?.apiKeyEncrypted,
      hasSigningSecret: !!metenzi?.hmacSecretEncrypted,
      hasWebhookSecret: !!metenzi?.webhookSecretEncrypted,
      isActive: metenzi?.isActive ?? false,
    },
    checkout: {
      hasPublicKey: !!checkout?.publicKeyEncrypted,
      hasSecretKey: !!checkout?.secretKeyEncrypted,
      isActive: checkout?.isActive ?? false,
    },
  });
});

router.post("/admin/settings/api-keys/reveal", requireAuth, requireAdmin, requirePermission("manageSettings"), async (req, res) => {
  const { provider, field } = req.body;
  const err = validateProviderField(provider, field);
  if (err) { res.status(400).json({ error: err }); return; }
  const adminEmail = req.user?.email ?? "unknown";
  logger.info({ provider, field, admin: adminEmail, ip: req.ip }, "[AUDIT] API key reveal");
  if (provider === "metenzi") {
    const [row] = await db.select().from(apiProviders).where(eq(apiProviders.slug, "metenzi"));
    if (!row) { res.status(404).json({ error: "Provider not found" }); return; }
    const enc = field === "apiKey" ? row.apiKeyEncrypted : field === "webhookSecret" ? row.webhookSecretEncrypted : row.hmacSecretEncrypted;
    if (!enc) { res.json({ value: "" }); return; }
    try { res.json({ value: decrypt(enc) }); } catch { res.status(500).json({ error: "Decryption failed" }); }
  } else if (provider === "checkout") {
    const [row] = await db.select().from(apiCredentials).where(eq(apiCredentials.provider, "checkout"));
    if (!row) { res.json({ value: "" }); return; }
    const enc = field === "publicKey" ? row.publicKeyEncrypted : row.secretKeyEncrypted;
    if (!enc) { res.json({ value: "" }); return; }
    try { res.json({ value: decrypt(enc) }); } catch { res.status(500).json({ error: "Decryption failed" }); }
  } else { res.status(400).json({ error: "Unknown provider" }); }
});

router.put("/admin/settings/api-keys", requireAuth, requireAdmin, requirePermission("manageSettings"), async (req, res) => {
  const { provider, field, value } = req.body;
  const fieldErr = validateProviderField(provider, field);
  if (fieldErr) { res.status(400).json({ error: fieldErr }); return; }
  if (!value || typeof value !== "string") { res.status(400).json({ error: "Value required" }); return; }
  const encrypted = encrypt(value.trim());
  if (provider === "metenzi") {
    const col = field === "apiKey" ? "apiKeyEncrypted" : field === "webhookSecret" ? "webhookSecretEncrypted" : "hmacSecretEncrypted";
    const [row] = await db.select({ id: apiProviders.id }).from(apiProviders).where(eq(apiProviders.slug, "metenzi"));
    if (row) { await db.update(apiProviders).set({ [col]: encrypted, baseUrl: "https://metenzi.com", isActive: true, updatedAt: new Date() }).where(eq(apiProviders.id, row.id)); }
    else { await db.insert(apiProviders).values({ name: "Metenzi", slug: "metenzi", baseUrl: "https://metenzi.com", isActive: true, [col]: encrypted }); }
    clearMetenziConfigCache();
  } else if (provider === "checkout") {
    const col = field === "publicKey" ? "publicKeyEncrypted" : "secretKeyEncrypted";
    const [row] = await db.select({ id: apiCredentials.id }).from(apiCredentials).where(eq(apiCredentials.provider, "checkout"));
    if (row) { await db.update(apiCredentials).set({ [col]: encrypted, updatedAt: new Date() }).where(eq(apiCredentials.id, row.id)); }
    else { await db.insert(apiCredentials).values({ provider: "checkout", [col]: encrypted }); }
  } else { res.status(400).json({ error: "Unknown provider" }); return; }
  res.json({ success: true });
});

router.post("/admin/settings/api-keys/test", requireAuth, requireAdmin, requirePermission("manageSettings"), async (req, res) => {
  const { provider } = req.body;
  if (provider === "metenzi") {
    const [row] = await db.select().from(apiProviders).where(eq(apiProviders.slug, "metenzi"));
    if (!row?.apiKeyEncrypted || !row?.hmacSecretEncrypted) {
      res.json({ success: false, message: "Both API Key and Signing Secret must be saved first" }); return;
    }
    try {
      const config: MetenziClientConfig = {
        baseUrl: row.baseUrl || "https://metenzi.com",
        apiKey: decrypt(row.apiKeyEncrypted),
        hmacSecret: decrypt(row.hmacSecretEncrypted),
      };
      const catalog = await getCatalogPage(config, { limit: 1 });
      res.json({ success: true, message: `Connected! ${catalog.total} products available.` });
    } catch (e) { res.json({ success: false, message: `Connection failed: ${(e as Error).message}` }); }
  } else if (provider === "checkout") {
    const [row] = await db.select().from(apiCredentials).where(eq(apiCredentials.provider, "checkout"));
    if (!row?.secretKeyEncrypted) { res.json({ success: false, message: "No secret key configured" }); return; }
    try {
      const sk = decrypt(row.secretKeyEncrypted);
      const r = await fetch("https://api.checkout.com/instruments", { method: "GET", headers: { Authorization: `Bearer ${sk}` } });
      const ok = r.status >= 200 && r.status < 300;
      res.json({ success: ok, message: ok ? "Connected successfully" : r.status === 401 ? "Invalid credentials" : `API returned ${r.status}` });
    } catch (e) { res.json({ success: false, message: `Connection failed: ${(e as Error).message}` }); }
  } else { res.status(400).json({ error: "Unknown provider" }); }
});

export default router;
