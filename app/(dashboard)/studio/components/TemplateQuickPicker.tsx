'use client';

// ============================================
// Template Quick Picker - Horizontal Chips
// ============================================
// Compact horizontal template selector for left column
// Replaces vertical TemplateSelector with chips-style design

import { useState, useRef } from 'react';
import { listAllTemplates, getTemplateById } from '@/lib/studio/templateLoader';
import { TemplateExplorer } from './TemplateExplorer';
import { PlatformChips } from './PlatformChips';
import { ModeIndicator } from './ModeIndicator';
import type { TemplateUIMetadata } from '@/lib/studio/templates/templateSchema';
import { useTranslation } from '@/lib/i18n';
import { useSeenState } from '@/lib/ui/seenState';

// Category icons mapping (labels now fetched from i18n)
const CATEGORY_ICONS: Record<string, string> = {
  ideation: '💡',
  content_creation: '✍️',
  analytical: '📊',
  optimization: '⚡',
};

interface TemplateQuickPickerProps {
  selectedTemplateId: string | null;
  onSelectTemplate: (templateId: string | null) => void;
}

export default function TemplateQuickPicker({
  selectedTemplateId,
  onSelectTemplate,
}: TemplateQuickPickerProps) {
  const { t } = useTranslation();
  const templates = listAllTemplates();
  const [explorerOpen, setExplorerOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Seen-state for script chip hover tooltip (show first 3 times)
  const scriptChipHoverHint = useSeenState({
    key: 'studio:onboarding:scriptChipHover',
    storage: 'local',
    maxShows: 3,
  });

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -240 : 240,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="hidden">
      {/* Section Header */}
      <div className="flex items-center justify-between gap-3 mb-1.5 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-shrink">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
            Bước 1 · Mẫu Prompt
          </h4>
          {/* Info Icon with Tooltip */}
          <div className="group/info relative flex-shrink-0">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 cursor-help">ℹ️</span>
            <div className="absolute left-0 top-full mt-1 hidden group-hover/info:block z-10 w-max max-w-xs">
              <div className="px-2 py-1 text-[9px] text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-lg leading-tight">
                Khung tạo nội dung có cấu trúc, không phải mẫu thiết kế.
              </div>
            </div>
          </div>
        </div>

        {/* View All Templates Button - Fixed Right */}
        <button
          onClick={() => setExplorerOpen(true)}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-950/50 rounded-lg transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
        >
          <span>📂</span>
          <span>{t('studio.templateMeta.actions.viewAll')}</span>
        </button>
      </div>

      {/* Horizontal Scrollable Chips with Navigation */}
      <div className="relative group/scroll w-full min-w-0">
        {/* Left Scroll Button */}
        <button
          onClick={() => handleScroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 flex items-center justify-center bg-white/95 dark:bg-slate-900/95 border border-gray-200 dark:border-slate-700 rounded-full shadow-md opacity-0 group-hover/scroll:opacity-100 hover:bg-white dark:hover:bg-slate-800 transition-opacity duration-200 cursor-pointer focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Scroll left"
          type="button"
        >
          <svg className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Right Scroll Button */}
        <button
          onClick={() => handleScroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 flex items-center justify-center bg-white/95 dark:bg-slate-900/95 border border-gray-200 dark:border-slate-700 rounded-full shadow-md opacity-0 group-hover/scroll:opacity-100 hover:bg-white dark:hover:bg-slate-800 transition-opacity duration-200 cursor-pointer focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Scroll right"
          type="button"
        >
          <svg className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Left Gradient Fade */}
        <div className="absolute left-0 top-0 bottom-2 w-6 bg-gradient-to-r from-white dark:from-slate-950 to-transparent pointer-events-none z-[5]" />

        {/* Right Gradient Fade */}
        <div className="absolute right-0 top-0 bottom-2 w-6 bg-gradient-to-l from-white dark:from-slate-950 to-transparent pointer-events-none z-[5]" />

        {/* Scrollable Container */}
        <div
          ref={scrollContainerRef}
          className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide w-full"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {/* Default/Clear Chip (when template is selected) */}
          {selectedTemplateId && (
            <button
              onClick={() => onSelectTemplate(null)}
              className="flex-shrink-0 px-3 py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
              title={t('studio.templateMeta.actions.useDefault')}
              type="button"
            >
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                ✕ {t('studio.templateMeta.actions.useDefault')}
              </span>
            </button>
          )}

          {/* Template Chips */}
          {templates.map((template) => {
            const isSelected = selectedTemplateId === template.id;
            const isInvalid = !template.isValid;

            // Get full template data for richer metadata
            let uiMetadata: TemplateUIMetadata | undefined;
            let fullTemplateData;
            try {
              fullTemplateData = getTemplateById(template.id);
              uiMetadata = fullTemplateData.template.ui;
            } catch (_error) {
              uiMetadata = undefined;
            }

            // Use i18n keys if available, otherwise fallback to template name/description
            const nameKey = fullTemplateData?.template.nameKey;
            const descriptionKey = fullTemplateData?.template.descriptionKey;
            const displayName = nameKey ? (t(nameKey) || template.name) : template.name;
            const displayDescription = descriptionKey ? (t(descriptionKey) || template.description) : template.description;

            const categoryIcon = CATEGORY_ICONS[template.category] || '📄';
            const categoryLabel = t(`studio.templateMeta.categories.${template.category}`) || template.category;

            return (
              <button
                key={template.id}
                onClick={() => onSelectTemplate(template.id)}
                onMouseEnter={() => {
                  // Mark as seen on first 3 hovers
                  if (scriptChipHoverHint.shouldShow) {
                    scriptChipHoverHint.markSeen();
                  }
                }}
                disabled={isInvalid}
                title={displayName}
                type="button"
                className={`
                  flex-shrink-0 group/chip relative px-3 py-2.5 rounded-lg border transition-all duration-200 max-w-[300px] min-h-[68px]
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950
                  ${isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 ring-2 ring-inset ring-blue-500/30 shadow-sm'
                    : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:border-sky-400 dark:hover:border-sky-500/50 hover:shadow-md opacity-70 hover:opacity-100'
                  }
                  ${isInvalid ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {/* 2-Line Chip Content */}
                <div className="flex flex-col gap-1.5 min-w-0">
                  {/* Line 1: Name + Complexity + Checkmark */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs font-semibold whitespace-nowrap truncate flex-1 min-w-0 ${
                      isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'
                    }`}>
                      {displayName}
                    </span>

                    {/* Complexity Badge */}
                    {uiMetadata?.complexity && (
                      <span className={`flex-shrink-0 px-1.5 py-0.5 text-[9px] font-semibold rounded ${
                        uiMetadata.complexity === 'beginner'
                          ? 'bg-green-500/15 text-green-700 dark:text-green-500'
                          : uiMetadata.complexity === 'intermediate'
                          ? 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-500'
                          : 'bg-orange-500/15 text-orange-700 dark:text-orange-500'
                      }`}>
                        {t(`studio.templateMeta.complexity.${uiMetadata.complexity}`)}
                      </span>
                    )}

                    {/* Selected Checkmark */}
                    {isSelected && (
                      <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>

                  {/* Line 2: Category + Modes + Platforms */}
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    {/* Category Badge */}
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-medium rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      <span>{categoryIcon}</span>
                      <span className="hidden sm:inline">{categoryLabel}</span>
                    </span>

                    {/* Mode Badges */}
                    {uiMetadata && (
                      <ModeIndicator ui={uiMetadata} variant="compact" />
                    )}

                    {/* Platform Chips */}
                    <div className="hidden md:flex">
                      <PlatformChips platforms={template.platforms} limit={2} size="sm" />
                    </div>
                  </div>
                </div>

                {/* Hover Preview Panel (Desktop Only) */}
                {!isInvalid && (
                  <div className="hidden md:block absolute left-0 top-full mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-4 opacity-0 invisible group-hover/chip:opacity-100 group-hover/chip:visible transition-all duration-200 z-20 pointer-events-none">
                    {/* Preview Header */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h5 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {displayName}
                      </h5>
                      {uiMetadata?.complexity && (
                        <span className={`flex-shrink-0 px-1.5 py-0.5 text-[9px] font-semibold rounded ${
                          uiMetadata.complexity === 'beginner'
                            ? 'bg-green-500/15 text-green-700 dark:text-green-500'
                            : uiMetadata.complexity === 'intermediate'
                            ? 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-500'
                            : 'bg-orange-500/15 text-orange-700 dark:text-orange-500'
                        }`}>
                          {t(`studio.templateMeta.complexity.${uiMetadata.complexity}`)}
                        </span>
                      )}
                    </div>

                    {/* Category */}
                    <div className="flex items-center gap-1 mb-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        <span>{categoryIcon}</span>
                        <span>{categoryLabel}</span>
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2 mb-3">
                      {displayDescription}
                    </p>

                    {/* Modes */}
                    {uiMetadata && (
                      <div className="mb-2">
                        <ModeIndicator ui={uiMetadata} variant="compact" />
                      </div>
                    )}

                    {/* Platforms */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <PlatformChips platforms={template.platforms} size="sm" />
                    </div>

                    {/* First-time hint (shown first 3 hovers) */}
                    {scriptChipHoverHint.shouldShow && (
                      <div className="mt-3 pt-2 border-t border-blue-100 dark:border-blue-900/50">
                        <p className="text-[9px] text-blue-600 dark:text-blue-400 leading-tight">
                          💡 {t('studio.onboarding.templateEngine.firstUseHint')}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Template Explorer Overlay */}
      <TemplateExplorer
        open={explorerOpen}
        onClose={() => setExplorerOpen(false)}
        templates={templates}
        selectedTemplateId={selectedTemplateId || undefined}
        onSelectTemplate={(id) => {
          onSelectTemplate(id);
          setExplorerOpen(false);
        }}
      />

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
