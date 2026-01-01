'use client';

// ============================================
// Golden Intent Bar Component [DEPRECATED]
// ============================================
// @deprecated Use PurposeSelector instead for the new 2-stage layout
// This component uses horizontal scrolling which was replaced with
// wrapped pills in PurposeSelector for better UX
//
// Quick-access bar for high-frequency content creation intents
// Displays horizontally scrollable intent buttons with hover previews
// Supports disabled intents + auto-scroll to selected

import React, { useState, useRef, useEffect } from 'react';
import { GOLDEN_INTENTS, type GoldenIntent } from '@/lib/studio/golden/intentsRegistry';
import { resolveTemplateManifest } from '@/lib/studio/templates/resolveManifest';
import { useStudio } from '@/lib/studio/studioContext';

export const GoldenIntentBar: React.FC = () => {
  const { handleTemplateSelect, selectedTemplateId } = useStudio();
  const [hoveredIntent, setHoveredIntent] = useState<string | null>(null);

  // Refs for auto-scroll functionality
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Get ALL intents (enabled + disabled), sorted by order
  const intents = GOLDEN_INTENTS.sort((a, b) => a.order - b.order);

  // Auto-scroll selected intent into view when selectedTemplateId changes
  useEffect(() => {
    if (!selectedTemplateId || !scrollContainerRef.current) return;

    // Find the intent that matches the selected template
    const selectedIntent = intents.find(intent => intent.templateId === selectedTemplateId);
    if (!selectedIntent) return;

    // Get the button element for this intent
    const buttonElement = buttonRefs.current.get(selectedIntent.id);
    if (!buttonElement) return;

    // Check if button is out of view
    const container = scrollContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const buttonRect = buttonElement.getBoundingClientRect();

    // Calculate if button is outside visible area
    const isOutOfView =
      buttonRect.left < containerRect.left ||
      buttonRect.right > containerRect.right;

    // Scroll into view if needed
    if (isOutOfView) {
      buttonElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [selectedTemplateId, intents]);

  const handleIntentClick = (intent: GoldenIntent) => {
    // Only allow clicking enabled intents
    if (intent.enabled === false) return;

    // Select the template associated with this intent
    handleTemplateSelect(intent.templateId);
  };

  return (
    <div className="w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
      <div className="max-w-7xl mx-auto px-4 py-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            ⚡ Tạo Nội Dung Nhanh
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Chọn mục đích → Bắt đầu viết
          </span>
        </div>

        {/* Intent Buttons - Horizontal Scroll */}
        <div
          ref={scrollContainerRef}
          className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600"
        >
          {intents.map((intent) => {
            const isEnabled = intent.enabled !== false; // Default to enabled
            const isSelected = selectedTemplateId === intent.templateId && isEnabled;
            const manifest = isEnabled ? resolveTemplateManifest(intent.templateId) : null;

            // Badge: Show intent's badge OR "SOON" for disabled
            const badge = !isEnabled ? 'SOON' : intent.badge;

            return (
              <button
                key={intent.id}
                ref={(el) => {
                  if (el) {
                    buttonRefs.current.set(intent.id, el);
                  } else {
                    buttonRefs.current.delete(intent.id);
                  }
                }}
                onClick={() => handleIntentClick(intent)}
                onMouseEnter={() => setHoveredIntent(intent.id)}
                onMouseLeave={() => setHoveredIntent(null)}
                disabled={!isEnabled}
                className={`
                  relative flex-shrink-0 px-4 py-2.5 rounded-lg border transition-all
                  ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-400 text-blue-700 dark:text-blue-300'
                      : !isEnabled
                      ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-600 opacity-50 cursor-not-allowed'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }
                `}
                title={intent.description}
              >
                {/* Badge */}
                {badge && (
                  <span
                    className={`absolute -top-1 -right-1 px-1.5 py-0.5 text-[9px] font-bold rounded ${
                      !isEnabled
                        ? 'bg-amber-500 text-white'
                        : 'bg-red-500 text-white'
                    }`}
                  >
                    {badge}
                  </span>
                )}

                {/* Label */}
                <span className="text-sm font-medium whitespace-nowrap">
                  {intent.label}
                </span>

                {/* Hover Preview Tooltip - Enabled Intents */}
                {hoveredIntent === intent.id && isEnabled && manifest && (
                  <div className="absolute top-full left-0 mt-2 w-64 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {manifest.name}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                      {manifest.description}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-500">
                      Version: {manifest.version}
                    </div>
                  </div>
                )}

                {/* Hover Tooltip - Disabled Intents */}
                {hoveredIntent === intent.id && !isEnabled && (
                  <div className="absolute top-full left-0 mt-2 w-64 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg shadow-lg z-50">
                    <div className="text-xs font-semibold text-amber-900 dark:text-amber-200 mb-1">
                      Sắp Ra Mắt
                    </div>
                    <div className="text-xs text-amber-800 dark:text-amber-300 mb-2">
                      {intent.description}
                    </div>
                    <div className="text-[10px] text-amber-600 dark:text-amber-400">
                      Chưa có manifest cho template: <code className="font-mono">{intent.templateId}</code>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Empty State */}
        {intents.length === 0 && (
          <div className="text-center py-4 text-sm text-slate-500 dark:text-slate-400">
            Chưa có mục đích nào được kích hoạt
          </div>
        )}
      </div>
    </div>
  );
};
