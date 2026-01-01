'use client';

// ============================================
// Purpose Selector Component
// ============================================
// Compact pill-based intent selector (replaces horizontal scroll bar)
// Uses wrapping flex layout - no horizontal scrollbar
// Trust-first styling with zinc-based neutrals

import React from 'react';
import { GOLDEN_INTENTS, type GoldenIntent } from '@/lib/studio/golden/intentsRegistry';
import { useStudio } from '@/lib/studio/studioContext';

export const PurposeSelector: React.FC = () => {
  const { handleTemplateSelect, selectedTemplateId } = useStudio();

  // Get enabled intents sorted by order
  const enabledIntents = GOLDEN_INTENTS
    .filter(intent => intent.enabled !== false)
    .sort((a, b) => a.order - b.order);

  const handleIntentClick = (intent: GoldenIntent) => {
    handleTemplateSelect(intent.templateId);
  };

  if (enabledIntents.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      {/* Label */}
      <div className="mb-3">
        <span className="text-[13px] font-medium tracking-wide text-zinc-500 dark:text-zinc-400">
          Mục đích
        </span>
      </div>

      {/* Wrapped Pills */}
      <div className="flex flex-wrap gap-2.5">
        {enabledIntents.map((intent) => {
          const isSelected = selectedTemplateId === intent.templateId;

          return (
            <button
              key={intent.id}
              onClick={() => handleIntentClick(intent)}
              className={`
                relative px-3.5 py-1.5 rounded-full text-[13px] font-medium
                transition-all duration-150 ease-out
                border
                ${
                  isSelected
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                    : 'bg-white dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-300 border-zinc-200/60 dark:border-zinc-700/50 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }
              `}
              title={intent.description}
            >
              {/* Badge (HOT, NEW) */}
              {intent.badge && (
                <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 text-[8px] font-bold rounded bg-amber-500 text-white leading-none">
                  {intent.badge}
                </span>
              )}

              {/* Label with emoji */}
              <span className="whitespace-nowrap">{intent.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PurposeSelector;
