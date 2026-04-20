import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { users } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

// Cache user isActive status for 5 minutes to avoid a DB hit on every request
// while still blocking deactivated users quickly.
const userStatusCache = new Map<number, { isActive: boolean; expiresAt: number }>();
const USER_STATUS_TTL = 5 * 60 * 1000;

async function isUserActive(userId: number): Promise<boolean> {
  const cached = userStatusCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.isActive;
  const [user] = await db.select({ isActive: users.isActive }).from(users).where(eq(users.id, userId)).limit(1);
  const isActive = user?.isActive ?? false;
  userStatusCache.set(userId, { isActive, expiresAt: Date.now() + USER_STATUS_TTL });
  return isActive;
}

/** Call when an admin deactivates a user to immediately evict the cache entry. */
export function evictUserStatusCache(userId: number): void {
  userStatusCache.delete(userId);
}

function getJwtSecret(): string {
  // JWT_SECRET is the dedicated signing key. Falls back to ENCRYPTION_KEY for
  // existing deployments that haven't set JWT_SECRET yet.
  const secret = process.env.JWT_SECRET ?? process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required for JWT signing");
  }
  return secret;
}

const JWT_SECRET = getJwtSecret();
const JWT_EXPIRY = "30d";

export interface JwtPayload {
  userId: number;
  email: string;
  role: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN";
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token =
    req.cookies?.token ||
    req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  let payload: JwtPayload;
  try {
    payload = verifyToken(token);
  } catch {
    logger.warn("Invalid or expired token");
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  isUserActive(payload.userId).then((active) => {
    if (!active) {
      res.status(401).json({ error: "Account is deactivated" });
      return;
    }
    req.user = payload;
    next();
  }).catch((err) => {
    logger.error({ err }, "Failed to verify user status");
    res.status(500).json({ error: "Authentication error" });
  });
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token =
    req.cookies?.token ||
    req.headers.authorization?.replace("Bearer ", "");

  if (token) {
    try {
      req.user = verifyToken(token);
    } catch {
      // ignore invalid tokens for optional auth
    }
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  if (req.user.role !== "ADMIN" && req.user.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  next();
}
