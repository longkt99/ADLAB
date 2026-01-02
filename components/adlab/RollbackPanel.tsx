'use client';

// ============================================
// AdLab Rollback Panel
// ============================================
// PHASE D18: Production snapshot rollback UI.
// PHASE D20: Role-based visibility (owner ONLY for rollback).
// PHASE D21: Role is server-provided for visibility only.
//
// CRITICAL SAFETY RULES:
// - Visible ONLY if user role is owner (D20: most dangerous action)
// - Visible ONLY if snapshot is NOT active
// - Requires explicit confirmation by typing "ROLLBACK"
// - Shows irreversible warning
// - NO silent failure
//
// CORE PRINCIPLE:
// Rollback is a decision, not an accident.
// ============================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { canPerform, type AdLabRole } from '@/lib/adlab/auth/roles';

interface RollbackPanelProps {
  snapshotId: string;
  snapshotCreatedAt: string;
  platform: string;
  dataset: string;
  ingestionLogId: string;
  currentActiveSnapshotId: string | null;
  isActive: boolean;
  // D20: Role for permission check
  userRole?: AdLabRole;
}

export function RollbackPanel({
  snapshotId,
  snapshotCreatedAt,
  platform,
  dataset,
  ingestionLogId,
  currentActiveSnapshotId,
  isActive,
  userRole = 'owner', // Default to owner for backwards compatibility
}: RollbackPanelProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [reason, setReason] = useState('');
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // D20: Check if role can perform ROLLBACK action (owner ONLY)
  const hasRollbackPermission = canPerform(userRole, 'ROLLBACK');

  // Rollback is only available for owner on inactive snapshots
  const canRollback = !isActive && hasRollbackPermission;
  const confirmationValid = confirmText === 'ROLLBACK' && reason.trim().length > 0;

  const handleRollback = async () => {
    if (!confirmationValid) return;

    setIsRollingBack(true);
    setError(null);

    try {
      const response = await fetch('/api/adlab/snapshots/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // D21: No role in request - server derives from session
        body: JSON.stringify({
          snapshotId,
          reason: reason.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Rollback failed');
      }

      // Success - redirect to snapshots list
      setShowModal(false);
      router.push('/ads/snapshots?rollback=success');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rollback failed');
    } finally {
      setIsRollingBack(false);
    }
  };

  // Don't render if user cannot rollback
  if (!canRollback) {
    if (isActive) {
      return (
        <div className="rounded-xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
              <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-medium text-green-700 dark:text-green-300">
                Active Production Snapshot
              </p>
              <p className="text-[11px] text-green-600/70 dark:text-green-400/70">
                Analytics is currently bound to this snapshot. This is the production truth.
              </p>
            </div>
          </div>
        </div>
      );
    }

    // D20: ROLLBACK is owner-only (most dangerous action)
    if (!hasRollbackPermission) {
      return (
        <div className="rounded-xl border border-border bg-secondary/30 p-4">
          <p className="text-[12px] text-muted-foreground">
            Only workspace owners can perform rollback operations.
          </p>
        </div>
      );
    }

    return null;
  }

  return (
    <>
      {/* Rollback Panel */}
      <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
              <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-medium text-red-700 dark:text-red-300">
                Rollback Production Snapshot
              </p>
              <p className="text-[11px] text-red-600/70 dark:text-red-400/70">
                Make this snapshot the active production truth
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-lg text-[12px] font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            Rollback Production Snapshot
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !isRollingBack && setShowModal(false)}
          />

          {/* Modal */}
          <div className="relative bg-card rounded-xl border border-border shadow-lg max-w-lg w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Confirm Production Rollback
            </h3>

            {/* Warning Banner */}
            <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg p-3 mb-4">
              <p className="text-[12px] text-red-700 dark:text-red-300 font-medium mb-1">
                This action will change production data immediately
              </p>
              <p className="text-[11px] text-red-600 dark:text-red-400">
                All analytics will immediately reflect the selected snapshot.
                This is an irreversible operation.
              </p>
            </div>

            {/* Snapshot Summary */}
            <div className="bg-secondary/50 rounded-lg p-3 mb-4 space-y-2">
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Current Active:</span>
                <span className="font-mono text-foreground">
                  {currentActiveSnapshotId?.slice(0, 8) || 'None'}...
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Target Snapshot:</span>
                <span className="font-mono text-foreground font-medium">
                  {snapshotId.slice(0, 8)}...
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Platform:</span>
                <span className="text-foreground capitalize">{platform}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Dataset:</span>
                <span className="text-foreground">{dataset}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Created:</span>
                <span className="text-foreground">
                  {new Date(snapshotCreatedAt).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Source Log:</span>
                <span className="font-mono text-foreground">{ingestionLogId.slice(0, 8)}...</span>
              </div>
            </div>

            {/* Reason Input */}
            <div className="mb-4">
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                Rollback Reason (required)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why you are rolling back..."
                disabled={isRollingBack}
                className="w-full px-3 py-2 text-[12px] rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none"
                rows={2}
              />
            </div>

            {/* Confirmation Input */}
            <div className="mb-4">
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                Type <span className="font-mono font-bold text-red-500">ROLLBACK</span> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="ROLLBACK"
                disabled={isRollingBack}
                className="w-full px-3 py-2 text-[12px] rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-red-500/50 font-mono"
              />
            </div>

            {/* Error Display */}
            {error && (
              <div className="mb-4 p-2 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-[11px]">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                disabled={isRollingBack}
                className="px-4 py-2 rounded-lg text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRollback}
                disabled={!confirmationValid || isRollingBack}
                className="px-4 py-2 rounded-lg text-[12px] font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isRollingBack ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Rolling Back...
                  </>
                ) : (
                  'Execute Rollback'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
