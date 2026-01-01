// ============================================
// AdLab Ingestion Log Detail Page
// ============================================
// View individual ingestion log details.
// PHASE D16A: Read-only log viewer.
// PHASE D16B: Added promotion panel.
// PHASE D19: Audit trail display.

import Link from 'next/link';
import { AdLabPageShell, AdLabEmptyState, AdLabErrorBox, PromotionPanel, AuditTrailPanel } from '@/components/adlab';
import {
  getIngestionLogById,
  getDatasetLabel,
  getPlatformLabel,
  getStatusColor,
  getStatusBgColor,
  isPromoteEnabled,
  DATASET_SCHEMAS,
  type ValidationError,
} from '@/lib/adlab/ingestion';
import { getEntityAuditLogs } from '@/lib/adlab/audit';
import { resolveWorkspace } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Format date for display
function formatDateTime(dateString: string): string {
  try {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '—';
  }
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function IngestionLogDetailPage({ params }: PageProps) {
  const { id } = await params;

  // Resolve workspace first
  const { workspace } = await resolveWorkspace();
  const { data: log, error } = await getIngestionLogById(id);

  // Fetch audit entries for this log if we have workspace
  const { data: auditEntries } = workspace
    ? await getEntityAuditLogs(workspace.id, 'ingestion_log', id, 10)
    : { data: [] };

  if (error || !log) {
    return (
      <AdLabPageShell
        title="Ingestion Log"
        description="Log not found"
      >
        <AdLabErrorBox
          message={error || 'Log not found'}
          hint="The requested ingestion log could not be found."
        />
        <Link
          href="/ads/ingestion/logs"
          className="inline-block mt-4 px-4 py-2 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          Back to Logs
        </Link>
      </AdLabPageShell>
    );
  }

  const statusColor = getStatusColor(log.status);
  const statusBg = getStatusBgColor(log.status);
  const schema = DATASET_SCHEMAS[log.dataset] || [];
  const errors = (log.errors_json as ValidationError[]) || [];
  const preview = (log.preview_json as Record<string, unknown>[]) || [];

  return (
    <AdLabPageShell
      title="Ingestion Log Detail"
      description={`${getDatasetLabel(log.dataset)} validation from ${formatDateTime(log.created_at)}`}
    >
      {/* Back link */}
      <Link
        href="/ads/ingestion/logs"
        className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors -mt-2 mb-4"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Logs
      </Link>

      {/* Summary Card */}
      <div className={`rounded-xl border p-6 mb-6 ${statusBg}`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{log.file_name}</h2>
            <p className="text-[12px] text-muted-foreground mt-1">
              {formatDateTime(log.created_at)} • {formatFileSize(log.file_size)}
            </p>
          </div>
          <span className={`px-3 py-1 rounded text-[11px] font-medium uppercase ${statusColor} ${statusBg}`}>
            {log.status}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <div className="text-[11px] text-muted-foreground mb-1">Platform</div>
            <div className="text-[13px] font-medium text-foreground">{getPlatformLabel(log.platform)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground mb-1">Dataset</div>
            <div className="text-[13px] font-medium text-foreground">{getDatasetLabel(log.dataset)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground mb-1">Rows Parsed</div>
            <div className="text-[13px] font-medium text-foreground">{log.rows_parsed}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground mb-1">Valid Rows</div>
            <div className="text-[13px] font-medium text-green-600 dark:text-green-400">{log.valid_rows}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground mb-1">Errors</div>
            <div className="text-[13px] font-medium text-red-600 dark:text-red-400">{errors.length}</div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border/50">
          <p className="text-[12px] text-muted-foreground">{log.message}</p>
        </div>
      </div>

      {/* Promotion Panel (D16B) */}
      <PromotionPanel
        logId={log.id}
        status={log.status}
        validRows={log.valid_rows}
        promotedAt={log.promoted_at}
        promotedBy={log.promoted_by}
        frozen={log.frozen}
        hasValidatedRows={!!(log.validated_rows_json && log.validated_rows_json.length > 0)}
        datasetLabel={getDatasetLabel(log.dataset)}
        promoteEnabled={isPromoteEnabled()}
      />

      {/* Errors Section */}
      {errors.length > 0 && (
        <div className="rounded-xl border border-border bg-card mb-6">
          <div className="p-4 border-b border-border">
            <h3 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Validation Errors ({errors.length})
            </h3>
          </div>
          <div className="p-4 max-h-64 overflow-y-auto">
            <div className="space-y-2">
              {errors.map((err, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 text-[11px] py-2 border-b border-border/50 last:border-0"
                >
                  <span className="text-muted-foreground min-w-[60px]">Row {err.row}</span>
                  <span className="font-medium text-foreground min-w-[100px]">{err.column || 'General'}</span>
                  <span className="text-red-600 dark:text-red-400">{err.message}</span>
                  {err.value && (
                    <span className="text-muted-foreground ml-auto truncate max-w-[150px]" title={err.value}>
                      &quot;{err.value}&quot;
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Preview Section */}
      {preview.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="text-[13px] font-semibold text-foreground">
              Preview Data ({preview.length} rows)
            </h3>
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
                {preview.map((row, idx) => (
                  <tr key={idx} className="hover:bg-secondary/30">
                    {schema.map((col) => (
                      <td key={col.name} className="px-3 py-2 text-foreground whitespace-nowrap truncate max-w-[200px]">
                        {row[col.name] !== null && row[col.name] !== undefined
                          ? String(row[col.name])
                          : <span className="text-muted-foreground">—</span>
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty preview state */}
      {preview.length === 0 && errors.length === 0 && (
        <AdLabEmptyState
          title="No preview data"
          description="This log does not contain preview data."
        />
      )}

      {/* D19: Audit Trail */}
      <div className="mt-6">
        <AuditTrailPanel
          entries={auditEntries}
          title="Ingestion Log Audit Trail"
          emptyMessage="No audit entries for this ingestion log."
        />
      </div>
    </AdLabPageShell>
  );
}
