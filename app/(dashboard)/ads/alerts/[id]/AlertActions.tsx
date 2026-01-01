'use client';

import { useState, useTransition } from 'react';
import { markAlertReadAction, toggleAlertResolvedAction, updateAlertNoteAction } from '../actions';

// ============================================
// Action Button Component
// ============================================

interface ActionButtonProps {
  onClick: () => Promise<void>;
  disabled?: boolean;
  variant: 'primary' | 'secondary' | 'danger';
  children: React.ReactNode;
}

function ActionButton({ onClick, disabled, variant, children }: ActionButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    setError(null);
    startTransition(async () => {
      try {
        await onClick();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Action failed');
      }
    });
  };

  const baseStyles = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const variantStyles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600',
    secondary: 'bg-secondary text-foreground hover:bg-secondary/80',
    danger: 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600',
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleClick}
        disabled={disabled || isPending}
        className={`${baseStyles} ${variantStyles[variant]}`}
      >
        {isPending ? (
          <>
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Processing...
          </>
        ) : (
          children
        )}
      </button>
      {error && (
        <span className="text-[10px] text-red-500">{error}</span>
      )}
    </div>
  );
}

// ============================================
// Read/Unread Toggle
// ============================================

interface ReadToggleProps {
  alertId: string;
  isRead: boolean;
}

export function ReadToggle({ alertId, isRead }: ReadToggleProps) {
  const [currentIsRead, setCurrentIsRead] = useState(isRead);

  const handleToggle = async () => {
    const result = await markAlertReadAction(alertId, !currentIsRead);
    if (result.success) {
      setCurrentIsRead(!currentIsRead);
    } else {
      throw new Error(result.error || 'Failed to update');
    }
  };

  return (
    <ActionButton onClick={handleToggle} variant="secondary">
      {currentIsRead ? (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
          </svg>
          Mark as Unread
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Mark as Read
        </>
      )}
    </ActionButton>
  );
}

// ============================================
// Resolve/Reopen Toggle
// ============================================

interface ResolveToggleProps {
  alertId: string;
  resolvedAt: string | null;
}

export function ResolveToggle({ alertId, resolvedAt }: ResolveToggleProps) {
  const [isResolved, setIsResolved] = useState(!!resolvedAt);

  const handleToggle = async () => {
    const result = await toggleAlertResolvedAction(alertId, !isResolved);
    if (result.success) {
      setIsResolved(!isResolved);
    } else {
      throw new Error(result.error || 'Failed to update');
    }
  };

  return (
    <ActionButton onClick={handleToggle} variant={isResolved ? 'secondary' : 'primary'}>
      {isResolved ? (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Reopen
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Resolve
        </>
      )}
    </ActionButton>
  );
}

// ============================================
// Resolved Status Badge
// ============================================

interface ResolvedBadgeProps {
  resolvedAt: string | null;
}

export function ResolvedBadge({ resolvedAt }: ResolvedBadgeProps) {
  const [isResolved] = useState(!!resolvedAt);

  if (isResolved) {
    return (
      <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400">
        Resolved
      </span>
    );
  }

  return (
    <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
      Active
    </span>
  );
}

// ============================================
// Internal Note Editor
// ============================================

interface InternalNoteEditorProps {
  alertId: string;
  initialNote: string | null;
  updatedAt: string | null;
}

export function InternalNoteEditor({ alertId, initialNote, updatedAt }: InternalNoteEditorProps) {
  const [note, setNote] = useState(initialNote || '');
  const [savedNote, setSavedNote] = useState(initialNote || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(updatedAt ? new Date(updatedAt) : null);

  const handleBlur = async () => {
    // Only save if changed
    if (note === savedNote) return;

    setIsSaving(true);
    setError(null);

    try {
      const result = await updateAlertNoteAction(alertId, note);
      if (result.success) {
        setSavedNote(note);
        setLastSaved(new Date());
      } else {
        setError(result.error || 'Failed to save note');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save note');
    } finally {
      setIsSaving(false);
    }
  };

  const formatSavedTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-2">
      <textarea
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          // Clear error when user starts typing again
          if (error) setError(null);
        }}
        onBlur={handleBlur}
        placeholder="Add internal notes about this alert..."
        className="w-full min-h-[100px] p-3 text-sm bg-background border border-border rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        disabled={isSaving}
      />
      <div className="flex items-center justify-end gap-2 h-4 text-[9px]">
        {isSaving && (
          <span className="text-muted-foreground/70 flex items-center gap-1">
            <svg className="w-2.5 h-2.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Saving...
          </span>
        )}
        {error && !isSaving && (
          <span className="text-amber-600/70 dark:text-amber-400/70">Failed to save</span>
        )}
        {lastSaved && !isSaving && !error && (
          <span className="text-muted-foreground/60">
            Saved at {formatSavedTime(lastSaved)}
          </span>
        )}
      </div>
    </div>
  );
}
