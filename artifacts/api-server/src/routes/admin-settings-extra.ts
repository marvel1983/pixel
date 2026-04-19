import { Router } from "express";
import { db } from "@workspace/db";
import { siteSettings, currencyRates, emailQueue, DEFAULT_RISK_CONFIG, type RiskScoringConfig } from "@workspace/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { encrypt, decrypt } from "../lib/encryption";
import { invalidateMailerCache } from "../lib/email/mailer";
import { getRateLimitConfig, updateRateLimitConfig } from "../middleware/rate-limit";
import { paramString } from "../lib/route-params";
import { syncCurrencyRates } from "../lib/currency-sync";

const router = Router();

router.get("/admin/settings/cpp-fees", requireAuth, requireAdmin, requirePermission("manageSettings"), async (_req, res) => {
  const [s] = await db.select().from(siteSettings);
  res.json({
    cppEnabled: s?.cppEnabled ?? false,
    cppLabel: s?.cppLabel ?? "Checkout Protection Plan",
    cppPrice: s?.cppPrice ?? "0.99",
    cppDescription: s?.cppDescription ?? "",
    processingFeePercent: s?.processingFeePercent ?? "0",
    processingFeeFixed: s?.processingFeeFixed ?? "0",
    processingFeeTiers: s?.processingFeeTiers ?? [],
  });
});

router.put("/admin/settings/cpp-fees", requireAuth, requireAdmin, requirePermission("manageSettings"), async (req, res) => {
  try {
    const [existing] = await db.select({ id: siteSettings.id }).from(siteSettings);
    const rawTiers = Array.isArray(req.body.processingFeeTiers) ? req.body.processingFeeTiers : [];
    const tiers = rawTiers
      .map((t: Record<string, unknown>) => ({
        minAmount: Math.max(0, Number(t.minAmount) || 0),
        feePercent: Math.max(0, Number(t.feePercent) || 0),
        feeFixed: Math.max(0, Number(t.feeFixed) || 0),
      }))
      .sort((a: { minAmount: number }, b: { minAmount: number }) => a.minAmount - b.minAmount);
    const data = {
      cppEnabled: Boolean(req.body.cppEnabled),
      cppLabel: String(req.body.cppLabel || "Checkout Protection Plan"),
      cppPrice: String(req.body.cppPrice || "0.99"),
      cppDescription: String(req.body.cppDescription || ""),
      processingFeePercent: String(req.body.processingFeePercent || "0"),
      processingFeeFixed: String(req.body.processingFeeFixed || "0"),
      processingFeeTiers: tiers.length > 0 ? tiers : null,
      updatedAt: new Date(),
    };
    if (existing) { await db.update(siteSettings).set(data).where(eq(siteSettings.id, existing.id)); }
    else { await db.insert(siteSettings).values(data); }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message ?? "DB error saving CPP settings" });
  }
});

router.get("/admin/settings/currencies", requireAuth, requireAdmin, requirePermission("manageSettings"), async (_req, res) => {
  const [s] = await db.select({ defaultCurrency: siteSettings.defaultCurrency }).from(siteSettings);
  const rates = await db.select().from(currencyRates).orderBy(currencyRates.sortOrder, currencyRates.currencyCode);
  res.json({ defaultCurrency: s?.defaultCurrency ?? "EUR", currencies: rates });
});

router.put("/admin/settings/currencies/default", requireAuth, requireAdmin, requirePermission("manageSettings"), async (req, res) => {
  const code = String(req.body.defaultCurrency || "EUR").toUpperCase();
  if (code.length !== 3) { res.status(400).json({ error: "Invalid currency code" }); return; }
  const [currency] = await db.select().from(currencyRates).where(eq(currencyRates.currencyCode, code));
  if (!currency) { res.status(400).json({ error: "Currency not found in rates table" }); return; }
  if (!currency.enabled) { res.status(400).json({ error: "Cannot set disabled currency as default" }); return; }
  const [existing] = await db.select({ id: siteSettings.id }).from(siteSettings);
  if (existing) { await db.update(siteSettings).set({ defaultCurrency: code, updatedAt: new Date() }).where(eq(siteSettings.id, existing.id)); }
  else { await db.insert(siteSettings).values({ defaultCurrency: code }); }
  res.json({ success: true });
});

