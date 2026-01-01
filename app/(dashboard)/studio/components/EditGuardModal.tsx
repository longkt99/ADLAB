'use client';

// ============================================
// STEP 16: Edit Guard Modal
// ============================================
// Human-in-the-loop confirmation when AI output
// violates the expected edit scope.
//
// Shows when:
// - User requested light edit (MICRO_POLISH, FLOW_SMOOTHING)
// - AI produced heavy changes (structural rewrites)
//
// INVARIANTS:
// - Pure UI, no LLM calls
// - No persistence
// - Non-blocking UX (user can accept/reject)
// ============================================

import React, { useMemo } from 'react';
import {
  type EditorialOp,
  type EditorialOpType,
  type EditorialScope,
  getEditorialOpLabel,
  getScopeLabel,
  getOperationWeight,
  getScopeWeight,
} from '@/lib/studio/editorialOpPrompt';

// ============================================
// Types
// ============================================

/**
 * Severity level of edit guard violation
 */
export type EditGuardSeverity = 'low' | 'medium' | 'high';

/**
 * Result of edit guard evaluation
 */
export interface EditGuardResult {
  /** Whether the output violates the expected scope */
  violated: boolean;
  /** Severity of the violation */
  severity: EditGuardSeverity;
  /** Human-readable reason */
  reason: string;
  /** Detected operation in the output */
  detectedOp?: EditorialOpType;
  /** Detected scope in the output */
  detectedScope?: EditorialScope;
  /** Metrics used for detection */
  metrics: {
    lengthRatio: number;
    structuralChangeScore: number;
    semanticDriftScore: number;
  };
}

/**
 * Props for EditGuardModal
 */
interface EditGuardModalProps {
  /** The original editorial operation requested */
  requestedOp: EditorialOp;
  /** The edit guard evaluation result */
  guardResult: EditGuardResult;
  /** Original text before edit */
  originalText: string;
  /** New text produced by AI */
  newText: string;
  /** Accept the changes despite violation */
  onAccept: () => void;
  /** Reject and revert to original */
  onReject: () => void;
  /** Cancel and dismiss modal */
  onCancel: () => void;
  /** Language for labels */
  language?: 'vi' | 'en';
}

// ============================================
// Edit Guard Evaluation (Pure Function)
// ============================================

/**
 * Evaluate if AI output violates the requested editorial scope.
 * Pure function - no LLM calls, no side effects.
 *
 * Detection heuristics:
 * 1. Length ratio: significant length change suggests heavy edit
 * 2. Structural changes: paragraph count, sentence count changes
 * 3. Semantic drift: keyword preservation ratio
 *
 * @param originalText - The original text before edit
 * @param newText - The AI-generated text
 * @param requestedOp - The editorial operation that was requested
 * @returns EditGuardResult with violation status and metrics
 */
