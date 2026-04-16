import { ImportRepository } from '../repositories/import.repository';
import { ImportService } from './import.service';
import { db } from '../db';
import { log } from '../middleware/logging';
import {
  auditService,
  AuditEventType,
  AuditTargetType,
} from '../utils/auditService';
import { processProductImport } from './import-processor/products';
import {
  processCustomerImport,
  processBranchImport,
} from './import-processor/customers';
import { processSoldKeysImport } from './import-processor/sold-keys';
import { processActiveKeysImport } from './import-processor/active-keys';
import type { ImportContext, ProcessResult } from './import-processor/helpers';

const importRepository = new ImportRepository(db);
const importService = new ImportService(importRepository);

const importTypeProcessors: Record<
  string,
  (
    ctx: ImportContext,
    rows: Array<{ rowNumber: number; data: Record<string, string> }>
  ) => Promise<ProcessResult>
> = {
  products: processProductImport,
  customers: processCustomerImport,
  branches: processBranchImport,
  sold_keys: processSoldKeysImport,
  active_keys: processActiveKeysImport,
};

async function executeImportJob(
  ctx: ImportContext,
  filePath: string
): Promise<ProcessResult> {
  const fileBuffer = await importService.downloadImportFile(filePath);
  const content = fileBuffer.toString('utf-8');
  const { rows } = importService.parseCSV(
    content,
    ctx.mappingConfig.hasHeaderRow
  );

  await importService.updateImportJobStatus(ctx.jobId, 'processing', {
    totalRows: rows.length,
  });

  const processor = importTypeProcessors[ctx.importType];
  if (!processor) {
    throw new Error(`Unknown import type: ${ctx.importType}`);
  }

  const result = await processor(ctx, rows);

  await importService.updateImportJobProgress(
    ctx.jobId,
    rows.length,
    result.successCount,
    result.errorCount,
    result.skippedCount
  );
  await importService.updateImportJobStatus(ctx.jobId, 'completed');

  log.info('[ImportProcessor] Import completed', {
    jobId: ctx.jobId,
    ...result,
  });
  return result;
}

export async function processImportJob(
  jobId: string,
  marketId: string
): Promise<ProcessResult> {
  const job = await importService.getImportJob(jobId, marketId);

  if (!job) {
    throw new Error(`Import job ${jobId} not found`);
  }

  if (!job.filePath || !job.mappingConfig) {
    throw new Error('Import job missing file or mapping configuration');
  }

  const ctx: ImportContext = {
    jobId,
    marketId,
    createdBy: job.createdBy,
    importType: job.type,
    mappingConfig: job.mappingConfig as ImportContext['mappingConfig'],
    options: (job.options as ImportContext['options']) || {
      duplicatePolicy: 'skip',
    },
  };

  await importService.updateImportJobStatus(jobId, 'processing');

  try {
    const result = await executeImportJob(ctx, job.filePath);

    await auditService.logEvent({
      marketId,
      eventType: AuditEventType.IMPORT_COMPLETED,
      targetType: AuditTargetType.IMPORT_JOB,
      targetId: jobId,
      details: {
        importType: ctx.importType,
        successCount: result.successCount,
        errorCount: result.errorCount,
        skippedCount: result.skippedCount,
      },
    });

    await importService.deleteImportFile(job.filePath);

    return result;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error('[ImportProcessor] Import failed', { jobId, err: errMsg });
    await importService.updateImportJobStatus(jobId, 'failed', {
      errorMessage: errMsg,
    });

    await importService.deleteImportFile(job.filePath);

    await auditService.logEvent({
      marketId,
      eventType: AuditEventType.IMPORT_FAILED,
      targetType: AuditTargetType.IMPORT_JOB,
      targetId: jobId,
      details: {
        importType: ctx.importType,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    throw error;
  }
}
