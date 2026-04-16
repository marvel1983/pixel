import { Worker, Job } from 'bullmq';
import {
  JobType,
  type JobResult,
  QUEUE_CONFIGS,
  getQueuePrefix,
} from '../types.js';
import { db } from '../../db.js';
import { and, eq, inArray, isNotNull, lt, lte } from 'drizzle-orm';
import { toErrorMessage } from '../../utils/errors';
import { BaseWorker } from './base.worker.js';

export class ImportWorker extends BaseWorker {
  protected readonly worker: Worker;

  constructor() {
    super();

    this.worker = new Worker(
      QUEUE_CONFIGS.import.name,
      async (job) => this.processImportJob(job),
      {
        prefix: getQueuePrefix(),
        connection: QUEUE_CONFIGS.import.connection,
        concurrency: QUEUE_CONFIGS.import.concurrency,
      }
    );

    this.worker.on('completed', (job) => {
      this.logger.debug({ jobId: job.id }, 'Import job completed successfully');
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        { jobId: job?.id, error: err.message },
        'Import job failed'
      );
    });
  }

  private async processImportJob(job: Job): Promise<JobResult> {
    const startTime = Date.now();

    try {
      await this.logJobStart(job, job.name);

      let result: JobResult;

      if ((job.name as JobType) === JobType.PROCESS_IMPORT) {
        result = await this.processImport(
          job.data as import('../types').ProcessImportJobData
        );
      } else if ((job.name as JobType) === JobType.CLEAN_IMPORT_FILES) {
        result = await this.cleanImportFiles(
          job.data as { olderThanHours?: number }
        );
      } else {
        throw new Error(`Unknown import job type: ${job.name}`);
      }

      result.processingTime = Date.now() - startTime;
      await this.logJobComplete(job, job.name, result);

      return result;
    } catch (error) {
      await this.logJobError(job, job.name, error);
      throw error;
    }
  }

  private async processImport(
    data: import('../types').ProcessImportJobData
  ): Promise<JobResult> {
    const { processImportJob } = await import(
      '../../services/import-processor.service'
    );

    try {
      const result = await processImportJob(data.jobId, data.marketId);

      this.logger.info(
        {
          jobId: data.jobId,
          marketId: data.marketId,
          importType: data.importType,
          successCount: result.successCount,
          errorCount: result.errorCount,
          skippedCount: result.skippedCount,
        },
        'Import processing completed'
      );

      return {
        success: result.success,
        data: {
          jobId: data.jobId,
          importType: data.importType,
          successCount: result.successCount,
          errorCount: result.errorCount,
          skippedCount: result.skippedCount,
        },
      };
    } catch (error) {
      this.logger.error(
        {
          jobId: data.jobId,
          error: toErrorMessage(error),
        },
        'Import processing failed'
      );

      return {
        success: false,
        error: toErrorMessage(error),
        data: {
          jobId: data.jobId,
        },
      };
    }
  }

  /**
   * Belt-and-suspenders sweep: delete any import files in object storage or
   * /tmp/order-archive-uploads/ that are older than `olderThanHours` hours.
   *
   * This catches files that were not cleaned up immediately after a job completed
   * (e.g. server crash, network error, or race condition during deletion).
   */
  private async deleteStaleStorageFiles(
    cutoff: Date
  ): Promise<{ deleted: number; errors: string[] }> {
    const { unifiedStorageService } = await import('../../storageService');
    const { importJobs: importJobsTable } = await import('@shared/schema');
    let deleted = 0;
    const errors: string[] = [];
    try {
      const staleJobs = await db
        .select({
          filePath: importJobsTable.filePath,
          credentialsFilePath: importJobsTable.credentialsFilePath,
        })
        .from(importJobsTable)
        .where(
          and(
            inArray(importJobsTable.status, ['completed', 'failed'] as const),
            lte(importJobsTable.completedAt, cutoff),
            isNotNull(importJobsTable.filePath)
          )
        );
      await unifiedStorageService.initialize();
      for (const job of staleJobs) {
        for (const fp of [job.filePath, job.credentialsFilePath]) {
          if (!fp) continue;
          try {
            await unifiedStorageService.deleteBuffer(fp);
            deleted++;
          } catch (err) {
            errors.push(`storage:${fp}: ${toErrorMessage(err)}`);
          }
        }
      }
    } catch (err) {
      errors.push(`storage-query: ${toErrorMessage(err)}`);
    }
    return { deleted, errors };
  }

  private async deleteStaleDiskFiles(
    cutoff: Date
  ): Promise<{ deleted: number; errors: string[] }> {
    const fsPromises = await import('node:fs/promises');
    const nodePath = await import('node:path');
    const ARCHIVE_DIR = '/tmp/order-archive-uploads';
    let deleted = 0;
    const errors: string[] = [];
    try {
      const entries = await fsPromises
        .readdir(ARCHIVE_DIR)
        .catch(() => [] as string[]);
      for (const entry of entries) {
        if (!entry.endsWith('.csv')) continue;
        const fullPath = nodePath.join(ARCHIVE_DIR, entry);
        try {
          const stat = await fsPromises.stat(fullPath);
          if (stat.mtimeMs < cutoff.getTime()) {
            await fsPromises.unlink(fullPath);
            deleted++;
          }
        } catch (err) {
          errors.push(`disk:${entry}: ${toErrorMessage(err)}`);
        }
      }
    } catch (err) {
      errors.push(`disk-readdir: ${toErrorMessage(err)}`);
    }
    return { deleted, errors };
  }

  private async cleanImportFiles(data: {
    olderThanHours?: number;
  }): Promise<JobResult> {
    const olderThanHours = data.olderThanHours ?? 24;
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

    const expireResult = await this.expireStalePendingJobs();
    const storageResult = await this.deleteStaleStorageFiles(cutoff);
    const diskResult = await this.deleteStaleDiskFiles(cutoff);

    const storageDeleted = storageResult.deleted;
    const diskDeleted = diskResult.deleted;
    const errors = [
      ...expireResult.errors,
      ...storageResult.errors,
      ...diskResult.errors,
    ];

    this.logger.info(
      {
        expiredJobs: expireResult.expired,
        storageDeleted,
        diskDeleted,
        cutoff,
        errors,
      },
      'CLEAN_IMPORT_FILES: completed'
    );

    return {
      success: errors.length === 0,
      data: {
        expiredJobs: expireResult.expired,
        storageDeleted,
        diskDeleted,
        olderThanHours,
        errors,
      },
    };
  }

  /**
   * Expire import jobs that have been stuck in pending/queued for over 2 hours.
   * These are uploads where the user navigated away before completing the import,
   * or where the file write failed after the DB record was created.
   * Marks the job as 'failed' and attempts to delete the associated file.
   */
  private async expireStalePendingJobs(): Promise<{
    expired: number;
    errors: string[];
  }> {
    const { importJobs: importJobsTable } = await import('@shared/schema');
    const { unifiedStorageService } = await import('../../storageService');
    const staleThreshold = new Date(Date.now() - 2 * 60 * 60 * 1000);
    let expired = 0;
    const errors: string[] = [];

    try {
      const staleJobs = await db
        .select({
          id: importJobsTable.id,
          filePath: importJobsTable.filePath,
          credentialsFilePath: importJobsTable.credentialsFilePath,
        })
        .from(importJobsTable)
        .where(
          and(
            inArray(importJobsTable.status, ['pending', 'queued'] as const),
            lt(importJobsTable.createdAt, staleThreshold)
          )
        );

      if (staleJobs.length === 0) return { expired: 0, errors: [] };

      await unifiedStorageService.initialize();
      for (const job of staleJobs) {
        try {
          for (const fp of [job.filePath, job.credentialsFilePath]) {
            if (!fp) continue;
            try {
              await unifiedStorageService.deleteBuffer(fp);
            } catch (_err) {
              // File may already be missing — not an error for stale job cleanup
            }
          }
          await db
            .update(importJobsTable)
            .set({ status: 'failed', completedAt: new Date() })
            .where(eq(importJobsTable.id, job.id));
          expired++;
        } catch (err) {
          errors.push(`expire:${job.id}: ${toErrorMessage(err)}`);
        }
      }

      this.logger.info(
        { expired, staleThreshold },
        'Expired stale import jobs'
      );
    } catch (err) {
      errors.push(`expire-query: ${toErrorMessage(err)}`);
    }
    return { expired, errors };
  }
}
