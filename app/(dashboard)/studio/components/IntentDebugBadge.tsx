'use client';

// ============================================
// STEP 8: Intent Debug Badge (DEV-ONLY)
// ============================================
// Floating debug badge that shows routing decision context.
// Only renders when ?debugIntent=1 URL param is present.
//
// INVARIANTS:
// - NEVER renders in production
// - Pure observability, NEVER affects execution
// - Shows after each send to explain what happened
//
// STEP 9: Added outcome display support
// STEP 10: Added stability metrics display
// STEP 11: Added continuity state display
// STEP 12: Added preference bias display
// STEP 14: Added governance display
// ============================================

import React, { useState, useEffect } from 'react';
import {
  isIntentDebugEnabled,
  type DebugDecision,
  getDecisionPathLabel,
  getConfidenceColor,
  getDecisionEmoji,
} from '@/lib/studio/intentDebug';
import { type IntentOutcome } from '@/lib/studio/intentOutcome';
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
import {
  type BiasResult,
  getPreferenceColorClasses,
} from '@/lib/studio/userPreference';
import {
  type GovernanceDecision,
  getRoleLabel,
  getRoleColorClasses,
  getGovernanceDebugState,
} from '@/lib/studio/intentGovernance';

interface IntentDebugBadgeProps {
  decision: DebugDecision | null;
  /** STEP 9: Optional outcome for this decision */
  outcome?: IntentOutcome | null;
  /** STEP 10: Optional stability metrics */
  stability?: StabilityMetrics | null;
  /** STEP 11: Optional continuity state */
  continuity?: ContinuityState | null;
  /** STEP 12: Optional preference bias */
  preferenceBias?: BiasResult | null;
  /** STEP 14: Optional governance decision */
  governanceDecision?: GovernanceDecision | null;
  onDismiss?: () => void;
}

/**
 * Floating debug badge showing routing decision context.
 * Only visible when debugIntent=1 URL param is set.
 */
