import { eq, and, desc, count, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { metenziMappingConflicts, metenziProductMappings, products, auditLog } from "@workspace/db/schema";
import { logger } from "../lib/logger";
import type { MetenziProduct } from "../lib/metenzi-endpoints";

export type ConflictType = "uuid_rotation" | "fuzzy_name_match" | "sku_collision";
export type ResolveAction = "link_existing" | "create_new" | "dismiss";

interface EnqueueArgs {
  type: ConflictType;
  metenziProduct: MetenziProduct;
  candidatePixelProductId: number | null;
  candidateMappingId?: number | null;
  similarityScore?: number;
}

/**
 * Records a sync-time decision the system can't safely make on its own.
 * Idempotent on (metenziProductId, conflictType, status='pending') — repeated
 * sync runs won't pile up duplicates while a conflict is awaiting review.
 */
export async function enqueueConflict(args: EnqueueArgs): Promise<{ created: boolean; id: number }> {
  const mp = args.metenziProduct;
  const [existing] = await db
    .select({ id: metenziMappingConflicts.id })
    .from(metenziMappingConflicts)
    .where(and(
      eq(metenziMappingConflicts.metenziProductId, mp.id),
      eq(metenziMappingConflicts.conflictType, args.type),
      eq(metenziMappingConflicts.status, "pending"),
    ))
    .limit(1);
  if (existing) return { created: false, id: existing.id };

  const [row] = await db.insert(metenziMappingConflicts).values({
    conflictType: args.type,
    metenziProductId: mp.id,
    metenziSku: mp.sku ?? null,
    metenziName: mp.name,
    rawPayload: mp as unknown as Record<string, unknown>,
    candidatePixelProductId: args.candidatePixelProductId,
    candidateMappingId: args.candidateMappingId ?? null,
    similarityScore: args.similarityScore != null ? args.similarityScore.toFixed(2) : null,
  }).returning({ id: metenziMappingConflicts.id });

  logger.warn(
    { conflictId: row.id, type: args.type, metenziProductId: mp.id, candidate: args.candidatePixelProductId },
    "Mapping conflict queued for admin review",
  );
  return { created: true, id: row.id };
}

export async function getConflictStats(): Promise<{ pending: number; byType: Record<string, number> }> {
  const rows = await db
    .select({ type: metenziMappingConflicts.conflictType, n: count() })
    .from(metenziMappingConflicts)
    .where(eq(metenziMappingConflicts.status, "pending"))
    .groupBy(metenziMappingConflicts.conflictType);
  const byType: Record<string, number> = {};
  let pending = 0;
  for (const r of rows) { byType[r.type] = Number(r.n); pending += Number(r.n); }
  return { pending, byType };
}

export async function listPendingConflicts(limit = 50) {
  return db
    .select({
      id: metenziMappingConflicts.id,
      conflictType: metenziMappingConflicts.conflictType,
      metenziProductId: metenziMappingConflicts.metenziProductId,
      metenziSku: metenziMappingConflicts.metenziSku,
      metenziName: metenziMappingConflicts.metenziName,
      candidatePixelProductId: metenziMappingConflicts.candidatePixelProductId,
      candidateMappingId: metenziMappingConflicts.candidateMappingId,
      similarityScore: metenziMappingConflicts.similarityScore,
      createdAt: metenziMappingConflicts.createdAt,
      candidateName: products.name,
      candidateSlug: products.slug,
    })
    .from(metenziMappingConflicts)
    .leftJoin(products, eq(products.id, metenziMappingConflicts.candidatePixelProductId))
    .where(eq(metenziMappingConflicts.status, "pending"))
    .orderBy(desc(metenziMappingConflicts.createdAt))
    .limit(limit);
}

interface ResolveArgs {
  conflictId: number;
  action: ResolveAction;
  adminUserId: number | null;
  note?: string;
}

export async function resolveConflict(args: ResolveArgs): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  const [conflict] = await db.select().from(metenziMappingConflicts).where(eq(metenziMappingConflicts.id, args.conflictId));
  if (!conflict) return { ok: false, error: "Conflict not found" };
  if (conflict.status !== "pending") return { ok: false, error: `Already resolved (${conflict.status})` };

  const now = new Date();
  let newStatus: string;

  if (args.action === "link_existing") {
    if (!conflict.candidatePixelProductId) return { ok: false, error: "No candidate pixel product to link to" };
    await upsertMapping(conflict.metenziProductId, conflict.candidatePixelProductId, conflict.metenziSku, conflict.metenziName);
    newStatus = "resolved_link";
    await writeAudit("UPDATE", args.adminUserId, conflict.candidatePixelProductId, {
      kind: "mapping_conflict_resolved",
      action: "link_existing",
      conflictId: conflict.id,
      conflictType: conflict.conflictType,
      metenziProductId: conflict.metenziProductId,
      note: args.note ?? null,
    });
  } else if (args.action === "create_new") {
    // Caller (or future admin UI) is expected to follow up with a separate
    // "create product" flow. Here we just close the conflict so sync stops
    // re-queueing it, and let the next sync pass recreate it as a fresh insert
    // by leaving no mapping in place.
    newStatus = "resolved_create";
    await writeAudit("CREATE", args.adminUserId, null, {
      kind: "mapping_conflict_resolved",
      action: "create_new",
      conflictId: conflict.id,
      metenziProductId: conflict.metenziProductId,
      note: args.note ?? null,
    });
  } else if (args.action === "dismiss") {
    newStatus = "dismissed";
    await writeAudit("UPDATE", args.adminUserId, conflict.candidatePixelProductId, {
      kind: "mapping_conflict_resolved",
      action: "dismiss",
      conflictId: conflict.id,
      metenziProductId: conflict.metenziProductId,
      note: args.note ?? null,
    });
  } else {
    return { ok: false, error: "Invalid action" };
  }

  await db.update(metenziMappingConflicts).set({
    status: newStatus,
    resolutionNote: args.note ?? null,
    resolvedBy: args.adminUserId,
    resolvedAt: now,
    updatedAt: now,
  }).where(eq(metenziMappingConflicts.id, args.conflictId));

  return { ok: true, status: newStatus };
}

