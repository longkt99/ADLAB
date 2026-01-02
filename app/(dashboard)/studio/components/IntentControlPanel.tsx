'use client';

// ============================================
// STEP 13: Intent Control Panel
// ============================================
// User-facing control panel for preference management.
// Shows active preferences, allows reset/disable.
//
// INVARIANTS:
// - No routing override (display only + reset controls)
// - No new LLM calls
// - Production-safe controls
// ============================================

import React, { useState, useCallback } from 'react';
import {
  getControlState,
  executeRecoveryAction,
  getPreferenceLabel,
  getControlCopy,
  type RecoveryAction,
  type Language,
  type ControlState,
} from '@/lib/studio/intentControl';
import { TrustMicrocopy, TrustProgressBar } from './TrustMicrocopy';
import type { StabilityMetrics } from '@/lib/studio/intentStability';

interface IntentControlPanelProps {
  /** Language for display */
  language?: Language;
  /** Current stability metrics */
  stabilityMetrics?: StabilityMetrics;
  /** Callback when a recovery action is executed */
  onRecoveryAction?: (action: RecoveryAction, result: string) => void;
  /** Whether panel is expanded */
  isExpanded?: boolean;
  /** Callback to toggle expanded state */
  onToggleExpanded?: () => void;
  /** Additional class names */
  className?: string;
}

/**
 * User control panel for managing AI learning and preferences.
 */