router.post("/admin/settings/currencies", requireAuth, requireAdmin, requirePermission("manageSettings"), async (req, res) => {
  const code = String(req.body.currencyCode || "").toUpperCase().trim();
  const symbol = String(req.body.symbol || "€").trim();
  const rate = String(req.body.rateToUsd || "1");
  if (code.length !== 3) { res.status(400).json({ error: "Currency code must be 3 characters" }); return; }
  if (Number(rate) <= 0 || isNaN(Number(rate))) { res.status(400).json({ error: "Rate must be positive" }); return; }
  const [existing] = await db.select().from(currencyRates).where(eq(currencyRates.currencyCode, code));
  if (existing) { res.status(409).json({ error: "Currency already exists" }); return; }
  const [created] = await db.insert(currencyRates).values({ currencyCode: code, symbol, rateToUsd: rate, enabled: true }).returning();
  res.json(created);
});

router.put("/admin/settings/currencies/reorder", requireAuth, requireAdmin, requirePermission("manageSettings"), async (req, res) => {
  const ids = req.body.ids;
  if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: "ids array required" }); return; }
  for (let i = 0; i < ids.length; i++) {
    await db.update(currencyRates).set({ sortOrder: i }).where(eq(currencyRates.id, Number(ids[i])));
  }
  res.json({ success: true });
});

router.put("/admin/settings/currencies/:id", requireAuth, requireAdmin, requirePermission("manageSettings"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (req.body.rateToUsd !== undefined) {
    const rate = Number(req.body.rateToUsd);
    if (rate <= 0 || isNaN(rate)) { res.status(400).json({ error: "Rate must be positive" }); return; }
    updates.rateToUsd = String(rate);
  }
  if (req.body.symbol !== undefined) updates.symbol = String(req.body.symbol).trim();
  if (req.body.enabled !== undefined) updates.enabled = Boolean(req.body.enabled);
  await db.update(currencyRates).set(updates).where(eq(currencyRates.id, id));
  res.json({ success: true });
});

router.delete("/admin/settings/currencies/:id", requireAuth, requireAdmin, requirePermission("manageSettings"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(currencyRates).where(eq(currencyRates.id, id));
  res.json({ success: true });
});

router.get("/admin/settings/smtp", requireAuth, requireAdmin, requirePermission("manageSettings"), async (_req, res) => {
  const [s] = await db.select().from(siteSettings);
  res.json({
    smtpHost: s?.smtpHost ?? "",
    smtpPort: s?.smtpPort ?? 587,
    smtpUser: s?.smtpUser ?? "",
    hasPassword: !!s?.smtpPass,
    smtpFrom: s?.smtpFrom ?? "",
    smtpSecure: s?.smtpSecure ?? false,
  });
});

router.put("/admin/settings/smtp", requireAuth, requireAdmin, requirePermission("manageSettings"), async (req, res) => {
  const [existing] = await db.select({ id: siteSettings.id }).from(siteSettings);
  const data: Record<string, unknown> = {
    smtpHost: req.body.smtpHost || null,
    smtpPort: Number(req.body.smtpPort) || 587,
    smtpUser: req.body.smtpUser || null,
    smtpFrom: req.body.smtpFrom || null,
    smtpSecure: Boolean(req.body.smtpSecure),
    updatedAt: new Date(),
  };
  if (req.body.smtpPass && typeof req.body.smtpPass === "string") {
    data.smtpPass = encrypt(req.body.smtpPass.trim());
  }
  if (existing) { await db.update(siteSettings).set(data).where(eq(siteSettings.id, existing.id)); }
  else { await db.insert(siteSettings).values(data as Record<string, unknown>); }
  invalidateMailerCache();
  res.json({ success: true });
});

router.post("/admin/settings/smtp/test", requireAuth, requireAdmin, requirePermission("manageSettings"), async (req, res) => {
  const [s] = await db.select().from(siteSettings);
  if (!s?.smtpHost || !s?.smtpUser) { res.json({ success: false, message: "SMTP not configured" }); return; }
  const to = String(req.body.to || s.contactEmail || s.supportEmail || "");
  if (!to) { res.json({ success: false, message: "No recipient email provided" }); return; }
  try {
    await db.insert(emailQueue).values({ to, subject: "PixelCodes SMTP Test", html: "<h2>SMTP Test</h2><p>Your SMTP configuration is working correctly.</p><p>Sent at: " + new Date().toISOString() + "</p>", status: "pending" });
    res.json({ success: true, message: `Test email queued for ${to}` });
  } catch (e) { res.json({ success: false, message: `Failed: ${(e as Error).message}` }); }
});

