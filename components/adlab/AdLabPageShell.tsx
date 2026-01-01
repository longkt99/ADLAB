// ============================================
// AdLab Page Shell
// ============================================
// Consistent page header for all AdLab pages.
// Matches the existing PostsHeader pattern.

import React from 'react';

interface AdLabPageShellProps {
  title: string;
  description: string;
  badge?: {
    label: string;
    variant: 'info' | 'warning' | 'success';
  };
  actions?: React.ReactNode;
  children: React.ReactNode;
}

const badgeStyles = {
  info: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
  warning: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400',
  success: 'bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400',
};

export function AdLabPageShell({
  title,
  description,
  badge,
  actions,
  children,
}: AdLabPageShellProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-foreground tracking-tight">
              {title}
            </h1>
            {badge && (
              <span className={`px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded ${badgeStyles[badge.variant]}`}>
                {badge.label}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {description}
          </p>
        </div>
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>

      {/* Content */}
      {children}
    </div>
  );
}

export default AdLabPageShell;
