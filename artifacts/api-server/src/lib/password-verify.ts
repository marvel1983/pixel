/**
 * Multi-format password verification.
 *
 * Supported formats:
 *   1. bcrypt     ($2a$ / $2b$ / $2y$) — native PixelCodes format
 *   2. phpass     ($P$ / $H$)          — WordPress < 6.8 format
 *   3. wp-bcrypt  ($wp$2y$)            — WordPress 6.8+ format (HMAC-SHA384 prehash + bcrypt)
 *
 * On every successful login with a non-bcrypt hash, the caller should
 * transparently re-hash to bcrypt and persist the new hash.
 */

import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const ITOA64 = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export type HashFormat = "bcrypt" | "phpass" | "wp-bcrypt" | "unknown";

export function getHashFormat(hash: string): HashFormat {
  // WordPress 6.8+ — must check before plain bcrypt since it starts with $wp$2y$
  if (hash.startsWith("$wp$2y$") || hash.startsWith("$wp$2b$") || hash.startsWith("$wp$2a$")) {
    return "wp-bcrypt";
  }
  if (hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$")) {
    return "bcrypt";
  }
  if ((hash.startsWith("$P$") || hash.startsWith("$H$")) && hash.length >= 20) {
    return "phpass";
  }
  return "unknown";
}

/** Verify any supported hash format. */
export async function verifyPasswordAny(plaintext: string, storedHash: string): Promise<boolean> {
  const fmt = getHashFormat(storedHash);
  if (fmt === "bcrypt") return bcrypt.compare(plaintext, storedHash);
  if (fmt === "wp-bcrypt") return verifyWpBcrypt(plaintext, storedHash);
  if (fmt === "phpass") return verifyPhpass(plaintext, storedHash);
  return false;
}

// ── WordPress 6.8+ ($wp$ + HMAC-SHA384 prehash + bcrypt) ─────────────────────

function wpPrehash(plaintext: string): string {
  return Buffer.from(crypto.createHmac("sha384", "wp-sha384").update(plaintext).digest()).toString("base64");
}

async function verifyWpBcrypt(plaintext: string, storedHash: string): Promise<boolean> {
  // Strip the $wp$ prefix to get a standard bcrypt hash
  const bcryptHash = storedHash.slice(4);
  return bcrypt.compare(wpPrehash(plaintext), bcryptHash);
}

// ── phpass (WordPress < 6.8) ──────────────────────────────────────────────────

function encode64(buf: Buffer, count: number): string {
  let out = "";
  let i = 0;
  while (i < count) {
    let val = buf[i++];
    out += ITOA64[val & 0x3f];
    if (i < count) val |= buf[i] << 8;
    out += ITOA64[(val >> 6) & 0x3f];
    if (i++ >= count) break;
    if (i < count) val |= buf[i] << 16;
    out += ITOA64[(val >> 12) & 0x3f];
    if (i++ >= count) break;
    out += ITOA64[(val >> 18) & 0x3f];
    i++;
  }
  return out;
}

function verifyPhpass(plaintext: string, storedHash: string): boolean {
  try {
    const iterChar = storedHash[3];
    const iterPos = ITOA64.indexOf(iterChar);
    if (iterPos < 0) return false;
    const count = 1 << iterPos;
    const salt = storedHash.slice(4, 12);
    const expectedEncoded = storedHash.slice(12);

    const pwBuf = Buffer.from(plaintext, "utf8");
    const saltBuf = Buffer.from(salt, "binary");

    let hash = crypto.createHash("md5").update(Buffer.concat([saltBuf, pwBuf])).digest();
    for (let i = 0; i < count; i++) {
      hash = crypto.createHash("md5").update(Buffer.concat([hash, pwBuf])).digest();
    }

    return encode64(hash, 16) === expectedEncoded;
  } catch {
    return false;
  }
}
