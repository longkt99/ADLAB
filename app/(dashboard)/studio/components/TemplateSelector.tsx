'use client';

// ============================================
// Template Selector for Content Machine Engine
// ============================================
// Displays and allows selection of NEW template system templates
// (social_caption, storytelling, ad_copy, etc.)

import { useState } from 'react';
import { listAllTemplates, getTemplateById } from '@/lib/studio/templateLoader';
import { useTranslation } from '@/lib/i18n';
import { EngineBadge } from './EngineBadge';
import { ModeIndicator } from './ModeIndicator';
import { PlatformChips } from './PlatformChips';
import { ToneChips } from './ToneChips';
import { TemplateExplorer } from './TemplateExplorer';
import type { ContentTemplate, TemplateUIMetadata } from '@/lib/studio/templates/templateSchema';

// Labels now fetched from i18n

interface TemplateSelectorProps {
  selectedTemplateId: string | null;
  onSelectTemplate: (templateId: string | null) => void;
}

export default function TemplateSelector({
  selectedTemplateId,
  onSelectTemplate,
}: TemplateSelectorProps) {
  const { t } = useTranslation();
  const templates = listAllTemplates();
  const [explorerOpen, setExplorerOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="pb-3 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-1.5">
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">
            {t('studio.engineTemplates.title') || 'Content Engine Templates'}
          </h3>
          {selectedTemplateId && (
            <button
              onClick={() => onSelectTemplate(null)}
              className="px-2 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded transition-all"
              title={t('studio.engineTemplates.clearTemplate') || 'Clear template'}
            >
              {t('studio.engineTemplates.useDefault') || 'Use Default'}
            </button>
          )}
        </div>
        <p className="text-[10px] text-slate-500 dark:text-slate-500 tracking-tight leading-tight mb-1.5">
          {t('studio.templateMeta.labels.engineInfo' as any)}
        </p>
        <button
          onClick={() => setExplorerOpen(true)}
          className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors"
        >
          {t('studio.templateMeta.labels.viewAllScripts' as any)}
        </button>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 gap-2.5 max-h-[320px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent">
        {templates.map((template) => {
          const isSelected = selectedTemplateId === template.id;
          const isInvalid = !template.isValid;

          // Get full template data to access ui metadata
          let fullTemplate;
          try {
            fullTemplate = getTemplateById(template.id);
          } catch (error) {
            fullTemplate = null;
          }
          const hasUIMetadata = fullTemplate?.template?.ui;

          return (
            <button
              key={template.id}
              onClick={() => onSelectTemplate(template.id)}
              disabled={isInvalid}
              className={`
                group relative p-4 rounded-lg border text-left transition-all duration-200
                ${isSelected
                  ? 'border-blue-500 dark:border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-sm ring-2 ring-inset ring-blue-500/20 dark:ring-blue-500/30'
                  : 'border-gray-200 dark:border-slate-700/60 bg-white dark:bg-slate-900/40 hover:border-sky-400 dark:hover:border-sky-500/50 hover:shadow-md hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }
                ${isInvalid ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {/* Template Header */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  {/* Title Row */}
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={`text-[13px] font-semibold truncate ${
                      isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'
                    }`}>
                      {template.nameKey ? (t(template.nameKey as any) || template.name) : template.name}
                    </h4>
                    {isSelected && (
                      <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  {/* Engine Badge Row */}
                  <div className="flex items-center gap-1.5 mb-1.5">
                    {hasUIMetadata && <EngineBadge ui={fullTemplate!.template.ui!} size="sm" />}
                  </div>
                  {/* Description */}
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug line-clamp-2">
                    {template.descriptionKey ? (t(template.descriptionKey as any) || template.description) : template.description}
                  </p>
                </div>

                {/* Top-Right: Complexity Badge */}
                <div className="flex-shrink-0">
                  {hasUIMetadata && fullTemplate!.template.ui!.complexity ? (
                    <span className={`inline-block px-1.5 py-0.5 text-[9px] font-semibold rounded ${
                      fullTemplate!.template.ui!.complexity === 'beginner'
                        ? 'bg-green-500/15 text-green-700 dark:text-green-500'
                        : fullTemplate!.template.ui!.complexity === 'intermediate'
                        ? 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-500'
                        : 'bg-orange-500/15 text-orange-700 dark:text-orange-500'
                    }`}>
                      {t(`studio.templateMeta.complexity.${fullTemplate!.template.ui!.complexity}` as any)}
                    </span>
                  ) : isInvalid ? (
                    <span className="inline-block px-1.5 py-0.5 bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 text-[9px] font-semibold rounded">
                      Invalid
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Metadata Footer */}
              <div className="flex flex-col gap-2 pt-2.5 mt-2.5 border-t border-gray-100 dark:border-slate-800/50">
                {/* Category + Mode Indicators */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`inline-flex px-2 py-0.5 text-[9px] font-semibold rounded-full ${
                    template.category === 'content_creation'
                      ? 'bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400'
                      : template.category === 'optimization'
                      ? 'bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400'
                      : template.category === 'ideation'
                      ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
                      : 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400'
                  }`}>
                    {t(`studio.templateMeta.categories.${template.category}` as any)}
                  </span>

                  {/* Mode Indicator */}
                  {hasUIMetadata && (
                    <ModeIndicator ui={fullTemplate!.template.ui!} variant="compact" />
                  )}
                </div>

                {/* Platform Chips */}
                <div>
                  <PlatformChips platforms={template.platforms} limit={3} size="sm" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Helper Text */}
      <p className="text-[10px] text-slate-500 dark:text-slate-500 leading-relaxed pt-1">
        {t('studio.engineTemplates.helperText') || 'Templates enforce the 5-step Content Machine pipeline with specific formatting rules.'}
      </p>

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
    </div>
  );
}