export function IntentControlPanel({
  language = 'vi',
  stabilityMetrics,
  onRecoveryAction,
  isExpanded = false,
  onToggleExpanded,
  className = '',
}: IntentControlPanelProps) {
  const [controlState, setControlState] = useState<ControlState>(() => getControlState());
  const [lastActionResult, setLastActionResult] = useState<string | null>(null);

  const copy = getControlCopy(language);

  const refreshState = useCallback(() => {
    setControlState(getControlState());
  }, []);

  const handleAction = useCallback((action: RecoveryAction) => {
    const result = executeRecoveryAction(action, language);
    setLastActionResult(result);
    refreshState();
    onRecoveryAction?.(action, result);

    // Clear result message after 3 seconds
    setTimeout(() => setLastActionResult(null), 3000);
  }, [language, onRecoveryAction, refreshState]);

  // Collapsed view
  if (!isExpanded) {
    return (
      <button
        onClick={onToggleExpanded}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg
          bg-slate-100 dark:bg-slate-800/50
          hover:bg-slate-200 dark:hover:bg-slate-700/50
          text-slate-600 dark:text-slate-400 text-sm
          transition-colors
          ${className}
        `}
      >
        <TrustMicrocopy
          stabilityMetrics={stabilityMetrics}
          hasActivePreferences={controlState.activePreferences.length > 0}
          language={language}
          showTooltip={false}
          compact
        />
        <span className="text-xs">
          {controlState.activePreferences.length > 0
            ? language === 'vi'
              ? `${controlState.activePreferences.length} so thich`
              : `${controlState.activePreferences.length} preferences`
            : language === 'vi'
              ? 'Dang hoc'
              : 'Learning'}
        </span>
      </button>
    );
  }

  // Expanded view
  return (
    <div
      className={`
        bg-white dark:bg-slate-900
        border border-slate-200 dark:border-slate-700
        rounded-xl shadow-lg overflow-hidden
        ${className}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <TrustMicrocopy
            stabilityMetrics={stabilityMetrics}
            hasActivePreferences={controlState.activePreferences.length > 0}
            language={language}
          />
        </div>
        <button
          onClick={onToggleExpanded}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Status indicators */}
        <div className="grid grid-cols-2 gap-3">
          <StatusIndicator
            label={language === 'vi' ? 'So thich' : 'Preferences'}
            value={controlState.preferencesEnabled}
            language={language}
          />
          <StatusIndicator
            label={language === 'vi' ? 'Tu dong' : 'Auto-apply'}
            value={controlState.autoApplyEnabled}
            language={language}
          />
        </div>

        {/* Progress bar */}
        {stabilityMetrics && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-500">
              <span>{language === 'vi' ? 'Do tin cay' : 'Confidence'}</span>
              <span>{stabilityMetrics.stabilityScore}%</span>
            </div>
            <TrustProgressBar stabilityScore={stabilityMetrics.stabilityScore} />
          </div>
        )}

        {/* Active preferences */}
        {controlState.activePreferences.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              {language === 'vi' ? 'So thich da hoc' : 'Learned preferences'}
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {controlState.activePreferences.slice(0, 5).map(pref => (
                <span
                  key={pref.key}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  {getPreferenceLabel(pref.key, language)}
                  <span className="ml-1 opacity-50">
                    {Math.round(pref.strength * 100)}%
                  </span>
                </span>
              ))}
              {controlState.activePreferences.length > 5 && (
                <span className="text-xs text-slate-400">
                  +{controlState.activePreferences.length - 5}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <StatBox
            label={language === 'vi' ? 'Mau' : 'Patterns'}
            value={controlState.learningStats.totalPatterns}
          />
          <StatBox
            label={language === 'vi' ? 'Tu dong' : 'Auto'}
            value={controlState.learningStats.autoApplyableCount}
          />
          <StatBox
            label={language === 'vi' ? 'So thich' : 'Prefs'}
            value={controlState.preferenceStats.activePreferences}
          />
        </div>

        {/* Action result message */}
        {lastActionResult && (
          <div className="px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-sm text-center animate-fade-in">
            {lastActionResult}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <ActionButton
            label={copy.disableTemporarily}
            onClick={() => handleAction({ type: 'DISABLE_PREFERENCES_TEMP' })}
            disabled={!controlState.preferencesEnabled}
            variant="secondary"
          />
          <ActionButton
            label={copy.resetPreferences}
            onClick={() => handleAction({ type: 'RESET_ALL_PREFERENCES' })}
            variant="danger"
          />
          <ActionButton
            label={copy.resetLearning}
            onClick={() => handleAction({ type: 'RESET_ALL_LEARNING' })}
            variant="danger"
          />
        </div>
      </div>
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

function StatusIndicator({
  label,
  value,
  language,
}: {
  label: string;
  value: boolean;
  language: Language;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/30">
      <span className="text-xs text-slate-600 dark:text-slate-400">{label}</span>
      <span className={`text-xs font-medium ${value ? 'text-emerald-600' : 'text-slate-400'}`}>
        {value
          ? language === 'vi' ? 'Bat' : 'On'
          : language === 'vi' ? 'Tat' : 'Off'}
      </span>
    </div>
  );
}

function StatBox({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="px-2 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/30">
      <div className="text-lg font-semibold text-slate-700 dark:text-slate-300">{value}</div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  disabled = false,
  variant = 'primary',
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300',
    danger: 'bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        px-3 py-1.5 rounded-lg text-xs font-medium
        transition-colors
        ${variantClasses[variant]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      {label}
    </button>
  );
}

/**
 * Compact recovery button for inline use
 */
export function RecoveryButton({
  action,
  label,
  language = 'vi',
  onComplete,
  className = '',
}: {
  action: RecoveryAction;
  label?: string;
  language?: Language;
  onComplete?: (result: string) => void;
  className?: string;
}) {
  const [isExecuting, setIsExecuting] = useState(false);
  const copy = getControlCopy(language);

  const handleClick = useCallback(() => {
    setIsExecuting(true);
    const result = executeRecoveryAction(action, language);
    onComplete?.(result);
    setTimeout(() => setIsExecuting(false), 1000);
  }, [action, language, onComplete]);

  const buttonLabel = label || (action.type === 'UNDO_LAST_INTENT'
    ? copy.undoAction
    : action.type === 'DONT_DO_THIS_AGAIN'
      ? copy.dontDoThisAgain
      : copy.resetLearning);

  return (
    <button
      onClick={handleClick}
      disabled={isExecuting}
      className={`
        px-2 py-1 rounded text-xs
        bg-slate-100 dark:bg-slate-800
        hover:bg-slate-200 dark:hover:bg-slate-700
        text-slate-600 dark:text-slate-400
        transition-colors
        ${isExecuting ? 'opacity-50' : ''}
        ${className}
      `}
    >
      {isExecuting ? '...' : buttonLabel}
    </button>
  );
}

export default IntentControlPanel;
