'use client';

// ============================================
// Locked Issues Panel - Frozen Spec v2.1
// ============================================
// LOCKED state: Read-only issues list
// No actions that change content

import React from 'react';
import type { LockedIssue } from '@/types/assistantZone';

interface LockedIssuesPanelProps {
  issues: LockedIssue[];
}

export const LockedIssuesPanel: React.FC<LockedIssuesPanelProps> = ({ issues }) => {
  if (issues.length === 0) {
    return (
      <div className="px-3 py-2 bg-red-50/80 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30 rounded-lg">
        <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
          <span>⛔</span>
          <span>Blocked</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-2.5 bg-red-50/80 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30 rounded-lg">
      <div className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 mb-1.5">
        <span>⛔</span>
        <span>Blocked ({issues.length})</span>
      </div>
      <ul className="space-y-0.5">
        {issues.map((issue) => (
          <li key={issue.id} className="text-[11px] text-red-500 dark:text-red-400/80 pl-4">
            • {issue.message}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default LockedIssuesPanel;
