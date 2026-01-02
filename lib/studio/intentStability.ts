// ============================================
// STEP 10: Intent Stability & Trust Signals
// ============================================
// Computes a privacy-safe stability score per patternHash
// using local-only aggregates from existing learning/outcome stores.
//
// INVARIANTS:
// - Read-only for routing: NEVER affects execution decisions
// - Privacy-safe: only uses patternHash and aggregates
// - Local-only: all data from localStorage
// - Observability: for UX hints and debug only
// ============================================

import { getPatternReliability, getAutoApplyChoice } from './intentLearning';
import * as outcomeStore from './intentOutcomeStore';

// ============================================
// Configuration (tuneable constants)
// ============================================

/** Base stability score */
const BASE_SCORE = 50;

/** Points added per accepted outcome (max 3 counted) */
const POINTS_PER_ACCEPTED = 8;
const MAX_ACCEPTED_POINTS = 24; // +8 * 3

/** Points subtracted per high-severity negative (max 3 counted) */
const POINTS_PER_HIGH_NEGATIVE = 18;
const MAX_HIGH_NEGATIVE_PENALTY = 54; // -18 * 3

/** Points subtracted per medium-severity negative (max 3 counted) */
const POINTS_PER_MEDIUM_NEGATIVE = 8;
const MAX_MEDIUM_NEGATIVE_PENALTY = 24; // -8 * 3

/** Minimum evidence count for full score range */
const MIN_EVIDENCE_COUNT = 3;
/** Score cap when evidence is insufficient */
const LOW_EVIDENCE_SCORE_CAP = 60;

/** Band thresholds */
const HIGH_BAND_THRESHOLD = 80;
const MEDIUM_BAND_THRESHOLD = 50;

// ============================================
// Types
// ============================================

export type StabilityBand = 'HIGH' | 'MEDIUM' | 'LOW';

export interface StabilityMetrics {
  /** Pattern hash this stability is computed for */
  patternHash: string;
  /** Stability score 0-100 */
  stabilityScore: number;
  /** Stability band */
  band: StabilityBand;
  /** Count of accepted outcomes */
  acceptedCount: number;
  /** Count of high-severity negative outcomes */
  negativeHighCount: number;
  /** Count of medium-severity negative outcomes */
  negativeMediumCount: number;
  /** Total recent outcome count */
  recentCount: number;
  /** Whether auto-apply is eligible (read-only from existing logic) */
  autoApplyEligible: boolean;
  /** Short human-readable reason (EN) */
  reason: string;
}

// ============================================
// Core Computation
// ============================================

/**
 * Count outcomes for a pattern from recent outcomes
 */
function countOutcomesForPattern(
  patternHash: string,
  limit: number = 20
): {
  acceptedCount: number;
  negativeHighCount: number;
  negativeMediumCount: number;
  recentCount: number;
} {
  const recentOutcomes = outcomeStore.listRecent(limit);

  let acceptedCount = 0;
  let negativeHighCount = 0;
  let negativeMediumCount = 0;
  let recentCount = 0;

  for (const outcome of recentOutcomes) {
    if (outcome.patternHash === patternHash) {
      recentCount++;

      if (outcome.derived.accepted) {
        acceptedCount++;
      } else if (outcome.derived.negative) {
        if (outcome.derived.severity === 'high') {
          negativeHighCount++;
        } else if (outcome.derived.severity === 'medium') {
          negativeMediumCount++;
        }
      }
    }
  }

  return { acceptedCount, negativeHighCount, negativeMediumCount, recentCount };
}

/**
 * Determine the stability band from a score
 */
export function getStabilityBand(score: number): StabilityBand {
  if (score >= HIGH_BAND_THRESHOLD) return 'HIGH';
  if (score >= MEDIUM_BAND_THRESHOLD) return 'MEDIUM';
  return 'LOW';
}

/**
 * Compute stability reason based on metrics
 */
function computeReason(metrics: {
  recentCount: number;
  acceptedCount: number;
  negativeHighCount: number;
  negativeMediumCount: number;
  band: StabilityBand;
}): string {
  const { recentCount, acceptedCount, negativeHighCount, negativeMediumCount, band } = metrics;

  if (recentCount < MIN_EVIDENCE_COUNT) {
    return 'Learning: limited evidence';
  }

  if (negativeHighCount >= 2) {
    return 'Unstable: frequent reversals';
  }

  if (negativeHighCount >= 1 || negativeMediumCount >= 2) {
    return 'Caution: some negatives';
  }

  if (band === 'HIGH' && acceptedCount >= 2) {
    return 'Stable: accepted consistently';
  }

  if (band === 'MEDIUM') {
    return 'Moderate: mixed signals';
  }

  return 'Building confidence';
}

/**
 * Compute stability metrics for a pattern hash.
 * Uses existing stores for data - no new storage.
 *
 * @param patternHash - Pattern hash to compute stability for
 * @returns StabilityMetrics
 */
