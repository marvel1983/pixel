import https from "node:https";
import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { logger } from "./logger";

// Upload directory — relative to CWD (PM2 runs from /var/www/pixel-storefront)
const UPLOADS_DIR = path.resolve(process.cwd(), "uploads", "products");

// Allow any HTTPS host — this function is only called from admin-guarded routes
const ALLOWED_HOSTS: string[] = [];

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
};

function extFromUrl(remoteUrl: string): string {
  try {
    const pathname = new URL(remoteUrl).pathname;
    const ext = path.extname(pathname).toLowerCase();
    if ([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"].includes(ext)) {
      return ext === ".jpeg" ? ".jpg" : ext;
    }
  } catch {
    // ignore
  }
  return ".jpg";
}

function extFromContentType(contentType: string): string | null {
  const base = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return ALLOWED_CONTENT_TYPES[base] ?? null;
}

export async function ensureUploadsDir(): Promise<void> {
  await fsp.mkdir(UPLOADS_DIR, { recursive: true });
}

/**
 * Downloads a remote image to the local VPS disk.
 * Returns the public URL path (e.g. /uploads/products/abc123.jpg).
 * Throws on failure.
 */
export async function downloadImageToVps(remoteUrl: string): Promise<string> {
  // Validate URL and host
  let parsed: URL;
  try {
    parsed = new URL(remoteUrl);
  } catch {
    throw new Error(`Invalid URL: ${remoteUrl}`);
  }

  if (ALLOWED_HOSTS.length > 0 && !ALLOWED_HOSTS.includes(parsed.hostname)) {
    throw new Error(`Host not allowed: ${parsed.hostname}`);
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Protocol not allowed: ${parsed.protocol}`);
  }

  await ensureUploadsDir();

  // Filename = SHA256 of URL (deterministic — same URL → same file, no duplicates)
  const hash = crypto.createHash("sha256").update(remoteUrl).digest("hex").slice(0, 32);
  const tempExt = extFromUrl(remoteUrl);
  const tempPath = path.join(UPLOADS_DIR, `${hash}${tempExt}`);

  // If already downloaded, return immediately
  if (fs.existsSync(tempPath)) {
    return `/uploads/products/${hash}${tempExt}`;
  }

  return new Promise((resolve, reject) => {
    const client = parsed.protocol === "https:" ? https : http;

    const request = client.get(remoteUrl, { timeout: 15_000 }, (res) => {
      // Follow one redirect
      if (res.statusCode === 301 || res.statusCode === 302) {
        const location = res.headers.location;
        if (!location) { reject(new Error("Redirect with no Location")); return; }
        downloadImageToVps(location).then(resolve).catch(reject);
        return;
      }

      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`HTTP ${res.statusCode} from ${remoteUrl}`));
        return;
      }

      const ct = res.headers["content-type"] ?? "";
      const ctExt = extFromContentType(ct);
      if (!ctExt) {
        reject(new Error(`Unsupported content-type: ${ct}`));
        return;
      }

      // Rename if content-type gives a different ext
      const finalExt = ctExt;
      const finalName = `${hash}${finalExt}`;
      const finalPath = path.join(UPLOADS_DIR, finalName);

      // Guard max file size: 10 MB
      const contentLength = parseInt(res.headers["content-length"] ?? "0", 10);
      if (contentLength > 10 * 1024 * 1024) {
        reject(new Error(`Image too large: ${contentLength} bytes`));
        return;
      }

      const writeStream = fs.createWriteStream(finalPath);
      let received = 0;

      res.on("data", (chunk: Buffer) => {
        received += chunk.length;
        if (received > 10 * 1024 * 1024) {
          writeStream.destroy();
          fs.unlink(finalPath, () => {});
          reject(new Error("Image exceeded 10 MB limit during download"));
        }
      });

      res.pipe(writeStream);

      writeStream.on("finish", () => {
        logger.info({ remoteUrl, localPath: finalPath }, "Image downloaded");
        resolve(`/uploads/products/${finalName}`);
      });

      writeStream.on("error", (err) => {
        fs.unlink(finalPath, () => {});
        reject(err);
      });
    });

    request.on("timeout", () => {
      request.destroy();
      reject(new Error(`Download timed out: ${remoteUrl}`));
    });

    request.on("error", reject);
  });
}
