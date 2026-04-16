import { randomBytes } from 'node:crypto';
import { ImportRepository } from '../repositories/import.repository';
import { unifiedStorageService } from '../storageService';
import { log } from '../middleware/logging';
import type {
  ImportJob,
  InsertImportJob,
  ImportJobError,
} from '@shared/schema';

export interface ParsedRow {
  rowNumber: number;
  data: Record<string, string>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    rowNumber: number;
    errorCode: string;
    errorMessage: string;
    rawData?: Record<string, string>;
  }>;
  validRows: ParsedRow[];
  headers: string[];
  totalRows: number;
  previewRows: ParsedRow[];
}

export interface ImportProgress {
  jobId: string;
  status: string;
  totalRows: number;
  processedRows: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;
}

export class ImportService {
  constructor(private readonly repository: ImportRepository) {}

  async createImportJob(data: InsertImportJob): Promise<ImportJob> {
    log.info('[ImportService] Creating import job', {
      type: data.type,
      marketId: data.marketId,
    });
    return this.repository.createImportJob(data);
  }

  async getImportJob(id: string, marketId: string): Promise<ImportJob | null> {
    return this.repository.getImportJob(id, marketId);
  }

  async getImportJobs(marketId: string): Promise<ImportJob[]> {
    return this.repository.getImportJobs(marketId);
  }

  async updateImportJobStatus(
    id: string,
    status:
      | 'pending'
      | 'validating'
      | 'processing'
      | 'completed'
      | 'failed'
      | 'cancelled',
    updates?: Partial<ImportJob>
  ): Promise<ImportJob | null> {
    const updateData: Partial<ImportJob> = { status, ...updates };

    if (status === 'processing' && !updates?.startedAt) {
      updateData.startedAt = new Date();
    }
    if (status === 'completed' || status === 'failed') {
      updateData.completedAt = new Date();
    }

    return this.repository.updateImportJob(id, updateData);
  }

  async updateImportJobProgress(
    id: string,
    processedRows: number,
    successCount: number,
    errorCount: number,
    skippedCount: number
  ): Promise<ImportJob | null> {
    return this.repository.updateImportJob(id, {
      processedRows,
      successCount,
      errorCount,
      skippedCount,
    });
  }

  async recordImportErrors(
    jobId: string,
    errors: Array<{
      rowNumber: number;
      errorCode: string;
      errorMessage: string;
      rawData?: Record<string, string>;
    }>
  ): Promise<void> {
    const errorRecords = errors.map((e) => ({
      jobId,
      rowNumber: e.rowNumber,
      errorCode: e.errorCode,
      errorMessage: e.errorMessage,
      rawData: e.rawData,
    }));
    await this.repository.createImportJobErrors(errorRecords);
  }

  async getImportJobErrors(jobId: string): Promise<ImportJobError[]> {
    return this.repository.getImportJobErrors(jobId);
  }

  async uploadImportFile(
    fileBuffer: Buffer,
    fileName: string,
    contentType: string
  ): Promise<string> {
    await unifiedStorageService.initialize();

    const fileId = `imports/${Date.now()}-${randomBytes(8).toString('hex')}-${fileName}`;

    await unifiedStorageService.uploadBuffer(fileBuffer, fileId, contentType);

    log.info('[ImportService] File uploaded', {
      fileId,
      fileName,
      size: fileBuffer.length,
    });

    return fileId;
  }

  async downloadImportFile(filePath: string): Promise<Buffer> {
    await unifiedStorageService.initialize();
    return unifiedStorageService.downloadBuffer(filePath);
  }

  /**
   * Delete an import file from storage after the job completes or fails.
   * Sensitive CSVs (license keys, customer PII, password hashes) must not
   * be retained beyond the duration of the import job.
   * Errors are swallowed — a missing file must never block job completion.
   */
  async deleteImportFile(filePath: string): Promise<void> {
    try {
      await unifiedStorageService.initialize();
      await unifiedStorageService.deleteBuffer(filePath);
      log.info('[ImportService] Import file deleted from storage', {
        filePath,
      });
    } catch (error) {
      log.warn(
        '[ImportService] Could not delete import file — may already be gone',
        {
          filePath,
          error: String(error),
        }
      );
    }
  }

