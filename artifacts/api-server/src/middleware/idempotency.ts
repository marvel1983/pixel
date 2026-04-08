import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { idempotencyKeys } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const KEY_HEADER = "x-idempotency-key";
const KEY_TTL_MS = 24 * 60 * 60 * 1000;

function hashRequest(body: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(body ?? {})).digest("hex");
}

function advisoryLockId(key: string): number {
  const hash = crypto.createHash("md5").update(key).digest();
  return hash.readInt32BE(0);
}

export function requireIdempotencyKey() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const idempotencyKey = req.headers[KEY_HEADER] as string | undefined;
    if (!idempotencyKey || idempotencyKey.length < 10 || idempotencyKey.length > 64) {
      res.status(400).json({ error: "Missing or invalid X-Idempotency-Key header" });
      return;
    }

    const requestHash = hashRequest(req.body);
    const route = `${req.method} ${req.path}`;
    const lockId = advisoryLockId(idempotencyKey);
    let userId: number | undefined;
    try { userId = (req as any).user?.userId; } catch {}

    try {
      const result = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockId})`);

        const [existing] = await tx
          .select()
          .from(idempotencyKeys)
          .where(eq(idempotencyKeys.key, idempotencyKey))
          .limit(1);

        if (existing) {
          if (existing.requestHash !== requestHash) {
            return { action: "hash_mismatch" as const };
          }
          if (existing.status === "COMPLETED" && existing.responseBody && existing.responseCode) {
            return {
              action: "cached" as const,
              code: existing.responseCode,
              body: existing.responseBody,
            };
          }
          if (existing.status === "PROCESSING") {
            const ageMs = Date.now() - existing.createdAt.getTime();
            if (ageMs < 120_000) {
              return { action: "in_flight" as const };
            }
            await tx
              .update(idempotencyKeys)
              .set({ status: "PROCESSING", updatedAt: new Date() })
              .where(eq(idempotencyKeys.id, existing.id));
            return { action: "proceed" as const, recordId: existing.id };
          }
          await tx
            .update(idempotencyKeys)
            .set({ status: "PROCESSING", updatedAt: new Date() })
            .where(eq(idempotencyKeys.id, existing.id));
          return { action: "proceed" as const, recordId: existing.id };
        }

        const [record] = await tx.insert(idempotencyKeys).values({
          key: idempotencyKey,
          requestHash,
          status: "PROCESSING",
          route,
          userId: userId ?? null,
          expiresAt: new Date(Date.now() + KEY_TTL_MS),
        }).returning();
        return { action: "proceed" as const, recordId: record.id };
      });

      if (result.action === "hash_mismatch") {
        res.status(422).json({ error: "Idempotency key already used with different request" });
        return;
      }
      if (result.action === "cached") {
        res.status(result.code).json(result.body);
        return;
      }
      if (result.action === "in_flight") {
        res.status(409).json({ error: "Request already in progress" });
        return;
      }

      const recordId = result.recordId;
      const origJson = res.json.bind(res);
      res.json = function (body: any) {
        const statusCode = res.statusCode;
        db.update(idempotencyKeys)
          .set({
            status: "COMPLETED",
            responseCode: statusCode,
            responseBody: body,
            updatedAt: new Date(),
          })
          .where(eq(idempotencyKeys.id, recordId))
          .then(() => {})
          .catch((err) => logger.error({ err, recordId }, "Failed to save idempotency response"));
        return origJson(body);
      };

      next();
    } catch (err) {
      logger.error({ err, idempotencyKey }, "Idempotency middleware error");
      next(err);
    }
  };
}
