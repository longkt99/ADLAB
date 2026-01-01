// ============================================
// AdLab Empty State
// ============================================
// Consistent empty state for AdLab pages.
// Follows the calm, professional tone.

import React from 'react';

interface AdLabEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function AdLabEmptyState({
  icon,
  title,
  description,
  action,
}: AdLabEmptyStateProps) {
  return (
    <div className="text-center py-16 bg-card rounded-xl border border-border">
      {icon ? (
        <div className="mx-auto w-12 h-12 bg-secondary rounded-full flex items-center justify-center mb-4">
          {icon}
        </div>
      ) : (
        <div className="mx-auto w-12 h-12 bg-secondary rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-6 h-6 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
        </div>
      )}
      <p className="text-[13px] text-muted-foreground mb-1">
        {title}
      </p>
      <p className="text-[12px] text-muted-foreground/70 mb-6 max-w-xs mx-auto">
        {description}
      </p>
      {action && (
        <div className="flex justify-center">
          {action}
        </div>
      )}
    </div>
  );
}

export default AdLabEmptyState;
