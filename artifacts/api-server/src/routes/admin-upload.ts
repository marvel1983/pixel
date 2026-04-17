import { Router } from "express";
import { z } from "zod";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { downloadImageToVps } from "../lib/image-downloader";
import { logger } from "../lib/logger";

const router = Router();

// ── Base64 upload (manual product image upload from admin UI) ────────────────

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

router.post(
  "/admin/upload",
  requireAuth,
  requireAdmin,
  requirePermission("manageProducts"),
  async (req, res) => {
    const { data, mimeType } = req.body as {
      data?: string;
      mimeType?: string;
    };

    if (!data || !mimeType) {
      res.status(400).json({ error: "data and mimeType are required" });
      return;
    }

    const ext = ALLOWED_TYPES[mimeType];
    if (!ext) {
      res.status(400).json({ error: "Unsupported image type. Allowed: jpeg, png, webp, gif" });
      return;
    }

    const base64 = data.includes(",") ? data.split(",")[1] : data;

    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64!, "base64");
    } catch {
      res.status(400).json({ error: "Invalid base64 data" });
      return;
    }

    if (buffer.length > 5 * 1024 * 1024) {
      res.status(413).json({ error: "Image too large. Maximum size is 5 MB" });
      return;
    }

    const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const filePath = path.join(uploadsDir, uniqueName);
    fs.writeFileSync(filePath, buffer);

    res.json({ url: `/uploads/${uniqueName}` });
  },
);

// ── Remote URL download (Metenzi product image sync) ─────────────────────────

const imageFromUrlSchema = z.object({
  url: z.string().url().max(2048),
});

/**
 * POST /admin/upload/image-from-url
 * Downloads a remote image (e.g. from Metenzi) to local VPS storage.
 * Body: { url: string }
 * Response: { localUrl: string }
 */
router.post(
  "/admin/upload/image-from-url",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const parsed = imageFromUrlSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid URL" });
      return;
    }

    try {
      const localUrl = await downloadImageToVps(parsed.data.url);
      res.json({ localUrl });
    } catch (err) {
      logger.error({ err, url: parsed.data.url }, "Image download failed");
      const message = err instanceof Error ? err.message : "Download failed";
      res.status(422).json({ error: message });
    }
  },
);

export default router;