router.get("/admin/settings/smtp/queue-status", requireAuth, requireAdmin, requirePermission("manageSettings"), async (_req, res) => {
  const [counts] = await db.select({
    total: sql<number>`count(*)::int`,
    pending: sql<number>`count(*) filter (where status = 'pending')::int`,
    sent: sql<number>`count(*) filter (where status = 'sent')::int`,
    failed: sql<number>`count(*) filter (where status = 'failed')::int`,
  }).from(emailQueue);
  const recent = await db.select({ id: emailQueue.id, to: emailQueue.to, subject: emailQueue.subject, status: emailQueue.status, attempts: emailQueue.attempts, lastError: emailQueue.lastError, createdAt: emailQueue.createdAt }).from(emailQueue).orderBy(desc(emailQueue.createdAt)).limit(10);
  res.json({ counts, recent });
});

router.get("/admin/settings/google-oauth", requireAuth, requireAdmin, requirePermission("manageSettings"), async (_req, res) => {
  const [s] = await db.select({
    enabled: siteSettings.googleOAuthEnabled,
    clientId: siteSettings.googleClientId,
    hasSecret: sql<boolean>`${siteSettings.googleClientSecret} IS NOT NULL AND ${siteSettings.googleClientSecret} != ''`,
  }).from(siteSettings);
  res.json({
    enabled: s?.enabled ?? false,
    clientId: s?.clientId ?? "",
    hasSecret: s?.hasSecret ?? false,
  });
});

router.put("/admin/settings/google-oauth", requireAuth, requireAdmin, requirePermission("manageSettings"), async (req, res) => {
  const { enabled, clientId, clientSecret } = req.body;
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof enabled === "boolean") update.googleOAuthEnabled = enabled;
  if (typeof clientId === "string") update.googleClientId = clientId;
  if (typeof clientSecret === "string" && clientSecret.length > 0) {
    update.googleClientSecret = encrypt(clientSecret);
  }
  const [s] = await db.select({ id: siteSettings.id }).from(siteSettings);
  if (s) {
    await db.update(siteSettings).set(update).where(eq(siteSettings.id, s.id));
  } else {
    await db.insert(siteSettings).values(update as Record<string, unknown>);
  }
  res.json({ ok: true });
});

router.post("/admin/settings/google-oauth/test", requireAuth, requireAdmin, requirePermission("manageSettings"), async (_req, res) => {
  const [s] = await db.select({
    enabled: siteSettings.googleOAuthEnabled,
    clientId: siteSettings.googleClientId,
    clientSecret: siteSettings.googleClientSecret,
  }).from(siteSettings);

  if (!s?.clientId || !s?.clientSecret) {
    res.json({ success: false, message: "Client ID and Client Secret are required" });
    return;
  }

  try {
    const secret = decrypt(s.clientSecret);
    const tokenUrl = "https://oauth2.googleapis.com/token";
    const testRes = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: s.clientId,
        client_secret: secret,
        grant_type: "client_credentials",
      }),
    });
    const body = await testRes.json() as { error?: string; error_description?: string };
    if (body.error === "invalid_client") {
      res.json({ success: false, message: "Invalid Client ID or Client Secret" });
    } else if (body.error === "unauthorized_client" || body.error === "unsupported_grant_type") {
      res.json({ success: true, message: "Credentials are valid (Google recognized the client)" });
    } else if (body.error) {
      res.json({ success: true, message: `Google responded: ${body.error_description || body.error}` });
    } else {
      res.json({ success: true, message: "Connection successful" });
    }
  } catch (e) {
    res.json({ success: false, message: `Connection failed: ${(e as Error).message}` });
  }
});

router.get("/admin/settings/rate-limits", requireAuth, requireAdmin, requirePermission("manageSettings"), (_req, res) => {
  res.json(getRateLimitConfig());
});

router.put("/admin/settings/rate-limits", requireAuth, requireAdmin, requirePermission("manageSettings"), (req, res) => {
  const { authLogin, authRegister, authReset, public: pub, admin } = req.body;
  updateRateLimitConfig({ authLogin, authRegister, authReset, public: pub, admin });
  res.json({ ok: true, config: getRateLimitConfig() });
});

router.get("/admin/settings/turnstile", requireAuth, requireAdmin, requirePermission("manageSettings"), async (_req, res) => {
  const [s] = await db.select({
    enabled: siteSettings.turnstileEnabled,
    siteKey: siteSettings.turnstileSiteKey,
    hasSecret: sql<boolean>`${siteSettings.turnstileSecretKey} IS NOT NULL AND ${siteSettings.turnstileSecretKey} != ''`,
  }).from(siteSettings);
  res.json({
    enabled: s?.enabled ?? false,
    siteKey: s?.siteKey ?? "",
    hasSecret: s?.hasSecret ?? false,
  });
});

