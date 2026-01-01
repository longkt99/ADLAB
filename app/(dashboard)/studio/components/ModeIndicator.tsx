// ============================================
// Mode Indicator Component
// ============================================
// Displays supported execution modes (A/B/C) with visual indicators

import React from 'react';
import type { TemplateUIMetadata } from '@/lib/studio/templates/templateSchema';

interface ModeIndicatorProps {
  ui: TemplateUIMetadata;
  variant?: 'compact' | 'expanded';
}

export function ModeIndicator({ ui, variant = 'compact' }: ModeIndicatorProps) {
  const modes = [
    { key: 'abstract', label: 'A', title: 'Abstract Mode' },
    { key: 'structured', label: 'B', title: 'Structured Mode' },
    { key: 'generic', label: 'C', title: 'Generic Mode' },
  ] as const;

  if (variant === 'compact') {
    return (
      <div className="inline-flex items-center gap-0.5">
        {modes.map((mode) => {
          const isSupported = ui.supportedModes[mode.key];
          const isDefault = ui.defaultMode === mode.key;

          return (
            <div
              key={mode.key}
              className={`
                flex items-center justify-center w-4 h-4 rounded text-[9px] font-bold
                transition-colors
                ${
                  isSupported
                    ? isDefault
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
                }
              `}
              title={`${mode.title}${isDefault ? ' (Default)' : ''}${!isSupported ? ' (Not Supported)' : ''}`}
            >
              {mode.label}
            </div>
          );
        })}
      </div>
    );
  }

  // Expanded variant
  return (
    <div className="flex flex-wrap gap-1">
      {modes.map((mode) => {
        const isSupported = ui.supportedModes[mode.key];
        const isDefault = ui.defaultMode === mode.key;

        if (!isSupported) return null;

        return (
          <div
            key={mode.key}
            className={`
              inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium
              ${
                isDefault
                  ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                  : 'bg-gray-500/10 text-gray-600 border border-gray-500/20'
              }
            `}
            title={mode.title}
          >
            <span className="font-bold">{mode.label}</span>
            <span>{mode.key}</span>
            {isDefault && <span className="text-[8px]">●</span>}
          </div>
        );
      })}
    </div>
  );
}
