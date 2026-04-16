import { Router } from "express";
import { eq, ne } from "drizzle-orm";
import { db } from "@workspace/db";
import { apiCredentials } from "@workspace/db/schema";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { encrypt, decrypt } from "../lib/encryption";
import { logger } from "../lib/logger";
import { clearPaymentConfigCache } from "../lib/payment-config";

const router = Router();

const auth = [requireAuth, requireAdmin, requirePermission("manageSettings")] as const;

const PROVIDERS = ["stripe", "checkout"] as const;
type Provider = (typeof PROVIDERS)[number];

// Fields allowed per provider and where they live in the DB row
const PROVIDER_FIELDS: Record<Provider, string[]> = {
  stripe: ["secretKey", "publishableKey", "webhookSecret"],
  checkout: ["secretKey", "publishableKey"],
};

function isValidProvider(p: unknown): p is Provider {
  return PROVIDERS.includes(p as Provider);
}

// ── GET /admin/settings/payment-providers ────────────────────────────────────

router.get("/admin/settings/payment-providers", ...auth, async (req, res) => {
  const rows = await db.select().from(apiCredentials)
    .where(eq(apiCredentials.provider, "stripe"))
    .limit(1)
    .then((r) => r);
  const checkoutRows = await db.select().from(apiCredentials)
    .where(eq(apiCredentials.provider, "checkout"))
    .limit(1);

  const stripeRow = rows[0] ?? null;
  const checkoutRow = checkoutRows[0] ?? null;

  const stripeExtra = (stripeRow?.extra ?? {}) as Record<string, string>;
  const checkoutExtra = (checkoutRow?.extra ?? {}) as Record<string, string>;
  const stripeMode = stripeExtra.mode === "live" ? "live" : "sandbox";
  const checkoutMode = checkoutExtra.mode === "live" ? "live" : "sandbox";

  const appUrl = process.env.APP_PUBLIC_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN ?? "localhost:8080"}`;

  res.json({
    activeProvider: stripeRow?.isActive ? "stripe" : checkoutRow?.isActive ? "checkout" : null,
    stripe: {
      isActive: stripeRow?.isActive ?? false,
      mode: stripeMode,
      hasSecretKey: !!stripeExtra[`${stripeMode}_secretKeyEncrypted`],
      hasPublishableKey: !!stripeExtra[`${stripeMode}_publicKeyEncrypted`],
      hasWebhookSecret: !!stripeExtra[`${stripeMode}_webhookSecretEncrypted`],
      webhookUrl: `${appUrl}/api/webhooks/stripe`,
    },
    checkout: {
      isActive: checkoutRow?.isActive ?? false,
      mode: checkoutMode,
      hasSecretKey: !!checkoutExtra[`${checkoutMode}_secretKeyEncrypted`],
      hasPublishableKey: !!checkoutExtra[`${checkoutMode}_publicKeyEncrypted`],
    },
  });
});

// ── PUT /admin/settings/payment-providers/active ─────────────────────────────

router.put("/admin/settings/payment-providers/active", ...auth, async (req, res) => {
  const { provider } = req.body;
  if (!isValidProvider(provider)) {
    res.status(400).json({ error: "Invalid provider" }); return;
  }

  // Deactivate all, then activate the chosen one
  await db.update(apiCredentials).set({ isActive: false });

  const [existing] = await db.select({ id: apiCredentials.id })
    .from(apiCredentials).where(eq(apiCredentials.provider, provider));

  if (existing) {
    await db.update(apiCredentials).set({ isActive: true, updatedAt: new Date() })
      .where(eq(apiCredentials.id, existing.id));
  } else {
    await db.insert(apiCredentials).values({ provider, isActive: true });
  }

  clearPaymentConfigCache();
  logger.info({ provider, admin: req.user?.email }, "[AUDIT] Payment provider activated");
  res.json({ success: true });
});

// ── PUT /admin/settings/payment-providers/:provider/mode ─────────────────────

router.put("/admin/settings/payment-providers/:provider/mode", ...auth, async (req, res) => {
  const { provider } = req.params;
  const { mode } = req.body;
  if (!isValidProvider(provider)) { res.status(400).json({ error: "Invalid provider" }); return; }
  if (mode !== "sandbox" && mode !== "live") { res.status(400).json({ error: "mode must be sandbox or live" }); return; }

  const [existing] = await db.select().from(apiCredentials).where(eq(apiCredentials.provider, provider));
  const currentExtra = (existing?.extra ?? {}) as Record<string, string>;
  const newExtra = { ...currentExtra, mode };

  if (existing) {
    await db.update(apiCredentials).set({ extra: newExtra, updatedAt: new Date() })
      .where(eq(apiCredentials.id, existing.id));
  } else {
    await db.insert(apiCredentials).values({ provider, extra: newExtra });
  }

  clearPaymentConfigCache();
  res.json({ success: true });
});

// ── POST /admin/settings/payment-providers/:provider/keys ────────────────────

router.post("/admin/settings/payment-providers/:provider/keys", ...auth, async (req, res) => {
  const { provider } = req.params;
  const { field, value } = req.body;
  if (!isValidProvider(provider)) { res.status(400).json({ error: "Invalid provider" }); return; }
  if (!PROVIDER_FIELDS[provider].includes(field)) {
    res.status(400).json({ error: `Invalid field '${field}' for ${provider}` }); return;
  }
  if (!value || typeof value !== "string" || !value.trim()) {
    res.status(400).json({ error: "Value is required" }); return;
  }

  const encrypted = encrypt(value.trim());
  const [existing] = await db.select().from(apiCredentials).where(eq(apiCredentials.provider, provider));
  const currentExtra = (existing?.extra ?? {}) as Record<string, string>;
  const mode = currentExtra.mode === "live" ? "live" : "sandbox";

  const extraKey =
    field === "secretKey" ? `${mode}_secretKeyEncrypted` :
    field === "publishableKey" ? `${mode}_publicKeyEncrypted` :
    `${mode}_webhookSecretEncrypted`;

  const newExtra = { ...currentExtra, [extraKey]: encrypted };

  if (existing) {
    await db.update(apiCredentials).set({ extra: newExtra, updatedAt: new Date() })
      .where(eq(apiCredentials.id, existing.id));
  } else {
    await db.insert(apiCredentials).values({ provider, extra: newExtra });
  }

  clearPaymentConfigCache();
  logger.info({ provider, field, admin: req.user?.email }, "[AUDIT] Payment provider key updated");
  res.json({ success: true });
});

// ── POST /admin/settings/payment-providers/:provider/reveal ──────────────────

router.post("/admin/settings/payment-providers/:provider/reveal", ...auth, async (req, res) => {
  const { provider } = req.params;
  const { field } = req.body;
  if (!isValidProvider(provider)) { res.status(400).json({ error: "Invalid provider" }); return; }
  if (!PROVIDER_FIELDS[provider].includes(field)) {
    res.status(400).json({ error: `Invalid field '${field}' for ${provider}` }); return;
  }

  logger.info({ provider, field, admin: req.user?.email, ip: req.ip }, "[AUDIT] Payment provider key revealed");

  const [row] = await db.select().from(apiCredentials).where(eq(apiCredentials.provider, provider));
  if (!row) { res.json({ value: "" }); return; }

  try {
    const extra = (row.extra ?? {}) as Record<string, string>;
    const mode = extra.mode === "live" ? "live" : "sandbox";
    const extraKey =
      field === "secretKey" ? `${mode}_secretKeyEncrypted` :
      field === "publishableKey" ? `${mode}_publicKeyEncrypted` :
      `${mode}_webhookSecretEncrypted`;
    const enc = extra[extraKey];

    res.json({ value: enc ? decrypt(enc) : "" });
  } catch {
    res.status(500).json({ error: "Decryption failed" });
  }
});

// ── POST /admin/settings/payment-providers/:provider/test ────────────────────

router.post("/admin/settings/payment-providers/:provider/test", ...auth, async (req, res) => {
  const { provider } = req.params;
  if (!isValidProvider(provider)) { res.status(400).json({ error: "Invalid provider" }); return; }

  const [row] = await db.select().from(apiCredentials).where(eq(apiCredentials.provider, provider));
  const extra = (row?.extra ?? {}) as Record<string, string>;
  const mode = extra.mode === "live" ? "live" : "sandbox";
  const skEnc = extra[`${mode}_secretKeyEncrypted`];
  if (!skEnc) {
    res.json({ success: false, message: `No ${mode} secret key configured` }); return;
  }

  try {
    const sk = decrypt(skEnc);

    if (provider === "stripe") {
      const { createStripeClient } = await import("../lib/stripe-client");
      const stripe = createStripeClient(sk);
      const balance = await stripe.balance.retrieve();
      const currency = balance.available[0]?.currency?.toUpperCase() ?? "USD";
      res.json({ success: true, message: `Connected! Available balance currency: ${currency}` });
    } else if (provider === "checkout") {
      const baseUrl = mode === "live"
        ? "https://api.checkout.com"
        : "https://api.sandbox.checkout.com";
      const r = await fetch(`${baseUrl}/instruments`, {
        headers: { Authorization: `Bearer ${sk}` },
        signal: AbortSignal.timeout(8000),
      });
      const ok = r.status >= 200 && r.status < 300;
      res.json({ success: ok, message: ok ? "Connected successfully" : r.status === 401 ? "Invalid credentials" : `API returned ${r.status}` });
    }
  } catch (err) {
    res.json({ success: false, message: `Connection failed: ${(err as Error).message}` });
  }
});

export default router;
