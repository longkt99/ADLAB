// ============================================
// AdLab Ingestion Validation
// ============================================
// Dataset schemas and required columns for CSV validation.
// PHASE D16A: Dry-run validation only, no actual writes.
//
// SAFETY RULES:
// - Validation only, no database writes
// - Parse up to 100k rows but only store preview (20 rows)
// - Store first 50 errors only
// - Return friendly error messages
// ============================================

// ============================================
// Dataset Types
// ============================================

export type DatasetType = 'campaigns' | 'ad_sets' | 'ads' | 'daily_metrics' | 'alerts';
export type PlatformType = 'meta' | 'google' | 'tiktok' | 'linkedin' | 'other';
export type ValidationStatus = 'pass' | 'warn' | 'fail';

// ============================================
// Dataset Schemas
// ============================================

export interface ColumnSchema {
  name: string;
  required: boolean;
  type: 'string' | 'number' | 'date' | 'boolean';
  description?: string;
}

export const DATASET_SCHEMAS: Record<DatasetType, ColumnSchema[]> = {
  campaigns: [
    { name: 'external_id', required: true, type: 'string', description: 'Platform campaign ID' },
    { name: 'name', required: true, type: 'string', description: 'Campaign name' },
    { name: 'platform', required: true, type: 'string', description: 'Platform (meta/google/tiktok/linkedin)' },
    { name: 'objective', required: false, type: 'string', description: 'Campaign objective' },
    { name: 'status', required: true, type: 'string', description: 'Campaign status' },
    { name: 'start_date', required: false, type: 'date', description: 'Campaign start date' },
    { name: 'end_date', required: false, type: 'date', description: 'Campaign end date' },
  ],
  ad_sets: [
    { name: 'external_id', required: true, type: 'string', description: 'Platform ad set ID' },
    { name: 'campaign_external_id', required: true, type: 'string', description: 'Parent campaign external ID' },
    { name: 'name', required: true, type: 'string', description: 'Ad set name' },
    { name: 'platform', required: true, type: 'string', description: 'Platform' },
    { name: 'status', required: true, type: 'string', description: 'Ad set status' },
    { name: 'daily_budget', required: false, type: 'number', description: 'Daily budget' },
    { name: 'lifetime_budget', required: false, type: 'number', description: 'Lifetime budget' },
    { name: 'bid_strategy', required: false, type: 'string', description: 'Bid strategy' },
  ],
  ads: [
    { name: 'external_id', required: true, type: 'string', description: 'Platform ad ID' },
    { name: 'ad_set_external_id', required: true, type: 'string', description: 'Parent ad set external ID' },
    { name: 'name', required: true, type: 'string', description: 'Ad name' },
    { name: 'platform', required: true, type: 'string', description: 'Platform' },
    { name: 'status', required: true, type: 'string', description: 'Ad status' },
    { name: 'creative_id', required: false, type: 'string', description: 'Creative ID' },
    { name: 'landing_page_url', required: false, type: 'string', description: 'Landing page URL' },
  ],
  daily_metrics: [
    { name: 'date', required: true, type: 'date', description: 'Metric date (YYYY-MM-DD)' },
    { name: 'platform', required: true, type: 'string', description: 'Platform' },
    { name: 'entity_type', required: true, type: 'string', description: 'Entity type (campaign/ad_set/ad)' },
    { name: 'entity_external_id', required: true, type: 'string', description: 'Entity external ID' },
    { name: 'spend', required: true, type: 'number', description: 'Spend amount' },
    { name: 'impressions', required: true, type: 'number', description: 'Impression count' },
    { name: 'clicks', required: true, type: 'number', description: 'Click count' },
    { name: 'conversions', required: false, type: 'number', description: 'Conversion count' },
    { name: 'currency', required: false, type: 'string', description: 'Currency code (default: VND)' },
  ],
  alerts: [
    { name: 'platform', required: true, type: 'string', description: 'Platform' },
    { name: 'severity', required: true, type: 'string', description: 'Severity (info/warning/critical)' },
    { name: 'message', required: true, type: 'string', description: 'Alert message' },
    { name: 'metric_key', required: false, type: 'string', description: 'Metric key' },
    { name: 'metric_value', required: false, type: 'number', description: 'Metric value' },
    { name: 'threshold', required: false, type: 'number', description: 'Threshold value' },
    { name: 'entity_external_id', required: false, type: 'string', description: 'Related entity external ID' },
  ],
};

// ============================================
// Validation Error Types
// ============================================

export interface ValidationError {
  row: number;
  column: string;
  message: string;
  value?: string;
}

export interface ValidationResult {
  status: ValidationStatus;
  rowsParsed: number;
  validRows: number;
  errorCount: number;
  warningCount: number;
  errors: ValidationError[];
  warnings: ValidationError[];
  preview: Record<string, string | number | null>[];
  /** All valid rows for promotion (D16B) */
  validatedRows: Record<string, string | number | null>[];
  missingColumns: string[];
  extraColumns: string[];
}

// ============================================
// CSV Parsing
// ============================================

