'use client';

// ============================================
// AdLab Audit Trail Panel
// ============================================
// PHASE D19: Entity-specific audit trail display.
//
// Shows audit entries related to a specific entity.
// Used on snapshot detail and ingestion log detail pages.
// ============================================

import Link from 'next/link';
import {
  type AuditAction,
  type AuditLogEntry,
  getActionLabel,
  getActionSeverity,
} from '@/lib/adlab/audit';

interface AuditTrailPanelProps {
  entries: AuditLogEntry[];
  title?: string;
  emptyMessage?: string;
}

// Format date for display
function formatDateTime(dateString: string): string {
  try {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

// Severity badge component
function SeverityBadge({ action }: { action: AuditAction }) {
  const severity = getActionSeverity(action);

  const styles = {
    critical: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',
    warning: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
    info: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
  };

  return (
    <span
      className={`px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide rounded ${styles[severity]}`}
    >
      {getActionLabel(action)}
    </span>
  );
}

// Action icon component (compact)
function ActionIcon({ action }: { action: AuditAction }) {
  const iconClass = 'w-4 h-4';

  switch (action) {
    case 'ROLLBACK':
      return (
        <svg className={`${iconClass} text-red-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
        </svg>
      );
    case 'PROMOTE':
      return (
        <svg className={`${iconClass} text-green-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      );
    case 'SNAPSHOT_ACTIVATE':
      return (
        <svg className={`${iconClass} text-green-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'SNAPSHOT_DEACTIVATE':
      return (
        <svg className={`${iconClass} text-amber-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    case 'VALIDATE':
      return (
        <svg className={`${iconClass} text-blue-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'INGEST':
    default:
      return (
        <svg className={`${iconClass} text-blue-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      );
  }
}

export function AuditTrailPanel({
  entries,
  title = 'Audit Trail',
  emptyMessage = 'No audit entries for this entity.',
}: AuditTrailPanelProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {title}
        </h3>
        <Link
          href="/ads/audit"
          className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
        >
          View All →
        </Link>
      </div>

      {entries.length === 0 ? (
        <p className="text-[11px] text-muted-foreground text-center py-4">
          {emptyMessage}
        </p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex gap-3 p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
            >
              {/* Icon */}
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
                <ActionIcon action={entry.action} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <SeverityBadge action={entry.action} />
                  <span className="text-[10px] text-muted-foreground">
                    {formatDateTime(entry.created_at)}
                  </span>
                </div>

                {/* Reason (for rollbacks) */}
                {entry.reason && (
                  <p className="text-[10px] text-red-600 dark:text-red-400 truncate">
                    Reason: {entry.reason}
                  </p>
                )}

                {/* Actor */}
                <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-1">
                  <span>by</span>
                  <span className="font-mono">{entry.actor_id.slice(0, 8)}...</span>
                  <span className="px-1 py-0.5 rounded bg-secondary text-secondary-foreground uppercase">
                    {entry.actor_role}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
