'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { type AdLabAlert } from '@/lib/adlab/types';
import {
  bulkMarkReadAction,
  bulkMarkUnreadAction,
  bulkResolveAction,
  bulkReopenAction,
} from './actions';

// ============================================
// Helpers
// ============================================

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

// ============================================
// Sub-components
// ============================================

function SeverityBadge({ severity, muted = false }: { severity: string; muted?: boolean }) {
  const styles: Record<string, string> = {
    critical: 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400',
    warning: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400',
    info: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
  };

  return (
    <span className={`px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded ${styles[severity] || styles.info} ${muted ? 'opacity-70' : ''}`}>
      {severity}
    </span>
  );
}

function StatusIndicator({ isRead, resolvedAt }: { isRead: boolean; resolvedAt?: string | null }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${!isRead ? 'bg-blue-500' : 'bg-secondary'}`} />
      <span className={`text-[11px] ${!isRead ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
        {isRead ? 'read' : 'unread'}
      </span>
      {resolvedAt && (
        <span
          title={`Resolved at ${formatDateTime(resolvedAt)}`}
          className="ml-1 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide rounded bg-green-50/80 text-green-600/80 dark:bg-green-950/20 dark:text-green-400/80 cursor-help"
        >
          resolved
        </span>
      )}
    </div>
  );
}

function PlatformBadge({ platform }: { platform: string | null }) {
  if (!platform) return <span className="text-muted-foreground">—</span>;

  const platformNames: Record<string, string> = {
    meta: 'Meta',
    google: 'Google',
    tiktok: 'TikTok',
    linkedin: 'LinkedIn',
  };

  return (
    <span className="px-2 py-0.5 text-[10px] bg-secondary text-secondary-foreground rounded">
      {platformNames[platform] || platform}
    </span>
  );
}

// ============================================
// Checkbox Component
// ============================================

function Checkbox({
  checked,
  indeterminate,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        ref={(el) => {
          if (el) el.indeterminate = indeterminate || false;
        }}
        onChange={onChange}
        className="w-4 h-4 rounded border-border text-blue-600 focus:ring-blue-500/20 focus:ring-offset-0 cursor-pointer"
        aria-label={label}
      />
    </label>
  );
}

// ============================================
// Bulk Action Bar
// ============================================

interface BulkActionBarProps {
  selectedIds: string[];
  alerts: AdLabAlert[];
  onClear: () => void;
  onSuccess: () => void;
}

function BulkActionBar({ selectedIds, alerts, onClear, onSuccess }: BulkActionBarProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  if (selectedIds.length === 0) return null;

  // Calculate which actions should be disabled
  const selectedAlerts = alerts.filter((a) => selectedIds.includes(a.id));
  const allRead = selectedAlerts.every((a) => a.is_read);
  const allUnread = selectedAlerts.every((a) => !a.is_read);
  const allResolved = selectedAlerts.every((a) => !!a.resolved_at);
  const allActive = selectedAlerts.every((a) => !a.resolved_at);

  const handleAction = async (
    action: 'markRead' | 'markUnread' | 'resolve' | 'reopen',
    actionFn: (ids: string[]) => Promise<{ success: boolean; error: string | null }>
  ) => {
    setError(null);
    setActiveAction(action);

    startTransition(async () => {
      const result = await actionFn(selectedIds);
      if (result.success) {
        onSuccess();
      } else {
        setError(result.error || 'Action failed');
      }
      setActiveAction(null);
    });
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-card border border-border rounded-xl shadow-lg px-4 py-3 flex items-center gap-3">
        {/* Selection count */}
        <span className="text-sm font-medium text-foreground whitespace-nowrap">
          {selectedIds.length} alert{selectedIds.length !== 1 ? 's' : ''} selected
        </span>

        <div className="w-px h-6 bg-border" />

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <BulkButton
            onClick={() => handleAction('markRead', bulkMarkReadAction)}
            disabled={allRead || isPending}
            loading={activeAction === 'markRead'}
          >
            Mark Read
          </BulkButton>

          <BulkButton
            onClick={() => handleAction('markUnread', bulkMarkUnreadAction)}
            disabled={allUnread || isPending}
            loading={activeAction === 'markUnread'}
          >
            Mark Unread
          </BulkButton>

          <BulkButton
            onClick={() => handleAction('resolve', bulkResolveAction)}
            disabled={allResolved || isPending}
            loading={activeAction === 'resolve'}
            variant="primary"
          >
            Resolve
          </BulkButton>

          <BulkButton
            onClick={() => handleAction('reopen', bulkReopenAction)}
            disabled={allActive || isPending}
            loading={activeAction === 'reopen'}
          >
            Reopen
          </BulkButton>
        </div>

        <div className="w-px h-6 bg-border" />

        {/* Clear button */}
        <button
          onClick={onClear}
          disabled={isPending}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          Clear
        </button>

        {/* Error message */}
        {error && (
          <>
            <div className="w-px h-6 bg-border" />
            <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80">{error}</span>
          </>
        )}
      </div>
    </div>
  );
}

