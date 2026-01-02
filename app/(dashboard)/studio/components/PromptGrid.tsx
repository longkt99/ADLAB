'use client';

// ============================================
// PromptGrid - 1-Click Prompts Grid (v1)
// ============================================
// Displays 6-8 featured prompt cards above editor.
// Secondary layer that helps users start quickly.
//
// VISIBILITY RULES:
// 1. Empty editor → opacity 100%
// 2. User typing (>20 chars) → fade to 40%
// 3. After first AI result → auto-collapse (user can expand)
// 4. ALWAYS visible by default for new users (beginner-friendly)
//
// STEP 4.5: Adaptive Silence
// - Hide top guidance text after any user interaction
// - Grid becomes silent option set, not suggestion panel
// ============================================

import { useState, useEffect, useRef, useMemo } from 'react';
import { getFeaturedCards, type PromptCardData } from '@/lib/studio/promptLibrary';
import PromptCard from './PromptCard';
import { Icon } from '@/components/ui/Icon';
// STEP 5: Soft preference memory for category affinity
import { getCategoryAffinity } from '@/lib/studio/preferenceMemory';

interface PromptGridProps {
  editorValue: string;
  assistantCount: number; // Monotonic count of assistant messages
  onSelectCard: (card: PromptCardData) => void;
  onOpenExplorer: () => void;
}

const FADE_THRESHOLD = 20;

export default function PromptGrid({
  editorValue,
  assistantCount,
  onSelectCard,
  onOpenExplorer,
}: PromptGridProps) {
  // Collapsed state - ALWAYS start expanded for beginner-friendly UX
  // Only collapse after user manually collapses OR after first NEW AI result
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hasAutoCollapsed, setHasAutoCollapsed] = useState(false);
  // STEP 4.5: Track if user has interacted (hide guidance permanently)
  const [hasInteracted, setHasInteracted] = useState(false);

  // Track previous assistant count to detect NEW responses (increments)
  // Using count instead of boolean allows detecting new messages even when history exists
  const prevAssistantCountRef = useRef(assistantCount);
  const isFirstRenderRef = useRef(true);

  // STEP 4.5: Mark as interacted when user types or has AI results
  useEffect(() => {
    if (editorValue.trim().length > 0 || assistantCount > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- One-way state transition based on external data
      setHasInteracted(true);
    }
  }, [editorValue, assistantCount]);

  // Auto-collapse when assistant count INCREASES after first render
  // IMPORTANT: Ignore persisted assistant messages on mount; collapse only when
  // a NEW assistant message arrives during this session.
  useEffect(() => {
    // Skip first render - we never auto-collapse on mount (regardless of persisted history)
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      prevAssistantCountRef.current = assistantCount;
      return;
    }

    // Skip if already collapsed or already auto-collapsed
    if (isCollapsed || hasAutoCollapsed) {
      // Still update ref to track count
      prevAssistantCountRef.current = assistantCount;
      return;
    }

    // Collapse when count increases (new AI response arrived)
    if (assistantCount > prevAssistantCountRef.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Auto-collapse on new AI response
      setIsCollapsed(true);
      setHasAutoCollapsed(true);
    }

    // Always update ref for next comparison
    prevAssistantCountRef.current = assistantCount;
  }, [assistantCount, isCollapsed, hasAutoCollapsed]);

  // Toggle collapse state (no localStorage - fresh each session for better UX)
  const handleToggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Visibility logic: fade to 40% when >20 chars
  const charCount = editorValue.trim().length;
  const shouldFade = charCount > FADE_THRESHOLD;

  // Get featured cards (6-8 cards only in v1)
  const baseFeaturedCards = getFeaturedCards();

  // STEP 5: Apply subtle category affinity - move preferred categories up by 1 position
  // This creates a "slightly more familiar" feel without dramatic reordering
  const featuredCards = useMemo(() => {
    const affinity = getCategoryAffinity();
    if (affinity.length === 0) return baseFeaturedCards;

    // Get the top preferred category
    const preferredCategory = affinity[0];

    // Find cards in preferred category
    const preferred: PromptCardData[] = [];
    const others: PromptCardData[] = [];

    for (const card of baseFeaturedCards) {
      if (card.category === preferredCategory) {
        preferred.push(card);
      } else {
        others.push(card);
      }
    }

    // Subtle reorder: move ONE preferred card to position 1 (after first card)
    // This keeps the grid feeling natural, not optimized
    if (preferred.length > 0 && others.length > 1) {
      const [first, ...rest] = others;
      return [first, preferred[0], ...rest, ...preferred.slice(1)];
    }

    return baseFeaturedCards;
  }, [baseFeaturedCards]);

  // If collapsed, show minimal expand hint
  if (isCollapsed) {
    return (
      <div className="mb-3">
        <button
          type="button"
          onClick={handleToggleCollapse}
          className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors duration-150"
        >
          <span>Gợi ý</span>
          <Icon name="chevronDown" size={12} />
        </button>
      </div>
    );
  }

  return (
    <div
      className="mb-5 transition-opacity duration-200 ease-out"
      style={{ opacity: shouldFade ? 0.4 : 1 }}
    >
      {/* STEP 4.5: Only show guidance for brand new users, hide after any interaction */}
      {!hasInteracted && (
        <div className="mb-4 text-center">
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
            Mô tả ý tưởng của bạn.
          </p>
        </div>
      )}

      {/* STEP 4.5: Header - minimal, reduced spacing after interaction */}
      <div className={`flex items-center justify-between ${hasInteracted ? 'mb-3' : 'mb-4'}`}>
        <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">
          Gợi ý
        </span>
        <div className="flex items-center gap-2.5">
          {/* Mẫu prompt - quieter styling */}
          <button
            type="button"
            onClick={onOpenExplorer}
            className="text-[12px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 rounded-sm"
            aria-label="Xem tất cả mẫu prompt"
          >
            Xem thêm
          </button>
          {/* Collapse toggle */}
          <button
            type="button"
            onClick={handleToggleCollapse}
            className="p-1 -mr-1 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors duration-150"
            aria-label="Thu gọn"
          >
            <Icon name="chevronUp" size={14} />
          </button>
        </div>
      </div>

      {/* STEP 4.5: Card Grid - tighter spacing after interaction */}
      <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 ${hasInteracted ? 'gap-2.5' : 'gap-3'}`}>
        {featuredCards.map((card) => (
          <PromptCard
            key={card.id}
            card={card}
            onSelect={onSelectCard}
          />
        ))}
      </div>
    </div>
  );
}
