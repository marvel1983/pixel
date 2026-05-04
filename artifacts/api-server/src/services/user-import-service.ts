/**
 * User import service — processes WooCommerce / generic CSV uploads.
 *
 * Supported password formats on import:
 *   - bcrypt ($2a/$2b/$2y$) → stored as-is
 *   - phpass ($P$/$H$) → stored as-is, migrated to bcrypt on first login
 *   - no hash → user created as inactive with a placeholder hash,
 *               adminNotes explains they need a password reset
 */

import { db } from "@workspace/db";
import { users, userImportJobs, userImportErrors, type UserImportJob } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { getHashFormat } from "../lib/password-verify";
import { logger } from "../lib/logger";

// ── Column mapping presets ────────────────────────────────────────────────────

/** Standard WooCommerce user export column names → PixelCodes user fields */
export const WOOCOMMERCE_PRESET: Record<string, string> = {
  user_email: "email",
  user_login: "username",
  user_pass: "passwordHash",
  first_name: "firstName",
  last_name: "lastName",
  display_name: "displayName",
  billing_phone: "billingPhone",
  billing_address_1: "billingAddress",
  billing_city: "billingCity",
  billing_postcode: "billingZip",
  billing_country: "billingCountry",
  billing_company: "companyName",
  user_registered: "createdAt",
};

export const AVAILABLE_FIELDS = [
  { field: "email", label: "Email", required: true },
  { field: "username", label: "Username / Login", required: false },
  { field: "passwordHash", label: "Password Hash (bcrypt or WordPress phpass)", required: false },
  { field: "firstName", label: "First Name", required: false },
  { field: "lastName", label: "Last Name", required: false },
  { field: "displayName", label: "Display Name (fallback for first/last)", required: false },
  { field: "companyName", label: "Company Name", required: false },
  { field: "billingPhone", label: "Phone", required: false },
  { field: "billingAddress", label: "Address", required: false },
  { field: "billingCity", label: "City", required: false },
  { field: "billingZip", label: "Postal Code", required: false },
  { field: "billingCountry", label: "Country Code (2-letter)", required: false },
];

// ── CSV parser ────────────────────────────────────────────────────────────────

function detectDelimiter(firstLine: string): string {
  const semis = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return semis >= commas ? ";" : ",";
}

export function parseCSV(content: string): { headers: string[]; rows: Array<{ rowNumber: number; data: Record<string, string> }> } {
  const firstNewline = content.indexOf("\n");
  const firstLine = firstNewline === -1 ? content : content.slice(0, firstNewline);
  const delim = detectDelimiter(firstLine);

  const records: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  let i = 0;

  while (i < content.length) {
    const ch = content[i];
    if (ch === '"') {
      if (inQ && content[i + 1] === '"') { field += '"'; i += 2; continue; }
      inQ = !inQ; i++; continue;
    }
    if (!inQ && ch === delim) { cur.push(field.trim()); field = ""; i++; continue; }
    if (!inQ && (ch === "\n" || ch === "\r")) {
      cur.push(field.trim());
      if (cur.some((f) => f.length > 0)) records.push(cur);
      cur = []; field = "";
      if (ch === "\r" && content[i + 1] === "\n") i++;
      i++; continue;
    }
    field += ch; i++;
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field.trim()); if (cur.some((f) => f.length > 0)) records.push(cur); }

  if (records.length === 0) return { headers: [], rows: [] };
  const headers = records[0];
  const rows = records.slice(1).map((vals, idx) => {
    const data: Record<string, string> = {};
    headers.forEach((h, j) => { data[h] = vals[j] ?? ""; });
    return { rowNumber: idx + 2, data };
  });
  return { headers, rows };
}

// ── Row processor ─────────────────────────────────────────────────────────────

function mapRow(data: Record<string, string>, mapping: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [col, field] of Object.entries(mapping)) {
    if (data[col] !== undefined) out[field] = data[col];
  }
  return out;
}

function resolveNames(mapped: Record<string, string>): { firstName: string | null; lastName: string | null } {
  if (mapped.firstName || mapped.lastName) {
    return { firstName: mapped.firstName?.trim() || null, lastName: mapped.lastName?.trim() || null };
  }
  if (mapped.displayName) {
    const parts = mapped.displayName.trim().split(/\s+/);
    return { firstName: parts[0] ?? null, lastName: parts.slice(1).join(" ") || null };
  }
  return { firstName: null, lastName: null };
}

async function resolveHash(provided?: string): Promise<{ hash: string; isKnownFormat: boolean }> {
  if (provided) {
    const fmt = getHashFormat(provided);
    if (fmt !== "unknown") return { hash: provided, isKnownFormat: true };
  }
  // No usable hash — create a random placeholder, mark account appropriately
  const placeholder = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
  return { hash: placeholder, isKnownFormat: false };
}

