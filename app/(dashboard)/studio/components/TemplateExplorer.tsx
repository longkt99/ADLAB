// ============================================
// Template Explorer Component
// ============================================
// Full-screen overlay for browsing templates by category

'use client';

import React, { useState, useEffect } from 'react';
import type { ContentTemplate } from '@/lib/studio/templates/templateSchema';
import { getTemplateById } from '@/lib/studio/templateLoader';
import { CategoryDivider } from './CategoryDivider';
import { TemplateCard } from './TemplateCard';
import { TemplateDetailDrawer } from './TemplateDetailDrawer';
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

interface TemplateExplorerProps {
  open: boolean;
  onClose: () => void;
  templates: TemplateListItem[];
  selectedTemplateId?: string;
  onSelectTemplate: (id: string) => void;
}

const CATEGORY_ORDER: ContentTemplate['category'][] = [
  'ideation',
  'content_creation',
  'analytical',
  'optimization',
];

export function TemplateExplorer({
  open,
  onClose,
  templates,
  selectedTemplateId,
  onSelectTemplate,
}: TemplateExplorerProps) {
  const { t } = useTranslation();
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open && !previewTemplateId) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, previewTemplateId, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  // Group templates by category
  const templatesByCategory = CATEGORY_ORDER.reduce(
    (acc, category) => {
      acc[category] = templates.filter((t) => t.category === category);
      return acc;
    },
    {} as Record<ContentTemplate['category'], TemplateListItem[]>
  );

  // Get preview template
  let previewTemplate: ContentTemplate | undefined;
  let previewUIMetadata;
  if (previewTemplateId) {
    try {
      const loaded = getTemplateById(previewTemplateId);
      previewTemplate = loaded.template;
      previewUIMetadata = loaded.template.ui;
    } catch (error) {
      // Template not found
      previewTemplate = undefined;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !previewTemplateId && onClose()}
        aria-hidden="true"
      />

      {/* Main Panel */}
      <div className="relative w-full max-w-5xl h-[85vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-5 border-b border-gray-200 dark:border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                {t('studio.scriptLibrary.title' as any)}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('studio.templateMeta.labels.engineInfo' as any)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close explorer"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {CATEGORY_ORDER.map((category) => {
            const categoryTemplates = templatesByCategory[category];
            if (categoryTemplates.length === 0) return null;

            return (
              <div key={category}>
                <CategoryDivider category={category} />

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  {categoryTemplates.map((template) => {
                    // Get UI metadata
                    let uiMetadata;
                    try {
                      const loaded = getTemplateById(template.id);
                      uiMetadata = loaded.template.ui;
                    } catch (error) {
                      uiMetadata = undefined;
                    }

                    return (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        uiMetadata={uiMetadata}
                        onSelect={(id) => {
                          onSelectTemplate(id);
                          onClose();
                        }}
                        onPreview={(id) => setPreviewTemplateId(id)}
                        isSelected={selectedTemplateId === template.id}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail Drawer */}
      {previewTemplate && (
        <TemplateDetailDrawer
          template={previewTemplate}
          uiMetadata={previewUIMetadata}
          open={!!previewTemplateId}
          onClose={() => setPreviewTemplateId(null)}
          onUseTemplate={(id) => {
            onSelectTemplate(id);
            setPreviewTemplateId(null);
            onClose();
          }}
        />
      )}
    </div>
  );
}
