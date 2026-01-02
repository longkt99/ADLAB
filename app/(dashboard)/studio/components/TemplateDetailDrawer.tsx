// ============================================
// Template Detail Drawer Component
// ============================================
// Slide-in panel showing full template metadata

import React, { useEffect } from 'react';
import type { ContentTemplate, TemplateUIMetadata } from '@/lib/studio/templates/templateSchema';
import { EngineBadge } from './EngineBadge';
import { ModeIndicator } from './ModeIndicator';
import { PlatformChips } from './PlatformChips';
import { ToneChips } from './ToneChips';
import { useTranslation } from '@/lib/i18n';

interface TemplateDetailDrawerProps {
  template: ContentTemplate;
  uiMetadata?: TemplateUIMetadata;
  open: boolean;
  onClose: () => void;
  onUseTemplate: (id: string) => void;
}

// Labels now fetched from i18n

export function TemplateDetailDrawer({
  template,
  uiMetadata,
  open,
  onClose,
  onUseTemplate,
}: TemplateDetailDrawerProps) {
  const { t } = useTranslation();

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-white dark:bg-slate-900 shadow-2xl z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-4 z-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                {template.nameKey ? (t(template.nameKey) || template.name) : template.name}
              </h2>
              {uiMetadata && (
                <div className="flex items-center gap-2">
                  <EngineBadge ui={uiMetadata} size="sm" />
                  {uiMetadata.complexity && (
                    <span
                      className={`px-2 py-0.5 text-[9px] font-semibold rounded ${
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
              )}
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Description */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Mô tả
            </h3>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {template.description}
            </p>
          </div>

          {/* Category */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Danh mục
            </h3>
            <span
              className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
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
          </div>

          {/* Execution Modes */}
          {uiMetadata && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                {t('studio.templateMeta.labels.executionModes')}
              </h3>
              <div className="mb-3">
                <ModeIndicator ui={uiMetadata} variant="expanded" />
              </div>
              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                {uiMetadata.supportedModes.abstract && (
                  <div className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded bg-slate-100 dark:bg-slate-800 text-[9px] font-bold">
                      A
                    </span>
                    <p>{t('studio.templateMeta.modes.abstract')}</p>
                  </div>
                )}
                {uiMetadata.supportedModes.structured && (
                  <div className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded bg-slate-100 dark:bg-slate-800 text-[9px] font-bold">
                      B
                    </span>
                    <p>{t('studio.templateMeta.modes.structured')}</p>
                  </div>
                )}
                {uiMetadata.supportedModes.generic && (
                  <div className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded bg-slate-100 dark:bg-slate-800 text-[9px] font-bold">
                      C
                    </span>
                    <p>{t('studio.templateMeta.modes.generic')}</p>
                  </div>
                )}
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-500">
                <span className="font-semibold">{t('studio.templateMeta.labels.defaultMode')}</span> {t(`studio.templateMeta.modes.${uiMetadata.defaultMode}`)}
              </p>
            </div>
          )}

          {/* Platforms */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              {t('studio.templateMeta.labels.supportedPlatforms')}
            </h3>
            <PlatformChips platforms={template.platforms} size="md" />
          </div>

          {/* Tones */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Giọng điệu hỗ trợ
            </h3>
            <ToneChips tones={template.toneSupport} size="md" />
          </div>

          {/* Output Structure */}
          {uiMetadata?.outputStructure && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                Cấu trúc đầu ra
              </h3>
              <div className="space-y-2">
                {uiMetadata.outputStructure.sections.map((section) => (
                  <div
                    key={section.order}
                    className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300"
                  >
                    <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 text-xs font-bold">
                      {section.order}
                    </span>
                    <span>{section.name}</span>
                  </div>
                ))}
              </div>
              {uiMetadata.outputStructure.hasExecutionGuidance && (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-500">
                  ✓ Bao gồm Execution Guidance (hướng dẫn thực thi chi tiết)
                </p>
              )}
            </div>
          )}

          {/* Tags */}
          {uiMetadata?.tags && uiMetadata.tags.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Tags
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                {uiMetadata.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex px-2 py-1 text-[10px] font-medium rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                onUseTemplate(template.id);
                onClose();
              }}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition-colors"
            >
              Dùng template này
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
