'use client';

// ============================================
// SourceIndicator - Shows active source message
// ============================================
// Displays which message is currently selected as
// source for transforms, with option to change.
// ============================================

import { Icon } from '@/components/ui/Icon';

interface SourceIndicatorProps {
  sourcePreview: string; // First ~50 chars of source content
  onClear: () => void;
  onChangeSource?: () => void;
  className?: string;
}

export default function SourceIndicator({
  sourcePreview,
  onClear,
  onChangeSource,
  className = '',
}: SourceIndicatorProps) {
  // Truncate preview
  const preview =
    sourcePreview.length > 50
      ? sourcePreview.slice(0, 50) + '...'
      : sourcePreview;

  return (
    <div
      className={`
        flex items-center gap-2 px-3 py-2
        bg-blue-50 dark:bg-blue-950/30
        border border-blue-200 dark:border-blue-800/50
        rounded-lg
        ${className}
      `}
    >
      {/* Icon */}
      <Icon
        name="link"
        size={14}
        className="flex-shrink-0 text-blue-500 dark:text-blue-400"
      />

      {/* Label & Preview */}
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">
          Đang chỉnh sửa
        </span>
        <p className="text-xs text-blue-800 dark:text-blue-200 truncate">
          "{preview}"
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {onChangeSource && (
          <button
            type="button"
            onClick={onChangeSource}
            className="
              px-2 py-1 text-[10px] font-medium
              text-blue-600 dark:text-blue-400
              hover:text-blue-700 dark:hover:text-blue-300
              hover:bg-blue-100 dark:hover:bg-blue-900/50
              rounded transition-colors
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30
            "
          >
            Đổi
          </button>
        )}
        <button
          type="button"
          onClick={onClear}
          className="
            p-1 text-blue-500 dark:text-blue-400
            hover:text-blue-700 dark:hover:text-blue-300
            hover:bg-blue-100 dark:hover:bg-blue-900/50
            rounded transition-colors
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30
          "
          aria-label="Bỏ chọn nguồn"
        >
          <Icon name="close" size={14} />
        </button>
      </div>
    </div>
  );
}
