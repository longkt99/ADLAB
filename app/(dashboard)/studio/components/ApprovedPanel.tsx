'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useStudio } from '@/lib/studio/studioContext';
import { Icon } from '@/components/ui/Icon';

export default function ApprovedPanel() {
  const router = useRouter();
  const { approvedMessageId, messages, clearApprovedMessage } = useStudio();

  // Find the approved message
  const approvedMessage = approvedMessageId
    ? messages.find((m) => m.id === approvedMessageId)
    : null;

  const handleCopy = async () => {
    if (!approvedMessage) return;
    try {
      await navigator.clipboard.writeText(approvedMessage.content);
      // Content copied successfully
    } catch (error) {
      console.error('❌ Failed to copy:', error);
    }
  };

  const handleUseInPostEditor = () => {
    if (!approvedMessage) return;

    try {
      // Prepare draft payload
      const draft = {
        content: approvedMessage.content,
        createdAt: new Date().toISOString(),
        meta: {
          toneId: approvedMessage.meta?.toneId,
          useCaseId: approvedMessage.meta?.useCaseId,
          workflowStep: approvedMessage.meta?.workflowStep,
        },
      };

      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('studio_approved_draft_v1', JSON.stringify(draft));
      }

      // Navigate to post editor
      router.push('/posts/new');
    } catch (error) {
      console.error('❌ Failed to save draft for post editor:', error);
    }
  };

  // Empty state when no approved message
  if (!approvedMessage) {
    return (
      <div className="mt-6 p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border border-green-200 dark:border-green-800 rounded-xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
            <span className="text-xl">✅</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-green-900 dark:text-green-200 mb-1">
              Phiên bản đã duyệt
            </h3>
            <p className="text-xs text-green-700 dark:text-green-300">
              Chưa có phiên bản nào được đánh dấu là bản cuối. Hãy nhấn &quot;Đặt làm bản cuối&quot; ở bất kỳ câu trả lời nào của AI để lưu nó vào đây.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Display approved message
  return (
    <div className="mt-6 p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-2 border-green-400 dark:border-green-600 rounded-xl shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
            <span className="text-white text-lg">✅</span>
          </div>
          <h3 className="text-sm font-bold text-green-900 dark:text-green-200">
            Phiên bản đã duyệt
          </h3>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-green-100 bg-green-100 dark:bg-green-900/40 hover:bg-green-200 dark:hover:bg-green-900/60 rounded-lg transition-colors flex items-center gap-1.5"
            title="Sao chép vào clipboard"
          >
            <Icon name="copy" size={14} />
            Sao chép
          </button>
          <button
            onClick={clearApprovedMessage}
            className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors"
            title="Xóa nội dung đã duyệt"
          >
            Xóa
          </button>
        </div>
      </div>

      {/* Approved Content */}
      <div className="bg-white dark:bg-gray-900/50 rounded-lg p-4 border border-green-200 dark:border-green-800">
        <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-sans leading-relaxed">
{approvedMessage.content}
        </pre>
      </div>

      {/* Actions and Metadata */}
      <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Metadata */}
        <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400">
          <Icon name="clock" size={14} />
          <span>
            Approved at {approvedMessage.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Primary Action Button */}
        <button
          onClick={handleUseInPostEditor}
          className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors shadow-sm hover:shadow flex items-center gap-2"
        >
          <Icon name="edit" size={16} />
          Dùng trong trình soạn bài viết
        </button>
      </div>
    </div>
  );
}