export function IntentDebugBadge({ decision, outcome, stability, continuity, preferenceBias, governanceDecision, onDismiss }: IntentDebugBadgeProps) {
  const [isDebugEnabled, setIsDebugEnabled] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Check debug flag on mount and URL changes
  useEffect(() => {
    const checkDebug = () => {
      setIsDebugEnabled(isIntentDebugEnabled());
    };

    checkDebug();

    // Listen for URL changes (for SPA navigation)
    window.addEventListener('popstate', checkDebug);
    return () => window.removeEventListener('popstate', checkDebug);
  }, []);

  // Don't render if not in debug mode or no decision
  if (!isDebugEnabled || !decision) {
    return null;
  }

  const confidenceColors = getConfidenceColor(decision.confidence.intentConfidence);
  const emoji = getDecisionEmoji(decision.decisionPath);
  const label = getDecisionPathLabel(decision.decisionPath);
  const confidencePercent = Math.round(decision.confidence.intentConfidence * 100);

  return (
    <div
      className="fixed bottom-24 right-4 z-50 font-mono text-xs"
      style={{ maxWidth: '320px' }}
    >
      {/* Collapsed badge */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className={`
            flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg
            border ${confidenceColors.border} ${confidenceColors.bg}
            hover:shadow-xl transition-shadow cursor-pointer
          `}
        >
          <span>{emoji}</span>
          <span className={`font-medium ${confidenceColors.text}`}>{label}</span>
          <span className={`${confidenceColors.text} opacity-75`}>
            {confidencePercent}%
          </span>
          {decision.warnings.length > 0 && (
            <span className="text-amber-600">⚠️ {decision.warnings.length}</span>
          )}
          {/* STEP 9: Outcome indicator */}
          {outcome && (
            <span className={
              outcome.derived.accepted
                ? 'text-green-500'
                : outcome.derived.negative
                  ? 'text-red-500'
                  : 'text-slate-400'
            }>
              {outcome.derived.accepted ? '✓' : outcome.derived.negative ? '✗' : '⏳'}
            </span>
          )}
        </button>
      )}

      {/* Expanded panel */}
      {isExpanded && (
        <div className="bg-slate-900 text-slate-100 rounded-lg shadow-xl border border-slate-700 overflow-hidden">
          {/* Header */}
          <div className={`flex items-center justify-between px-3 py-2 ${confidenceColors.bg}`}>
            <div className="flex items-center gap-2">
              <span>{emoji}</span>
              <span className={`font-medium ${confidenceColors.text}`}>{label}</span>
            </div>
            <button
              onClick={() => {
                setIsExpanded(false);
                onDismiss?.();
              }}
              className="text-slate-500 hover:text-slate-700"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="p-3 space-y-2">
            {/* Confidence */}
            <div className="flex justify-between">
              <span className="text-slate-400">Confidence:</span>
              <span className={confidenceColors.text}>
                {confidencePercent}% → {decision.confidence.routeHint}
              </span>
            </div>

            {/* Reason */}
            <div className="flex justify-between">
              <span className="text-slate-400">Reason:</span>
              <span className="text-slate-200">{decision.confidence.reason}</span>
            </div>

            {/* Final choice */}
            {decision.finalChoice && (
              <div className="flex justify-between">
                <span className="text-slate-400">Choice:</span>
                <span className="text-cyan-400">{decision.finalChoice}</span>
              </div>
            )}

            {/* Context */}
            <div className="flex justify-between">
              <span className="text-slate-400">Context:</span>
              <span className="text-slate-200">
                {decision.hasActiveSource ? '📎 Source' : ''}
                {decision.hasActiveSource && decision.hasLastValidAssistant ? ' + ' : ''}
                {decision.hasLastValidAssistant ? '💬 Convo' : ''}
                {!decision.hasActiveSource && !decision.hasLastValidAssistant ? '(none)' : ''}
              </span>
            </div>

            {/* Auto-applied */}
            {decision.autoApplied && (
              <div className="flex justify-between">
                <span className="text-slate-400">Auto-applied:</span>
                <span className="text-purple-400">
                  Yes ({decision.learnedCount}x learned)
                </span>
              </div>
            )}

            {/* Pattern hash */}
            <div className="flex justify-between">
              <span className="text-slate-400">Pattern:</span>
              <span className="text-slate-500 font-mono">{decision.patternHash}</span>
            </div>

            {/* Warnings */}
            {decision.warnings.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-700">
                <div className="text-amber-400 font-medium mb-1">⚠️ Warnings:</div>
                {decision.warnings.map((w, i) => (
                  <div key={i} className="text-amber-300 text-xs ml-2">
                    • {w}
                  </div>
                ))}
              </div>
            )}

            {/* STEP 9: Outcome tracking */}
            {outcome && (
              <div className="mt-2 pt-2 border-t border-slate-700">
                <div className="text-slate-400 font-medium mb-1">📊 Outcome:</div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className={
                    outcome.derived.accepted
                      ? 'text-green-400'
                      : outcome.derived.negative
                        ? outcome.derived.severity === 'high'
                          ? 'text-red-400'
                          : 'text-amber-400'
                        : 'text-slate-300'
                  }>
                    {outcome.derived.accepted ? '✓ Accepted' : outcome.derived.negative ? '✗ Rejected' : '⏳ Pending'}
                    {outcome.derived.negative && ` (${outcome.derived.severity})`}
                  </span>
                </div>
                {outcome.signals.length > 0 && (
                  <div className="flex justify-between mt-1">
                    <span className="text-slate-400">Signals:</span>
                    <span className="text-slate-300 text-right">
                      {outcome.signals.map(s => {
                        switch (s.type) {
                          case 'UNDO_WITHIN_WINDOW': return '⏪';
                          case 'EDIT_AFTER': return '✏️';
                          case 'RESEND_IMMEDIATELY': return '🔄';
                          case 'ACCEPT_SILENTLY': return '✅';
                        }
                      }).join(' ')}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* STEP 10: Stability metrics */}
            {stability && (
              <div className="mt-2 pt-2 border-t border-slate-700">
                <div className="text-slate-400 font-medium mb-1">📈 Stability:</div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Score:</span>
                  <span className={getStabilityColorClasses(stability.band).text}>
                    {stability.stabilityScore}% {stability.band}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-slate-400">Evidence:</span>
                  <span className="text-slate-300">
                    +{stability.acceptedCount} -{stability.negativeHighCount}H -{stability.negativeMediumCount}M (n={stability.recentCount})
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-slate-400">Auto-apply:</span>
                  <span className={stability.autoApplyEligible ? 'text-green-400' : 'text-slate-500'}>
                    {stability.autoApplyEligible ? '✓ Eligible' : '✗ Not eligible'}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-slate-400">Reason:</span>
                  <span className="text-slate-300 text-right">{stability.reason}</span>
                </div>
              </div>
            )}

            {/* STEP 11: Continuity state */}
            {continuity && (
              <div className="mt-2 pt-2 border-t border-slate-700">
                <div className="text-slate-400 font-medium mb-1">🔄 Continuity:</div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Mode:</span>
                  <span className={getModeColorClasses(continuity.mode).text}>
                    {getModeEmoji(continuity.mode)} {getModeLabel(continuity.mode)}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-slate-400">Confidence:</span>
                  <span className="text-slate-300">
                    {Math.round(continuity.modeConfidence * 100)}%
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-slate-400">Flow:</span>
                  <span className="text-slate-300">
                    {continuity.consecutiveCount}x {continuity.dominantType ?? '?'} | h={continuity.history.length}
                  </span>
                </div>
                {continuity.inCorrectionCycle && (
                  <div className="flex justify-between mt-1">
                    <span className="text-slate-400">Status:</span>
                    <span className="text-amber-400">⚠️ Correction cycle</span>
                  </div>
                )}
                <div className="flex justify-between mt-1">
                  <span className="text-slate-400">Reason:</span>
                  <span className="text-slate-300 text-right">{continuity.reason}</span>
                </div>
              </div>
            )}

            {/* STEP 12: Preference bias */}
            {preferenceBias && preferenceBias.activePreferences.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-700">
                <div className="text-slate-400 font-medium mb-1">🎯 Preferences:</div>
                {preferenceBias.defaultChoiceBias && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Bias:</span>
                    <span className={getPreferenceColorClasses(preferenceBias.defaultChoiceStrength).text}>
                      {preferenceBias.defaultChoiceBias} ({Math.round(preferenceBias.defaultChoiceStrength * 100)}%)
                    </span>
                  </div>
                )}
                <div className="flex justify-between mt-1">
                  <span className="text-slate-400">Active:</span>
                  <span className="text-slate-300 text-right">
                    {preferenceBias.activePreferences.slice(0, 3).map(p =>
                      p.key.replace('prefers', '').replace('avoids', '!').slice(0, 8)
                    ).join(', ')}
                    {preferenceBias.activePreferences.length > 3 && ` +${preferenceBias.activePreferences.length - 3}`}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-slate-400">Order:</span>
                  <span className="text-slate-300 text-right text-[10px]">
                    {preferenceBias.optionOrderBias.map(o => o.slice(0, 6)).join(' → ')}
                  </span>
                </div>
              </div>
            )}

            {/* STEP 14: Governance */}
            <GovernanceDebugSection governanceDecision={governanceDecision} />
          </div>

          {/* Footer */}
          <div className="px-3 py-2 bg-slate-800 text-slate-500 text-xs">
            Input: {decision.inputLength} chars |
            {' '}{new Date(decision.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * STEP 14: Governance debug section component
 */
function GovernanceDebugSection({ governanceDecision }: { governanceDecision?: GovernanceDecision | null }) {
  const govState = getGovernanceDebugState();

  // Don't render if governance is inactive
  if (!govState.active) {
    return null;
  }

  const roleColors = govState.role ? getRoleColorClasses(govState.role) : null;

  return (
    <div className="mt-2 pt-2 border-t border-slate-700">
      <div className="text-slate-400 font-medium mb-1">🏢 Governance:</div>

      {/* Role */}
      {govState.role && roleColors && (
        <div className="flex justify-between">
          <span className="text-slate-400">Role:</span>
          <span className={`px-1.5 py-0.5 rounded ${roleColors.bg} ${roleColors.text}`}>
            {getRoleLabel(govState.role, 'en')}
          </span>
        </div>
      )}

      {/* Team */}
      {govState.teamId && (
        <div className="flex justify-between mt-1">
          <span className="text-slate-400">Team:</span>
          <span className="text-slate-300">{govState.teamId}</span>
        </div>
      )}

      {/* Permissions summary */}
      {govState.permissions && (
        <div className="flex justify-between mt-1">
          <span className="text-slate-400">Permissions:</span>
          <span className="text-slate-300 text-right">
            {govState.permissions.allowAutoApply ? 'Auto✓' : 'Auto✗'}
            {' '}
            {govState.permissions.allowLearning ? 'Learn✓' : 'Learn✗'}
            {' '}
            {govState.permissions.allowExecution ? 'Exec✓' : 'Exec✗'}
          </span>
        </div>
      )}

      {/* Team overrides */}
      {govState.teamOverrides && (govState.teamOverrides.autoApplyDisabled || govState.teamOverrides.learningDisabled) && (
        <div className="flex justify-between mt-1">
          <span className="text-slate-400">Team Override:</span>
          <span className="text-amber-400">
            {govState.teamOverrides.autoApplyDisabled && '⚠️NoAuto '}
            {govState.teamOverrides.learningDisabled && '⚠️NoLearn'}
          </span>
        </div>
      )}

      {/* Governance decision */}
      {governanceDecision && (
        <>
          <div className="flex justify-between mt-1">
            <span className="text-slate-400">Confirmation:</span>
            <span className={governanceDecision.confirmationRequired ? 'text-amber-400' : 'text-green-400'}>
              {governanceDecision.confirmationRequired ? '⚠️ Required' : '✓ Can skip'}
            </span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-slate-400">Reason:</span>
            <span className="text-slate-300 text-right text-[10px]">{governanceDecision.reason}</span>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Hook to check if intent debug is available
 */
export function useIntentDebug() {
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Sync with URL query param on mount
    setIsEnabled(isIntentDebugEnabled());

    const checkDebug = () => setIsEnabled(isIntentDebugEnabled());
    window.addEventListener('popstate', checkDebug);
    return () => window.removeEventListener('popstate', checkDebug);
  }, []);

  return isEnabled;
}

export default IntentDebugBadge;
