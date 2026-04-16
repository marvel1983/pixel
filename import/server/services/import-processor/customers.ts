import { customers, clientUsers, branches } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import bcrypt from 'bcrypt';
import { getHashType } from '../../utils/passwordVerify';
import {
  db,
  stripHtml,
  importService,
  importRepository,
  mapRowToFields,
  checkDuplicatePolicy,
  log,
  type ImportContext,
  type ProcessResult,
  type ImportError,
} from './helpers';

function parseVipValue(vip: string | undefined): boolean {
  return vip?.toLowerCase() === 'true' || vip === '1';
}

function parseStatusValue(status: string | undefined): 'active' | 'inactive' {
  return status === 'inactive' ? 'inactive' : 'active';
}

async function resolvePasswordHash(
  providedHash: string | undefined
): Promise<{ passwordHash: string; hasProvidedHash: boolean }> {
  const hashType = providedHash ? getHashType(providedHash) : 'unknown';
  const hasProvidedHash = hashType !== 'unknown';
  if (hasProvidedHash) {
    return { passwordHash: providedHash!, hasProvidedHash: true };
  }
  const tempPassword = nanoid(16);
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  return { passwordHash, hasProvidedHash: false };
}

async function createNewCustomer(
  customerId: string,
  mappedData: Record<string, string>,
  ctx: ImportContext
): Promise<void> {
  await db.insert(customers).values({
    id: customerId,
    marketId: ctx.marketId,
    name: mappedData.name,
    email: mappedData.email,
    contactPerson: mappedData.contactPerson || undefined,
    phone: mappedData.phone || undefined,
    whatsapp: mappedData.whatsapp || undefined,
    address: mappedData.address || undefined,
    city: mappedData.city || undefined,
    country: mappedData.country || undefined,
    taxId: mappedData.taxId || undefined,
    paymentTerms: mappedData.paymentTerms || undefined,
    creditLimit: mappedData.creditLimit || '0',
    creditBalance: mappedData.creditBalance || '0',
    description: stripHtml(mappedData.description) || undefined,
    vip: parseVipValue(mappedData.vip),
    status: parseStatusValue(mappedData.status),
    parentMarkup: mappedData.parentMarkup || '0',
  });

  const { passwordHash, hasProvidedHash } = await resolvePasswordHash(
    mappedData.passwordHash
  );

  const [insertedUser] = await db
    .insert(clientUsers)
    .values({
      marketId: ctx.marketId,
      customerId,
      email: mappedData.email,
      passwordHash,
      role: 'client',
      status: hasProvidedHash ? 'active' : 'pending',
      forcePasswordChange: !hasProvidedHash,
      emailVerified: hasProvidedHash,
    })
    .returning({ id: clientUsers.id });

  if (ctx.options.sendInvitations && !hasProvidedHash) {
    try {
      await importService.generateCustomerInviteToken(insertedUser.id);
      log.info('[ImportProcessor] Invite token generated for customer', {
        customerId,
        email: mappedData.email,
      });
    } catch (inviteError) {
      log.warn('[ImportProcessor] Failed to generate invitation', {
        customerId,
        email: mappedData.email,
        error: inviteError,
      });
    }
  }
}

async function updateExistingCustomer(
  existingCustomerId: string,
  mappedData: Record<string, string>
): Promise<void> {
  await db
    .update(customers)
    .set({
      name: mappedData.name,
      contactPerson: mappedData.contactPerson || null,
      phone: mappedData.phone || null,
      whatsapp: mappedData.whatsapp || null,
      address: mappedData.address || null,
      city: mappedData.city || null,
      country: mappedData.country || null,
      taxId: mappedData.taxId || null,
      paymentTerms: mappedData.paymentTerms || null,
      creditLimit: mappedData.creditLimit || null,
      creditBalance: mappedData.creditBalance || undefined,
      description: stripHtml(mappedData.description) || null,
      vip: mappedData.vip ? parseVipValue(mappedData.vip) : undefined,
      status: mappedData.status
        ? parseStatusValue(mappedData.status)
        : undefined,
      parentMarkup: mappedData.parentMarkup || undefined,
    })
    .where(eq(customers.id, existingCustomerId));
}

