'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useStudio } from '@/lib/studio/studioContext';
import { useTranslation } from '@/lib/i18n';

export default function ApprovedPanelSidebar() {
  const { t } = useTranslation();
  const router = useRouter();
  const { approvedMessageId, messages, clearApprovedMessage } = useStudio();

  const approvedMessage = approvedMessageId
    ? messages.find((m) => m.id === approvedMessageId)
    : null;

  const handleCopy = async () => {
    if (!approvedMessage) return;
    try {
      await navigator.clipboard.writeText(approvedMessage.content);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleUseInPostEditor = () => {
    if (!approvedMessage) return;

    try {
      const draft = {
        content: approvedMessage.content,
        createdAt: new Date().toISOString(),
        meta: {
          toneId: approvedMessage.meta?.toneId,
          useCaseId: approvedMessage.meta?.useCaseId,
          workflowStep: approvedMessage.meta?.workflowStep,
        },
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem('studio_approved_draft_v1', JSON.stringify(draft));
      }

      router.push('/posts/new');
    } catch (error) {
      console.error('Failed to save draft for post editor:', error);
    }
  };

  if (!approvedMessage) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
            <span className="text-sm">✅</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
              {t('studio.approvedPanel.title')}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              {t('studio.approvedPanel.emptyMessage')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white dark:bg-gray-900 border border-green-200 dark:border-green-700 rounded-xl" style={{ boxShadow: '0 1px 3px rgba(34, 197, 94, 0.1)' }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg bg-green-100 dark:bg-green-950/40 flex items-center justify-center">
          <span className="text-green-600 dark:text-green-400 text-sm">✓</span>
        </div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t('studio.approvedPanel.title')}
        </h3>
      </div>

      {/* Content Preview */}
      <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
        <pre className="whitespace-pre-wrap text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-sans line-clamp-6">
{approvedMessage.content}
        </pre>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <button
          onClick={handleUseInPostEditor}
          className="w-full px-3 py-2 bg-blue-600 dark:bg-blue-500 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
        >
          {t('studio.approvedPanel.useInEditor')}
        </button>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t('studio.approvedPanel.copy')}
          </button>
          <button
            onClick={clearApprovedMessage}
            className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 bg-gray-100 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
          >
            {t('studio.approvedPanel.clear')}
          </button>
        </div>
      </div>

      {/* Timestamp */}
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
        <p className="text-[10px] text-gray-400 dark:text-gray-600">
          {t('studio.approvedPanel.approvedAt')} {approvedMessage.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}
