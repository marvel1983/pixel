import { Request, Response, NextFunction } from "express";
import { verifyToken } from "./auth";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

function getStore(name: string): Map<string, RateLimitEntry> {
  let store = stores.get(name);
  if (!store) {
    store = new Map();
    stores.set(name, store);
  }
  return store;
}

setInterval(() => {
  const now = Date.now();
  for (const store of stores.values()) {
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }
}, 60_000);

function getClientKey(req: Request): string {
  // With trust proxy: 1, req.ip is already the real client IP from X-Forwarded-For
  // Fallback to X-Real-IP header set by Nginx
  return req.ip ?? (req.headers["x-real-ip"] as string) ?? "unknown";
}

/** Lokalni dev + E2E: bez limita na loopbacku; produkcija ne dira. */
function shouldSkipRateLimit(req: Request): boolean {
  if (process.env.DISABLE_RATE_LIMIT === "1") return true;
  if (process.env.NODE_ENV !== "development") return false;
  const ip = req.ip || req.socket.remoteAddress || "";
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1"
  );
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  name: string;
  keyFn?: (req: Request) => string;
}

export function rateLimit(options: RateLimitOptions) {
  const { windowMs, max, name, keyFn } = options;
  const store = getStore(name);

  return (req: Request, res: Response, next: NextFunction) => {
    if (shouldSkipRateLimit(req)) {
      next();
      return;
    }

    const key = keyFn ? keyFn(req) : getClientKey(req);
    const now = Date.now();
    let entry = store.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    const remaining = Math.max(0, max - entry.count);
    const resetSecs = Math.ceil((entry.resetAt - now) / 1000);

    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", resetSecs);

    if (entry.count > max) {
      res.setHeader("Retry-After", resetSecs);
      res.status(429).json({
        error: "Too many requests, please try again later",
        retryAfter: resetSecs,
      });
      return;
    }

    next();
  };
}

interface RateLimitConfig {
  authLogin: number;
  authRegister: number;
  authReset: number;
  public: number;
  admin: number;
}

const config: RateLimitConfig = {
  authLogin: 50,
  authRegister: 20,
  authReset: 10,
  public: 300,
  admin: 300,
};

export function getRateLimitConfig(): RateLimitConfig {
  return { ...config };
}

function clamp(val: unknown, min: number, max: number): number | undefined {
  if (typeof val !== "number" || !Number.isInteger(val)) return undefined;
  return Math.max(min, Math.min(max, val));
}

export function updateRateLimitConfig(updates: Partial<RateLimitConfig>) {
  const login = clamp(updates.authLogin, 1, 100);
  const register = clamp(updates.authRegister, 1, 100);
  const reset = clamp(updates.authReset, 1, 100);
  const pub = clamp(updates.public, 10, 1000);
  const admin = clamp(updates.admin, 10, 1000);
  if (login !== undefined) config.authLogin = login;
  if (register !== undefined) config.authRegister = register;
  if (reset !== undefined) config.authReset = reset;
  if (pub !== undefined) config.public = pub;
  if (admin !== undefined) config.admin = admin;
}

function dynamicLimit(configKey: keyof RateLimitConfig, name: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const limiter = rateLimit({ name, windowMs: 60_000, max: config[configKey] });
    return limiter(req, res, next);
  };
}

export const authLoginLimit = dynamicLimit("authLogin", "auth-login");
export const authRegisterLimit = dynamicLimit("authRegister", "auth-register");
export const authPasswordResetLimit = dynamicLimit("authReset", "auth-reset");
export const publicLimit = dynamicLimit("public", "public");
export const adminLimit = dynamicLimit("admin", "admin");

/** Strict limit for guest order lookup — prevents license key enumeration */
export const orderLookupLimit = rateLimit({ name: "order-lookup", windowMs: 15 * 60_000, max: 10 });

/**
 * Checkout / order creation: max 5 orders per 10 minutes.
 * Keyed by userId when the request carries a valid JWT, otherwise by IP.
 * This prevents order-flooding attacks regardless of whether the attacker
 * uses different sessions or rotates cookies.
 */
function checkoutKeyFn(req: Request): string {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    try {
      const payload = verifyToken(auth.slice(7));
      if (payload?.userId) return `uid:${payload.userId}`;
    } catch { /* fall through to IP */ }
  }
  // Also check cookie-based JWT used by the storefront
  const cookieToken = req.cookies?.token;
  if (cookieToken) {
    try {
      const payload = verifyToken(cookieToken);
      if (payload?.userId) return `uid:${payload.userId}`;
    } catch { /* fall through to IP */ }
  }
  return `ip:${getClientKey(req)}`;
}

export const checkoutLimit = rateLimit({
  name: "checkout",
  windowMs: 10 * 60_000, // 10 minutes
  max: 5,                 // 5 orders per window
  keyFn: checkoutKeyFn,
});
