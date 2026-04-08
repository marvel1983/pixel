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
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
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

export const authLoginLimit = rateLimit({ name: "auth-login", windowMs: 60_000, max: 5 });
export const authRegisterLimit = rateLimit({ name: "auth-register", windowMs: 60_000, max: 3 });
export const authPasswordResetLimit = rateLimit({ name: "auth-reset", windowMs: 60_000, max: 3 });
export const publicLimit = rateLimit({ name: "public", windowMs: 60_000, max: 60 });
export const adminLimit = rateLimit({ name: "admin", windowMs: 60_000, max: 120 });