function BulkButton({
  onClick,
  disabled,
  loading,
  variant = 'secondary',
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
}) {
  const baseStyles = 'px-2.5 py-1.5 text-[11px] font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 min-w-[70px] justify-center';
  const variantStyles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600',
    secondary: 'bg-secondary text-foreground hover:bg-secondary/80',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseStyles} ${variantStyles[variant]}`}
    >
      {loading ? (
        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : null}
      {children}
    </button>
  );
}

// ============================================
// Main Component
// ============================================

interface AlertsTableClientProps {
  alerts: AdLabAlert[];
}

export function AlertsTableClient({ alerts }: AlertsTableClientProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Reset selection when alerts change (after bulk action)
  useEffect(() => {
    // Keep selected IDs that still exist
    setSelectedIds((prev) => {
      const alertIds = new Set(alerts.map((a) => a.id));
      const filtered = new Set([...prev].filter((id) => alertIds.has(id)));
      return filtered.size === prev.size ? prev : filtered;
    });
  }, [alerts]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc to clear selection
      if (e.key === 'Escape' && selectedIds.size > 0) {
        e.preventDefault();
        setSelectedIds(new Set());
      }

      // Cmd/Ctrl + A to select all
      if ((e.metaKey || e.ctrlKey) && e.key === 'a' && !e.shiftKey) {
        // Only if focus is not in an input/textarea
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setSelectedIds(new Set(alerts.map((a) => a.id)));
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [alerts, selectedIds.size]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === alerts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(alerts.map((a) => a.id)));
    }
  }, [alerts, selectedIds.size]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  if (alerts.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">No alerts found</p>
      </div>
    );
  }

  const allSelected = selectedIds.size === alerts.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < alerts.length;

  return (
    <>
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-secondary/60">
              <tr>
                <th scope="col" className="px-4 py-3 text-left w-10">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={toggleSelectAll}
                    label="Select all alerts"
                  />
                </th>
                <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Severity</th>
                <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Platform</th>
                <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Message</th>
                <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Metric</th>
                <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Triggered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {alerts.map((alert) => {
                const isResolved = !!alert.resolved_at;
                const isSelected = selectedIds.has(alert.id);
                return (
                  <tr
                    key={alert.id}
                    className={`hover:bg-secondary/40 transition-colors ${isResolved ? 'bg-secondary/20' : ''} ${isSelected ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}
                  >
                    <td className="px-4 py-3.5 text-sm w-10">
                      <Checkbox
                        checked={isSelected}
                        onChange={() => toggleSelect(alert.id)}
                        label={`Select alert: ${alert.message}`}
                      />
                    </td>
                    <td className="px-4 py-3.5 text-sm">
                      <StatusIndicator isRead={alert.is_read} resolvedAt={alert.resolved_at} />
                    </td>
                    <td className="px-4 py-3.5 text-sm">
                      <SeverityBadge severity={alert.severity} muted={isResolved} />
                    </td>
                    <td className="px-4 py-3.5 text-sm">
                      <PlatformBadge platform={alert.platform} />
                    </td>
                    <td className="px-4 py-3.5 text-sm">
                      <Link
                        href={`/ads/alerts/${alert.id}`}
                        className={`font-medium truncate max-w-[300px] block hover:underline ${isResolved ? 'text-muted-foreground/70' : 'text-blue-600 dark:text-blue-400'}`}
                      >
                        {alert.message}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-sm">
                      <span className={isResolved ? 'text-muted-foreground/70 capitalize' : 'text-muted-foreground capitalize'}>{alert.metric_key || '—'}</span>
                    </td>
                    <td className="px-4 py-3.5 text-sm">
                      <span className={isResolved ? 'text-muted-foreground/70' : 'text-muted-foreground'}>{formatDateTime(alert.created_at)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedIds={[...selectedIds]}
        alerts={alerts}
        onClear={clearSelection}
        onSuccess={clearSelection}
      />
    </>
  );
}