export interface ImportRowError {
  rowNumber: number;
  errorCode: string;
  errorMessage: string;
  rawData: Record<string, string>;
}

export async function processImportJob(jobId: number): Promise<void> {
  const [job] = await db.select().from(userImportJobs).where(eq(userImportJobs.id, jobId)).limit(1);
  if (!job || !job.csvContent) {
    logger.error({ jobId }, "Import job not found or has no CSV content");
    return;
  }

  await db.update(userImportJobs)
    .set({ status: "processing", startedAt: new Date() })
    .where(eq(userImportJobs.id, jobId));

  const { rows } = parseCSV(job.csvContent);
  const mapping = (job.columnMapping as Record<string, string>) ?? {};
  const policy = job.duplicatePolicy ?? "skip";
  const errors: ImportRowError[] = [];
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  await db.update(userImportJobs).set({ totalRows: rows.length }).where(eq(userImportJobs.id, jobId));

  for (const row of rows) {
    try {
      const result = await processRow(row, mapping, policy);
      if (result === "success") successCount++;
      else if (result === "skipped") skippedCount++;
    } catch (err) {
      errors.push({ rowNumber: row.rowNumber, errorCode: "PROCESSING_ERROR", errorMessage: err instanceof Error ? err.message : String(err), rawData: row.data });
      errorCount++;
    }

    if ((successCount + errorCount + skippedCount) % 50 === 0) {
      await db.update(userImportJobs)
        .set({ processedRows: successCount + errorCount + skippedCount, successCount, errorCount, skippedCount })
        .where(eq(userImportJobs.id, jobId));
    }
  }

  if (errors.length > 0) {
    await db.insert(userImportErrors).values(errors.map((e) => ({ ...e, jobId })));
  }

  await db.update(userImportJobs)
    .set({ status: "completed", completedAt: new Date(), processedRows: rows.length, successCount, errorCount, skippedCount, csvContent: null })
    .where(eq(userImportJobs.id, jobId));

  logger.info({ jobId, successCount, errorCount, skippedCount }, "User import completed");
}

async function processRow(
  row: { rowNumber: number; data: Record<string, string> },
  mapping: Record<string, string>,
  policy: string,
): Promise<"success" | "skipped"> {
  const mapped = mapRow(row.data, mapping);

  if (!mapped.email) throw new Error("Missing required field: email");
  const email = mapped.email.trim().toLowerCase();
  if (!email.includes("@")) throw new Error(`Invalid email: ${mapped.email}`);

  const [existing] = await db.select({ id: users.id, passwordHash: users.passwordHash }).from(users).where(eq(users.email, email)).limit(1);

  if (existing) {
    if (policy === "skip") return "skipped";
    if (policy === "error") throw new Error(`Duplicate email: ${email}`);
    // update — never overwrite password
    const { firstName, lastName } = resolveNames(mapped);
    await db.update(users).set({
      username: mapped.username?.trim() || undefined,
      firstName: firstName ?? undefined,
      lastName: lastName ?? undefined,
      companyName: mapped.companyName?.trim() || undefined,
      billingPhone: mapped.billingPhone?.trim() || undefined,
      billingAddress: mapped.billingAddress?.trim() || undefined,
      billingCity: mapped.billingCity?.trim() || undefined,
      billingZip: mapped.billingZip?.trim() || undefined,
      billingCountry: mapped.billingCountry?.trim().toUpperCase().slice(0, 3) || undefined,
      updatedAt: new Date(),
    }).where(eq(users.id, existing.id));
    return "success";
  }

  const { hash, isKnownFormat } = await resolveHash(mapped.passwordHash);
  const { firstName, lastName } = resolveNames(mapped);

  await db.insert(users).values({
    email,
    passwordHash: hash,
    username: mapped.username?.trim() || null,
    firstName: firstName,
    lastName: lastName,
    companyName: mapped.companyName?.trim() || null,
    role: "CUSTOMER",
    isActive: isKnownFormat,
    emailVerified: isKnownFormat,
    billingPhone: mapped.billingPhone?.trim() || null,
    billingAddress: mapped.billingAddress?.trim() || null,
    billingCity: mapped.billingCity?.trim() || null,
    billingZip: mapped.billingZip?.trim() || null,
    billingCountry: mapped.billingCountry?.trim().toUpperCase().slice(0, 3) || null,
    adminNotes: isKnownFormat ? "Imported from WooCommerce" : "Imported — no password hash provided, requires password reset",
  });

  return "success";
}
