'use client';

// ============================================
// PromptCard - 1-Click Prompt Card
// ============================================
// Compact card for prompt selection in PromptGrid.
// Stateless: receives data, emits onSelect.
//
// DESIGN:
// - Novera warm professional tokens
// - Clear visibility in Light mode
// - Subtle hover with border strengthen
// - Optional muted category tag
// ============================================

import type { PromptCardData } from '@/lib/studio/promptLibrary';

interface PromptCardProps {
  card: PromptCardData;
  onSelect: (card: PromptCardData) => void;
}

export default function PromptCard({ card, onSelect }: PromptCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(card)}
      className="card-interactive shadow-sm w-full flex flex-col items-start text-left px-4 py-3 cursor-pointer"
    >
      {/* Title */}
      <span className="text-[14px] font-medium text-foreground leading-snug">
        {card.title}
      </span>

      {/* Description - readable, two lines max */}
      <span className="mt-1 text-[13px] text-muted-foreground leading-relaxed line-clamp-2">
        {card.description}
      </span>

      {/* Platform indicator - if present, subtle badge */}
      {card.platform && (
        <span className="mt-2 px-2 py-0.5 text-[11px] text-muted-foreground bg-secondary/60 dark:bg-secondary/80 rounded">
          {card.platform}
        </span>
      )}
    </button>
  );
}