export function evaluateEditGuard(
  originalText: string,
  newText: string,
  requestedOp: EditorialOp
): EditGuardResult {
  // Normalize texts
  const original = originalText.trim();
  const output = newText.trim();

  // Empty check
  if (!original || !output) {
    return {
      violated: false,
      severity: 'low',
      reason: 'Empty text',
      metrics: { lengthRatio: 1, structuralChangeScore: 0, semanticDriftScore: 0 },
    };
  }

  // Calculate metrics
  const lengthRatio = output.length / original.length;
  const structuralChangeScore = calculateStructuralChange(original, output);
  const semanticDriftScore = calculateSemanticDrift(original, output);

  // Determine expected thresholds based on requested operation
  const thresholds = getThresholdsForOp(requestedOp.op, requestedOp.scope);

  // Check for violations
  const lengthViolation = lengthRatio < thresholds.minLengthRatio || lengthRatio > thresholds.maxLengthRatio;
  const structuralViolation = structuralChangeScore > thresholds.maxStructuralChange;
  const semanticViolation = semanticDriftScore > thresholds.maxSemanticDrift;

  const violated = lengthViolation || structuralViolation || semanticViolation;

  // Determine severity
  let severity: EditGuardSeverity = 'low';
  let violationCount = 0;
  if (lengthViolation) violationCount++;
  if (structuralViolation) violationCount++;
  if (semanticViolation) violationCount++;

  if (violationCount >= 3) {
    severity = 'high';
  } else if (violationCount >= 2) {
    severity = 'medium';
  } else if (violated) {
    severity = 'low';
  }

  // Boost severity for light ops with heavy violations
  if (requestedOp.op === 'MICRO_POLISH' || requestedOp.op === 'FLOW_SMOOTHING') {
    if (structuralViolation && structuralChangeScore > 0.5) {
      severity = 'high';
    }
  }

  // Build reason
  const reason = buildViolationReason(
    violated,
    lengthViolation,
    structuralViolation,
    semanticViolation,
    lengthRatio,
    requestedOp
  );

  // Detect what operation was actually performed
  const { detectedOp, detectedScope } = detectActualOperation(
    lengthRatio,
    structuralChangeScore,
    semanticDriftScore
  );

  return {
    violated,
    severity,
    reason,
    detectedOp,
    detectedScope,
    metrics: {
      lengthRatio,
      structuralChangeScore,
      semanticDriftScore,
    },
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Calculate structural change score (0-1)
 * Based on paragraph and sentence count changes
 */
function calculateStructuralChange(original: string, output: string): number {
  // Count paragraphs (double newlines)
  const originalParas = original.split(/\n\s*\n/).filter(p => p.trim()).length;
  const outputParas = output.split(/\n\s*\n/).filter(p => p.trim()).length;

  // Count sentences (rough approximation)
  const originalSentences = original.split(/[.!?]+/).filter(s => s.trim()).length;
  const outputSentences = output.split(/[.!?]+/).filter(s => s.trim()).length;

  // Calculate change ratios
  const paraChange = originalParas > 0
    ? Math.abs(outputParas - originalParas) / originalParas
    : outputParas > 0 ? 1 : 0;

  const sentenceChange = originalSentences > 0
    ? Math.abs(outputSentences - originalSentences) / originalSentences
    : outputSentences > 0 ? 1 : 0;

  // Combined score (weighted average)
  return Math.min(1, (paraChange * 0.6 + sentenceChange * 0.4));
}

/**
 * Calculate semantic drift score (0-1)
 * Based on keyword preservation
 */
function calculateSemanticDrift(original: string, output: string): number {
  // Extract significant words (3+ chars, not common words)
  const commonWords = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her',
    'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its',
    'may', 'new', 'now', 'old', 'see', 'way', 'who', 'did', 'let', 'say', 'she',
    'too', 'use', 'trong', 'nhu', 'cua', 'cho', 'voi', 'khi', 'duoc', 'nay',
    'mot', 'cac', 'nhung', 'den', 'con', 'thi', 'hay', 'bang', 'vao', 'that',
  ]);

  const extractKeywords = (text: string): Set<string> => {
    const words = text
      .toLowerCase()
      .normalize('NFC')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !commonWords.has(w));
    return new Set(words);
  };

  const originalKeywords = extractKeywords(original);
  const outputKeywords = extractKeywords(output);

  if (originalKeywords.size === 0) return 0;

  // Calculate preservation ratio
  let preserved = 0;
  for (const keyword of originalKeywords) {
    if (outputKeywords.has(keyword)) {
      preserved++;
    }
  }

  const preservationRatio = preserved / originalKeywords.size;

  // Drift is inverse of preservation (1 - preservation)
  return 1 - preservationRatio;
}

/**
 * Get thresholds for a given operation type
 */
function getThresholdsForOp(
  op: EditorialOpType,
  scope: EditorialScope
): {
  minLengthRatio: number;
  maxLengthRatio: number;
  maxStructuralChange: number;
  maxSemanticDrift: number;
} {
  // Base thresholds by operation weight
  const opWeight = getOperationWeight(op);
  const scopeWeight = getScopeWeight(scope);

  // Light edits (weight 1-2): very strict
  if (opWeight <= 2) {
    return {
      minLengthRatio: 0.85,
      maxLengthRatio: 1.15,
      maxStructuralChange: 0.15,
      maxSemanticDrift: 0.2,
    };
  }

  // Medium edits (weight 3-4): moderate
  if (opWeight <= 4) {
    return {
      minLengthRatio: 0.6,
      maxLengthRatio: 1.4,
      maxStructuralChange: 0.4,
      maxSemanticDrift: 0.35,
    };
  }

  // Heavy edits (weight 5-6): permissive
  return {
    minLengthRatio: 0.3,
    maxLengthRatio: 2.0,
    maxStructuralChange: 0.7,
    maxSemanticDrift: 0.5,
  };
}