async function processCustomerRow(
  row: { rowNumber: number; data: Record<string, string> },
  ctx: ImportContext,
  counters: { successCount: number; errorCount: number; skippedCount: number },
  errors: ImportError[]
): Promise<void> {
  const mappedData = mapRowToFields(row.data, ctx.mappingConfig.columnToField);

  if (!mappedData.email || !mappedData.name) {
    errors.push({
      rowNumber: row.rowNumber,
      errorCode: 'MISSING_REQUIRED',
      errorMessage: 'Missing email or name',
      rawData: row.data,
    });
    counters.errorCount++;
    return;
  }

  const existingUser = await db
    .select()
    .from(clientUsers)
    .where(
      and(
        eq(clientUsers.email, mappedData.email),
        eq(clientUsers.marketId, ctx.marketId)
      )
    )
    .limit(1);

  if (existingUser.length > 0) {
    const action = checkDuplicatePolicy(ctx.options.duplicatePolicy);
    if (action === 'skip') {
      counters.skippedCount++;
      return;
    }
    if (action === 'error_duplicate') {
      errors.push({
        rowNumber: row.rowNumber,
        errorCode: 'DUPLICATE',
        errorMessage: `Customer with email ${mappedData.email} already exists`,
        rawData: row.data,
      });
      counters.errorCount++;
      return;
    }
    await updateExistingCustomer(existingUser[0].customerId ?? '', mappedData);
  } else {
    const customerId = nanoid();
    await createNewCustomer(customerId, mappedData, ctx);
  }

  counters.successCount++;
}

export async function processCustomerImport(
  ctx: ImportContext,
  rows: Array<{ rowNumber: number; data: Record<string, string> }>
): Promise<ProcessResult> {
  const counters = { successCount: 0, errorCount: 0, skippedCount: 0 };
  const errors: ImportError[] = [];

  for (const row of rows) {
    try {
      await processCustomerRow(row, ctx, counters, errors);
    } catch (error) {
      errors.push({
        rowNumber: row.rowNumber,
        errorCode: 'PROCESSING_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        rawData: row.data,
      });
      counters.errorCount++;
    }
  }

  if (errors.length > 0) {
    await importService.recordImportErrors(ctx.jobId, errors);
  }

  return { success: counters.errorCount === 0, ...counters };
}

async function resolveParentCustomer(
  mappedData: Record<string, string>,
  linkField: string,
  marketId: string
): Promise<string | null> {
  const hasParentData =
    mappedData.parentCustomerEmail ||
    mappedData.parentCustomerName ||
    mappedData.parentCustomerId ||
    mappedData.parentTaxId;
  if (!hasParentData) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fieldMap: Record<string, { column: any; value: string | undefined }> = {
    email: { column: customers.email, value: mappedData.parentCustomerEmail },
    name: { column: customers.name, value: mappedData.parentCustomerName },
    taxId: { column: customers.taxId, value: mappedData.parentTaxId },
    id: { column: customers.id, value: mappedData.parentCustomerId },
  };

  const match = fieldMap[linkField];
  if (!match?.value) {
    return 'NOT_FOUND';
  }

  const result = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(match.column, match.value), eq(customers.marketId, marketId)))
    .limit(1);

  return result[0]?.id ?? 'NOT_FOUND';
}

async function resolveBranchPasswordHash(
  providedHash: string | undefined
): Promise<{ finalHash: string; generatedPassword: string | null }> {
  const hashType = providedHash ? getHashType(providedHash) : 'unknown';
  if (hashType !== 'unknown') {
    return { finalHash: providedHash!, generatedPassword: null };
  }
  const generatedPassword = importService.generateSecurePassword();
  const finalHash = await bcrypt.hash(generatedPassword, 10);
  return { finalHash, generatedPassword };
}

async function createNewBranch(
  mappedData: Record<string, string>,
  parentCustomerId: string,
  ctx: ImportContext
): Promise<string | null> {
  const { finalHash, generatedPassword } = await resolveBranchPasswordHash(
    mappedData.passwordHash
  );

  await db.insert(branches).values({
    marketId: ctx.marketId,
    parentCustomerId,
    name: mappedData.name,
    username: mappedData.username,
    passwordHash: finalHash,
    contactPerson: mappedData.contactPerson || undefined,
    phone: mappedData.phone || undefined,
    address: mappedData.address || undefined,
    city: mappedData.city || undefined,
    printerType: mappedData.printerType || undefined,
    fiscalDeviceType: mappedData.fiscalDeviceType || undefined,
    status: 'active',
  });

  return generatedPassword;
}