async function upsertMapping(metenziProductId: string, pixelProductId: number, sku: string | null, name: string | null) {
  // Reactivate any disabled row for this UUID, otherwise upsert
  await db.execute(sql`
    INSERT INTO metenzi_product_mappings (metenzi_product_id, pixel_product_id, metenzi_sku, metenzi_name, disabled, updated_at)
    VALUES (${metenziProductId}, ${pixelProductId}, ${sku}, ${name}, false, NOW())
    ON CONFLICT (metenzi_product_id) DO UPDATE
      SET pixel_product_id = EXCLUDED.pixel_product_id,
          metenzi_sku = EXCLUDED.metenzi_sku,
          metenzi_name = EXCLUDED.metenzi_name,
          disabled = false,
          updated_at = NOW()
  `);
}

async function writeAudit(action: "CREATE" | "UPDATE" | "DELETE", userId: number | null, entityId: number | null, details: Record<string, unknown>) {
  try {
    await db.insert(auditLog).values({
      action,
      entityType: "metenzi_mapping",
      entityId,
      userId,
      details,
    });
  } catch (err) {
    logger.error({ err, details }, "Failed to write mapping audit log");
  }
}

/**
 * Cheap Levenshtein-ratio similarity (0..1). Good enough for ~hundreds of
 * candidates per sync run; we don't need pg_trgm. Comparison is case- and
 * whitespace-insensitive.
 */
export function nameSimilarity(a: string, b: string): number {
  const x = a.toLowerCase().trim().replace(/\s+/g, " ");
  const y = b.toLowerCase().trim().replace(/\s+/g, " ");
  if (!x || !y) return 0;
  if (x === y) return 1;
  const dist = levenshtein(x, y);
  const maxLen = Math.max(x.length, y.length);
  return 1 - dist / maxLen;
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array<number>(n + 1);
  let cur = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

/**
 * Audit-log helper for sync-driven mapping changes (creates, updates, sticky
 * disables). Admin-driven changes go through resolveConflict and unmap routes
 * which already write their own entries.
 */
export async function writeMappingAudit(args: {
  action: "CREATE" | "UPDATE";
  pixelProductId: number;
  metenziProductId: string;
  details: Record<string, unknown>;
}): Promise<void> {
  await writeAudit(args.action, null, args.pixelProductId, {
    kind: "mapping_sync_change",
    metenziProductId: args.metenziProductId,
    ...args.details,
  });
}
