import { Request, Response, NextFunction } from "express";

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
  return req.ip ?? "unknown";
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  name: string;
}

export function rateLimit(options: RateLimitOptions) {
  const { windowMs, max, name } = options;
  const store = getStore(name);

  return (req: Request, res: Response, next: NextFunction) => {
    const key = getClientKey(req);
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
  authLogin: 5,
  authRegister: 3,
  authReset: 3,
  public: 60,
  admin: 120,
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