/**
 * Detect what operation was actually performed based on metrics
 */
function detectActualOperation(
  lengthRatio: number,
  structuralChange: number,
  semanticDrift: number
): { detectedOp?: EditorialOpType; detectedScope?: EditorialScope } {
  // Very minimal changes
  if (structuralChange < 0.1 && semanticDrift < 0.1 && lengthRatio > 0.9 && lengthRatio < 1.1) {
    return { detectedOp: 'MICRO_POLISH', detectedScope: 'WORDING_ONLY' };
  }

  // Light changes
  if (structuralChange < 0.2 && semanticDrift < 0.2) {
    return { detectedOp: 'FLOW_SMOOTHING', detectedScope: 'SENTENCE_LEVEL' };
  }

  // Significant shortening
  if (lengthRatio < 0.7) {
    return { detectedOp: 'TRIM', detectedScope: 'PARAGRAPH_LEVEL' };
  }

  // Moderate restructuring
  if (structuralChange < 0.5 && semanticDrift < 0.4) {
    return { detectedOp: 'SECTION_REWRITE', detectedScope: 'SECTION_LEVEL' };
  }

  // Heavy changes
  if (structuralChange >= 0.5 || semanticDrift >= 0.4) {
    if (semanticDrift >= 0.5) {
      return { detectedOp: 'FULL_REWRITE', detectedScope: 'FULL' };
    }
    return { detectedOp: 'BODY_REWRITE', detectedScope: 'SECTION_LEVEL' };
  }

  return {};
}

/**
 * Build human-readable violation reason
 */
function buildViolationReason(
  violated: boolean,
  lengthViolation: boolean,
  structuralViolation: boolean,
  semanticViolation: boolean,
  lengthRatio: number,
  requestedOp: EditorialOp
): string {
  if (!violated) {
    return 'Output matches expected scope';
  }

  const reasons: string[] = [];

  if (lengthViolation) {
    if (lengthRatio < 1) {
      reasons.push(`shortened by ${Math.round((1 - lengthRatio) * 100)}%`);
    } else {
      reasons.push(`lengthened by ${Math.round((lengthRatio - 1) * 100)}%`);
    }
  }

  if (structuralViolation) {
    reasons.push('structural changes detected');
  }

  if (semanticViolation) {
    reasons.push('significant content changes');
  }

  const requestedLabel = getEditorialOpLabel(requestedOp.op, 'en');
  return `Requested "${requestedLabel}" but: ${reasons.join(', ')}`;
}

// ============================================
// UI Components
// ============================================

/**
 * Severity badge component
 */
function SeverityBadge({
  severity,
  language,
}: {
  severity: EditGuardSeverity;
  language: 'vi' | 'en';
}) {
  const config = {
    low: {
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      text: 'text-yellow-800 dark:text-yellow-200',
      label: { vi: 'Nhẹ', en: 'Low' },
    },
    medium: {
      bg: 'bg-orange-100 dark:bg-orange-900/30',
      text: 'text-orange-800 dark:text-orange-200',
      label: { vi: 'Trung bình', en: 'Medium' },
    },
    high: {
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-800 dark:text-red-200',
      label: { vi: 'Cao', en: 'High' },
    },
  };

  const c = config[severity];

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label[language]}
    </span>
  );
}

/**
 * Metrics display component
 */
