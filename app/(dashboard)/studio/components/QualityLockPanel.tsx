'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { QualityDecision } from '@/types/studio';
import type { RuleResult } from '@/lib/quality/intentQualityRules';
import { getRuleDisplay, getRuleTitle, getRuleSeverityLabel } from '@/lib/quality/ruleDisplayMap';
import { useAutoFixOnboarding } from '@/lib/studio/useAutoFixOnboarding';
import { track, trackQLPanelViewed } from '@/lib/analytics/track';
import { DraftState, AssistMode } from '@/types/analytics';

// ============================================
// Types
// ============================================

export interface QualityLockPanelProps {
  decision: QualityDecision;
  hardFails: RuleResult[];
  softFails: RuleResult[];
  testMode?: boolean;
  intent?: string;
  autoFixAttempts?: number;
  onAutoFix?: () => void;
  autoFixLoading?: boolean;
  /** Previous decision before Auto Fix was applied (for showing improvement indicator) */
  previousDecision?: QualityDecision;
  /** Message ID for analytics tracking */
  messageId?: string;
}

// ============================================
// Friendly Labels (Vietnamese)
// ============================================

const STATUS_CONFIG: Record<QualityDecision, {
  label: string;
  summary: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  icon: React.ReactNode;
}> = {
  PASS: {
    label: 'Ổn rồi',
    summary: 'Sẵn sàng dùng',
    bgClass: 'bg-zinc-50 dark:bg-zinc-900/50',
    textClass: 'text-zinc-600 dark:text-zinc-400',
    borderClass: 'border-zinc-200 dark:border-zinc-800',
    icon: <Icon name="check" size={14} />,
  },
  DRAFT: {
    label: 'Cần chỉnh nhẹ',
    summary: 'Có vài gợi ý cải thiện',
    bgClass: 'bg-zinc-50 dark:bg-zinc-900/50',
    textClass: 'text-amber-600 dark:text-amber-400',
    borderClass: 'border-zinc-200 dark:border-zinc-800',
    icon: <Icon name="alert" size={14} />,
  },
  FAIL: {
    label: 'Cần chỉnh',
    summary: 'Cần điều chỉnh trước khi dùng',
    bgClass: 'bg-zinc-50 dark:bg-zinc-900/50',
    textClass: 'text-red-600 dark:text-red-400',
    borderClass: 'border-zinc-200 dark:border-zinc-800',
    icon: <Icon name="close" size={14} />,
  },
};

// ============================================
// Rule Display Helpers (using ruleDisplayMap)
// ============================================

/**
 * Get friendly title for a rule (uses ruleDisplayMap with fallback)
 */
function getRuleFriendlyTitle(rule: RuleResult): string {
  return getRuleTitle(rule.id, rule.message);
}

// ============================================
// Sub-components
// ============================================

