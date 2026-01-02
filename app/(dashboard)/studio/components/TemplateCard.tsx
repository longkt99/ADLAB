// ============================================
// Template Card Component
// ============================================
// Rich card for displaying templates in grid view

import React from 'react';
import type { TemplateUIMetadata } from '@/lib/studio/templates/templateSchema';
import { EngineBadge } from './EngineBadge';
import { ModeIndicator } from './ModeIndicator';
import { PlatformChips } from './PlatformChips';
import { useTranslation } from '@/lib/i18n';

type TemplateListItem = {
  id: string;
  name: string;
  description: string;
  nameKey?: string;
  descriptionKey?: string;
  category: string;
  platforms: string[];
  isValid: boolean;
};

interface TemplateCardProps {
  template: TemplateListItem;
  uiMetadata?: TemplateUIMetadata;
  onSelect: (id: string) => void;
  onPreview?: (id: string) => void;
  isSelected?: boolean;
}

// Category and complexity labels are now fetched from i18n

export function TemplateCard({
  template,
  uiMetadata,
  onSelect,
  onPreview,
  isSelected,
}: TemplateCardProps) {
  const { t } = useTranslation();

  // Use i18n key if available, otherwise fallback to template.name/description
  const displayName = template.nameKey ? (t(template.nameKey) || template.name) : template.name;
  const displayDescription = template.descriptionKey ? (t(template.descriptionKey) || template.description) : template.description;

  return (
    <div
      className={`
        group relative p-5 rounded-xl border bg-white dark:bg-slate-900/60
        transition-all duration-200 hover:shadow-lg hover:border-sky-400 dark:hover:border-sky-500/50
        ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 dark:border-slate-700/60'}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1 line-clamp-1">
            {displayName}
          </h3>
          {uiMetadata && (
            <div className="flex items-center gap-2 mb-2">
              <EngineBadge ui={uiMetadata} size="sm" />
            </div>
          )}
        </div>

        {/* Complexity Badge */}
        {uiMetadata?.complexity && (
          <span
            className={`flex-shrink-0 px-2 py-0.5 text-[9px] font-semibold rounded ${
              uiMetadata.complexity === 'beginner'
                ? 'bg-green-500/15 text-green-700 dark:text-green-500'
                : uiMetadata.complexity === 'intermediate'
                ? 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-500'
                : 'bg-orange-500/15 text-orange-700 dark:text-orange-500'
            }`}
          >
            {t(`studio.templateMeta.complexity.${uiMetadata.complexity}`)}
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3 mb-4">
        {displayDescription}
      </p>

      {/* Metadata */}
      <div className="space-y-2.5 mb-4 pb-4 border-b border-gray-100 dark:border-slate-800/50">
        {/* Category + Modes */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex px-2 py-0.5 text-[9px] font-semibold rounded-full ${
              template.category === 'content_creation'
                ? 'bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400'
                : template.category === 'optimization'
                ? 'bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400'
                : template.category === 'ideation'
                ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
                : 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400'
            }`}
          >
            {t(`studio.templateMeta.categories.${template.category}`)}
          </span>

          {uiMetadata && <ModeIndicator ui={uiMetadata} variant="compact" />}
        </div>

        {/* Platforms */}
        <div>
          <PlatformChips platforms={template.platforms} limit={4} size="sm" />
        </div>

        {/* Tags */}
        {uiMetadata?.tags && uiMetadata.tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {uiMetadata.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-flex px-1.5 py-0.5 text-[8px] font-medium rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              >
                {tag}
              </span>
            ))}
            {uiMetadata.tags.length > 3 && (
              <span className="text-[8px] text-slate-500">+{uiMetadata.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onSelect(template.id)}
          className="flex-1 px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition-colors"
        >
          {t('studio.templateMeta.actions.useScript')}
        </button>
        {onPreview && (
          <button
            onClick={() => onPreview(template.id)}
            className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors"
          >
            {t('studio.templateMeta.actions.viewDetails')}
          </button>
        )}
      </div>
    </div>
  );
}
