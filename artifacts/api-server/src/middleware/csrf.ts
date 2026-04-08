import crypto from "crypto";
import { Request, Response, NextFunction } from "express";

const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";
const TOKEN_LENGTH = 32;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const EXEMPT_PATHS = [
  "/api/webhooks/",
  "/api/auth/google",
  "/api/survey/",
];

function generateToken(): string {
  return crypto.randomBytes(TOKEN_LENGTH).toString("hex");
}

function isExempt(path: string): boolean {
  return EXEMPT_PATHS.some((p) => path.startsWith(p));
}

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  let token = req.cookies?.[CSRF_COOKIE];
  if (!token) {
    token = generateToken();
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 24 * 60 * 60 * 1000,
    });
  }

  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  if (isExempt(req.originalUrl || req.url)) {
    next();
    return;
  }

  const headerToken = req.headers[CSRF_HEADER];
  if (!headerToken || headerToken !== token) {
    res.status(403).json({ error: "Invalid or missing CSRF token" });
    return;
  }

  next();
}

export function csrfTokenEndpoint(req: Request, res: Response) {
  let token = req.cookies?.[CSRF_COOKIE];
  if (!token) {
    token = generateToken();
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 24 * 60 * 60 * 1000,
    });
  }
  res.json({ csrfToken: token });
}