function RuleItem({ rule, severity, templateId: _templateId, messageId: _messageId }: { rule: RuleResult; severity: 'HARD' | 'SOFT'; templateId?: string; messageId?: string }) {
  const [showDetails, setShowDetails] = useState(false);

  const handleToggleDetails = useCallback(() => {
    setShowDetails(prev => !prev);
  }, []);

  // Get display metadata from ruleDisplayMap
  const display = getRuleDisplay(rule.id);
  const title = display?.title || rule.message;
  const description = display?.description;
  const suggestion = display?.suggestion;
  const _severityLabel = getRuleSeverityLabel(rule.id, severity);

  // Has expandable content?
  const hasExpandableContent = suggestion || rule.details !== undefined;

  return (
    <li className="text-[11px]">
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 flex-shrink-0 text-[10px] ${severity === 'HARD' ? 'text-red-500 dark:text-red-400' : 'text-amber-500 dark:text-amber-400'}`}>
          {severity === 'HARD' ? '!' : '·'}
        </span>
        <div className="flex-1 min-w-0">
          {/* Title - muted, editorial */}
          <span className="text-zinc-700 dark:text-zinc-300">
            {title}
          </span>

          {/* Description (muted, optional) */}
          {description && (
            <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-500">
              {description}
            </p>
          )}

          {/* Expandable details link */}
          {hasExpandableContent && (
            <button
              onClick={handleToggleDetails}
              className="mt-1 text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              {showDetails ? '− Ẩn' : '+ Chi tiết'}
            </button>
          )}

          {/* Expanded content */}
          {showDetails && hasExpandableContent && (
            <div className="mt-2 pl-3 border-l-2 border-zinc-200 dark:border-zinc-700 text-[10px] space-y-1">
              {suggestion && (
                <p className="text-zinc-600 dark:text-zinc-400">
                  {suggestion}
                </p>
              )}
              {rule.details !== undefined && (
                <pre className="font-mono text-zinc-400 dark:text-zinc-500 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(rule.details, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

// ============================================
// Main Component
// ============================================

// Helper to determine if decision improved
function didDecisionImprove(current: QualityDecision, previous?: QualityDecision): boolean {
  if (!previous) return false;
  const rank: Record<QualityDecision, number> = { FAIL: 0, DRAFT: 1, PASS: 2 };
  return rank[current] > rank[previous];
}

export default function QualityLockPanel({
  decision,
  hardFails,
  softFails,
  testMode = false,
  intent,
  autoFixAttempts = 0,
  onAutoFix,
  autoFixLoading = false,
  previousDecision,
  messageId,
}: QualityLockPanelProps) {
  const config = STATUS_CONFIG[decision];
  const totalIssues = hardFails.length + softFails.length;

  // Check if state improved after Auto Fix was applied
  const hasImproved = didDecisionImprove(decision, previousDecision);

  // Expand by default for FAIL, collapsed for PASS, partially for DRAFT
  const [isExpanded, setIsExpanded] = useState(decision === 'FAIL');

  // Track panel expand/collapse
  const handleToggleExpand = useCallback(() => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);

    if (newExpanded && messageId) {
      trackQLPanelViewed({
        draft_id: messageId,
        message_id: messageId,
        ui_surface: 'panel',
        editor_state: DraftState.D0_ACTIVE,
        assist_mode: AssistMode.A0_ASSIST_NORMAL,
      });
    }
  }, [isExpanded, messageId]);

  // Onboarding state for first-time hint
  const { showHint, markHintSeen } = useAutoFixOnboarding();
  const [hintVisible, setHintVisible] = useState(false);

  // Show hint only when expanded and Auto Fix is available
  const canShowAutoFix = onAutoFix && (decision === 'DRAFT' || decision === 'FAIL') && autoFixAttempts < 2;

  useEffect(() => {
    if (isExpanded && canShowAutoFix && showHint) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Show hint when conditions are met
      setHintVisible(true);
    }
  }, [isExpanded, canShowAutoFix, showHint]);

  // Dismiss hint when user clicks Auto Fix or after timeout
  const handleAutoFixClick = useCallback(() => {
    if (hintVisible) {
      markHintSeen();
      setHintVisible(false);
    }
    onAutoFix?.();
  }, [hintVisible, markHintSeen, onAutoFix]);

  // Copy issues to clipboard
  const handleCopyIssues = useCallback(async () => {
    const lines: string[] = [];
    lines.push(`Quality Lock: ${decision}`);
    lines.push('');

    if (hardFails.length > 0) {
      lines.push('📛 Bắt buộc (Critical):');
      hardFails.forEach((rule) => {
        const title = getRuleFriendlyTitle(rule);
        lines.push(`  - [${rule.id}] ${title}`);
      });
      lines.push('');
    }

    if (softFails.length > 0) {
      lines.push('⚠️ Gợi ý cải thiện (Quality):');
      softFails.forEach((rule) => {
        const title = getRuleFriendlyTitle(rule);
        lines.push(`  - [${rule.id}] ${title}`);
      });
    }

    try {
      await navigator.clipboard.writeText(lines.join('\n'));

      // Track issues copied (using generic track for non-spec events)
      track('quality_lock.blocked_action', {
        draft_id: messageId || 'unknown',
        ui_surface: 'panel',
        editor_state: DraftState.D0_ACTIVE,
        assist_mode: AssistMode.A0_ASSIST_NORMAL,
        action: 'copy_issues',
        issue_count: hardFails.length + softFails.length,
      });
    } catch (error) {
      console.error('Failed to copy issues:', error);
    }
  }, [decision, hardFails, softFails, messageId]);

  // For PASS, show minimal collapsed view
  if (decision === 'PASS') {
    return (
      <div className="mx-5 mb-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/60">
        <div className="flex items-center gap-2">
          <span className="text-zinc-400 dark:text-zinc-500">{config.icon}</span>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {config.summary}
          </span>
          {hasImproved && (
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
              · đã điều chỉnh
            </span>
          )}
          {testMode && (
            <span className="ml-auto text-[9px] text-zinc-400 dark:text-zinc-500 font-mono">
              test
            </span>
          )}
        </div>
      </div>
    );
  }

  // For DRAFT/FAIL, show expandable panel
  return (
    <div className="mx-5 mb-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/60">
      {/* Header - always visible, keyboard accessible expand/collapse
       * Interaction: calm transition-transform on chevron, focus-visible ring */}
      <button
        type="button"
        onClick={handleToggleExpand}
        className="w-full flex items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 focus-visible:ring-offset-1 rounded-sm"
        aria-expanded={isExpanded}
        aria-controls="quality-issues-panel"
      >
        <span className={config.textClass}>{config.icon}</span>
        <span className={`text-[11px] ${config.textClass}`}>
          {config.summary}
        </span>
        {!isExpanded && totalIssues > 0 && (
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
            ({totalIssues})
          </span>
        )}
        {hasImproved && (
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
            · đã điều chỉnh
          </span>
        )}
        {testMode && (
          <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono">
            test
          </span>
        )}
        <Icon name="chevronDown" size={12} className={`ml-auto text-zinc-400 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Expanded content - animated reveal with calm opacity */}
      {isExpanded && (
        <div id="quality-issues-panel" className="mt-3 space-y-3 animate-fade-in">
          {/* testMode note */}
          {testMode && (
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 italic">
              Một số tiêu chí được bỏ qua (test mode)
            </p>
          )}

          {/* HARD fails (Critical) */}
          {hardFails.length > 0 && (
            <div>
              <h4 className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                Bắt buộc
              </h4>
              <ul className="space-y-1.5">
                {hardFails.map((rule, i) => (
                  <RuleItem key={rule.id || i} rule={rule} severity="HARD" templateId={intent} messageId={messageId} />
                ))}
              </ul>
            </div>
          )}

          {/* SOFT fails (Quality suggestions) */}
          {softFails.length > 0 && (
            <div>
              <h4 className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                Gợi ý
              </h4>
              <ul className="space-y-1.5">
                {softFails.map((rule, i) => (
                  <RuleItem key={rule.id || i} rule={rule} severity="SOFT" templateId={intent} messageId={messageId} />
                ))}
              </ul>
            </div>
          )}

          {/* Action buttons - keyboard accessible with focus-visible rings */}
          <div className="pt-2 flex items-center gap-3" role="group" aria-label="Quality actions">
            {/* Auto Fix button - calm, text-only style with focus ring */}
            {canShowAutoFix && (
              <div className="relative">
                <button
                  type="button"
                  onClick={handleAutoFixClick}
                  disabled={autoFixLoading}
                  className={`text-[11px] transition-colors duration-150 flex items-center gap-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 focus-visible:ring-offset-1 ${
                    autoFixLoading
                      ? 'text-zinc-400 cursor-wait'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                  aria-label={autoFixLoading ? 'Preparing suggestions...' : 'View fix suggestions'}
                  aria-busy={autoFixLoading}
                >
                  {autoFixLoading ? (
                    <>
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Đang chuẩn bị...</span>
                    </>
                  ) : (
                    <>
                      <Icon name="edit" size={12} />
                      <span>Xem gợi ý sửa</span>
                    </>
                  )}
                </button>

                {/* First-time hint - tooltip with calm fade */}
                {hintVisible && !autoFixLoading && (
                  <div className="absolute left-0 top-full mt-1.5 w-48 p-2 bg-zinc-800 dark:bg-zinc-700 text-white text-[10px] leading-relaxed rounded shadow-lg z-10 animate-fade-in" role="tooltip">
                    <p>Xem trước bản điều chỉnh — bạn quyết định.</p>
                    <button
                      type="button"
                      onClick={() => { markHintSeen(); setHintVisible(false); }}
                      className="mt-1 text-zinc-400 hover:text-white transition-colors duration-150"
                    >
                      Đã hiểu
                    </button>
                    <div className="absolute -top-1 left-3 w-2 h-2 bg-zinc-800 dark:bg-zinc-700 transform rotate-45" aria-hidden="true" />
                  </div>
                )}
              </div>
            )}

            {/* Attempts indicator */}
            {autoFixAttempts > 0 && autoFixAttempts < 2 && (
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500" aria-label={`${autoFixAttempts} attempt`}>
                ({autoFixAttempts} lần)
              </span>
            )}
            {autoFixAttempts >= 2 && (
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                Có thể chỉnh tay
              </span>
            )}

            {/* Copy issues button */}
            <button
              type="button"
              onClick={handleCopyIssues}
              className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors duration-150 flex items-center gap-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 focus-visible:ring-offset-1"
              aria-label="Copy issues to clipboard"
            >
              <Icon name="copy" size={12} />
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
