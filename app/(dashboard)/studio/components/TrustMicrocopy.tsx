'use client';

// ============================================
// STEP 13: Trust Microcopy Component
// ============================================
// Production-safe, human-readable trust signals.
// Shows reassuring messages about AI behavior.
//
// INVARIANTS:
// - ALWAYS production-safe (no debug jargon)
// - Pure observability, NEVER affects execution
// - Soft reassurance, builds user confidence
// ============================================

import React, { useState } from 'react';
import {
  getTrustMicrocopy,
  getTrustColorClasses,
  type TrustLevel,
  type Language,
} from '@/lib/studio/intentControl';
import type { StabilityMetrics } from '@/lib/studio/intentStability';
import type { ConversationMode } from '@/lib/studio/intentContinuity';

interface TrustMicrocopyProps {
  /** Stability metrics for trust computation */
  stabilityMetrics?: StabilityMetrics;
  /** Whether user has active preferences */
  hasActivePreferences?: boolean;
  /** Current conversation mode */
  continuityMode?: ConversationMode;
  /** Language for display */
  language?: Language;
  /** Whether to show extended explanation on hover */
  showTooltip?: boolean;
  /** Compact mode (emoji only) */
  compact?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Trust microcopy component for production use.
 * Shows human-readable, reassuring messages about AI behavior.
 */
export function TrustMicrocopy({
  stabilityMetrics,
  hasActivePreferences = false,
  continuityMode,
  language = 'vi',
  showTooltip = true,
  compact = false,
  className = '',
}: TrustMicrocopyProps) {
  const [isHovering, setIsHovering] = useState(false);

  const microcopy = getTrustMicrocopy({
    stabilityMetrics,
    hasActivePreferences,
    continuityMode,
    language,
  });

  const colors = getTrustColorClasses(microcopy.level);

  if (compact) {
    return (
      <span
        className={`inline-flex items-center ${className}`}
        title={showTooltip ? microcopy.explanation : undefined}
      >
        <span className="text-base">{microcopy.emoji}</span>
      </span>
    );
  }

  return (
    <div
      className={`relative inline-flex items-center gap-1.5 ${className}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Badge */}
      <span
        className={`
          inline-flex items-center gap-1 px-2 py-0.5 rounded-full
          text-xs font-medium
          ${colors.bg} ${colors.text} ${colors.border} border
          transition-all duration-200
        `}
      >
        <span>{microcopy.emoji}</span>
        <span>{microcopy.label}</span>
      </span>

      {/* Tooltip on hover */}
      {showTooltip && isHovering && (
        <div
          className={`
            absolute bottom-full left-0 mb-1 z-50
            px-2 py-1 rounded shadow-lg
            text-xs whitespace-nowrap
            bg-slate-900 text-slate-100
            dark:bg-slate-100 dark:text-slate-900
            animate-fade-in
          `}
        >
          {microcopy.explanation}
        </div>
      )}
    </div>
  );
}

/**
 * Inline trust indicator (minimal footprint)
 */
export function TrustIndicator({
  level,
  className = '',
}: {
  level: TrustLevel;
  className?: string;
}) {
  const colors = getTrustColorClasses(level);

  const emoji = {
    HIGH: '✨',
    BUILDING: '📚',
    UNCERTAIN: '🤔',
    LEARNING: '👋',
  }[level];

  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${colors.bg} ${className}`}
      title={level}
    >
      <span className="text-xs">{emoji}</span>
    </span>
  );
}

/**
 * Trust progress bar (shows learning progress visually)
 */
export function TrustProgressBar({
  stabilityScore,
  className = '',
}: {
  stabilityScore: number;
  className?: string;
}) {
  const clampedScore = Math.max(0, Math.min(100, stabilityScore));

  const getBarColor = (score: number): string => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 50) return 'bg-blue-500';
    if (score >= 30) return 'bg-amber-500';
    return 'bg-slate-400';
  };

  return (
    <div className={`w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden ${className}`}>
      <div
        className={`h-full ${getBarColor(clampedScore)} transition-all duration-500 ease-out`}
        style={{ width: `${clampedScore}%` }}
      />
    </div>
  );
}

export default TrustMicrocopy;
