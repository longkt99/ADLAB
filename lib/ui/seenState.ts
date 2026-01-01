// ============================================
// Seen State Helper
// ============================================
// Manages "first-time" and "limited-show" hints using localStorage/sessionStorage
// Usage: Track onboarding tooltips, modals, and nudges to avoid spamming users

import { useState, useEffect, useCallback } from 'react';

export interface SeenStateOptions {
  /**
   * Unique key for this hint (e.g., 'studio:onboarding:scriptChipHover')
   */
  key: string;

  /**
   * Storage type
   * - 'local': Persisted across sessions (localStorage)
   * - 'session': Reset on new session (sessionStorage)
   */
  storage: 'local' | 'session';

  /**
   * Maximum number of times to show this hint (default: 1)
   * Set to Infinity for unlimited (useful for debugging)
   */
  maxShows?: number;

  /**
   * Force reset the seen state (useful for debugging)
   */
  reset?: boolean;
}

export interface SeenState {
  /**
   * Whether this hint should be shown
   */
  shouldShow: boolean;

  /**
   * Mark this hint as seen (increments count)
   */
  markSeen: () => void;

  /**
   * Current seen count
   */
  seenCount: number;

  /**
   * Manually reset the seen state
   */
  resetState: () => void;
}

/**
 * Get the appropriate storage object
 */
function getStorage(type: 'local' | 'session'): Storage | null {
  if (typeof window === 'undefined') return null;
  return type === 'local' ? localStorage : sessionStorage;
}

/**
 * Read seen count from storage
 */
function getSeenCount(key: string, storage: 'local' | 'session'): number {
  const store = getStorage(storage);
  if (!store) return 0;

  try {
    const value = store.getItem(key);
    return value ? parseInt(value, 10) || 0 : 0;
  } catch (error) {
    console.warn(`[SeenState] Failed to read ${key}:`, error);
    return 0;
  }
}

/**
 * Write seen count to storage
 */
function setSeenCount(key: string, storage: 'local' | 'session', count: number): void {
  const store = getStorage(storage);
  if (!store) return;

  try {
    store.setItem(key, count.toString());
  } catch (error) {
    console.warn(`[SeenState] Failed to write ${key}:`, error);
  }
}

/**
 * Clear seen state from storage
 */
function clearSeenCount(key: string, storage: 'local' | 'session'): void {
  const store = getStorage(storage);
  if (!store) return;

  try {
    store.removeItem(key);
  } catch (error) {
    console.warn(`[SeenState] Failed to clear ${key}:`, error);
  }
}

/**
 * React hook for managing seen-state of onboarding hints
 *
 * @example
 * ```tsx
 * const tooltip = useSeenState({
 *   key: 'studio:onboarding:scriptChipHover',
 *   storage: 'local',
 *   maxShows: 3,
 * });
 *
 * // In component
 * {tooltip.shouldShow && (
 *   <Tooltip onShow={tooltip.markSeen}>First time hint!</Tooltip>
 * )}
 * ```
 */
export function useSeenState(options: SeenStateOptions): SeenState {
  const { key, storage, maxShows = 1, reset = false } = options;

  const [seenCount, setSeenCountState] = useState<number>(() => {
    if (reset) {
      clearSeenCount(key, storage);
      return 0;
    }
    return getSeenCount(key, storage);
  });

  // Handle reset option
  useEffect(() => {
    if (reset) {
      clearSeenCount(key, storage);
      setSeenCountState(0);
    }
  }, [reset, key, storage]);

  // Sync with storage on mount (in case another tab updated it)
  useEffect(() => {
    const current = getSeenCount(key, storage);
    if (current !== seenCount) {
      setSeenCountState(current);
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shouldShow = seenCount < maxShows;

  const markSeen = useCallback(() => {
    const newCount = seenCount + 1;
    setSeenCountState(newCount);
    setSeenCount(key, storage, newCount);
  }, [seenCount, key, storage]);

  const resetState = useCallback(() => {
    clearSeenCount(key, storage);
    setSeenCountState(0);
  }, [key, storage]);

  return {
    shouldShow,
    markSeen,
    seenCount,
    resetState,
  };
}

/**
 * Imperative API (non-hook) for checking/marking seen state
 * Useful for event handlers or non-React contexts
 */
export const SeenStateAPI = {
  shouldShow(key: string, storage: 'local' | 'session', maxShows: number = 1): boolean {
    const count = getSeenCount(key, storage);
    return count < maxShows;
  },

  markSeen(key: string, storage: 'local' | 'session'): void {
    const count = getSeenCount(key, storage);
    setSeenCount(key, storage, count + 1);
  },

  getCount(key: string, storage: 'local' | 'session'): number {
    return getSeenCount(key, storage);
  },

  reset(key: string, storage: 'local' | 'session'): void {
    clearSeenCount(key, storage);
  },
};
