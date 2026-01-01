'use client';

// ============================================
// STEP 8: Intent Confirmation Explainability (DEV-ONLY)
// ============================================
// Shows context about WHY confirmation is being shown.
// Only renders when ?debugIntent=1 URL param is present.
//
// INVARIANTS:
// - NEVER renders in production
// - Pure observability, NEVER affects execution
// - Enhances the confirmation UI with debug context
//
// STEP 10: Added stability metrics display
// STEP 11: Added continuity state display
// ============================================

import React from 'react';
import { isIntentDebugEnabled, getConfidenceColor } from '@/lib/studio/intentDebug';
import {
  type StabilityMetrics,
  getStabilityColorClasses,
} from '@/lib/studio/intentStability';
import {
  type ContinuityState,
  getModeLabel,
  getModeEmoji,
  getModeColorClasses,
} from '@/lib/studio/intentContinuity';

interface IntentConfirmExplainProps {
  /** Computed confidence for the route */
  confidence: number;
  /** Route hint from confidence computation */
  routeHint: 'CREATE' | 'TRANSFORM';
  /** Reason for the confidence score */
  reason: string;
  /** Whether there's an active source */
  hasActiveSource: boolean;
  /** Whether there's a last valid assistant message */
  hasLastValidAssistant: boolean;
  /** Pattern hash (for debugging) */
  patternHash?: string;
  /** STEP 10: Optional stability metrics */
  stability?: StabilityMetrics;
  /** STEP 11: Optional continuity state */
  continuity?: ContinuityState;
}

/**
 * Debug info panel shown alongside confirmation UI.
 * Only visible when debugIntent=1 URL param is set.
 */
export function IntentConfirmExplain({
  confidence,
  routeHint,
  reason,
  hasActiveSource,
  hasLastValidAssistant,
  patternHash,
  stability,
  continuity,
}: IntentConfirmExplainProps) {
  // Only render in debug mode
  if (!isIntentDebugEnabled()) {
    return null;
  }

  const colors = getConfidenceColor(confidence);
  const confidencePercent = Math.round(confidence * 100);
  const stabilityColors = stability ? getStabilityColorClasses(stability.band) : null;
  const continuityColors = continuity ? getModeColorClasses(continuity.mode) : null;

  return (
    <div className="mt-2 p-2 bg-slate-800 rounded text-xs font-mono text-slate-300 border border-slate-700">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-slate-500">🔍 Debug:</span>
        <span className={`px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
          {confidencePercent}% → {routeHint}
        </span>
        {/* STEP 10: Stability badge */}
        {stability && stabilityColors && (
          <span className={`px-1.5 py-0.5 rounded ${stabilityColors.bg} ${stabilityColors.text}`}>
            {stability.stabilityScore}% {stability.band}
          </span>
        )}
        {/* STEP 11: Continuity badge */}
        {continuity && continuityColors && (
          <span className={`px-1.5 py-0.5 rounded ${continuityColors.bg} ${continuityColors.text}`}>
            {getModeEmoji(continuity.mode)} {getModeLabel(continuity.mode)}
          </span>
        )}
      </div>
      <div className="text-slate-400">
        {reason}
      </div>
      <div className="mt-1 text-slate-500 flex gap-3">
        <span>{hasActiveSource ? '✓ Source' : '✗ Source'}</span>
        <span>{hasLastValidAssistant ? '✓ Convo' : '✗ Convo'}</span>
        {patternHash && <span className="opacity-50">#{patternHash}</span>}
      </div>
      {/* STEP 10: Stability details */}
      {stability && (
        <div className="mt-1 text-slate-500 flex gap-3">
          <span>+{stability.acceptedCount}</span>
          <span>-{stability.negativeHighCount}H</span>
          <span>n={stability.recentCount}</span>
          <span>{stability.autoApplyEligible ? 'auto✓' : 'auto✗'}</span>
        </div>
      )}
      {/* STEP 11: Continuity details */}
      {continuity && (
        <div className="mt-1 text-slate-500 flex gap-3">
          <span>{continuity.consecutiveCount}x {continuity.dominantType ?? '?'}</span>
          <span>h={continuity.history.length}</span>
          <span>{Math.round(continuity.modeConfidence * 100)}%</span>
          {continuity.inCorrectionCycle && <span className="text-amber-500">⚠️corr</span>}
        </div>
      )}
    </div>
  );
}

/**
 * Compact inline explainer for confirmation buttons.
 * Shows a small hint about what each choice does.
 */
export function IntentChoiceHint({
  choice,
  confidence,
  routeHint,
}: {
  choice: 'EDIT_IN_PLACE' | 'TRANSFORM_NEW_VERSION' | 'CREATE_NEW';
  confidence: number;
  routeHint: 'CREATE' | 'TRANSFORM';
}) {
  if (!isIntentDebugEnabled()) {
    return null;
  }

  // Determine if this choice matches the route hint
  const isRecommended =
    (choice === 'CREATE_NEW' && routeHint === 'CREATE') ||
    ((choice === 'EDIT_IN_PLACE' || choice === 'TRANSFORM_NEW_VERSION') && routeHint === 'TRANSFORM');

  if (!isRecommended) {
    return null;
  }

  return (
    <span className="ml-1 text-xs text-slate-500">
      (suggested: {Math.round(confidence * 100)}%)
    </span>
  );
}

export default IntentConfirmExplain;
