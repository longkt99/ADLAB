// ============================================
// AdLab Snapshot Management Page
// ============================================
// PHASE D18: Production snapshot management UI.
//
// CORE PRINCIPLE:
// Production truth is defined ONLY by the active snapshot.
// This page allows viewing and managing production snapshots.
//
// SAFETY: Read-only by default. Rollback requires explicit action.
// ============================================

import Link from 'next/link';
import { AdLabPageShell, AdLabEmptyState, AdLabErrorBox, AdLabContextBar } from '@/components/adlab';
import { getSnapshotHistory, type ProductionSnapshot } from '@/lib/adlab/ingestion/snapshots';
import { getDatasetLabel, getPlatformLabel, type PlatformType, type DatasetType } from '@/lib/adlab/ingestion';
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
    });
  } catch {
    return '—';
  }
}

// Group snapshots by platform and dataset
function groupSnapshots(snapshots: ProductionSnapshot[]): Map<string, ProductionSnapshot[]> {
  const grouped = new Map<string, ProductionSnapshot[]>();

  for (const snapshot of snapshots) {
    const key = `${snapshot.platform}:${snapshot.dataset}`;
    const existing = grouped.get(key) || [];
    existing.push(snapshot);
    grouped.set(key, existing);
  }

  return grouped;
}

// Status badge component
function StatusBadge({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return (
      <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
        Active
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded bg-secondary text-muted-foreground">
      Inactive
    </span>
  );
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SnapshotsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const showRollbackSuccess = params.rollback === 'success';

  // Resolve workspace
  const { workspace, error: workspaceError } = await resolveWorkspace();

  if (!workspace) {
    return (
      <AdLabPageShell
        title="Production Snapshots"
        description="Manage production data snapshots"
      >
        {workspaceError ? (
          <AdLabErrorBox
            message={workspaceError}
            hint="Unable to resolve workspace. Please check your authentication."
          />
        ) : (
          <AdLabEmptyState
            title="No workspace found"
            description="Create a workspace to manage production snapshots."
          />
        )}
      </AdLabPageShell>
    );
  }

  // Fetch snapshots and clients
  const [{ data: snapshots, error: snapshotsError }, { clients }] = await Promise.all([
    getSnapshotHistory(workspace.id),
    getWorkspaceClients(workspace.id),
  ]);

  // Group snapshots
  const groupedSnapshots = groupSnapshots(snapshots);

  return (
    <AdLabPageShell
      title="Production Snapshots"
      description="Manage production data snapshots and rollback"
      badge={{ label: 'Critical', variant: 'warning' }}
    >
      {/* Context Bar */}
      <AdLabContextBar
        workspaceName={workspace.name}
        clients={clients}
      />

      {/* Success Banner */}
      {showRollbackSuccess && (
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-[13px] font-medium text-green-700 dark:text-green-300">
              Rollback completed successfully. Analytics now reflects the new active snapshot.
            </p>
          </div>
        </div>
      )}

      {/* Warning Banner */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-[13px] font-medium text-amber-700 dark:text-amber-300">
              Production truth is defined by the active snapshot
            </p>
            <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-1">
              Each platform/dataset combination has exactly ONE active snapshot.
              Analytics queries are bound to the active snapshot.
              Rollback changes production data immediately.
            </p>
          </div>
        </div>
      </div>

      {snapshotsError && (
        <AdLabErrorBox
          message={snapshotsError}
          hint="Failed to load snapshots. Please try again."
        />
      )}

      {/* No Snapshots State */}
      {snapshots.length === 0 && !snapshotsError && (
        <AdLabEmptyState
          title="No production snapshots"
          description="Promote ingestion data to create your first production snapshot."
          icon={
            <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
          }
        />
      )}

      {/* Grouped Snapshots */}
      {Array.from(groupedSnapshots.entries()).map(([key, groupSnapshots]) => {
        const [platform, dataset] = key.split(':');
        const activeSnapshot = groupSnapshots.find((s) => s.is_active);

        return (
          <div key={key} className="mb-6">
            {/* Group Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-semibold text-foreground">
                  {getPlatformLabel(platform as PlatformType)} / {getDatasetLabel(dataset as DatasetType)}
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  ({groupSnapshots.length} snapshot{groupSnapshots.length !== 1 ? 's' : ''})
                </span>
              </div>
              {activeSnapshot && (
                <div className="flex items-center gap-2 text-[11px] text-green-600 dark:text-green-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Active: {activeSnapshot.id.slice(0, 8)}...</span>
                </div>
              )}
            </div>

            {/* Snapshots Table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-[12px]">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Snapshot ID</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Source Log</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Promoted At</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Promoted By</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Rolled Back</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {groupSnapshots.map((snapshot) => (
                    <tr
                      key={snapshot.id}
                      className={`hover:bg-secondary/30 ${
                        snapshot.is_active ? 'bg-green-50/50 dark:bg-green-950/20' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-foreground">
                          {snapshot.id.slice(0, 8)}...
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge isActive={snapshot.is_active} />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/ads/ingestion/logs/${snapshot.ingestion_log_id}`}
                          className="font-mono text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {snapshot.ingestion_log_id.slice(0, 8)}...
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateTime(snapshot.promoted_at)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {snapshot.promoted_by || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {snapshot.rolled_back_at ? (
                          <span className="text-amber-600 dark:text-amber-400">
                            {formatDateTime(snapshot.rolled_back_at)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/ads/snapshots/${snapshot.id}`}
                          className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Help Text */}
      <div className="bg-card rounded-xl border border-border p-4 mt-6">
        <h4 className="text-[12px] font-semibold text-foreground mb-2">About Production Snapshots</h4>
        <ul className="text-[11px] text-muted-foreground space-y-1">
          <li>• Each snapshot represents a point-in-time view of promoted data</li>
          <li>• Only ONE snapshot can be active per platform/dataset combination</li>
          <li>• Rolling back changes which data analytics queries return</li>
          <li>• Data is never deleted — rollback only changes the active snapshot</li>
          <li>• Only workspace owners and admins can perform rollback</li>
        </ul>
      </div>
    </AdLabPageShell>
  );
}
