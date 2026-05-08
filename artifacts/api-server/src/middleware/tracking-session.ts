import { type Request, type Response, type NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      sessionId?: string;
    }
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SESSION_HEADER = "x-session-id";
const SESSION_COOKIE = "pixelcodes_session";

export function trackingSession(req: Request, _res: Response, next: NextFunction) {
  const headerId = req.headers[SESSION_HEADER];
  const cookieId = req.cookies?.[SESSION_COOKIE];

  const candidate = (typeof headerId === "string" ? headerId : undefined) ?? cookieId;

  if (typeof candidate === "string" && UUID_RE.test(candidate)) {
    req.sessionId = candidate.toLowerCase();
  }

  next();
}
