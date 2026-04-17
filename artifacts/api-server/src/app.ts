import express, { type Express, type Request } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";
import { maintenanceMiddleware } from "./middleware/maintenance";
import { referralTracking } from "./middleware/referral";
import { securityHeaders } from "./middleware/security-headers";
import { csrfProtection, csrfTokenEndpoint } from "./middleware/csrf";
import { publicLimit, adminLimit } from "./middleware/rate-limit";

declare global {
  namespace Express {
    interface Request {
      rawBody?: string;
    }
  }
}

const app: Express = express();
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const ALLOWED_ORIGINS = process.env.NODE_ENV === "production"
  ? (process.env.ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean)
  : true; // dev: allow all origins
app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
}));
app.use(cookieParser());
// Webhook endpoints must accept requests from any origin (Metenzi, Stripe, etc.)
// They use their own HMAC signature verification instead of CORS for security.
app.use((req, res, next) => {
  if (req.path.startsWith("/api/webhooks/") || req.path === "/api/webhooks") {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type, authorization, x-metenzi-signature, x-metenzi-timestamp, x-metenzi-event, stripe-signature, cko-signature");
    if (req.method === "OPTIONS") { res.status(204).end(); return; }
  }
  next();
});

app.use(
  express.json({
    limit: "10mb",
    verify: (req: Request, _res, buf) => {
      if (req.url?.includes("/webhooks/")) {
        (req as Request).rawBody = buf.toString("utf8");
      }
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images statically
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir));

app.use(securityHeaders);
app.get("/api/csrf-token", publicLimit, csrfTokenEndpoint);

function categoryRateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.path.startsWith("/admin")) {
    return adminLimit(req, res, next);
  }
  return publicLimit(req, res, next);
}

app.use("/api", categoryRateLimit, csrfProtection, referralTracking, maintenanceMiddleware, router);

export default app;
