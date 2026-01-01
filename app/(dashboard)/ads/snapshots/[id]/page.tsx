// ============================================
// AdLab Snapshot Detail Page
// ============================================
// PHASE D18: Individual snapshot view with rollback capability.
// PHASE D19: Audit trail display.
//
// CORE PRINCIPLE:
// Production is not time-based.
// Production is snapshot-based.
// Rollback is a decision, not an accident.
// ============================================

import Link from 'next/link';
import { AdLabPageShell, AdLabErrorBox, RollbackPanel, AuditTrailPanel } from '@/components/adlab';
import {
  getSnapshotById,
  getActiveSnapshot,
  type ProductionSnapshot,
} from '@/lib/adlab/ingestion/snapshots';
import { getIngestionLogById } from '@/lib/adlab/ingestion/queries';
import { getDatasetLabel, getPlatformLabel } from '@/lib/adlab/ingestion';
import { resolveWorkspace } from '@/lib/supabase/server';
import { getSnapshotAuditTrail } from '@/lib/adlab/audit';

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

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SnapshotDetailPage({ params }: PageProps) {
  const { id } = await params;

  // Resolve workspace
  const { workspace, error: workspaceError } = await resolveWorkspace();

  if (!workspace) {
    return (
      <AdLabPageShell
        title="Snapshot Detail"
        description="Snapshot not found"
      >
        <AdLabErrorBox
          message={workspaceError || 'Unable to resolve workspace'}
          hint="Please check your authentication."
        />
      </AdLabPageShell>
    );
  }

  // Fetch snapshot
  const { data: snapshot, error: snapshotError } = await getSnapshotById(id);

  if (snapshotError || !snapshot) {
    return (
      <AdLabPageShell
        title="Snapshot Detail"
        description="Snapshot not found"
      >
        <AdLabErrorBox
          message={snapshotError || 'Snapshot not found'}
          hint="The requested snapshot could not be found."
        />
        <Link
          href="/ads/snapshots"
          className="inline-block mt-4 px-4 py-2 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          Back to Snapshots
        </Link>
      </AdLabPageShell>
    );
  }

  // Verify snapshot belongs to workspace
  if (snapshot.workspace_id !== workspace.id) {
    return (
      <AdLabPageShell
        title="Snapshot Detail"
        description="Access denied"
      >
        <AdLabErrorBox
          message="This snapshot does not belong to your workspace"
          hint="You do not have permission to view this snapshot."
        />
        <Link
          href="/ads/snapshots"
          className="inline-block mt-4 px-4 py-2 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          Back to Snapshots
        </Link>
      </AdLabPageShell>
    );
  }

  // Fetch related data
  const [{ data: ingestionLog }, { data: currentActive }, { data: auditEntries }] = await Promise.all([
    getIngestionLogById(snapshot.ingestion_log_id),
    getActiveSnapshot(snapshot.workspace_id, snapshot.platform, snapshot.dataset),
    getSnapshotAuditTrail(workspace.id, id, snapshot.ingestion_log_id, 10),
  ]);

  return (
    <AdLabPageShell
      title="Snapshot Detail"
      description={`${getPlatformLabel(snapshot.platform as any)} / ${getDatasetLabel(snapshot.dataset as any)}`}
      badge={snapshot.is_active ? { label: 'Active', variant: 'success' } : undefined}
    >
      {/* Back link */}
      <Link
        href="/ads/snapshots"
        className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors -mt-2 mb-4"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Snapshots
      </Link>

      {/* Analytics Binding Statement */}
      {snapshot.is_active ? (
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-[14px] font-semibold text-green-700 dark:text-green-300">
                Analytics is currently bound to this snapshot
              </p>
              <p className="text-[12px] text-green-600/80 dark:text-green-400/80">
                This snapshot defines the production truth for {getPlatformLabel(snapshot.platform as any)} {getDatasetLabel(snapshot.dataset as any)}.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-secondary/50 border border-border rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
              <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-[14px] font-semibold text-foreground">
                This snapshot is inactive
              </p>
              <p className="text-[12px] text-muted-foreground">
                Analytics queries do not use this snapshot. You can rollback to make this the active production snapshot.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Snapshot Metadata */}
      <div className="rounded-xl border border-border bg-card p-6 mb-6">
        <h2 className="text-[14px] font-semibold text-foreground mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
          </svg>
          Snapshot Information
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <div className="text-[11px] text-muted-foreground mb-1">Snapshot ID</div>
            <div className="text-[13px] font-mono text-foreground">{snapshot.id}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground mb-1">Platform</div>
            <div className="text-[13px] font-medium text-foreground">
              {getPlatformLabel(snapshot.platform as any)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground mb-1">Dataset</div>
            <div className="text-[13px] font-medium text-foreground">
              {getDatasetLabel(snapshot.dataset as any)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground mb-1">Status</div>
            <div className="text-[13px] font-medium">
              {snapshot.is_active ? (
                <span className="text-green-600 dark:text-green-400">Active</span>
              ) : (
                <span className="text-muted-foreground">Inactive</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground mb-1">Promoted At</div>
            <div className="text-[13px] text-foreground">
              {formatDateTime(snapshot.promoted_at)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground mb-1">Promoted By</div>
            <div className="text-[13px] text-foreground">
              {snapshot.promoted_by || '—'}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground mb-1">Created At</div>
            <div className="text-[13px] text-foreground">
              {formatDateTime(snapshot.created_at)}
            </div>
          </div>
          {snapshot.rolled_back_at && (
            <>
              <div>
                <div className="text-[11px] text-muted-foreground mb-1">Rolled Back At</div>
                <div className="text-[13px] text-amber-600 dark:text-amber-400">
                  {formatDateTime(snapshot.rolled_back_at)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground mb-1">Rollback Reason</div>
                <div className="text-[13px] text-foreground">
                  {snapshot.rollback_reason || '—'}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Source Ingestion Log */}
      <div className="rounded-xl border border-border bg-card p-6 mb-6">
        <h2 className="text-[14px] font-semibold text-foreground mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Source Ingestion Log
        </h2>

        {ingestionLog ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-[11px] text-muted-foreground mb-1">Log ID</div>
                <Link
                  href={`/ads/ingestion/logs/${ingestionLog.id}`}
                  className="text-[13px] font-mono text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {ingestionLog.id.slice(0, 8)}...
                </Link>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground mb-1">File Name</div>
                <div className="text-[13px] text-foreground truncate" title={ingestionLog.file_name}>
                  {ingestionLog.file_name}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground mb-1">Valid Rows</div>
                <div className="text-[13px] font-medium text-green-600 dark:text-green-400">
                  {ingestionLog.valid_rows}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground mb-1">Status</div>
                <div className="text-[13px] font-medium text-foreground uppercase">
                  {ingestionLog.status}
                </div>
              </div>
            </div>
            <Link
              href={`/ads/ingestion/logs/${ingestionLog.id}`}
              className="inline-flex items-center gap-1.5 text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
            >
              View full ingestion log
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        ) : (
          <p className="text-[12px] text-muted-foreground">
            Source ingestion log not found.
          </p>
        )}
      </div>

      {/* Rollback Panel */}
      <RollbackPanel
        snapshotId={snapshot.id}
        snapshotCreatedAt={snapshot.created_at}
        platform={snapshot.platform}
        dataset={snapshot.dataset}
        ingestionLogId={snapshot.ingestion_log_id}
        currentActiveSnapshotId={currentActive?.id || null}
        isActive={snapshot.is_active}
        userRole="admin" // TODO: Get from auth context
      />

      {/* Current Active Reference (if not this snapshot) */}
      {!snapshot.is_active && currentActive && (
        <div className="rounded-xl border border-border bg-card p-4 mt-6">
          <h3 className="text-[12px] font-semibold text-foreground mb-2">Current Active Snapshot</h3>
          <div className="flex items-center justify-between">
            <div className="text-[11px] text-muted-foreground">
              <span className="font-mono">{currentActive.id.slice(0, 8)}...</span>
              {' — '}
              promoted {formatDateTime(currentActive.promoted_at)}
            </div>
            <Link
              href={`/ads/snapshots/${currentActive.id}`}
              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
            >
              View Active Snapshot
            </Link>
          </div>
        </div>
      )}

      {/* D19: Audit Trail */}
      <div className="mt-6">
        <AuditTrailPanel
          entries={auditEntries}
          title="Snapshot Audit Trail"
          emptyMessage="No audit entries for this snapshot."
        />
      </div>
    </AdLabPageShell>
  );
}
