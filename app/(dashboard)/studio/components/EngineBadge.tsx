// ============================================
// Engine Badge Component
// ============================================
// Displays template engine version and compliance level

import React from 'react';
import type { TemplateUIMetadata } from '@/lib/studio/templates/templateSchema';

interface EngineBadgeProps {
  ui: TemplateUIMetadata;
  size?: 'sm' | 'md';
}

export function EngineBadge({ ui, size = 'sm' }: EngineBadgeProps) {
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
  };

  const complianceColors = {
    'v2.3.1-certified': 'bg-green-500/10 text-green-600 border-green-500/20',
    'v2.3-certified': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    'legacy': 'bg-gray-500/10 text-gray-600 border-gray-500/20',
  };

  const colorClass = ui.complianceLevel
    ? complianceColors[ui.complianceLevel]
    : complianceColors['legacy'];

  return (
    <div
      className={`inline-flex items-center gap-1 rounded border font-medium ${sizeClasses[size]} ${colorClass}`}
      title={ui.engineCodeName || `Engine ${ui.engineVersion}`}
    >
      <svg
        className="w-3 h-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>{ui.engineVersion}</span>
    </div>
  );
}
