import { z } from 'zod';
import { customers } from '@shared/schema';
import { inArray, eq as eqOp, and as andOp } from 'drizzle-orm';
import { db } from '../../../db';
import { log } from '../../../middleware/logging';
import type { ImportService } from '../../../services/import.service';
import multer from 'multer';
import * as path from 'node:path';

export const importJobTypeSchema = z.enum([
  'products',
  'customers',
  'branches',
  'sold_keys',
  'active_keys',
]);
export type ImportJobType = z.infer<typeof importJobTypeSchema>;

export const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

export const archiveProgress = new Map<
  string,
  {
    updates: Array<{
      phase: string;
      current: number;
      total: number;
      message: string;
    }>;
  }
>();

export const archiveUpload = multer({
  dest: '/tmp/order-archive-uploads/',
  limits: { fileSize: 1024 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.csv') cb(null, true);
    else cb(new Error('Only CSV files are supported'));
  },
});

export function stripHtmlForPreview(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value !== 'string') {
    if (typeof value === 'number' || typeof value === 'boolean')
      return value.toString();
    return JSON.stringify(value);
  }
  return value
    .replaceAll(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replaceAll(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replaceAll(
      /<div[^>]*class="[^"]*wc-json-data[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
      ''
    )
    .replaceAll(
      /<div[^>]*style="[^"]*display:\s*none[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
      ''
    )
    .replaceAll(
      /\{["']?(?:duration|src|sources|width|height)["']?:[^}]*\}/gi,
      ''
    )
    .replaceAll(/<[^>]*>/g, '')
    .replaceAll(/&nbsp;/gi, ' ')
    .replaceAll(/&amp;/gi, '&')
    .replaceAll(/&lt;/gi, '<')
    .replaceAll(/&gt;/gi, '>')
    .replaceAll(/&quot;/gi, '"')
    .replaceAll(/&#39;/gi, "'")
    .replaceAll(/\[\{[^\]]*\}\]/g, '')
    .replaceAll(' ', ' ')
    .trim();
}

export async function processUploadedChunks(
  chunks: Buffer[],
  fileName: string,
  contentType: string,
  importType: ImportJobType,
  req: any,
  res: any,
  importService: ImportService
) {
  try {
    const fileBuffer = Buffer.concat(chunks);
    if (fileBuffer.length === 0) {
      res.status(400).json({ error: 'Empty file received' });
      return;
    }
    const filePath = await importService.uploadImportFile(
      fileBuffer,
      fileName,
      contentType
    );
    const job = await importService.createImportJob({
      marketId: req.adminUser?.marketId ?? '',
      type: importType,
      filePath,
      originalFileName: fileName,
      createdBy: req.adminUser?.id ?? '',
    });
    log.info('[ImportRoutes] Import file uploaded', {
      jobId: job.id,
      type: importType,
      fileName,
      size: fileBuffer.length,
      marketId: req.adminUser?.marketId ?? '',
    });
    res.json({
      job,
      message: 'File uploaded successfully. Proceed to column mapping.',
    });
  } catch (error) {
    log.error('[ImportRoutes] Upload error', { error });
    res.status(500).json({ error: 'Failed to upload file' });
  }
}

export const previewSchema = z.object({
  hasHeaderRow: z.boolean().optional().default(true),
});

export const mappingSchema = z.object({
  mapping: z.record(z.string()),
  hasHeaderRow: z.boolean().optional().default(true),
  parentLinkField: z.enum(['email', 'name', 'taxId', 'id']).optional(),
});

export const startImportSchema = z.object({
  duplicatePolicy: z
    .enum(['skip', 'update', 'error'])
    .optional()
    .default('skip'),
  sendInvitations: z.boolean().optional().default(true),
  productOverrides: z.record(z.string()).optional().default({}),
});

/** Normalize and market-validate customerOverrides from a request body.
 * Returns `{ overrides }` on success or `{ error }` on validation failure.
 */

export async function resolveCustomerOverrides(
  raw: unknown,
  marketId: string
): Promise<{ overrides: Record<string, string> } | { error: string }> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { overrides: {} };
  }
  const normalized: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = typeof k === 'string' ? k.trim().toLowerCase() : '';
    const val = typeof v === 'string' ? v.trim() : '';
    if (key && val) normalized[key] = val;
  }
  const overrideIds = [...new Set(Object.values(normalized))];
  if (overrideIds.length === 0) return { overrides: normalized };

  const allowedRows = await db
    .select({ id: customers.id })
    .from(customers)
    .where(
      andOp(
        inArray(customers.id, overrideIds),
        eqOp(customers.marketId, marketId)
      )
    );
  const allowedIds = new Set(allowedRows.map((r) => r.id));
  const invalid = overrideIds.filter((id) => !allowedIds.has(id));
  if (invalid.length > 0) {
    return {
      error: `Invalid customer overrides: IDs not found in this market (${invalid.slice(0, 3).join(', ')}${invalid.length > 3 ? '…' : ''})`,
    };
  }
  return { overrides: normalized };
}