async function updateExistingBranch(
  branchId: string,
  mappedData: Record<string, string>
): Promise<void> {
  await db
    .update(branches)
    .set({
      contactPerson: mappedData.contactPerson || null,
      phone: mappedData.phone || null,
      address: mappedData.address || null,
      city: mappedData.city || null,
    })
    .where(eq(branches.id, branchId));
}

async function processBranchRow(
  row: { rowNumber: number; data: Record<string, string> },
  ctx: ImportContext,
  counters: { successCount: number; errorCount: number; skippedCount: number },
  errors: ImportError[],
  generatedCredentials: Array<{
    branchName: string;
    username: string;
    password: string;
  }>
): Promise<void> {
  const mappedData = mapRowToFields(row.data, ctx.mappingConfig.columnToField);

  if (!mappedData.name || !mappedData.username) {
    errors.push({
      rowNumber: row.rowNumber,
      errorCode: 'MISSING_REQUIRED',
      errorMessage: 'Missing branch name or username',
      rawData: row.data,
    });
    counters.errorCount++;
    return;
  }

  const linkField = ctx.mappingConfig.parentLinkField || 'email';
  const parentCustomerId = await resolveParentCustomer(
    mappedData,
    linkField,
    ctx.marketId
  );

  if (parentCustomerId === 'NOT_FOUND') {
    errors.push({
      rowNumber: row.rowNumber,
      errorCode: 'PARENT_NOT_FOUND',
      errorMessage: 'Parent customer not found',
      rawData: row.data,
    });
    counters.errorCount++;
    return;
  }

  const existingBranch = await db
    .select()
    .from(branches)
    .where(
      and(
        eq(branches.name, mappedData.name),
        eq(branches.marketId, ctx.marketId)
      )
    )
    .limit(1);

  if (existingBranch.length > 0) {
    const action = checkDuplicatePolicy(ctx.options.duplicatePolicy);
    if (action === 'skip') {
      counters.skippedCount++;
      return;
    }
    if (action === 'error_duplicate') {
      errors.push({
        rowNumber: row.rowNumber,
        errorCode: 'DUPLICATE',
        errorMessage: `Branch ${mappedData.name} already exists`,
        rawData: row.data,
      });
      counters.errorCount++;
      return;
    }
    await updateExistingBranch(existingBranch[0].id, mappedData);
    counters.successCount++;
    return;
  }

  if (!parentCustomerId) {
    errors.push({
      rowNumber: row.rowNumber,
      errorCode: 'MISSING_PARENT',
      errorMessage: 'Parent customer is required for new branches',
      rawData: row.data,
    });
    counters.errorCount++;
    return;
  }

  const generatedPassword = await createNewBranch(
    mappedData,
    parentCustomerId,
    ctx
  );
  if (generatedPassword) {
    generatedCredentials.push({
      branchName: mappedData.name,
      username: mappedData.username,
      password: generatedPassword,
    });
  }
  counters.successCount++;
}

async function saveGeneratedCredentials(
  jobId: string,
  credentials: Array<{ branchName: string; username: string; password: string }>
): Promise<void> {
  if (credentials.length === 0) return;

  const credentialsCsv = [
    'Branch Name,Username,Password',
    ...credentials.map(
      (c) => `"${c.branchName}","${c.username}","${c.password}"`
    ),
  ].join('\n');

  const credentialsPath = await importService.uploadImportFile(
    Buffer.from(credentialsCsv, 'utf-8'),
    `branch-credentials-${jobId}.csv`,
    'text/csv'
  );

  await importRepository.updateImportJob(jobId, {
    credentialsFilePath: credentialsPath,
  });
}

export async function processBranchImport(
  ctx: ImportContext,
  rows: Array<{ rowNumber: number; data: Record<string, string> }>
): Promise<ProcessResult> {
  const counters = { successCount: 0, errorCount: 0, skippedCount: 0 };
  const errors: ImportError[] = [];
  const generatedCredentials: Array<{
    branchName: string;
    username: string;
    password: string;
  }> = [];

  for (const row of rows) {
    try {
      await processBranchRow(row, ctx, counters, errors, generatedCredentials);
    } catch (error) {
      errors.push({
        rowNumber: row.rowNumber,
        errorCode: 'PROCESSING_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        rawData: row.data,
      });
      counters.errorCount++;
    }
  }

  if (errors.length > 0) {
    await importService.recordImportErrors(ctx.jobId, errors);
  }

  await saveGeneratedCredentials(ctx.jobId, generatedCredentials);

  return { success: counters.errorCount === 0, ...counters };
}
