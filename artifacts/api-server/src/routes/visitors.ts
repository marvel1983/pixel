import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { upsertVisitor, getVisitorStats } from "../lib/visitor-tracker";

const router = Router();

router.post("/visitors/ping", (req, res) => {
  const { sessionId, path, referrer } = req.body;
  if (!sessionId || typeof sessionId !== "string" || sessionId.length > 64) {
    res.status(400).json({ error: "Invalid session" }); return;
  }
  const ip = (req.headers["x-forwarded-for"] as string || req.ip || "").split(",")[0].trim();
  const ua = (req.headers["user-agent"] as string) || "";
  upsertVisitor(
    sessionId,
    typeof path === "string" ? path.slice(0, 200) : "/",
    typeof referrer === "string" ? referrer.slice(0, 300) : "",
    ua,
    ip,
  );
  res.json({ ok: true });
});

router.get("/admin/visitors/live", requireAuth, requireAdmin, (_req, res) => {
  res.json(getVisitorStats());
});

export default router;
