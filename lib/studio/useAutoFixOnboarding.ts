// ============================================
// Auto Fix Onboarding State Hook
// ============================================
// Minimal onboarding: "whisper, not a guide"
// Stores state in localStorage to show hints only once

'use client';

import { useState, useEffect, useCallback } from 'react';

// ============================================
// Types
// ============================================

interface AutoFixOnboardingState {
  hintSeen: boolean;       // First-time hint in QualityLockPanel
  previewIntroSeen: boolean; // Intro banner in DiffPreviewModal
}

const STORAGE_KEY = 'autoFixOnboarding';

const DEFAULT_STATE: AutoFixOnboardingState = {
  hintSeen: false,
  previewIntroSeen: false,
};

// ============================================
// Hook
// ============================================

export function useAutoFixOnboarding() {
  const [state, setState] = useState<AutoFixOnboardingState>(DEFAULT_STATE);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AutoFixOnboardingState>;
        setState({
          hintSeen: parsed.hintSeen ?? false,
          previewIntroSeen: parsed.previewIntroSeen ?? false,
        });
      }
    } catch {
      // Ignore errors, use default state
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Ignore storage errors
      }
    }
  }, [state, isLoaded]);

  // Mark hint as seen
  const markHintSeen = useCallback(() => {
    setState(prev => ({ ...prev, hintSeen: true }));
  }, []);

  // Mark preview intro as seen
  const markPreviewIntroSeen = useCallback(() => {
    setState(prev => ({ ...prev, previewIntroSeen: true }));
  }, []);

  // Reset onboarding (for testing)
  const resetOnboarding = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  return {
    // State
    isLoaded,
    hintSeen: state.hintSeen,
    previewIntroSeen: state.previewIntroSeen,

    // Derived - whether to show hints
    showHint: isLoaded && !state.hintSeen,
    showPreviewIntro: isLoaded && !state.previewIntroSeen,

    // Actions
    markHintSeen,
    markPreviewIntroSeen,
    resetOnboarding,
  };
}

export type { AutoFixOnboardingState };
