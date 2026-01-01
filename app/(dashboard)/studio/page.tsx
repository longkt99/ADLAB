'use client';

// ============================================
// Studio Page - Calm Writing Surface
// ============================================
// A writing surface, not a tool, not a chat.
// User starts typing immediately.
// AI is quiet background presence.
//
// UX LAYERS:
// 1. PromptGrid (secondary) - Quick-start cards, fades on typing
// 2. StudioEditor (primary) - The calm writing surface
// 3. PromptSheet (modal) - Bottom sheet for topic input
// ============================================

import { useState, useCallback } from 'react';
import { useStudio } from '@/lib/studio/studioContext';
import { BRAND_TONES } from '@/lib/studio/tones';
import FallingLEffect from './components/FallingLEffect';
import StudioEditor from './components/StudioEditor';
import PromptGrid from './components/PromptGrid';
import PromptSheet from './components/PromptSheet';
import PromptExplorer from './components/PromptExplorer';
import StudioFooterBar from './components/StudioFooterBar';
import type { PromptCardData } from '@/lib/studio/promptLibrary';

export default function StudioPage() {
  const {
    showWelcomeAnimation,
    celebrationTrigger,
    chatInput,
    setChatInput,
    handleTemplateSelect,
    handleToneSelect,
    handleSend,
    messages,
  } = useStudio();

  // PromptSheet state
  const [selectedCard, setSelectedCard] = useState<PromptCardData | null>(null);

  // PromptExplorer state
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);

  // Handle card selection from PromptGrid or Explorer
  const handleCardSelect = useCallback((card: PromptCardData) => {
    setSelectedCard(card);
  }, []);

  // Open/close Explorer
  const handleOpenExplorer = useCallback(() => {
    setIsExplorerOpen(true);
  }, []);

  const handleCloseExplorer = useCallback(() => {
    setIsExplorerOpen(false);
  }, []);

  // Handle submission from PromptSheet (receives structured prompt)
  const handleSheetSubmit = useCallback((structuredPrompt: string, card: PromptCardData, toneId?: string) => {
    // Set the template based on card
    handleTemplateSelect(card.templateId);

    // Set tone if provided
    if (toneId) {
      const tone = BRAND_TONES.find(t => t.id === toneId);
      if (tone) handleToneSelect(tone);
    }

    // Set the structured prompt and trigger send
    setChatInput(structuredPrompt);

    // Small delay to ensure state updates, then send
    setTimeout(() => {
      handleSend();
    }, 50);
  }, [handleTemplateSelect, handleToneSelect, setChatInput, handleSend]);

  // Close sheet
  const handleCloseSheet = useCallback(() => {
    setSelectedCard(null);
  }, []);

  // Count assistant messages (monotonic signal for detecting NEW responses)
  // Using count instead of boolean allows detecting increments even when history exists
  const assistantCount = messages.filter(m => m.role === 'assistant').length;

  // ============================================
  // LAYOUT: Full-height Studio - Warm Professional
  // ============================================
  // Cream background, white panels, spacious layout
  // Celebration effects disabled for calm, professional feel
  return (
    <div
      className="h-full flex flex-col bg-background -m-6 sm:-m-8"
    >
      {/* Celebration effects - disabled for Warm Professional calm style */}
      {/* {showWelcomeAnimation && (
        <FallingLEffect trigger={1} duration={2500} particleCount={12} />
      )}
      <FallingLEffect trigger={celebrationTrigger} duration={2500} particleCount={18} /> */}

      {/* Main Content - ChatGPT-like layout, scroll in StudioEditor */}
      <main className="flex-1 min-h-0">
        <StudioEditor
          promptGrid={
            <PromptGrid
              editorValue={chatInput}
              assistantCount={assistantCount}
              onSelectCard={handleCardSelect}
              onOpenExplorer={handleOpenExplorer}
            />
          }
        />
      </main>

      {/* PromptSheet - Bottom sheet modal */}
      <PromptSheet
        card={selectedCard}
        onClose={handleCloseSheet}
        onSubmit={handleSheetSubmit}
      />

      {/* PromptExplorer - Browse all prompts modal */}
      <PromptExplorer
        isOpen={isExplorerOpen}
        onClose={handleCloseExplorer}
        onSelectCard={handleCardSelect}
      />

      {/* FEATURE A: Footer bar with Primary selection + Commit action */}
      <StudioFooterBar />
    </div>
  );
}