export function computeStability(patternHash: string): StabilityMetrics {
  // Get counts from recent outcomes
  const { acceptedCount, negativeHighCount, negativeMediumCount, recentCount } =
    countOutcomesForPattern(patternHash);

  // Also check pattern reliability from learning store (for additional signal)
  const reliability = getPatternReliability(patternHash);
  const reliabilityHighNeg = reliability?.highNegativeCount ?? 0;
  const reliabilityAccepted = reliability?.acceptedCount ?? 0;

  // Combine counts (outcome store is primary, reliability store is secondary)
  const totalAccepted = acceptedCount + reliabilityAccepted;
  const totalHighNeg = negativeHighCount + reliabilityHighNeg;

  // Compute score
  let score = BASE_SCORE;

  // Add points for accepted (capped)
  const acceptedPoints = Math.min(totalAccepted, 3) * POINTS_PER_ACCEPTED;
  score += Math.min(acceptedPoints, MAX_ACCEPTED_POINTS);

  // Subtract points for high-severity negatives (capped)
  const highNegPenalty = Math.min(totalHighNeg, 3) * POINTS_PER_HIGH_NEGATIVE;
  score -= Math.min(highNegPenalty, MAX_HIGH_NEGATIVE_PENALTY);

  // Subtract points for medium-severity negatives (capped)
  const medNegPenalty = Math.min(negativeMediumCount, 3) * POINTS_PER_MEDIUM_NEGATIVE;
  score -= Math.min(medNegPenalty, MAX_MEDIUM_NEGATIVE_PENALTY);

  // Cap if insufficient evidence
  if (recentCount < MIN_EVIDENCE_COUNT) {
    score = Math.min(score, LOW_EVIDENCE_SCORE_CAP);
  }

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score));

  // Determine band
  const band = getStabilityBand(score);

  // Check auto-apply eligibility (read-only from existing logic)
  const autoApplyEligible = getAutoApplyChoice(patternHash) !== null;

  // Compute reason
  const reason = computeReason({
    recentCount,
    acceptedCount: totalAccepted,
    negativeHighCount: totalHighNeg,
    negativeMediumCount,
    band,
  });

  return {
    patternHash,
    stabilityScore: Math.round(score),
    band,
    acceptedCount: totalAccepted,
    negativeHighCount: totalHighNeg,
    negativeMediumCount,
    recentCount,
    autoApplyEligible,
    reason,
  };
}

// ============================================
// Trust Signal Copy
// ============================================

type Language = 'vi' | 'en';

interface TrustCopy {
  label: string;
  emoji: string;
}

const TRUST_COPY: Record<StabilityBand, Record<Language, TrustCopy>> = {
  HIGH: {
    vi: { label: 'On dinh', emoji: '✅' },
    en: { label: 'Stable', emoji: '✅' },
  },
  MEDIUM: {
    vi: { label: 'Dang hoc', emoji: '🟡' },
    en: { label: 'Learning', emoji: '🟡' },
  },
  LOW: {
    vi: { label: 'Can xac nhan', emoji: '⚠️' },
    en: { label: 'Confirm', emoji: '⚠️' },
  },
};

/**
 * Get ultra-short trust copy for display
 * @param metrics - Stability metrics
 * @param language - Language code ('vi' | 'en')
 * @returns Short trust phrase with emoji
 */
export function getTrustCopy(metrics: StabilityMetrics, language: Language = 'vi'): string {
  const copy = TRUST_COPY[metrics.band][language];
  return `${copy.emoji} ${copy.label}`;
}

/**
 * Get trust copy object (for more flexible rendering)
 */
export function getTrustCopyParts(metrics: StabilityMetrics, language: Language = 'vi'): TrustCopy {
  return TRUST_COPY[metrics.band][language];
}

// ============================================
// Confirmation Gating Logic
// ============================================

/**
 * Check if confirmation should be skipped based on stability.
 * This is UI-only gating - routing remains unchanged.
 *
 * Rules:
 * - HIGH band + autoApplyEligible => skip confirmation
 * - LOW band OR negativeHighCount >= 1 => force confirmation
 * - Otherwise => use default confirmation logic
 *
 * @param metrics - Stability metrics
 * @returns 'SKIP' | 'FORCE' | 'DEFAULT'
 */
export function getConfirmationGating(
  metrics: StabilityMetrics
): 'SKIP' | 'FORCE' | 'DEFAULT' {
  // If band is LOW or any high negatives, always confirm
  if (metrics.band === 'LOW' || metrics.negativeHighCount >= 1) {
    return 'FORCE';
  }

  // If HIGH band and auto-apply eligible, skip confirmation
  if (metrics.band === 'HIGH' && metrics.autoApplyEligible) {
    return 'SKIP';
  }

  // Otherwise, use existing confirmation logic
  return 'DEFAULT';
}

// ============================================
// Debug Display Helpers
// ============================================

/**
 * Get color classes for stability band (for debug display)
 */
export function getStabilityColorClasses(band: StabilityBand): {
  bg: string;
  text: string;
  border: string;
} {
  switch (band) {
    case 'HIGH':
      return {
        bg: 'bg-green-100 dark:bg-green-900/30',
        text: 'text-green-700 dark:text-green-300',
        border: 'border-green-300 dark:border-green-700',
      };
    case 'MEDIUM':
      return {
        bg: 'bg-yellow-100 dark:bg-yellow-900/30',
        text: 'text-yellow-700 dark:text-yellow-300',
        border: 'border-yellow-300 dark:border-yellow-700',
      };
    case 'LOW':
      return {
        bg: 'bg-red-100 dark:bg-red-900/30',
        text: 'text-red-700 dark:text-red-300',
        border: 'border-red-300 dark:border-red-700',
      };
  }
}

/**
 * Get a compact debug summary string
 */
export function getStabilityDebugSummary(metrics: StabilityMetrics): string {
  return `${metrics.stabilityScore}% ${metrics.band} | ` +
    `+${metrics.acceptedCount} -${metrics.negativeHighCount}H -${metrics.negativeMediumCount}M | ` +
    `n=${metrics.recentCount} | ` +
    `${metrics.autoApplyEligible ? 'auto✓' : 'auto✗'}`;
}
