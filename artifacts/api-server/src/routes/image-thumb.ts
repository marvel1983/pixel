import path from "path";
import fs from "fs";
import { Router, Request, Response } from "express";

const router = Router();

const uploadsDir = path.join(process.cwd(), "uploads");
const thumbDir = path.join(process.cwd(), "uploads", "_thumbs");

if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

router.get("/uploads/thumb/:filename", async (req: Request, res: Response) => {
  const filename = String(req.params.filename ?? "");
  if (!filename || filename.includes("..") || filename.includes("/")) {
    res.status(400).end(); return;
  }

  const thumbPath = path.join(thumbDir, filename);
  const originalPath = path.join(uploadsDir, filename);

  // Serve cached thumb if it exists
  if (fs.existsSync(thumbPath)) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.sendFile(thumbPath); return;
  }

  if (!fs.existsSync(originalPath)) {
    res.status(404).end(); return;
  }

  try {
    // Lazy import so sharp doesn't slow startup if unused
    const sharp = (await import("sharp")).default;
    await sharp(originalPath)
      .resize(400, 534, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(thumbPath);

    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.sendFile(thumbPath);
  } catch {
    // Fall back to original
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.sendFile(originalPath);
  }
});

export default router;
