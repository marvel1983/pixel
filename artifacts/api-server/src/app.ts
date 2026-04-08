import express, { type Express, type Request } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
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
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(
  express.json({
    verify: (req: Request, _res, buf) => {
      if (req.url?.includes("/webhooks/")) {
        (req as Request).rawBody = buf.toString("utf8");
      }
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

app.use(securityHeaders);
app.get("/api/csrf-token", publicLimit, csrfTokenEndpoint);
app.use("/api/admin", adminLimit);
app.use("/api", publicLimit, csrfProtection, referralTracking, maintenanceMiddleware, router);

export default app;
