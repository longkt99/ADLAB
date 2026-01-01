// ============================================
// AdLab Audit Timeline Page
// ============================================
// PHASE D19: Read-only audit trail for high-risk actions.
//
// CORE PRINCIPLE:
// If it can change production, it must leave a trail.
//
// Features:
// - Timeline view of all audit entries
// - Filter by action, entity type, date range
// - Severity badges for critical actions
// - Links to related entities
// ============================================

import Link from 'next/link';
import { AdLabPageShell, AdLabEmptyState, AdLabErrorBox, AdLabContextBar } from '@/components/adlab';
import {
  getAuditLogs,
  getActionLabel,
  getActionSeverity,
  getEntityTypeLabel,
  type AuditAction,
  type AuditEntityType,
  type AuditLogEntry,
} from '@/lib/adlab/audit';
import { getPlatformLabel, getDatasetLabel } from '@/lib/adlab/ingestion';
import { resolveWorkspace, getWorkspaceClients } from '@/lib/supabase/server';

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
      className={`px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded ${styles[severity]}`}
    >
      {getActionLabel(action)}
    </span>
  );
}

// Action icon component
function ActionIcon({ action }: { action: AuditAction }) {
  const iconClass = 'w-5 h-5';

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

// Entity link component
function EntityLink({ entry }: { entry: AuditLogEntry }) {
  if (entry.entity_type === 'snapshot') {
    return (
      <Link
        href={`/ads/snapshots/${entry.entity_id}`}
        className="text-blue-600 dark:text-blue-400 hover:underline font-mono text-[11px]"
      >
        {entry.entity_id.slice(0, 8)}...
      </Link>
    );
  }

  if (entry.entity_type === 'ingestion_log') {
    return (
      <Link
        href={`/ads/ingestion/logs/${entry.entity_id}`}
        className="text-blue-600 dark:text-blue-400 hover:underline font-mono text-[11px]"
      >
        {entry.entity_id.slice(0, 8)}...
      </Link>
    );
  }

  return <span className="font-mono text-[11px]">{entry.entity_id.slice(0, 8)}...</span>;
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AuditTimelinePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const actionFilter = params.action as AuditAction | undefined;
  const entityTypeFilter = params.entityType as AuditEntityType | undefined;

  // Resolve workspace
  const { workspace, error: workspaceError } = await resolveWorkspace();

  if (!workspace) {
    return (
      <AdLabPageShell
        title="Audit Trail"
        description="Production action history"
      >
        {workspaceError ? (
          <AdLabErrorBox
            message={workspaceError}
            hint="Unable to resolve workspace. Please check your authentication."
          />
        ) : (
          <AdLabEmptyState
            title="No workspace found"
            description="Create a workspace to view audit trail."
          />
        )}
      </AdLabPageShell>
    );
  }

  // Fetch audit logs and clients
  const [{ data: auditLogs, error: auditError }, { clients }] = await Promise.all([
    getAuditLogs({
      workspaceId: workspace.id,
      action: actionFilter,
      entityType: entityTypeFilter,
      limit: 100,
    }),
    getWorkspaceClients(workspace.id),
  ]);

  return (
    <AdLabPageShell
      title="Audit Trail"
      description="Immutable log of high-risk production actions"
      badge={{ label: 'Read-Only', variant: 'info' }}
    >
      {/* Context Bar */}
      <AdLabContextBar
        workspaceName={workspace.name}
        clients={clients}
      />

      {/* Info Banner */}
      <div className="bg-secondary/50 border border-border rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-muted-foreground mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-[13px] font-medium text-foreground">
              Immutable Audit Trail
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Every production-impacting action is logged here. Records cannot be edited or deleted.
              Use this trail for compliance, debugging, and understanding system history.
            </p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Link
          href="/ads/audit"
          className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
            !actionFilter && !entityTypeFilter
              ? 'bg-foreground text-background'
              : 'bg-secondary text-muted-foreground hover:text-foreground'
          }`}
        >
          All
        </Link>
        <Link
          href="/ads/audit?action=ROLLBACK"
          className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
            actionFilter === 'ROLLBACK'
              ? 'bg-red-600 text-white'
              : 'bg-secondary text-muted-foreground hover:text-foreground'
          }`}
        >
          Rollbacks
        </Link>
        <Link
          href="/ads/audit?action=PROMOTE"
          className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
            actionFilter === 'PROMOTE'
              ? 'bg-green-600 text-white'
              : 'bg-secondary text-muted-foreground hover:text-foreground'
          }`}
        >
          Promotions
        </Link>
        <Link
          href="/ads/audit?action=VALIDATE"
          className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
            actionFilter === 'VALIDATE'
              ? 'bg-blue-600 text-white'
              : 'bg-secondary text-muted-foreground hover:text-foreground'
          }`}
        >
          Validations
        </Link>
        <Link
          href="/ads/audit?entityType=snapshot"
          className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
            entityTypeFilter === 'snapshot'
              ? 'bg-foreground text-background'
              : 'bg-secondary text-muted-foreground hover:text-foreground'
          }`}
        >
          Snapshots
        </Link>
      </div>

      {auditError && (
        <AdLabErrorBox
          message={auditError}
          hint="Failed to load audit logs. Please try again."
        />
      )}

      {/* No Logs State */}
      {auditLogs.length === 0 && !auditError && (
        <AdLabEmptyState
          title="No audit entries"
          description="Audit entries will appear here as actions are performed."
          icon={
            <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
      )}

      {/* Audit Timeline */}
      {auditLogs.length > 0 && (
        <div className="space-y-4">
          {auditLogs.map((entry, index) => (
            <div
              key={entry.id}
              className={`relative flex gap-4 ${
                index < auditLogs.length - 1 ? 'pb-4' : ''
              }`}
            >
              {/* Timeline line */}
              {index < auditLogs.length - 1 && (
                <div className="absolute left-5 top-10 bottom-0 w-px bg-border" />
              )}

              {/* Icon */}
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center z-10">
                <ActionIcon action={entry.action} />
              </div>

              {/* Content */}
              <div className="flex-1 rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex items-center gap-2">
                    <SeverityBadge action={entry.action} />
                    <span className="text-[11px] text-muted-foreground">
                      {getEntityTypeLabel(entry.entity_type)}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatDateTime(entry.created_at)}
                  </span>
                </div>

                {/* Scope */}
                <div className="flex flex-wrap gap-2 mb-2 text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                    {getPlatformLabel(entry.scope.platform as any)}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                    {getDatasetLabel(entry.scope.dataset as any)}
                  </span>
                </div>

                {/* Entity Link */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] text-muted-foreground">Entity:</span>
                  <EntityLink entry={entry} />
                </div>

                {/* Reason (for rollbacks) */}
                {entry.reason && (
                  <div className="mt-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
                    <span className="text-[11px] font-medium text-red-700 dark:text-red-300">
                      Reason: {entry.reason}
                    </span>
                  </div>
                )}

                {/* Metadata */}
                {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2 text-[10px]">
                    {Object.entries(entry.metadata).map(([key, value]) => (
                      <div key={key} className="bg-secondary/50 rounded px-2 py-1">
                        <span className="text-muted-foreground">{key}: </span>
                        <span className="text-foreground">
                          {typeof value === 'string' && value.length > 20
                            ? `${value.slice(0, 8)}...`
                            : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actor */}
                <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>Actor:</span>
                  <span className="font-mono">{entry.actor_id.slice(0, 8)}...</span>
                  <span className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground uppercase">
                    {entry.actor_role}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Help Text */}
      <div className="bg-card rounded-xl border border-border p-4 mt-6">
        <h4 className="text-[12px] font-semibold text-foreground mb-2">About Audit Trail</h4>
        <ul className="text-[11px] text-muted-foreground space-y-1">
          <li>• Every production-impacting action creates an immutable audit record</li>
          <li>• Records include who performed the action, when, and why (for rollbacks)</li>
          <li>• Critical actions like Rollback are highlighted for visibility</li>
          <li>• Click on entity IDs to view the related snapshot or ingestion log</li>
          <li>• Audit records cannot be modified or deleted — ever</li>
        </ul>
      </div>
    </AdLabPageShell>
  );
}
