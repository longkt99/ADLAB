// ============================================
// Quality Feedback
// ============================================
// Transforms internal QualityLockResult to user-facing feedback
// All messages in Vietnamese, outcome-based language

import type { QualityLockResult, RuleResult } from './intentQualityRules';
import { getRuleMessage } from './qualityMessages';

/**
 * User-facing quality status
 */
export type QualityStatus = 'PASS' | 'WARNING' | 'FAIL';

/**
 * Quality score bands for UI display
 */
export type QualityBand = 'strong' | 'acceptable' | 'needs_improvement';

/**
 * A single user-facing issue
 */
export interface QualityIssue {
  id: string;                     // Internal rule ID (for debugging)
  severity: 'critical' | 'minor'; // Maps from HARD/SOFT
  title: string;                  // Short, user-friendly title (Vietnamese)
  suggestion: string;             // Actionable fix suggestion (Vietnamese)
}

/**
 * Complete user-facing quality feedback
 */
export interface QualityFeedback {
  status: QualityStatus;
  score: number;                  // 0-100
  band: QualityBand;
  issues: QualityIssue[];
  summary: string;                // One-line summary for UI header
  canApprove: boolean;            // Whether "Đặt làm bản cuối" is allowed
}

/**
 * Calculate quality score from hard/soft fail counts
 *
 * Scoring rules:
 * - Base score: 100
 * - Any HARD fail: cap at 60
 * - Each SOFT fail: -10 points
 * - Minimum score: 0
 */
export function calculateQualityScore(
  hardFailCount: number,
  softFailCount: number
): { score: number; band: QualityBand; status: QualityStatus } {
  let score = 100;
  let status: QualityStatus = 'PASS';

  // HARD fails cap the score and set FAIL status
  if (hardFailCount > 0) {
    score = Math.min(60, score);
    status = 'FAIL';
  }

  // SOFT fails reduce score by 10 each
  score = Math.max(0, score - (softFailCount * 10));

  // If only SOFT fails, status is WARNING
  if (hardFailCount === 0 && softFailCount > 0) {
    status = 'WARNING';
  }

  // Determine band
  let band: QualityBand;
  if (score >= 85) {
    band = 'strong';
  } else if (score >= 70) {
    band = 'acceptable';
  } else {
    band = 'needs_improvement';
  }

  return { score, band, status };
}

/**
 * Convert RuleResult to QualityIssue
 */
function ruleToIssue(rule: RuleResult, severity: 'critical' | 'minor'): QualityIssue {
  const messages = getRuleMessage(rule.id);
  return {
    id: rule.id,
    severity,
    title: messages.title,
    suggestion: messages.suggestion,
  };
}

/**
 * Generate user-friendly summary based on status and issues
 */
function generateSummary(status: QualityStatus, score: number, issueCount: number): string {
  if (status === 'PASS' && issueCount === 0) {
    return 'Nội dung đạt chất lượng tốt, sẵn sàng sử dụng.';
  }
  if (status === 'PASS') {
    return 'Nội dung đạt yêu cầu.';
  }
  if (status === 'WARNING') {
    return `Nội dung có ${issueCount} điểm có thể cải thiện.`;
  }
  // FAIL
  return `Nội dung chưa đạt yêu cầu. Cần sửa ${issueCount} vấn đề.`;
}

/**
 * Transform QualityLockResult to user-facing QualityFeedback
 */
export function transformToFeedback(result: QualityLockResult): QualityFeedback {
  const { score, band, status } = calculateQualityScore(
    result.hardFails.length,
    result.softFails.length
  );

  // Transform rule results to user-facing issues
  // Critical (HARD) issues first, then minor (SOFT) issues
  const issues: QualityIssue[] = [
    ...result.hardFails.map(r => ruleToIssue(r, 'critical')),
    ...result.softFails.map(r => ruleToIssue(r, 'minor')),
  ];

  // Generate summary
  const summary = generateSummary(status, score, issues.length);

  return {
    status,
    score,
    band,
    issues,
    summary,
    canApprove: status !== 'FAIL',
  };
}

/**
 * Get badge text for quality band
 */
export function getBadgeText(band: QualityBand): string {
  switch (band) {
    case 'strong':
      return 'Chất lượng tốt';
    case 'acceptable':
      return 'Có thể cải thiện';
    case 'needs_improvement':
      return 'Cần sửa';
  }
}

/**
 * Get status icon for display
 */
export function getStatusIcon(status: QualityStatus): string {
  switch (status) {
    case 'PASS':
      return '✓';
    case 'WARNING':
      return '⚠';
    case 'FAIL':
      return '✗';
  }
}