  parseCSV(
    content: string,
    hasHeaderRow = true
  ): { headers: string[]; rows: ParsedRow[] } {
    const records = this.parseCSVWithMultilineSupport(content);

    if (records.length === 0) {
      return { headers: [], rows: [] };
    }

    const headers = hasHeaderRow ? records[0] : [];
    const dataRecords = hasHeaderRow ? records.slice(1) : records;

    const rows: ParsedRow[] = dataRecords.map((values, index) => {
      const data: Record<string, string> = {};

      if (hasHeaderRow) {
        headers.forEach((header, i) => {
          data[header] = values[i] || '';
        });
      } else {
        values.forEach((value, i) => {
          data[`column_${i + 1}`] = value;
        });
      }

      return {
        rowNumber: hasHeaderRow ? index + 2 : index + 1,
        data,
      };
    });

    return { headers, rows };
  }

  private finalizeRecord(
    records: string[][],
    currentRecord: string[],
    currentField: string
  ): { record: string[]; field: string } {
    currentRecord.push(currentField.trim());
    if (currentRecord.some((f) => f.length > 0)) {
      records.push(currentRecord);
    }
    return { record: [], field: '' };
  }

  private processQuoteChar(
    content: string,
    i: number,
    inQuotes: boolean,
    currentField: string,
    delimiter: string
  ): { i: number; inQuotes: boolean; currentField: string } {
    if (inQuotes && content[i + 1] === '"') {
      return { i: i + 2, inQuotes, currentField: currentField + '"' };
    }
    if (inQuotes) {
      const nextChar = content[i + 1];
      const isFieldEnd =
        nextChar === delimiter ||
        nextChar === '\n' ||
        nextChar === '\r' ||
        nextChar === undefined;
      if (!isFieldEnd) {
        return { i: i + 1, inQuotes: true, currentField: currentField + '"' };
      }
    }
    return { i: i + 1, inQuotes: !inQuotes, currentField };
  }

  private processNewlineChar(
    content: string,
    i: number,
    records: string[][],
    currentRecord: string[],
    currentField: string
  ): { i: number; currentRecord: string[]; currentField: string } {
    const nextI =
      content[i] === '\r' && content[i + 1] === '\n' ? i + 2 : i + 1;
    const result = this.finalizeRecord(records, currentRecord, currentField);
    return {
      i: nextI,
      currentRecord: result.record,
      currentField: result.field,
    };
  }

  private detectDelimiter(content: string): string {
    const firstLine = content.slice(
      0,
      content.indexOf('\n') === -1 ? content.length : content.indexOf('\n')
    );
    const semicolons = (firstLine.match(/;/g) || []).length;
    const commas = (firstLine.match(/,/g) || []).length;
    return semicolons >= commas ? ';' : ',';
  }

  private parseCSVWithMultilineSupport(content: string): string[][] {
    const delimiter = this.detectDelimiter(content);
    const records: string[][] = [];
    let currentRecord: string[] = [];
    let currentField = '';
    let inQuotes = false;

    let i = 0;
    while (i < content.length) {
      const char = content[i];

      if (char === '"') {
        const qResult = this.processQuoteChar(
          content,
          i,
          inQuotes,
          currentField,
          delimiter
        );
        i = qResult.i;
        inQuotes = qResult.inQuotes;
        currentField = qResult.currentField;
        continue;
      }

      if (inQuotes) {
        currentField += char;
        i++;
        continue;
      }

      if (char === delimiter) {
        currentRecord.push(currentField.trim());
        currentField = '';
        i++;
        continue;
      }

      if (char === '\n' || char === '\r') {
        const nResult = this.processNewlineChar(
          content,
          i,
          records,
          currentRecord,
          currentField
        );
        i = nResult.i;
        currentRecord = nResult.currentRecord;
        currentField = nResult.currentField;
        continue;
      }

      currentField += char;
      i++;
    }

    if (currentField.length > 0 || currentRecord.length > 0) {
      this.finalizeRecord(records, currentRecord, currentField);
    }

    return records;
  }

