import { Router, type Request } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { walletTransactions } from "@workspace/db/schema";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { getOrCreateWallet, creditWallet, debitWallet } from "../services/wallet-service";
import { logger } from "../lib/logger";
import { paramString } from "../lib/route-params";

const router = Router();
const auth = [requireAuth, requireAdmin, requirePermission("manageCustomers")];

type AdjustType = "TOPUP" | "CREDIT" | "DEBIT";

function firstQuery(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

/** Parse ?a=b from a path or full URL (Express 5 mounted routers often leave req.query empty). */
function extractQueryFromUrlPart(urlPart: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!urlPart?.includes("?")) return out;
  const q = urlPart.slice(urlPart.indexOf("?") + 1);
  const noHash = (q.split("#")[0] ?? "").trim();
  if (!noHash) return out;
  new URLSearchParams(noHash).forEach((v, k) => {
    if (!(k in out)) out[k] = v;
  });
  return out;
}

/**
 * Query: prefer raw URL parsing, then req.query. Body wins over query for same keys.
 */
function buildAdjustPayload(req: Request): unknown {
  const fromUrl = {
    ...extractQueryFromUrlPart(req.originalUrl),
    ...extractQueryFromUrlPart(req.url),
  };

  const fromQuery: Record<string, unknown> = { ...fromUrl };
  const q = req.query as Record<string, string | string[] | undefined>;
  for (const k of Object.keys(q)) {
    const v = firstQuery(q[k] as string | string[] | undefined);
    if (v != null && fromQuery[k] === undefined) fromQuery[k] = v;
  }

  const b = req.body;
  const fromBody: Record<string, unknown> =
    b && typeof b === "object" && !Array.isArray(b) ? { ...(b as Record<string, unknown>) } : {};

  const merged = { ...fromQuery, ...fromBody };
  if (Object.keys(merged).length > 0) return merged;
  return b;
}

function pickScalar(v: unknown): unknown {
  if (Array.isArray(v)) return v.length > 0 ? v[0] : undefined;
  return v;
}

/**
 * Lenient parser so admin adjust works even when proxies/clients send
 * string amounts, wrapped payloads, or JSON as a string.
 */
function parseAdjustPayload(raw: unknown):
  | { ok: true; type: AdjustType; amountUsd: number; reason: string }
  | { ok: false; error: string; hint?: string } {
  let v: unknown = raw;

  if (v && typeof v === "object" && !Array.isArray(v) && "data" in v) {
    const inner = (v as { data: unknown }).data;
    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
      v = inner;
    }
  }

  if (typeof v === "string") {
    try {
      v = JSON.parse(v) as unknown;
    } catch {
      return { ok: false, error: "Invalid JSON body" };
    }
  }

  if (!v || typeof v !== "object" || Array.isArray(v)) {
    return {
      ok: false,
      error: "Missing wallet adjustment data",
      hint: "Send type, amountUsd, and reason in the POST query string or JSON/form body.",
    };
  }

  const o = v as Record<string, unknown>;

  const typeRaw = pickScalar(o.type);
  const typeStr =
    typeof typeRaw === "string"
      ? typeRaw.trim().toUpperCase()
      : typeRaw != null
        ? String(typeRaw).trim().toUpperCase()
        : "";
  if (typeStr !== "TOPUP" && typeStr !== "CREDIT" && typeStr !== "DEBIT") {
    return {
      ok: false,
      error: "Invalid type",
      hint: `Expected TOPUP, CREDIT, or DEBIT; received ${JSON.stringify(typeRaw)}`,
    };
  }
  const type = typeStr as AdjustType;

  const amountRaw = pickScalar(o.amountUsd);
  let amount: number;
  if (typeof amountRaw === "number" && Number.isFinite(amountRaw)) {
    amount = amountRaw;
  } else if (typeof amountRaw === "string") {
    amount = parseFloat(amountRaw.replace(/\s/g, "").replace(",", "."));
  } else if (amountRaw != null) {
    amount = Number(amountRaw);
  } else {
    return { ok: false, error: "Missing amountUsd" };
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10000) {
    return {
      ok: false,
      error: "Invalid amountUsd",
      hint: "Must be a finite number > 0 and ≤ 10000",
    };
  }

  const reasonRaw = pickScalar(o.reason);
  const reason =
    typeof reasonRaw === "string"
      ? reasonRaw.trim()
      : reasonRaw != null && String(reasonRaw).length > 0
        ? String(reasonRaw).trim()
        : "";
  if (!reason) {
    return { ok: false, error: "Missing or empty reason" };
  }
  if (reason.length > 500) {
    return { ok: false, error: "Reason too long (max 500 characters)" };
  }

  return { ok: true, type, amountUsd: amount, reason };
}

router.get("/admin/wallet/:userId", ...auth, async (req, res) => {
  const userId = parseInt(paramString(req.params, "userId"));
  if (!userId || isNaN(userId)) {
    res.status(400).json({ code: "WALLET_ADMIN_BAD_USER", error: "Invalid user ID" });
    return;
  }

  const wallet = await getOrCreateWallet(userId);
  const txs = await db.select().from(walletTransactions)
    .where(eq(walletTransactions.userId, userId))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(50);

  res.json({ wallet, transactions: txs });
});

router.post("/admin/wallet/:userId/adjust", ...auth, async (req, res) => {
  const userId = parseInt(paramString(req.params, "userId"));
  if (!userId || isNaN(userId)) {
    res.status(400).json({ code: "WALLET_ADMIN_BAD_USER", error: "Invalid user ID" });
    return;
  }

  const merged = buildAdjustPayload(req);
  const raw = merged;
  const body = typeof raw === "string"
    ? (() => { try { return JSON.parse(raw) as unknown; } catch { return raw; } })()
    : raw;

  const parsed = parseAdjustPayload(body);
  if (!parsed.ok) {
    logger.warn(
      {
        error: parsed.error,
        hint: parsed.hint,
        contentType: req.headers["content-type"],
        originalUrl: req.originalUrl,
        url: req.url,
        queryKeys: Object.keys(req.query),
        bodyKeys: req.body && typeof req.body === "object" && !Array.isArray(req.body) ? Object.keys(req.body as object) : [],
      },
      "admin wallet adjust parse failed",
    );
    res.status(400).json({
      code: "WALLET_ADJUST_VALIDATE",
      error: parsed.error,
      hint: parsed.hint,
      issues: { formErrors: [parsed.hint ? `${parsed.error}: ${parsed.hint}` : parsed.error] },
    });
    return;
  }

  const { type, amountUsd, reason } = parsed;
  const adminId = req.user!.userId;

  try {
    if (type === "TOPUP") {
      const { wallet } = await creditWallet(userId, amountUsd, "TOPUP",
        `Admin top-up: ${reason}`, `admin:${adminId}`);
      res.json({ balanceUsd: wallet.balanceUsd });
    } else if (type === "CREDIT") {
      const { wallet } = await creditWallet(userId, amountUsd, "CREDIT",
        `Admin credit: ${reason}`, `admin:${adminId}`);
      res.json({ balanceUsd: wallet.balanceUsd });
    } else {
      const { wallet } = await debitWallet(userId, amountUsd, "DEBIT",
        `Admin debit: ${reason}`, `admin:${adminId}`);
      res.json({ balanceUsd: wallet.balanceUsd });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Adjustment failed";
    logger.error({ err, userId, adminId }, "admin wallet adjust failed");
    res.status(400).json({ code: "WALLET_ADJUST_DB", error: msg });
  }
});

export default router;
