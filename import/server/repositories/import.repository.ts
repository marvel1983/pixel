import { eq, and, desc, isNull, lt } from 'drizzle-orm';
import type { DbAdapter } from '../db';
import {
  importJobs,
  importJobErrors,
  customerInviteTokens,
  type ImportJob,
  type InsertImportJob,
  type ImportJobError,
  type InsertImportJobError,
  type CustomerInviteToken,
  type InsertCustomerInviteToken,
} from '@shared/schema';

export class ImportRepository {
  constructor(private readonly db: DbAdapter) {}

  async createImportJob(data: InsertImportJob): Promise<ImportJob> {
    const [result] = await this.db.insert(importJobs).values(data).returning();
    return result;
  }

  async getImportJob(id: string, marketId: string): Promise<ImportJob | null> {
    const [result] = await this.db
      .select()
      .from(importJobs)
      .where(and(eq(importJobs.id, id), eq(importJobs.marketId, marketId)))
      .limit(1);
    return result || null;
  }

  async getImportJobById(id: string): Promise<ImportJob | null> {
    const [result] = await this.db
      .select()
      .from(importJobs)
      .where(eq(importJobs.id, id))
      .limit(1);
    return result || null;
  }

  async getImportJobs(marketId: string, limit = 50): Promise<ImportJob[]> {
    return this.db
      .select()
      .from(importJobs)
      .where(eq(importJobs.marketId, marketId))
      .orderBy(desc(importJobs.createdAt))
      .limit(limit);
  }

  async updateImportJob(
    id: string,
    updates: Partial<ImportJob>
  ): Promise<ImportJob | null> {
    const [result] = await this.db
      .update(importJobs)
      .set(updates)
      .where(eq(importJobs.id, id))
      .returning();
    return result || null;
  }

  async createImportJobError(
    data: InsertImportJobError
  ): Promise<ImportJobError> {
    const [result] = await this.db
      .insert(importJobErrors)
      .values(data)
      .returning();
    return result;
  }

  async createImportJobErrors(errors: InsertImportJobError[]): Promise<void> {
    if (errors.length === 0) {
      return;
    }
    await this.db.insert(importJobErrors).values(errors);
  }

  async getImportJobErrors(jobId: string): Promise<ImportJobError[]> {
    return this.db
      .select()
      .from(importJobErrors)
      .where(eq(importJobErrors.jobId, jobId))
      .orderBy(importJobErrors.rowNumber);
  }

  async createCustomerInviteToken(
    data: InsertCustomerInviteToken
  ): Promise<CustomerInviteToken> {
    const [result] = await this.db
      .insert(customerInviteTokens)
      .values(data)
      .returning();
    return result;
  }

  async getCustomerInviteToken(
    token: string
  ): Promise<CustomerInviteToken | null> {
    const [result] = await this.db
      .select()
      .from(customerInviteTokens)
      .where(eq(customerInviteTokens.token, token))
      .limit(1);
    return result || null;
  }

  async markInviteTokenUsed(id: string): Promise<void> {
    await this.db
      .update(customerInviteTokens)
      .set({ usedAt: new Date() })
      .where(eq(customerInviteTokens.id, id));
  }

  async deleteExpiredInviteTokens(): Promise<number> {
    const result = await this.db
      .delete(customerInviteTokens)
      .where(
        and(
          isNull(customerInviteTokens.usedAt),
          lt(customerInviteTokens.expiresAt, new Date())
        )
      );
    return result.rowCount || 0;
  }
}