  async generateCustomerInviteToken(clientUserId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.repository.createCustomerInviteToken({
      clientUserId,
      token,
      expiresAt,
    });

    return token;
  }

  async validateInviteToken(
    token: string
  ): Promise<{ valid: boolean; clientUserId?: string; tokenId?: string }> {
    const inviteToken = await this.repository.getCustomerInviteToken(token);

    if (!inviteToken) {
      return { valid: false };
    }

    if (inviteToken.usedAt) {
      return { valid: false };
    }

    if (new Date() > inviteToken.expiresAt) {
      return { valid: false };
    }

    return {
      valid: true,
      clientUserId: inviteToken.clientUserId,
      tokenId: inviteToken.id,
    };
  }

  async markInviteTokenUsed(tokenId: string): Promise<void> {
    await this.repository.markInviteTokenUsed(tokenId);
  }

  generateSecurePassword(): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
    let password = '';
    const bytes = randomBytes(12);
    for (let i = 0; i < 12; i++) {
      password += chars[bytes[i] % chars.length];
    }
    return password;
  }

  getRequiredFields(
    importType:
      | 'products'
      | 'customers'
      | 'branches'
      | 'sold_keys'
      | 'active_keys'
  ): string[] {
    switch (importType) {
      case 'products':
        return ['name', 'sku'];
      case 'customers':
        return ['email', 'name'];
      case 'branches':
        return ['name', 'username'];
      case 'sold_keys':
        return ['keyCode'];
      case 'active_keys':
        return ['keyCode'];
      default:
        return [];
    }
  }

  getAvailableFields(
    importType:
      | 'products'
      | 'customers'
      | 'branches'
      | 'sold_keys'
      | 'active_keys'
  ): Array<{ field: string; label: string; required: boolean }> {
    switch (importType) {
      case 'products':
        return [
          { field: 'name', label: 'Product Name', required: true },
          { field: 'sku', label: 'SKU', required: true },
          { field: 'description', label: 'Description', required: false },
          {
            field: 'shortDescription',
            label: 'Short Description',
            required: false,
          },
          { field: 'costPrice', label: 'Purchase/Cost Price', required: false },
          {
            field: 'b2bPrice',
            label: 'Distributor/B2B Price',
            required: false,
          },
          { field: 'retailPrice', label: 'Retail Price', required: false },
          { field: 'priceEur', label: 'Sell Price (EUR)', required: false },
          { field: 'priceKm', label: 'Sell Price (KM)', required: false },
          { field: 'b2bMargin', label: 'B2B Margin %', required: false },
          { field: 'retailMargin', label: 'Retail Margin %', required: false },
          {
            field: 'kmB2bPrice',
            label: 'KM B2B Price Override',
            required: false,
          },
          {
            field: 'kmRetailPrice',
            label: 'KM Retail Price Override',
            required: false,
          },
          { field: 'stock', label: 'Stock Quantity', required: false },
          { field: 'minStock', label: 'Minimum Stock', required: false },
          { field: 'category', label: 'Category (Legacy)', required: false },
          {
            field: 'mainCategoryName',
            label: 'Main Category Name',
            required: false,
          },
          {
            field: 'subCategoryName',
            label: 'Sub Category Name',
            required: false,
          },
          {
            field: 'subSubCategoryName',
            label: 'Sub-Sub Category Name',
            required: false,
          },
          {
            field: 'mainCategoryId',
            label: 'Main Category ID',
            required: false,
          },
          { field: 'subCategoryId', label: 'Sub Category ID', required: false },
          {
            field: 'subSubCategoryId',
            label: 'Sub-Sub Category ID',
            required: false,
          },
          { field: 'platform', label: 'Platform', required: false },
          {
            field: 'status',
            label: 'Status (active/inactive)',
            required: false,
          },
          {
            field: 'isKeyManaged',
            label: 'Digital Key Managed',
            required: false,
          },
          { field: 'imageUrl', label: 'Image URL', required: false },
          { field: 'activationUrl', label: 'Activation URL', required: false },
          { field: 'warrantyDays', label: 'Warranty Days', required: false },
        ];
      case 'customers':
        return [
          { field: 'email', label: 'Email', required: true },
          { field: 'name', label: 'Company/Customer Name', required: true },
          { field: 'contactPerson', label: 'Contact Person', required: false },
          { field: 'phone', label: 'Phone', required: false },
          { field: 'whatsapp', label: 'WhatsApp', required: false },
          { field: 'address', label: 'Address', required: false },
          { field: 'city', label: 'City', required: false },
          { field: 'country', label: 'Country', required: false },
          { field: 'taxId', label: 'Tax ID / VAT', required: false },
          { field: 'paymentTerms', label: 'Payment Terms', required: false },
          { field: 'creditLimit', label: 'Credit Limit', required: false },
          {
            field: 'creditBalance',
            label: 'Initial Credit Balance',
            required: false,
          },
          { field: 'description', label: 'Description', required: false },
          { field: 'vip', label: 'VIP Status (true/false)', required: false },
          {
            field: 'status',
            label: 'Status (active/inactive)',
            required: false,
          },
          { field: 'parentMarkup', label: 'Parent Markup %', required: false },
          {
            field: 'passwordHash',
            label: 'Password Hash (bcrypt)',
            required: false,
          },
        ];
      case 'branches':
        return [
          {
            field: 'parentCustomerEmail',
            label: 'Parent Customer Email',
            required: false,
          },
          {
            field: 'parentCustomerName',
            label: 'Parent Customer Name',
            required: false,
          },
          {
            field: 'parentCustomerId',
            label: 'Parent Customer ID',
            required: false,
          },
          { field: 'parentTaxId', label: 'Parent Tax ID', required: false },
          { field: 'name', label: 'Branch Name', required: true },
          { field: 'username', label: 'POS Username', required: true },
          { field: 'contactPerson', label: 'Contact Person', required: false },
          { field: 'phone', label: 'Phone', required: false },
          { field: 'address', label: 'Address', required: false },
          { field: 'city', label: 'City', required: false },
          { field: 'printerType', label: 'Printer Type', required: false },
          {
            field: 'fiscalDeviceType',
            label: 'Fiscal Device Type',
            required: false,
          },
          {
            field: 'passwordHash',
            label: 'Password Hash (bcrypt)',
            required: false,
          },
        ];
      case 'sold_keys':
        return [
          { field: 'keyCode', label: 'Digital Key Code', required: true },
          { field: 'productSku', label: 'Product SKU', required: false },
          { field: 'productName', label: 'Product Name', required: false },
          { field: 'customerEmail', label: 'Customer Email', required: false },
          { field: 'customerName', label: 'Customer Name', required: false },
          { field: 'soldDate', label: 'Sale Date', required: false },
          { field: 'notes', label: 'Notes', required: false },
        ];
      case 'active_keys':
        return [
          { field: 'keyCode', label: 'Digital Key Code', required: true },
          { field: 'productSku', label: 'Product SKU', required: false },
          { field: 'productName', label: 'Product Name', required: false },
          {
            field: 'codeType',
            label: 'Code Type (e.g. text/plain)',
            required: false,
          },
          { field: 'notes', label: 'Notes', required: false },
        ];
      default:
        return [];
    }
  }

  async getBranchCredentials(
    jobId: string
  ): Promise<{ branchName: string; username: string; password: string }[]> {
    const job = await this.repository.getImportJobById(jobId);

    if (!job?.credentialsFilePath) {
      return [];
    }

    try {
      const fileBuffer = await this.downloadImportFile(job.credentialsFilePath);
      const content = fileBuffer.toString('utf-8');

      const { rows } = this.parseCSV(content, true);

      return rows
        .map((row) => ({
          branchName: row.data['Branch Name'] || row.data['branchName'] || '',
          username: row.data['Username'] || row.data['username'] || '',
          password: row.data['Password'] || row.data['password'] || '',
        }))
        .filter((c) => c.username && c.password);
    } catch (error) {
      log.error('[ImportService] Failed to retrieve branch credentials', {
        jobId,
        error,
      });
      return [];
    }
  }
}
