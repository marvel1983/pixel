import { Router } from 'express';
import { asyncHandler } from '../../../middleware/errorHandler';
import { authenticateAdmin } from '../../../middleware/jwtAuth';
import { requireStaff, requirePermission } from '../../../middleware/rbac';
import { Permissions } from '../../../permissions';
import { ImportService } from '../../../services/import.service';
import { ImportRepository } from '../../../repositories/import.repository';
import { db } from '../../../db';
import { customers } from '@shared/schema';
import { inArray, eq as eqOp, and as andOp } from 'drizzle-orm';
import {
  auditService,
  AuditEventType,
  AuditTargetType,
} from '../../../utils/auditService';
import { importOrderArchiveFromFile } from '../../../services/order-archive-import.service';
import * as path from 'node:path';
import * as fs from 'node:fs';
import {
  archiveProgress,
  archiveUpload,
  resolveCustomerOverrides,
} from './helpers';

export function registerImportArchiveRoutes(router: Router) {
  const importRepository = new ImportRepository(db);
  const importService = new ImportService(importRepository);

  router.get(
    '/api/admin/imports/:id/errors/download',
    authenticateAdmin,
    requireStaff,
    requirePermission(Permissions.IMPORT_MANAGE),
    asyncHandler(async (req, res) => {
      const marketId = req.adminUser?.marketId ?? '';
      const job = await importService.getImportJob(req.params.id, marketId);

      if (!job) {
        res.status(404).json({ error: 'Import job not found' });
        return;
      }

      const errors = await importService.getImportJobErrors(req.params.id);

      const csvContent = ['Row,ErrorCode,Message']
        .concat(
          errors.map(
            (e) =>
              `${e.rowNumber},"${(e.errorCode || '').replaceAll('"', '""')}","${e.errorMessage.replaceAll('"', '""')}"`
          )
        )
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="import-errors-${job.id}.csv"`
      );
      res.send(csvContent);
    })
  );

  const ARCHIVE_BASE = '/tmp/order-archive-uploads';
  fs.mkdirSync(ARCHIVE_BASE, { recursive: true });
  try {
    fs.chmodSync(ARCHIVE_BASE, 0o700);
  } catch {
    /* no-op on read-only mounts */
  }

  function getMarketArchiveDir(marketId: string): string {
    const safeMarket = marketId.replaceAll(/[^a-zA-Z0-9_-]/g, '_');
    const dir = path.join(ARCHIVE_BASE, safeMarket);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  const archiveFiles = new Map<
    string,
    {
      filePath: string;
      fileName: string;
      fileSize: number;
      headers: string[];
      preview: string[][];
      marketId: string;
    }
  >();

  function saveArchiveFilePersistently(
    tmpPath: string,
    originalName: string,
    marketId: string
  ): string {
    const safeName = originalName.replaceAll(/[^a-zA-Z0-9._-]/g, '_');
    const archiveDir = getMarketArchiveDir(marketId);
    const destPath = path.join(archiveDir, safeName);
    if (tmpPath !== destPath) {
      fs.copyFileSync(tmpPath, destPath);
    }
    return destPath;
  }

  router.get(
    '/api/admin/imports/order-archive/files',
    authenticateAdmin,
    requireStaff,
    requirePermission(Permissions.IMPORT_MANAGE),
    asyncHandler(async (req, res) => {
      const marketId = req.adminUser?.marketId ?? '';
      const archiveDir = getMarketArchiveDir(marketId);
      const files = fs
        .readdirSync(archiveDir)
        .filter((f) => f.endsWith('.csv'))
        .map((f) => {
          const stat = fs.statSync(path.join(archiveDir, f));
          return {
            fileName: f,
            fileSize: stat.size,
            uploadedAt: stat.mtime.toISOString(),
          };
        })
        .sort(
          (a, b) =>
            new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        );
      res.json({ files });
    })
  );

  router.delete(
    '/api/admin/imports/order-archive/files/:fileName',
    authenticateAdmin,
    requireStaff,
    requirePermission(Permissions.IMPORT_MANAGE),
    asyncHandler(async (req, res) => {
      const marketId = req.adminUser?.marketId ?? '';
      const archiveDir = getMarketArchiveDir(marketId);
      const safeName = path.basename(req.params.fileName);
      const filePath = path.join(archiveDir, safeName);
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: 'File not found' });
        return;
      }
      fs.unlinkSync(filePath);
      res.json({ success: true });
    })
  );

  router.post(
    '/api/admin/imports/order-archive/reuse',
    authenticateAdmin,
    requireStaff,
    requirePermission(Permissions.IMPORT_MANAGE),
    asyncHandler(async (req, res) => {
      const marketId = req.adminUser?.marketId ?? '';
      const { fileName } = req.body;
      if (!fileName) {
        res.status(400).json({ error: 'fileName is required' });
        return;
      }
      const safeName = path.basename(fileName);
      const archiveDir = getMarketArchiveDir(marketId);
      const filePath = path.join(archiveDir, safeName);
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: 'File not found on server' });
        return;
      }

      const { extractCsvHeaders, extractCsvPreview } = await import(
        '../../../services/order-archive-import.service'
      );
      const headers = await extractCsvHeaders(filePath);
      const preview = await extractCsvPreview(filePath, 5);
      const stat = fs.statSync(filePath);

      const importId = `archive-${Date.now()}`;
      archiveFiles.set(importId, {
        filePath,
        fileName: safeName,
        fileSize: stat.size,
        headers,
        preview,
        marketId,
      });

      res.json({
        importId,
        fileName: safeName,
        fileSize: stat.size,
        headers,
        preview,
        status: 'uploaded',
      });
    })
  );

  router.post(
    '/api/admin/imports/order-archive',
    authenticateAdmin,
    requireStaff,
    requirePermission(Permissions.IMPORT_MANAGE),
    archiveUpload.single('file'),
    asyncHandler(async (req, res) => {
      if (!req.file) {
        res
          .status(400)
          .json({ error: 'No file uploaded. Please select a CSV file.' });
        return;
      }

      const marketId = req.adminUser?.marketId ?? '';
      const persistentPath = saveArchiveFilePersistently(
        req.file.path,
        req.file.originalname,
        marketId
      );
      if (req.file.path !== persistentPath) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          /* no-op */
        }
      }

      const { extractCsvHeaders, extractCsvPreview } = await import(
        '../../../services/order-archive-import.service'
      );
      const headers = await extractCsvHeaders(persistentPath);
      const preview = await extractCsvPreview(persistentPath, 5);

      const importId = `archive-${Date.now()}`;
      archiveFiles.set(importId, {
        filePath: persistentPath,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        headers,
        preview,
        marketId,
      });

      res.json({
        importId,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        headers,
        preview,
        status: 'uploaded',
      });
    })
  );

  router.post(
    '/api/admin/imports/order-archive/:importId/customer-names',
    authenticateAdmin,
    requireStaff,
    requirePermission(Permissions.IMPORT_MANAGE),
    asyncHandler(async (req, res) => {
      const { importId } = req.params;
      const marketId = req.adminUser?.marketId ?? '';
      const fileInfo = archiveFiles.get(importId);

      if (!fileInfo || fileInfo.marketId !== marketId) {
        res.status(404).json({
          error: 'Upload not found or expired. Please upload the file again.',
        });
        return;
      }

      const mapping = req.body.mapping;
      if (!mapping) {
        res.status(400).json({ error: 'Column mapping is required.' });
        return;
      }

      const { extractArchiveCustomerNames } = await import(
        '../../../services/order-archive-import.service'
      );
      const result = await extractArchiveCustomerNames(
        fileInfo.filePath,
        mapping,
        marketId
      );

      res.json(result);
    })
  );

  router.post(
    '/api/admin/imports/order-archive/:importId/start',
    authenticateAdmin,
    requireStaff,
    requirePermission(Permissions.IMPORT_MANAGE),
    asyncHandler(async (req, res) => {
      const { importId } = req.params;
      const marketId = req.adminUser?.marketId ?? '';
      const fileInfo = archiveFiles.get(importId);

      if (!fileInfo || fileInfo.marketId !== marketId) {
        res.status(404).json({
          error: 'Upload not found or expired. Please upload the file again.',
        });
        return;
      }

      const mapping = req.body.mapping;
      if (
        !mapping?.orderId ||
        !mapping?.email ||
        !mapping?.productCode ||
        !mapping?.productName
      ) {
        res.status(400).json({
          error:
            'Column mapping is required. Map at least: Order ID, Email, Product Code, Product Name.',
        });
        return;
      }

      const rawKeyCodeCols = mapping.keyCodeColumns;
      if (rawKeyCodeCols !== undefined) {
        if (
          !Array.isArray(rawKeyCodeCols) ||
          rawKeyCodeCols.some((c: unknown) => typeof c !== 'string')
        ) {
          res
            .status(400)
            .json({ error: 'keyCodeColumns must be an array of strings.' });
          return;
        }
        mapping.keyCodeColumns = (rawKeyCodeCols as string[]).filter(
          (c) => typeof c === 'string' && c.trim().length > 0
        );
      }

      const overridesResult = await resolveCustomerOverrides(
        req.body.customerOverrides,
        marketId
      );
      if ('error' in overridesResult) {
        res.status(400).json({ error: overridesResult.error });
        return;
      }
      const customerOverrides =
        Object.keys(overridesResult.overrides).length > 0
          ? overridesResult.overrides
          : undefined;

      archiveFiles.delete(importId);
      archiveProgress.set(importId, { updates: [] });

      res.json({ importId, status: 'processing' });

      const archiveFilePath = fileInfo.filePath;
      importOrderArchiveFromFile(
        archiveFilePath,
        marketId,
        (update) => {
          const entry = archiveProgress.get(importId);
          if (!entry) {
            return;
          }
          if (entry.updates.length > 20) {
            entry.updates = entry.updates.slice(-5);
          }
          entry.updates.push(update);
        },
        mapping,
        customerOverrides
      )
        .then((result) => {
          const entry = archiveProgress.get(importId);
          if (entry)
            entry.updates.push({
              phase: 'complete',
              current: 0,
              total: 0,
              message: JSON.stringify(result),
            });
          // Delete the archive CSV immediately — it may contain order PII and must not
          // persist in /tmp beyond the duration of the import job.
          try {
            fs.unlinkSync(archiveFilePath);
          } catch {
            /* already gone */
          }
        })
        .catch((err) => {
          const entry = archiveProgress.get(importId);
          if (entry)
            entry.updates.push({
              phase: 'error',
              current: 0,
              total: 0,
              message: err.message,
            });
          try {
            fs.unlinkSync(archiveFilePath);
          } catch {
            /* already gone */
          }
        });
    })
  );

  router.get(
    '/api/admin/imports/order-archive/progress/:importId',
    authenticateAdmin,
    requireStaff,
    requirePermission(Permissions.IMPORT_MANAGE),
    (req, res) => {
      const importId = req.params.importId;

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      let lastIndex = 0;

      const interval = setInterval(() => {
        const entry = archiveProgress.get(importId);
        if (!entry) {
          res.write(
            `data: ${JSON.stringify({ phase: 'error', message: 'Import not found' })}\n\n`
          );
          clearInterval(interval);
          res.end();
          return;
        }

        while (lastIndex < entry.updates.length) {
          const update = entry.updates[lastIndex];
          res.write(`data: ${JSON.stringify(update)}\n\n`);

          if (update.phase === 'complete' || update.phase === 'error') {
            clearInterval(interval);
            setTimeout(() => archiveProgress.delete(importId), 30000);
            res.end();
            return;
          }
          lastIndex++;
        }
      }, 500);

      req.on('close', () => {
        clearInterval(interval);
      });
    }
  );

  router.get(
    '/api/admin/imports/:id/credentials/download',
    authenticateAdmin,
    requireStaff,
    requirePermission(Permissions.IMPORT_MANAGE),
    asyncHandler(async (req, res) => {
      const marketId = req.adminUser?.marketId ?? '';
      const job = await importService.getImportJob(req.params.id, marketId);

      if (!job) {
        res.status(404).json({ error: 'Import job not found' });
        return;
      }

      if (job.type !== 'branches') {
        res.status(400).json({
          error: 'Credentials download only available for branch imports',
        });
        return;
      }

      const credentials = await importService.getBranchCredentials(
        req.params.id
      );

      if (!credentials || credentials.length === 0) {
        res.status(404).json({ error: 'No credentials found for this import' });
        return;
      }

      const csvContent = ['Branch Name,Username,Temporary Password']
        .concat(
          credentials.map(
            (c) =>
              `"${c.branchName.replaceAll('"', '""')}","${c.username}","${c.password}"`
          )
        )
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="branch-credentials-${job.id}.csv"`
      );
      res.send(csvContent);
    })
  );

  router.post(
    '/api/admin/imports/exclusion-impact',
    authenticateAdmin,
    requireStaff,
    requirePermission(Permissions.IMPORT_MANAGE),
    asyncHandler(async (req, res) => {
      const { keyCodes } = req.body as { keyCodes: unknown[] };
      if (!Array.isArray(keyCodes) || keyCodes.length === 0) {
        res.status(400).json({ error: 'keyCodes must be a non-empty array' });
        return;
      }

      const marketId = req.adminUser?.marketId;
      if (!marketId) {
        res.status(403).json({ error: 'Market context required' });
        return;
      }

      const { hashKeyCode } = await import('../../../utils/keyNormalization');
      const { customerKeys } = await import('@shared/schema');
      const { sql: drizzleSql } = await import('drizzle-orm');

      const hashes = [
        ...new Set(
          (keyCodes as string[])
            .map((c) => (c || '').trim())
            .filter(Boolean)
            .map((c) => hashKeyCode(c))
        ),
      ];

      if (hashes.length === 0) {
        res.json({ affectedCustomers: [] });
        return;
      }

      const BATCH = 5000;
      const customerOverlaps = new Map<
        string,
        { name: string; overlapCount: number }
      >();

      for (let i = 0; i < hashes.length; i += BATCH) {
        const batch = hashes.slice(i, i + BATCH);
        const rows = await db
          .select({
            customerId: customerKeys.customerId,
            customerName: customers.name,
            cnt: drizzleSql<number>`count(*)::int`,
          })
          .from(customerKeys)
          .innerJoin(customers, eqOp(customerKeys.customerId, customers.id))
          .where(
            andOp(
              inArray(customerKeys.codeHash, batch),
              eqOp(customerKeys.source, 'exclusion_upload'),
              eqOp(customers.marketId, marketId)
            )
          )
          .groupBy(customerKeys.customerId, customers.name);

        for (const r of rows) {
          const existing = customerOverlaps.get(r.customerId);
          if (existing) {
            existing.overlapCount += r.cnt;
          } else {
            customerOverlaps.set(r.customerId, {
              name: r.customerName ?? r.customerId,
              overlapCount: r.cnt,
            });
          }
        }
      }

      const affectedCustomers = [...customerOverlaps.entries()].map(
        ([customerId, info]) => ({
          customerId,
          customerName: info.name,
          overlapCount: info.overlapCount,
        })
      );

      res.json({ affectedCustomers, totalUploadedHashes: hashes.length });
    })
  );

  router.post(
    '/api/admin/imports/exclusion-impact/remove',
    authenticateAdmin,
    requireStaff,
    requirePermission(Permissions.IMPORT_MANAGE),
    asyncHandler(async (req, res) => {
      const { keyCodes, customerId } = req.body as {
        keyCodes: unknown[];
        customerId: unknown;
      };
      if (!Array.isArray(keyCodes) || keyCodes.length === 0) {
        res.status(400).json({ error: 'keyCodes must be a non-empty array' });
        return;
      }
      if (typeof customerId !== 'string' || !customerId) {
        res
          .status(400)
          .json({ error: 'customerId must be a non-empty string' });
        return;
      }

      const marketId = req.adminUser?.marketId;
      if (!marketId) {
        res.status(403).json({ error: 'Market context required' });
        return;
      }

      const [customer] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(
          andOp(
            eqOp(customers.id, customerId),
            eqOp(customers.marketId, marketId)
          )
        )
        .limit(1);
      if (!customer) {
        res.status(404).json({ error: 'Customer not found' });
        return;
      }

      const { hashKeyCode } = await import('../../../utils/keyNormalization');
      const { customerKeys } = await import('@shared/schema');

      const hashes = [
        ...new Set(
          (keyCodes as string[])
            .map((c) => (c || '').trim())
            .filter(Boolean)
            .map((c) => hashKeyCode(c))
        ),
      ];

      if (hashes.length === 0) {
        res.json({ removed: 0 });
        return;
      }

      const BATCH = 5000;
      let totalRemoved = 0;

      for (let i = 0; i < hashes.length; i += BATCH) {
        const batch = hashes.slice(i, i + BATCH);
        const deleted = await db
          .delete(customerKeys)
          .where(
            andOp(
              inArray(customerKeys.codeHash, batch),
              eqOp(customerKeys.customerId, customerId),
              eqOp(customerKeys.source, 'exclusion_upload')
            )
          )
          .returning({ id: customerKeys.id });
        totalRemoved += deleted.length;
      }

      await auditService.logEvent({
        marketId,
        userId: req.adminUser?.id,
        eventType: AuditEventType.KEY_EXCLUSION_BULK_REMOVED,
        targetType: AuditTargetType.CUSTOMER,
        targetId: customerId,
        details: {
          reason: 'stock_upload_overlap_removal',
          removedCount: totalRemoved,
          totalHashesChecked: hashes.length,
          actor: req.adminUser?.email,
        },
      });

      res.json({ removed: totalRemoved });
    })
  );
}
