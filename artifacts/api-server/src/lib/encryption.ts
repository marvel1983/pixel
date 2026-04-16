import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const SALT_LENGTH = 16;

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return crypto.scryptSync(passphrase, salt, 32);
}

function getPassphrase(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY environment variable is not set");
  return key;
}

/** Encrypt using a random per-value salt (v2 format). */
export function encrypt(plaintext: string): string {
  const passphrase = getPassphrase();
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(passphrase, salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();

  return `v2:${salt.toString("hex")}:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

export function decrypt(ciphertext: string): string {
  const passphrase = getPassphrase();

  // v2 format: v2:<salt>:<iv>:<tag>:<data>
  if (ciphertext.startsWith("v2:")) {
    const parts = ciphertext.slice(3).split(":");
    if (parts.length !== 4) throw new Error("Invalid v2 encrypted value format");
    const [saltHex, ivHex, tagHex, data] = parts;
    const salt = Buffer.from(saltHex, "hex");
    const key = deriveKey(passphrase, salt);
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(data, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  // v1 legacy format: <iv>:<tag>:<data> — hardcoded salt for backwards compatibility
  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted value format");
  const key = crypto.scryptSync(passphrase, "pixelcodes-salt", 32);
  const iv = Buffer.from(parts[0], "hex");
  const tag = Buffer.from(parts[1], "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(parts[2], "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