function MetricsDisplay({
  metrics,
  language,
}: {
  metrics: EditGuardResult['metrics'];
  language: 'vi' | 'en';
}) {
  const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

  return (
    <div className="grid grid-cols-3 gap-2 text-xs">
      <div className="p-2 rounded bg-gray-50 dark:bg-gray-800">
        <div className="text-gray-500 dark:text-gray-400 mb-1">
          {language === 'vi' ? 'Tỷ lệ độ dài' : 'Length ratio'}
        </div>
        <div className="font-medium text-gray-700 dark:text-gray-300">
          {formatPercent(metrics.lengthRatio)}
        </div>
      </div>
      <div className="p-2 rounded bg-gray-50 dark:bg-gray-800">
        <div className="text-gray-500 dark:text-gray-400 mb-1">
          {language === 'vi' ? 'Thay đổi cấu trúc' : 'Structure change'}
        </div>
        <div className="font-medium text-gray-700 dark:text-gray-300">
          {formatPercent(metrics.structuralChangeScore)}
        </div>
      </div>
      <div className="p-2 rounded bg-gray-50 dark:bg-gray-800">
        <div className="text-gray-500 dark:text-gray-400 mb-1">
          {language === 'vi' ? 'Thay đổi nội dung' : 'Content drift'}
        </div>
        <div className="font-medium text-gray-700 dark:text-gray-300">
          {formatPercent(metrics.semanticDriftScore)}
        </div>
      </div>
    </div>
  );
}

/**
 * Edit Guard Modal Component
 */
export function EditGuardModal({
  requestedOp,
  guardResult,
  originalText,
  newText,
  onAccept,
  onReject,
  onCancel,
  language = 'vi',
}: EditGuardModalProps) {
  const title = useMemo(() => {
    if (language === 'vi') {
      return guardResult.severity === 'high'
        ? 'AI thay đổi quá nhiều'
        : 'AI thay đổi hơn yêu cầu';
    }
    return guardResult.severity === 'high'
      ? 'AI changed too much'
      : 'AI changed more than requested';
  }, [guardResult.severity, language]);

  const description = useMemo(() => {
    if (language === 'vi') {
      return `Bạn yêu cầu "${getEditorialOpLabel(requestedOp.op, 'vi')}" nhưng AI đã thay đổi nhiều hơn.`;
    }
    return `You requested "${getEditorialOpLabel(requestedOp.op, 'en')}" but AI made more changes.`;
  }, [requestedOp.op, language]);

  const detectedLabel = guardResult.detectedOp
    ? getEditorialOpLabel(guardResult.detectedOp, language)
    : language === 'vi' ? 'Không xác định' : 'Unknown';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-amber-50 dark:bg-amber-900/20">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <span>{guardResult.severity === 'high' ? '🚨' : '⚠️'}</span>
              {title}
            </h3>
            <SeverityBadge severity={guardResult.severity} language={language} />
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {description}
          </p>
        </div>

        {/* Content */}
        <div className="px-4 py-3 space-y-3">
          {/* Operation comparison */}
          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="text-gray-500 dark:text-gray-400">
                {language === 'vi' ? 'Yêu cầu: ' : 'Requested: '}
              </span>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {getEditorialOpLabel(requestedOp.op, language)}
              </span>
            </div>
            <span className="text-gray-400">→</span>
            <div>
              <span className="text-gray-500 dark:text-gray-400">
                {language === 'vi' ? 'Thực tế: ' : 'Actual: '}
              </span>
              <span className="font-medium text-amber-700 dark:text-amber-300">
                {detectedLabel}
              </span>
            </div>
          </div>

          {/* Reason */}
          <div className="p-2 rounded bg-gray-50 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-400">
            {guardResult.reason}
          </div>

          {/* Metrics */}
          <MetricsDisplay metrics={guardResult.metrics} language={language} />

          {/* Preview diff hint */}
          <div className="text-[10px] text-gray-400 text-center">
            {language === 'vi'
              ? `Gốc: ${originalText.length} ký tự → Mới: ${newText.length} ký tự`
              : `Original: ${originalText.length} chars → New: ${newText.length} chars`}
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
          >
            {language === 'vi' ? 'Hủy' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={onReject}
            className="px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 rounded transition-colors"
          >
            {language === 'vi' ? 'Hoàn tác' : 'Revert'}
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
          >
            {language === 'vi' ? 'Chấp nhận thay đổi' : 'Accept changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Debug Helper
// ============================================

/**
 * Get debug summary of edit guard result
 */
export function getEditGuardDebugSummary(result: EditGuardResult): string {
  if (!result.violated) return 'OK';
  return `VIOLATED:${result.severity} [L:${Math.round(result.metrics.lengthRatio * 100)}% S:${Math.round(result.metrics.structuralChangeScore * 100)}% D:${Math.round(result.metrics.semanticDriftScore * 100)}%]`;
}

export default EditGuardModal;
