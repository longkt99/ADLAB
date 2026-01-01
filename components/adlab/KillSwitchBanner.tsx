'use client';

// ============================================
// AdLab Kill-Switch Banner
// ============================================
// PHASE D22: Read-only UI indicator for kill-switch status.
//
// DISPLAY RULES:
// - Only visible when kill-switch is active
// - Shows reason and scope
// - No toggle/action - read-only
// - Fetches status on mount
// ============================================

import { useState, useEffect } from 'react';

interface KillSwitchStatus {
  blocked: boolean;
  scope?: 'global' | 'workspace';
  reason?: string;
}

export function KillSwitchBanner() {
  const [status, setStatus] = useState<KillSwitchStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch('/api/adlab/kill-switch/status');
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
        }
      } catch {
        // Fail silently - banner is informational only
      } finally {
        setLoading(false);
      }
    }

    fetchStatus();
  }, []);

  // Don't render anything while loading or if not blocked
  if (loading || !status?.blocked) {
    return null;
  }

  return (
    <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center flex-shrink-0">
          <svg
            className="w-4 h-4 text-red-600 dark:text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <div>
          <p className="text-[13px] font-medium text-red-700 dark:text-red-300">
            {status.scope === 'global'
              ? 'System Operations Paused'
              : 'Workspace Operations Paused'}
          </p>
          <p className="text-[11px] text-red-600/80 dark:text-red-400/80 mt-0.5">
            {status.reason || 'Administrative action in progress'}
          </p>
          <p className="text-[10px] text-red-600/60 dark:text-red-400/60 mt-1">
            Promotion and rollback actions are temporarily unavailable.
          </p>
        </div>
      </div>
    </div>
  );
}

export default KillSwitchBanner;
