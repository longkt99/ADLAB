'use client';

// ============================================
// AdLab Promotion Panel
// ============================================
// Client component for promoting validated ingestion logs.
// PHASE D16B: Promotion UI with confirmation modal.
// PHASE D20: Role-based visibility (owner | admin only).
// PHASE D21: Role is server-provided for visibility only.

import { useState } from 'react';
import { canPerform, type AdLabRole } from '@/lib/adlab/auth/roles';

interface PromotionPanelProps {
  logId: string;
  status: 'pass' | 'warn' | 'fail';
  validRows: number;
  promotedAt: string | null;
  promotedBy: string | null;
  frozen: boolean;
  hasValidatedRows: boolean;
  datasetLabel: string;
  promoteEnabled: boolean;
  // D20: Role for permission check
  userRole?: AdLabRole;
}

export function PromotionPanel({
  logId,
  status,
  validRows,
  promotedAt,
  promotedBy,
  frozen,
  hasValidatedRows,
  datasetLabel,
  promoteEnabled,
  userRole = 'admin', // Default to admin for backwards compatibility
}: PromotionPanelProps) {
  const [showModal, setShowModal] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // D20: Check if role can perform PROMOTE action
  const hasPromotePermission = canPerform(userRole, 'PROMOTE');

  // Determine if promotion is possible
  const canPromoteLog =
    promoteEnabled &&
    hasPromotePermission &&
    (status === 'pass' || status === 'warn') &&
    validRows > 0 &&
    !promotedAt &&
    !frozen &&
    hasValidatedRows;

  // Get reason if cannot promote
  const getBlockReason = (): string | null => {
    if (!promoteEnabled) return 'Promotion feature is disabled';
    if (!hasPromotePermission) return 'Insufficient permissions to promote';
    if (status === 'fail') return 'Validation failed - cannot promote';
    if (validRows <= 0) return 'No valid rows to promote';
    if (promotedAt) return 'Already promoted';
    if (frozen) return 'Log is frozen';
    if (!hasValidatedRows) return 'No validated rows data available';
    return null;
  };

  const handlePromote = async () => {
    setIsPromoting(true);
    setError(null);

    try {
      // D21: No role or userId in request - server derives from session
      const response = await fetch('/api/adlab/ingestion/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Promotion failed');
      }

      setSuccess(true);
      setShowModal(false);

      // Refresh page after short delay to show updated status
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Promotion failed');
    } finally {
      setIsPromoting(false);
    }
  };

  // Already promoted state
  if (promotedAt) {
    return (
      <div className="rounded-xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 p-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
            <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-[13px] font-medium text-green-700 dark:text-green-300">
              Promoted to Production
            </p>
            <p className="text-[11px] text-green-600/70 dark:text-green-400/70">
              {new Date(promotedAt).toLocaleString()} {promotedBy && `by ${promotedBy}`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Success state (after promoting)
  if (success) {
    return (
      <div className="rounded-xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 p-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
            <svg className="w-4 h-4 text-green-600 dark:text-green-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-[13px] font-medium text-green-700 dark:text-green-300">
              Successfully promoted! Refreshing...
            </p>
          </div>
        </div>
      </div>
    );
  }

  const blockReason = getBlockReason();

  return (
    <>
      {/* Promotion Panel */}
      <div className="rounded-xl border border-border bg-card p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
              <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-medium text-foreground">
                Promote to Production
              </p>
              <p className="text-[11px] text-muted-foreground">
                {canPromoteLog
                  ? `${validRows} rows ready to import into ${datasetLabel}`
                  : blockReason}
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowModal(true)}
            disabled={!canPromoteLog}
            className={`px-4 py-2 rounded-lg text-[12px] font-medium transition-colors ${
              canPromoteLog
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-secondary text-muted-foreground cursor-not-allowed'
            }`}
          >
            {canPromoteLog ? 'Promote' : 'Unavailable'}
          </button>
        </div>

        {error && (
          <div className="mt-3 p-2 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-[11px]">
            {error}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !isPromoting && setShowModal(false)}
          />

          {/* Modal */}
          <div className="relative bg-card rounded-xl border border-border shadow-lg max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Confirm Promotion
            </h3>

            <p className="text-[13px] text-muted-foreground mb-4">
              You are about to promote <strong>{validRows} rows</strong> to the{' '}
              <strong>{datasetLabel}</strong> production table.
            </p>

            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 mb-4">
              <p className="text-[12px] text-amber-700 dark:text-amber-300 font-medium mb-1">
                This action cannot be undone
              </p>
              <ul className="text-[11px] text-amber-600 dark:text-amber-400 list-disc list-inside space-y-0.5">
                <li>Data will be written to production tables</li>
                <li>This log will be marked as frozen</li>
                <li>Re-promotion will not be possible</li>
              </ul>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                disabled={isPromoting}
                className="px-4 py-2 rounded-lg text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePromote}
                disabled={isPromoting}
                className="px-4 py-2 rounded-lg text-[12px] font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isPromoting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Promoting...
                  </>
                ) : (
                  'Confirm Promotion'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