/**
 * Simple CSV parser that handles quoted fields
 */
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && !inQuotes) {
      inQuotes = true;
    } else if (char === '"' && inQuotes) {
      if (nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = false;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Parse full CSV content
 */
export function parseCSV(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.split(/\r?\n/).filter(line => line.trim());

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const rows = lines.slice(1).map(parseCSVLine);

  return { headers, rows };
}

// ============================================
// Validation Functions
// ============================================

function validateType(value: string, type: ColumnSchema['type']): boolean {
  if (!value || value.trim() === '') return true; // Empty values handled by required check

  switch (type) {
    case 'number':
      return !isNaN(parseFloat(value));
    case 'date':
      // Accept YYYY-MM-DD format
      return /^\d{4}-\d{2}-\d{2}$/.test(value) || !isNaN(Date.parse(value));
    case 'boolean':
      return ['true', 'false', '1', '0', 'yes', 'no'].includes(value.toLowerCase());
    case 'string':
    default:
      return true;
  }
}

/**
 * Validate CSV content against dataset schema
 */
export function validateCSV(
  content: string,
  dataset: DatasetType,
  maxRows = 100000,
  maxPreview = 20,
  maxErrors = 50
): ValidationResult {
  const schema = DATASET_SCHEMAS[dataset];
  const requiredColumns = schema.filter(c => c.required).map(c => c.name);
  const allColumns = schema.map(c => c.name);

  const result: ValidationResult = {
    status: 'pass',
    rowsParsed: 0,
    validRows: 0,
    errorCount: 0,
    warningCount: 0,
    errors: [],
    warnings: [],
    preview: [],
    validatedRows: [],
    missingColumns: [],
    extraColumns: [],
  };

  // Parse CSV
  const { headers, rows } = parseCSV(content);

  if (headers.length === 0) {
    result.status = 'fail';
    result.errors.push({
      row: 0,
      column: '',
      message: 'CSV file is empty or has no headers',
    });
    return result;
  }

  // Check for missing required columns
  result.missingColumns = requiredColumns.filter(col => !headers.includes(col));

  if (result.missingColumns.length > 0) {
    result.status = 'fail';
    result.errors.push({
      row: 0,
      column: '',
      message: `Missing required columns: ${result.missingColumns.join(', ')}`,
    });
    return result;
  }

  // Check for extra columns (warning only)
  result.extraColumns = headers.filter(h => !allColumns.includes(h));

  if (result.extraColumns.length > 0) {
    result.warningCount++;
    result.warnings.push({
      row: 0,
      column: '',
      message: `Extra columns will be ignored: ${result.extraColumns.join(', ')}`,
    });
  }

  // Create column index map
  const columnIndex: Record<string, number> = {};
  headers.forEach((h, i) => {
    columnIndex[h] = i;
  });

  // Validate rows
  const rowsToProcess = Math.min(rows.length, maxRows);

  for (let i = 0; i < rowsToProcess; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-indexed, accounting for header
    let rowValid = true;

    // Check each column in schema
    for (const col of schema) {
      const colIdx = columnIndex[col.name];
      const value = colIdx !== undefined ? row[colIdx] : undefined;

      // Required check
      if (col.required && (!value || value.trim() === '')) {
        if (result.errors.length < maxErrors) {
          result.errors.push({
            row: rowNum,
            column: col.name,
            message: `Missing required value`,
            value: '',
          });
        }
        result.errorCount++;
        rowValid = false;
        continue;
      }

      // Type check (only if value exists)
      if (value && value.trim() !== '' && !validateType(value, col.type)) {
        if (result.errors.length < maxErrors) {
          result.errors.push({
            row: rowNum,
            column: col.name,
            message: `Invalid ${col.type} value`,
            value: value.substring(0, 50),
          });
        }
        result.errorCount++;
        rowValid = false;
      }
    }

    result.rowsParsed++;

    if (rowValid) {
      result.validRows++;

      // Build valid row data
      const validRow: Record<string, string | number | null> = {};
      for (const col of schema) {
        const colIdx = columnIndex[col.name];
        const value = colIdx !== undefined ? row[colIdx] : null;
        validRow[col.name] = value || null;
      }

      // Add to preview if under limit
      if (result.preview.length < maxPreview) {
        result.preview.push(validRow);
      }

      // Add ALL valid rows for promotion (D16B)
      result.validatedRows.push(validRow);
    }
  }

  // Determine final status
  if (result.errorCount > 0) {
    result.status = result.validRows > 0 ? 'warn' : 'fail';
  } else if (result.warningCount > 0) {
    result.status = 'warn';
  }

  return result;
}

// ============================================
// Display Helpers
// ============================================

export function getDatasetLabel(dataset: DatasetType): string {
  const labels: Record<DatasetType, string> = {
    campaigns: 'Campaigns',
    ad_sets: 'Ad Sets',
    ads: 'Ads',
    daily_metrics: 'Daily Metrics',
    alerts: 'Alerts',
  };
  return labels[dataset];
}

export function getPlatformLabel(platform: PlatformType): string {
  const labels: Record<PlatformType, string> = {
    meta: 'Meta',
    google: 'Google',
    tiktok: 'TikTok',
    linkedin: 'LinkedIn',
    other: 'Other',
  };
  return labels[platform];
}

export function getStatusColor(status: ValidationStatus): string {
  switch (status) {
    case 'pass':
      return 'text-green-600 dark:text-green-400';
    case 'warn':
      return 'text-amber-600 dark:text-amber-400';
    case 'fail':
      return 'text-red-600 dark:text-red-400';
  }
}

export function getStatusBgColor(status: ValidationStatus): string {
  switch (status) {
    case 'pass':
      return 'bg-green-50 dark:bg-green-950/30';
    case 'warn':
      return 'bg-amber-50 dark:bg-amber-950/30';
    case 'fail':
      return 'bg-red-50 dark:bg-red-950/30';
  }
}
