// ============================================
// Category Divider Component
// ============================================
// Section header for grouping templates by category in the explorer

import React from 'react';
import type { ContentTemplate } from '@/lib/studio/templates/templateSchema';
import { useTranslation } from '@/lib/i18n';

interface CategoryDividerProps {
  category: ContentTemplate['category'];
}

// Category visual attributes (labels and descriptions now fetched from i18n)
const CATEGORY_VISUALS: Record<
  ContentTemplate['category'],
  { icon: string; color: string }
> = {
  ideation: {
    icon: '💡',
    color: 'text-amber-600 dark:text-amber-400',
  },
  content_creation: {
    icon: '✍️',
    color: 'text-green-600 dark:text-green-400',
  },
  analytical: {
    icon: '📊',
    color: 'text-blue-600 dark:text-blue-400',
  },
  optimization: {
    icon: '⚡',
    color: 'text-purple-600 dark:text-purple-400',
  },
};

export function CategoryDivider({ category }: CategoryDividerProps) {
  const { t } = useTranslation();
  const visuals = CATEGORY_VISUALS[category];
  const label = t(`studio.templateMeta.categories.${category}`);
  const description = t(`studio.templateMeta.categoryDescriptions.${category}`);

  return (
    <div className="py-6">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl" role="img" aria-label={label}>
          {visuals.icon}
        </span>
        <div>
          <h2 className={`text-lg font-bold ${visuals.color}`}>{label}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
