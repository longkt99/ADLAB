'use client';

// ============================================
// MessageActionBar - Hover-reveal action buttons
// ============================================
// Displays quick transform actions on assistant messages.
// Matches the existing Copy/Approve pattern.
// ============================================

import { Icon, type IconName } from '@/components/ui/Icon';
import { QUICK_ACTIONS, type ActionType } from '@/types/orchestrator';

interface MessageActionBarProps {
  messageId: string;
  onAction: (action: ActionType, messageId: string) => void;
  isLoading?: boolean;
  className?: string;
}

/**
 * Map action IDs to icon names
 * Using available icons from the Icon component
 */
const ACTION_ICONS: Record<ActionType, IconName> = {
  OPTIMIZE: 'sparkles',
  REWRITE: 'refresh',
  SHORTEN: 'arrowDown', // Represent "shrink" concept
  CHANGE_TONE: 'edit',   // Represent "modify" concept
  FORMAT_CONVERT: 'grid', // Represent "structure" concept
  // Other actions (not shown in quick actions)
  CREATE_CONTENT: 'plus',
  BRAINSTORM: 'lightning',
  OUTLINE: 'posts',
  EXPAND: 'arrowUp',     // Represent "grow" concept
  TRANSLATE: 'link',     // Represent "connect languages"
  EVALUATE: 'eye',       // Represent "review"
  QA_FIX: 'check',
  SELECT_SOURCE: 'bookmark',
  CLARIFY: 'info',
};

export default function MessageActionBar({
  messageId,
  onAction,
  isLoading = false,
  className = '',
}: MessageActionBarProps) {
  const handleClick = (action: ActionType) => {
    if (!isLoading) {
      onAction(action, messageId);
    }
  };

  return (
    <div
      className={`
        flex items-center gap-1
        opacity-0 group-hover/message:opacity-100
        transition-opacity duration-150
        ${className}
      `}
    >
      {QUICK_ACTIONS.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={() => handleClick(action.id)}
          disabled={isLoading}
          className={`
            flex items-center gap-1 px-2 py-1
            text-[10px] font-medium
            text-zinc-500 dark:text-zinc-400
            hover:text-zinc-700 dark:hover:text-zinc-200
            hover:bg-zinc-100 dark:hover:bg-zinc-800
            rounded-md transition-all duration-150
            disabled:opacity-50 disabled:cursor-not-allowed
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30
          `}
          title={action.tooltip}
          aria-label={action.tooltip}
        >
          <Icon
            name={ACTION_ICONS[action.id]}
            size={12}
            className="flex-shrink-0"
          />
          <span className="hidden sm:inline">{action.label}</span>
        </button>
      ))}
    </div>
  );
}
