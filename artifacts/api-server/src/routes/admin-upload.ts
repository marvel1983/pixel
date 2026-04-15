import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const router = Router();

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
    const { data, mimeType, filename } = req.body as {
      data?: string;
      mimeType?: string;
      filename?: string;
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

    // Strip base64 data URL prefix if present
    const base64 = data.includes(",") ? data.split(",")[1] : data;

    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64, "base64");
    } catch {
      res.status(400).json({ error: "Invalid base64 data" });
      return;
    }

    // 5 MB limit
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

export default router;
