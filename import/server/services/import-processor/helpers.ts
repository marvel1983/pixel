import { ImportRepository } from '../../repositories/import.repository';
import { ImportService } from '../import.service';
import { db } from '../../db';
import { products, customers } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { log } from '../../middleware/logging';

export { db };
export { products, customers };
export { eq };
export { log };

export const importRepository = new ImportRepository(db);
export const importService = new ImportService(importRepository);

export function stripHtml(html: string | null | undefined): string | null {
  if (!html) {
    return null;
  }
  return html
    .replaceAll(/<[^>]*>/g, '')
    .replaceAll(/&nbsp;/gi, ' ')
    .replaceAll(/&amp;/gi, '&')
    .replaceAll(/&lt;/gi, '<')
    .replaceAll(/&gt;/gi, '>')
    .replaceAll(/&quot;/gi, '"')
    .replaceAll(/&#39;/gi, "'")
    .replaceAll(' ', ' ')
    .trim();
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replaceAll(/[^\w\s-]/g, '')
    .replaceAll(' ', '-')
    .replaceAll(/-+/g, '-');
}

export interface ImportContext {
  jobId: string;
  marketId: string;
  createdBy: string;
  importType:
    | 'products'
    | 'customers'
    | 'branches'
    | 'sold_keys'
    | 'active_keys';
  mappingConfig: {
    columnToField: Record<string, string>;
    hasHeaderRow: boolean;
    parentLinkField?: string;
  };
  options: {
    duplicatePolicy: 'skip' | 'update' | 'error';
    sendInvitations?: boolean;
    productOverrides?: Record<string, string>;
  };
}

export interface ProcessResult {
  success: boolean;
  successCount: number;
  errorCount: number;
  skippedCount: number;
}

export type ImportError = {
  rowNumber: number;
  errorCode: string;
  errorMessage: string;
  rawData?: Record<string, string>;
};

export type DuplicateAction = 'skip' | 'update' | 'error_duplicate';

export function checkDuplicatePolicy(policy: string): DuplicateAction {
  if (policy === 'skip') return 'skip';
  if (policy === 'error') return 'error_duplicate';
  return 'update';
}

export function mapRowToFields(
  rowData: Record<string, string>,
  columnToField: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [column, field] of Object.entries(columnToField)) {
    if (field && rowData[column] !== undefined) {
      result[field] = stripQuotes(rowData[column]);
    }
  }

  return result;
}

export function stripQuotes(value: string): string {
  return value.replaceAll(/(?:^["']+|["']+$)/g, '').trim();
}

export function parseSoldDate(dateStr: string | undefined): Date | null {
  if (!dateStr?.trim()) {
    return null;
  }
  const parsed = new Date(dateStr.trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export type ProductInfo = { id: string; name: string };
export type CustomerInfo = { id: string; name: string };

export async function buildProductLookupCache(): Promise<{
  bySku: Map<string, ProductInfo>;
  byName: Map<string, ProductInfo>;
}> {
  const allProducts = await db
    .select({ id: products.id, name: products.name, sku: products.sku })
    .from(products);

  const bySku = new Map<string, ProductInfo>();
  const byName = new Map<string, ProductInfo>();

  for (const p of allProducts) {
    if (p.sku) {
      bySku.set(p.sku.toLowerCase(), { id: p.id, name: p.name });
    }
    byName.set(p.name.toLowerCase(), { id: p.id, name: p.name });
  }

  return { bySku, byName };
}

export async function buildCustomerLookupCache(marketId: string): Promise<{
  byEmail: Map<string, CustomerInfo>;
  byName: Map<string, CustomerInfo>;
}> {
  const allCustomers = await db
    .select({ id: customers.id, name: customers.name, email: customers.email })
    .from(customers)
    .where(eq(customers.marketId, marketId));

  const byEmail = new Map<string, CustomerInfo>();
  const byName = new Map<string, CustomerInfo>();

  for (const c of allCustomers) {
    if (c.email) {
      byEmail.set(c.email.toLowerCase(), { id: c.id, name: c.name });
    }
    byName.set(c.name.toLowerCase(), { id: c.id, name: c.name });
  }

  return { byEmail, byName };
}

export function resolveProductCached(
  sku: string | undefined,
  name: string | undefined,
  cache: { bySku: Map<string, ProductInfo>; byName: Map<string, ProductInfo> }
): ProductInfo | null {
  if (sku?.trim()) {
    const found = cache.bySku.get(sku.trim().toLowerCase());
    if (found) return found;
  }
  if (name?.trim()) {
    const found = cache.byName.get(name.trim().toLowerCase());
    if (found) return found;
  }
  return null;
}

export function resolveCustomerCached(
  email: string | undefined,
  name: string | undefined,
  cache: {
    byEmail: Map<string, CustomerInfo>;
    byName: Map<string, CustomerInfo>;
  }
): CustomerInfo | null {
  if (email?.trim()) {
    const found = cache.byEmail.get(email.trim().toLowerCase());
    if (found) return found;
  }
  if (name?.trim()) {
    const found = cache.byName.get(name.trim().toLowerCase());
    if (found) return found;
  }
  return null;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUUID(value: string | undefined): boolean {
  return !!value && UUID_REGEX.test(value.trim());
}