router.put("/admin/settings/turnstile", requireAuth, requireAdmin, requirePermission("manageSettings"), async (req, res) => {
  const { enabled, siteKey, secretKey } = req.body;
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof enabled === "boolean") update.turnstileEnabled = enabled;
  if (typeof siteKey === "string") update.turnstileSiteKey = siteKey;
  if (typeof secretKey === "string" && secretKey.length > 0) {
    update.turnstileSecretKey = encrypt(secretKey);
  }
  const [existing] = await db.select({ id: siteSettings.id }).from(siteSettings);
  if (existing) {
    await db.update(siteSettings).set(update).where(eq(siteSettings.id, existing.id));
  } else {
    await db.insert(siteSettings).values(update as Record<string, unknown>);
  }
  res.json({ ok: true });
});

router.get("/admin/settings/risk-scoring", requireAuth, requireAdmin, requirePermission("manageSettings"), async (_req, res) => {
  const [s] = await db.select({ riskConfig: siteSettings.riskConfig }).from(siteSettings).limit(1);
  const cfg = s?.riskConfig ? { ...DEFAULT_RISK_CONFIG, ...s.riskConfig } : DEFAULT_RISK_CONFIG;
  res.json(cfg);
});

router.put("/admin/settings/risk-scoring", requireAuth, requireAdmin, requirePermission("manageSettings"), async (req, res) => {
  const body = req.body as Partial<RiskScoringConfig>;
  const cfg: RiskScoringConfig = {
    enabled: typeof body.enabled === "boolean" ? body.enabled : DEFAULT_RISK_CONFIG.enabled,
    holdThreshold: Number(body.holdThreshold) || DEFAULT_RISK_CONFIG.holdThreshold,
    minOrderHoldAmount: Number(body.minOrderHoldAmount) ?? DEFAULT_RISK_CONFIG.minOrderHoldAmount,
    newAccountHighValueScore: Number(body.newAccountHighValueScore) || DEFAULT_RISK_CONFIG.newAccountHighValueScore,
    newAccountHighValueMin: Number(body.newAccountHighValueMin) || DEFAULT_RISK_CONFIG.newAccountHighValueMin,
    newAccountBaseScore: Number(body.newAccountBaseScore) || DEFAULT_RISK_CONFIG.newAccountBaseScore,
    firstOrderScore: Number(body.firstOrderScore) || DEFAULT_RISK_CONFIG.firstOrderScore,
    bulkQtyHighScore: Number(body.bulkQtyHighScore) || DEFAULT_RISK_CONFIG.bulkQtyHighScore,
    bulkQtyHighMin: Number(body.bulkQtyHighMin) || DEFAULT_RISK_CONFIG.bulkQtyHighMin,
    bulkQtyLowScore: Number(body.bulkQtyLowScore) || DEFAULT_RISK_CONFIG.bulkQtyLowScore,
    bulkQtyLowMin: Number(body.bulkQtyLowMin) || DEFAULT_RISK_CONFIG.bulkQtyLowMin,
    geoMismatchScore: Number(body.geoMismatchScore) || DEFAULT_RISK_CONFIG.geoMismatchScore,
    guestHighValueScore: Number(body.guestHighValueScore) || DEFAULT_RISK_CONFIG.guestHighValueScore,
    guestHighValueMin: Number(body.guestHighValueMin) || DEFAULT_RISK_CONFIG.guestHighValueMin,
    highOrderValueScore: Number(body.highOrderValueScore) || DEFAULT_RISK_CONFIG.highOrderValueScore,
    highOrderValueMin: Number(body.highOrderValueMin) || DEFAULT_RISK_CONFIG.highOrderValueMin,
  };
  const [existing] = await db.select({ id: siteSettings.id }).from(siteSettings);
  if (existing) {
    await db.update(siteSettings).set({ riskConfig: cfg, updatedAt: new Date() }).where(eq(siteSettings.id, existing.id));
  } else {
    await db.insert(siteSettings).values({ riskConfig: cfg });
  }
  res.json({ ok: true });
});

// POST /admin/settings/sync-currency-rates — manual trigger
router.post("/admin/settings/sync-currency-rates", requireAuth, requireAdmin, requirePermission("manageSettings"), async (_req, res) => {
  try {
    const result = await syncCurrencyRates();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

export default router;
