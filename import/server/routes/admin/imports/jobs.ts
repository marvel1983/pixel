import { Router } from 'express';
import { asyncHandler } from '../../../middleware/errorHandler';
import { authenticateAdmin } from '../../../middleware/jwtAuth';
import { requireStaff, requirePermission } from '../../../middleware/rbac';
import { Permissions } from '../../../permissions';
import { ImportService } from '../../../services/import.service';
import { ImportRepository } from '../../../repositories/import.repository';
import { db } from '../../../db';
import { log } from '../../../middleware/logging';
import { products } from '@shared/schema';
import { getQueueManager } from '../../../queue/manager';
import { JobType, type ProcessImportJobData } from '../../../queue/types';
import {
  auditService,
  AuditEventType,
  AuditTargetType,
} from '../../../utils/auditService';
import {
  importJobTypeSchema,
  type ImportJobType,
  MAX_FILE_SIZE,
  stripHtmlForPreview,
  processUploadedChunks,
  previewSchema,
  mappingSchema,
  startImportSchema,
} from './helpers';

export function registerImportJobRoutes(router: Router) {
  const importRepository = new ImportRepository(db);
  const importService = new ImportService(importRepository);

  router.get(
    '/api/admin/imports',
    authenticateAdmin,
    requireStaff,
    requirePermission(Permissions.IMPORT_MANAGE),
    asyncHandler(async (req, res) => {
      const marketId = req.adminUser?.marketId ?? '';
      const jobs = await importService.getImportJobs(marketId);
      res.json({ jobs });
    })
  );

  router.get(
    '/api/admin/imports/fields/:type',
    authenticateAdmin,
    requireStaff,
    requirePermission(Permissions.IMPORT_MANAGE),
    asyncHandler(async (req, res) => {
      const typeResult = importJobTypeSchema.safeParse(req.params.type);

      if (!typeResult.success) {
        res.status(400).json({ error: 'Invalid import type' });
        return;
      }

      const fields = importService.getAvailableFields(typeResult.data);
      const required = importService.getRequiredFields(typeResult.data);

      res.json({ fields, required });
    })
  );

  router.get(
    '/api/admin/imports/:id',
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

      res.json({ job });
    })
  );

  router.get(
    '/api/admin/imports/:id/errors',
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
      res.json({ errors });
    })
  );

  router.post(
    '/api/admin/imports/upload',
    authenticateAdmin,
    requireStaff,
    requirePermission(Permissions.IMPORT_MANAGE),
    asyncHandler(async (req, res) => {
      const contentType = req.headers['content-type'] || '';
      const fileName = req.headers['x-file-name'] as string;
      const importType = req.headers['x-import-type'] as ImportJobType;

      if (!fileName) {
        res
          .status(400)
          .json({ error: 'Missing file name header (x-file-name)' });
        return;
      }

      const typeResult = importJobTypeSchema.safeParse(importType);
      if (!typeResult.success) {
        res
          .status(400)
          .json({ error: 'Invalid import type header (x-import-type)' });
        return;
      }

      const fileExtension = fileName.toLowerCase().split('.').pop();
      if (!fileExtension || !['csv', 'xlsx', 'xls'].includes(fileExtension)) {
        res.status(400).json({
          error: 'Invalid file type. Only CSV and Excel files are supported.',
        });
        return;
      }

      const contentLength = Number.parseInt(
        req.headers['content-length'] || '0',
        10
      );
      if (contentLength > MAX_FILE_SIZE) {
        res
          .status(413)
          .json({ error: 'File too large. Maximum size is 200MB.' });
        return;
      }

      const chunks: Buffer[] = [];
      let totalSize = 0;
      let sizeLimitExceeded = false;

      req.on('data', (chunk: Buffer) => {
        if (sizeLimitExceeded) {
          return;
        }
        totalSize += chunk.length;
        if (totalSize > MAX_FILE_SIZE) {
          sizeLimitExceeded = true;
          return;
        }
        chunks.push(chunk);
      });

      req.on('end', async () => {
        if (sizeLimitExceeded) {
          res
            .status(413)
            .json({ error: 'File too large. Maximum size is 200MB.' });
          return;
        }
        await processUploadedChunks(
          chunks,
          fileName,
          contentType,
          typeResult.data,
          req,
          res,
          importService
        );
      });

      req.on('error', (error) => {
        log.error('[ImportRoutes] Request stream error', { error });
        if (!res.headersSent) {
          res.status(500).json({ error: 'Upload failed' });
        }
      });
    })
  );

  router.post(
    '/api/admin/imports/:id/preview',
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

      if (!job.filePath) {
        res.status(400).json({ error: 'No file uploaded for this job' });
        return;
      }

      const { hasHeaderRow } = previewSchema.parse(req.body);

      try {
        const fileBuffer = await importService.downloadImportFile(job.filePath);
        const content = fileBuffer.toString('utf-8');
        const { headers, rows } = importService.parseCSV(content, hasHeaderRow);

        const previewRows = rows.slice(0, 10).map((row) => ({
          rowNumber: row.rowNumber,
          data: Object.fromEntries(
            Object.entries(row.data).map(([key, value]) => [
              key,
              stripHtmlForPreview(value),
            ])
          ),
        }));

        res.json({
          headers,
          previewRows,
          totalRows: rows.length,
          hasHeaderRow,
        });
      } catch (error) {
        log.error('[ImportRoutes] Preview error', { error, jobId: job.id });
        res.status(500).json({ error: 'Failed to parse file' });
      }
    })
  );

  router.post(
    '/api/admin/imports/:id/mapping',
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

      const { mapping, hasHeaderRow, parentLinkField } = mappingSchema.parse(
        req.body
      );

      const requiredFields = importService.getRequiredFields(job.type);
      const mappedFields = Object.values(mapping);
      const missingRequired = requiredFields.filter(
        (f) => !mappedFields.includes(f)
      );

      if (missingRequired.length > 0) {
        res.status(400).json({
          error: 'Missing required field mappings',
          missingFields: missingRequired,
        });
        return;
      }

      if (job.type === 'branches' && !parentLinkField) {
        const hasParentField = [
          'parentCustomerEmail',
          'parentCustomerName',
          'parentCustomerId',
          'parentTaxId',
        ].some((f) => mappedFields.includes(f));

        if (!hasParentField) {
          res.status(400).json({
            error: 'Branch imports require a parent customer link field',
          });
          return;
        }
      }

      const mappingConfig = {
        columnToField: mapping,
        hasHeaderRow,
        parentLinkField,
      };

      await importService.updateImportJobStatus(job.id, 'pending', {
        mappingConfig,
      });

      res.json({
        message: 'Mapping saved successfully',
        mappingConfig,
      });
    })
  );

  router.get(
    '/api/admin/imports/:id/product-names',
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

      if (job.type !== 'active_keys') {
        res
          .status(400)
          .json({ error: 'Only active_keys imports support product matching' });
        return;
      }

      if (!job.filePath) {
        res.status(400).json({ error: 'No file uploaded for this job' });
        return;
      }

      const mappingConfig = job.mappingConfig as {
        columnToField: Record<string, string>;
        hasHeaderRow: boolean;
      } | null;

      if (!mappingConfig?.columnToField) {
        res.status(400).json({ error: 'Column mapping not saved yet' });
        return;
      }

      const fileBuffer = await importService.downloadImportFile(job.filePath);
      const content = fileBuffer.toString('utf-8');
      const { rows } = importService.parseCSV(
        content,
        mappingConfig.hasHeaderRow
      );

      const colToField = mappingConfig.columnToField;
      const nameCol = Object.keys(colToField).find(
        (c) => colToField[c] === 'productName'
      );
      const skuCol = Object.keys(colToField).find(
        (c) => colToField[c] === 'productSku'
      );

      const seen = new Set<string>();
      const csvNames: string[] = [];
      for (const row of rows) {
        const val =
          (nameCol ? row.data[nameCol] : '') ||
          (skuCol ? row.data[skuCol] : '') ||
          '';
        const trimmed = val.trim();
        if (trimmed && !seen.has(trimmed)) {
          seen.add(trimmed);
          csvNames.push(trimmed);
        }
      }

      const allProducts = await db
        .select({ id: products.id, name: products.name, sku: products.sku })
        .from(products);

      const byName = new Map(allProducts.map((p) => [p.name.toLowerCase(), p]));

      const matches = csvNames.map((csvName) => {
        const hit = byName.get(csvName.toLowerCase());
        return {
          csvName,
          productId: hit?.id ?? null,
          productName: hit?.name ?? null,
          productSku: hit?.sku ?? null,
        };
      });

      res.json({ matches });
    })
  );

  router.post(
    '/api/admin/imports/:id/start',
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

      if (!job.mappingConfig) {
        res.status(400).json({ error: 'Column mapping not configured' });
        return;
      }

      if (job.status !== 'pending') {
        res
          .status(400)
          .json({ error: `Cannot start import in ${job.status} status` });
        return;
      }

      const options = startImportSchema.parse(req.body);

      await importService.updateImportJobStatus(job.id, 'processing', {
        options,
      });

      const queueJobData: ProcessImportJobData = {
        jobId: job.id,
        importType: job.type,
        marketId: marketId,
        userId: req.adminUser?.id ?? '',
      };

      const queueJob = await getQueueManager().addJob(
        JobType.PROCESS_IMPORT,
        queueJobData
      );

      log.info('[ImportRoutes] Import queued', {
        jobId: job.id,
        queueJobId: queueJob?.id,
        type: job.type,
        options,
      });

      await auditService.logEvent({
        marketId,
        userId: req.adminUser?.id ?? '',
        eventType: AuditEventType.IMPORT_STARTED,
        targetType: AuditTargetType.IMPORT_JOB,
        targetId: job.id,
        details: {
          importType: job.type,
          fileName: job.originalFileName,
          duplicatePolicy: options.duplicatePolicy,
          sendInvitations: options.sendInvitations,
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json({
        message: 'Import queued for processing',
        jobId: job.id,
        queueJobId: queueJob?.id,
      });
    })
  );

  router.post(
    '/api/admin/imports/:id/cancel',
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

      if (['completed', 'failed', 'cancelled'].includes(job.status)) {
        res
          .status(400)
          .json({ error: `Cannot cancel import in ${job.status} status` });
        return;
      }

      await importService.updateImportJobStatus(job.id, 'cancelled');

      log.info('[ImportRoutes] Import cancelled', { jobId: job.id });

      await auditService.logEvent({
        marketId,
        userId: req.adminUser?.id ?? '',
        eventType: AuditEventType.IMPORT_CANCELLED,
        targetType: AuditTargetType.IMPORT_JOB,
        targetId: job.id,
        details: {
          importType: job.type,
          fileName: job.originalFileName,
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json({ message: 'Import cancelled' });
    })
  );

  router.post(
    '/api/admin/imports/:id/retry',
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

      if (!['failed', 'cancelled'].includes(job.status)) {
        res
          .status(400)
          .json({ error: `Cannot retry import in ${job.status} status` });
        return;
      }

      if (!job.mappingConfig) {
        res
          .status(400)
          .json({ error: 'Column mapping not configured — please re-upload' });
        return;
      }

      await importService.updateImportJobStatus(job.id, 'pending', {
        processedRows: 0,
        successCount: 0,
        errorCount: 0,
        skippedCount: 0,
      });

      const options = startImportSchema.parse(req.body);

      await importService.updateImportJobStatus(job.id, 'processing', {
        options,
      });

      const queueJobData: ProcessImportJobData = {
        jobId: job.id,
        importType: job.type,
        marketId,
        userId: req.adminUser?.id ?? '',
      };

      const queueJob = await getQueueManager().addJob(
        JobType.PROCESS_IMPORT,
        queueJobData
      );

      log.info('[ImportRoutes] Import retried', {
        jobId: job.id,
        queueJobId: queueJob?.id,
        type: job.type,
      });

      res.json({
        message: 'Import queued for retry',
        jobId: job.id,
        queueJobId: queueJob?.id,
      });
    })
  );
}
