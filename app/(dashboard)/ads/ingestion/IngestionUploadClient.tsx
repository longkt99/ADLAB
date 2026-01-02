'use client';

// ============================================
// Ingestion Upload Client Component
// ============================================
// Handles CSV upload, validation, and preview.
// PHASE D16A: Dry-run validation only.

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  type DatasetType,
  type PlatformType,
  type ValidationResult,
  DATASET_SCHEMAS,
  getDatasetLabel,
  getPlatformLabel,
  getStatusColor,
  getStatusBgColor,
} from '@/lib/adlab/ingestion/validate';

interface IngestionUploadClientProps {
  workspaceId: string;
  workspaceName: string;
  clients: Array<{ id: string; name: string }>;
  isEnabled: boolean;
}

interface ValidationState {
  loading: boolean;
  result: ValidationResult | null;
  error: string | null;
  fileName: string | null;
  fileSize: number | null;
}

const DATASETS: DatasetType[] = ['campaigns', 'ad_sets', 'ads', 'daily_metrics', 'alerts'];
const PLATFORMS: PlatformType[] = ['meta', 'google', 'tiktok', 'linkedin', 'other'];

export function IngestionUploadClient({
  workspaceId,
  workspaceName,
  clients,
  isEnabled,
}: IngestionUploadClientProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [platform, setPlatform] = useState<PlatformType>('meta');
  const [dataset, setDataset] = useState<DatasetType>('campaigns');
  const [clientId, setClientId] = useState<string>('');
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationState>({
    loading: false,
    result: null,
    error: null,
    fileName: null,
    fileSize: null,
  });

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      setValidation({
        loading: false,
        result: null,
        error: 'Please upload a CSV file',
        fileName: file.name,
        fileSize: file.size,
      });
      return;
    }

    // Read file content
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setFileContent(content);
      setValidation({
        loading: false,
        result: null,
        error: null,
        fileName: file.name,
        fileSize: file.size,
      });
    };
    reader.onerror = () => {
      setValidation({
        loading: false,
        result: null,
        error: 'Failed to read file',
        fileName: file.name,
        fileSize: file.size,
      });
    };
    reader.readAsText(file);
  }, []);

  const handleValidate = useCallback(async () => {
    if (!fileContent) return;

    setValidation(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch('/api/adlab/ingestion/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: fileContent,
          dataset,
          platform,
          workspaceId,
          clientId: clientId || null,
          fileName: validation.fileName,
          fileSize: validation.fileSize,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setValidation(prev => ({
          ...prev,
          loading: false,
          error: data.error || 'Validation failed',
        }));
        return;
      }

      setValidation(prev => ({
        ...prev,
        loading: false,
        result: data.result,
        error: null,
      }));
    } catch (e) {
      setValidation(prev => ({
        ...prev,
        loading: false,
        error: e instanceof Error ? e.message : 'Unknown error',
      }));
    }
  }, [fileContent, dataset, platform, workspaceId, clientId, validation.fileName, validation.fileSize]);

  const handleReset = useCallback(() => {
    setFileContent(null);
    setValidation({
      loading: false,
      result: null,
      error: null,
      fileName: null,
      fileSize: null,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Feature flag disabled state
  if (!isEnabled) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
          <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-foreground mb-2">Ingestion Disabled</h3>
        <p className="text-[12px] text-muted-foreground">
          CSV ingestion is currently disabled. Contact your administrator to enable this feature.
        </p>
      </div>
    );
  }

  const schema = DATASET_SCHEMAS[dataset];

  return (
    <div className="space-y-6">
      {/* Configuration Section */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Upload Configuration</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Platform Dropdown */}
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">
              Platform
            </label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as PlatformType)}
              className="w-full h-9 px-3 rounded-lg border border-border bg-background text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {getPlatformLabel(p)}
                </option>
              ))}
            </select>
          </div>

          {/* Dataset Dropdown */}
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">
              Dataset
            </label>
            <select
              value={dataset}
              onChange={(e) => setDataset(e.target.value as DatasetType)}
              className="w-full h-9 px-3 rounded-lg border border-border bg-background text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {DATASETS.map((d) => (
                <option key={d} value={d}>
                  {getDatasetLabel(d)}
                </option>
              ))}
            </select>
          </div>

          {/* Client Dropdown (optional) */}
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">
              Client (optional)
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-border bg-background text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Schema Preview */}
        <div className="rounded-lg border border-border bg-secondary/30 p-4 mb-6">
          <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Required Columns for {getDatasetLabel(dataset)}
          </h4>
          <div className="flex flex-wrap gap-2">
            {schema.map((col) => (
              <span
                key={col.name}
                className={`px-2 py-0.5 rounded text-[11px] ${
                  col.required
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300'
                    : 'bg-secondary text-muted-foreground'
                }`}
                title={col.description}
              >
                {col.name}
                {col.required && <span className="text-red-500 ml-0.5">*</span>}
              </span>
            ))}
          </div>
        </div>

        {/* File Upload */}
        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
            id="csv-upload"
          />
          <label
            htmlFor="csv-upload"
            className="cursor-pointer block"
          >
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
              <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <p className="text-[13px] font-medium text-foreground mb-1">
              {validation.fileName || 'Click to upload CSV file'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {validation.fileSize
                ? `${(validation.fileSize / 1024).toFixed(1)} KB`
                : 'Maximum 100,000 rows'}
            </p>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={handleValidate}
            disabled={!fileContent || validation.loading}
            className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-colors ${
              !fileContent || validation.loading
                ? 'bg-secondary text-muted-foreground cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {validation.loading ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Validating...
              </span>
            ) : (
              'Validate & Preview (dry-run)'
            )}
          </button>

          {(validation.result || validation.error) && (
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              Reset
            </button>
          )}

          <button
            onClick={() => router.push('/ads/ingestion/logs')}
            className="ml-auto px-4 py-2 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            View Logs
          </button>
        </div>
      </div>

      {/* Error Display */}
      {validation.error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-[13px] font-medium text-red-700 dark:text-red-300">
                Validation Error
              </p>
              <p className="text-[12px] text-red-600 dark:text-red-400 mt-1">
                {validation.error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Validation Result */}
      {validation.result && (
        <div className="space-y-4">
          {/* Summary */}
          <div className={`rounded-xl border p-4 ${getStatusBgColor(validation.result.status)}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-sm font-semibold ${getStatusColor(validation.result.status)}`}>
                {validation.result.status === 'pass' && 'Validation Passed'}
                {validation.result.status === 'warn' && 'Validation Passed with Warnings'}
                {validation.result.status === 'fail' && 'Validation Failed'}
              </h3>
              <span className={`px-2 py-0.5 rounded text-[11px] font-medium uppercase ${getStatusColor(validation.result.status)}`}>
                {validation.result.status}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-lg font-semibold text-foreground">
                  {validation.result.rowsParsed}
                </div>
                <div className="text-[11px] text-muted-foreground">Rows Parsed</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                  {validation.result.validRows}
                </div>
                <div className="text-[11px] text-muted-foreground">Valid Rows</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-red-600 dark:text-red-400">
                  {validation.result.errorCount}
                </div>
                <div className="text-[11px] text-muted-foreground">Errors</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-amber-600 dark:text-amber-400">
                  {validation.result.warningCount}
                </div>
                <div className="text-[11px] text-muted-foreground">Warnings</div>
              </div>
            </div>
          </div>

          {/* Errors List */}
          {validation.result.errors.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h4 className="text-[12px] font-semibold text-foreground mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Errors ({validation.result.errors.length}{validation.result.errorCount > 50 ? ' of ' + validation.result.errorCount : ''})
              </h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {validation.result.errors.map((err, idx) => (
                  <div key={idx} className="text-[11px] text-red-600 dark:text-red-400 flex items-start gap-2">
                    <span className="text-muted-foreground min-w-[60px]">Row {err.row}</span>
                    <span className="font-medium min-w-[100px]">{err.column || 'General'}</span>
                    <span>{err.message}</span>
                    {err.value && <span className="text-muted-foreground truncate max-w-[100px]">({err.value})</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview Table */}
          {validation.result.preview.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="p-4 border-b border-border">
                <h4 className="text-[12px] font-semibold text-foreground">
                  Preview (first {validation.result.preview.length} valid rows)
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-secondary/50">
                    <tr>
                      {schema.map((col) => (
                        <th key={col.name} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">
                          {col.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {validation.result.preview.map((row, idx) => (
                      <tr key={idx} className="hover:bg-secondary/30">
                        {schema.map((col) => (
                          <td key={col.name} className="px-3 py-2 text-foreground whitespace-nowrap truncate max-w-[200px]">
                            {row[col.name] !== null ? String(row[col.name]) : <span className="text-muted-foreground">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Note about dry-run */}
          <div className="rounded-lg border border-border bg-secondary/30 p-4">
            <p className="text-[11px] text-muted-foreground flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              This is a dry-run validation. No data has been written to the database.
              {validation.result.status !== 'fail' && ' A log entry has been saved for reference.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
