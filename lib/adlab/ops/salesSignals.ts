// ============================================
// AdLab Sales Signals Derivation Engine
// ============================================
// PHASE D37: Sales Activation & Trust Intelligence.
//
// PROVIDES:
// - Heuristic-based sales signal derivation
// - Friction point detection
// - Deal stage indicators
// - Engagement pattern analysis
//
// INVARIANTS:
// - Signals are ADVISORY only, never conclusions
// - Zero PII in signals
// - Evidence-derived only
// - Confidence levels are honest (LOW/MEDIUM/HIGH)
// - Never claims intent (no "customer wants to buy")
// - Read-only analysis
// ============================================

import {
  type BundleEngagementMetrics,
  type TrackedSection,
  type TimeBucket,
} from './trustEngagement';

// ============================================
// Types
// ============================================

/** Confidence level for derived signals */
export type SignalConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

/** Sales signal types - heuristic indicators */
export type SalesSignalType =
  | 'SECURITY_BLOCKER_SUSPECTED'      // Long time on questionnaire + repeated revisits
  | 'PROCUREMENT_STAGE_REACHED'       // Multiple exports + whitepaper focus
  | 'SUMMARY_ONLY_CONSUMER'           // Only securitySummary viewed
  | 'LOW_TRUST_READINESS'             // UNAVAILABLE sections accessed repeatedly
  | 'DEAL_STALLED'                    // Multiple accesses over >14 days without export
  | 'ACTIVE_EVALUATION'               // Regular engagement pattern
  | 'DEEP_DIVE_IN_PROGRESS'           // Extended time on multiple sections
  | 'QUICK_REVIEW_COMPLETED'          // Brief views across all sections
  | 'COMPLIANCE_FOCUS'                // Heavy questionnaire + attestation focus
  | 'TECHNICAL_REVIEW'                // Heavy whitepaper + evidence focus
  | 'NO_ENGAGEMENT';                  // Bundle created but never viewed

/** A derived sales signal */
export interface SalesSignal {
  type: SalesSignalType;
  confidence: SignalConfidence;
  description: string;
  evidence: string[];
  recommendations: string[];
  detectedAt: string;
}

/** Bundle-level sales intelligence */
export interface BundleSalesIntelligence {
  bundleId: string;
  signals: SalesSignal[];
  primarySignal: SalesSignal | null;
  engagementScore: number; // 0-100
  frictionPoints: FrictionPoint[];
  dealStageIndicator: DealStageIndicator;
  lastAnalyzedAt: string;
}

/** Friction point detection */
export interface FrictionPoint {
  section: TrackedSection;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  indicator: string;
  evidence: string;
}

/** Deal stage indicator (heuristic, not deterministic) */
export type DealStageIndicator =
  | 'NO_ACTIVITY'
  | 'INITIAL_INTEREST'
  | 'ACTIVE_REVIEW'
  | 'DEEP_EVALUATION'
  | 'POTENTIAL_BLOCKER'
  | 'PROCUREMENT_LIKELY'
  | 'STALLED';

/** Workspace-level sales summary */
export interface WorkspaceSalesSummary {
  workspaceId: string;
  totalBundles: number;
  bundlesByStage: Record<DealStageIndicator, number>;
  topSignals: Array<{ type: SalesSignalType; count: number }>;
  topFrictionSections: TrackedSection[];
  averageEngagementScore: number;
  analyzedAt: string;
}

// ============================================
// Signal Detection Functions
// ============================================

/**
 * Derives sales signals from bundle engagement metrics.
 * All signals are heuristic and include confidence levels.
 */
export function deriveSalesSignals(
  metrics: BundleEngagementMetrics
): SalesSignal[] {
  const signals: SalesSignal[] = [];
  const now = new Date().toISOString();

  // 1. Check for NO_ENGAGEMENT
  if (metrics.totalViews === 0) {
    signals.push({
      type: 'NO_ENGAGEMENT',
      confidence: 'HIGH',
      description: 'Bundle has been created but never viewed',
      evidence: ['Zero bundle views recorded'],
      recommendations: [
        'Verify bundle link was shared correctly',
        'Follow up with recipient to confirm access',
      ],
      detectedAt: now,
    });
    return signals; // No point checking other signals
  }

  // 2. Check for SECURITY_BLOCKER_SUSPECTED
  const questionnaireViews = metrics.sectionViews.questionnaire || 0;
  const questionnaireExtended = metrics.sectionTimeDistribution.questionnaire?.EXTENDED || 0;
  if (questionnaireViews > 3 && questionnaireExtended > 1 && metrics.revisitCount > 2) {
    signals.push({
      type: 'SECURITY_BLOCKER_SUSPECTED',
      confidence: questionnaireExtended > 3 ? 'HIGH' : 'MEDIUM',
      description: 'Repeated extended time on security questionnaire may indicate concerns',
      evidence: [
        `${questionnaireViews} questionnaire views`,
        `${questionnaireExtended} extended reading sessions (>2 min)`,
        `${metrics.revisitCount} bundle revisits`,
      ],
      recommendations: [
        'Proactively reach out to address security concerns',
        'Offer a security-focused call with technical team',
        'Prepare detailed answers for common security questions',
      ],
      detectedAt: now,
    });
  }

  // 3. Check for PROCUREMENT_STAGE_REACHED
  const totalExports = Object.values(metrics.exports).reduce((sum, n) => sum + n, 0);
  const whitepaperViews = metrics.sectionViews.whitepaper || 0;
  if (totalExports >= 2 && whitepaperViews > 0) {
    signals.push({
      type: 'PROCUREMENT_STAGE_REACHED',
      confidence: totalExports >= 3 ? 'HIGH' : 'MEDIUM',
      description: 'Multiple exports and whitepaper focus suggest procurement process',
      evidence: [
        `${totalExports} total exports (JSON: ${metrics.exports.json}, CSV: ${metrics.exports.csv}, HTML: ${metrics.exports.html})`,
        `${whitepaperViews} whitepaper views`,
      ],
      recommendations: [
        'Prepare for vendor assessment questionnaires',
        'Ensure all compliance documentation is current',
        'Consider scheduling a procurement-focused call',
      ],
      detectedAt: now,
    });
  }

  // 4. Check for SUMMARY_ONLY_CONSUMER
  const summaryViews = metrics.sectionViews.summary || 0;
  const otherSectionViews = questionnaireViews + whitepaperViews +
    (metrics.sectionViews.attestation || 0) + (metrics.sectionViews.evidence || 0);
  if (summaryViews > 0 && otherSectionViews === 0) {
    signals.push({
      type: 'SUMMARY_ONLY_CONSUMER',
      confidence: summaryViews > 2 ? 'HIGH' : 'MEDIUM',
      description: 'Viewer only accessed executive summary section',
      evidence: [
        `${summaryViews} summary views`,
        'No other sections accessed',
      ],
      recommendations: [
        'May be executive-level review',
        'Consider sending tailored executive summary',
        'Offer briefing call if deeper engagement needed',
      ],
      detectedAt: now,
    });
  }

  // 5. Check for LOW_TRUST_READINESS (if we had UNAVAILABLE sections)
  if (metrics.expiredAccessAttempts > 0) {
    signals.push({
      type: 'LOW_TRUST_READINESS',
      confidence: metrics.expiredAccessAttempts > 2 ? 'HIGH' : 'MEDIUM',
      description: 'Attempts to access expired bundle may indicate ongoing interest',
      evidence: [
        `${metrics.expiredAccessAttempts} expired access attempts`,
      ],
      recommendations: [
        'Consider creating a new bundle for the prospect',
        'Follow up to understand their timeline',
      ],
      detectedAt: now,
    });
  }

  // 6. Check for DEAL_STALLED
  if (metrics.bundleAgeDays > 14 && totalExports === 0 && metrics.revisitCount > 0) {
    signals.push({
      type: 'DEAL_STALLED',
      confidence: metrics.bundleAgeDays > 30 ? 'HIGH' : 'MEDIUM',
      description: 'Extended engagement period without export action',
      evidence: [
        `Bundle age: ${metrics.bundleAgeDays} days`,
        `${metrics.revisitCount} revisits`,
        'No exports recorded',
      ],
      recommendations: [
        'Schedule follow-up call to understand blockers',
        'Ask if additional information is needed',
        'Consider refreshing the bundle with updated evidence',
      ],
      detectedAt: now,
    });
  }

  // 7. Check for ACTIVE_EVALUATION
  if (metrics.totalViews > 2 && metrics.bundleAgeDays < 7 && metrics.uniqueSessions > 1) {
    signals.push({
      type: 'ACTIVE_EVALUATION',
      confidence: metrics.uniqueSessions > 3 ? 'HIGH' : 'MEDIUM',
      description: 'Active engagement pattern suggests ongoing evaluation',
      evidence: [
        `${metrics.totalViews} total views`,
        `${metrics.uniqueSessions} unique sessions`,
        `Bundle age: ${metrics.bundleAgeDays} days`,
      ],
      recommendations: [
        'Evaluation is progressing well',
        'Be available for questions',
        'Prepare for potential follow-up requests',
      ],
      detectedAt: now,
    });
  }

  // 8. Check for DEEP_DIVE_IN_PROGRESS
  const totalExtendedViews = Object.values(metrics.sectionTimeDistribution)
    .reduce((sum, dist) => sum + (dist.EXTENDED || 0), 0);
  if (totalExtendedViews > 3) {
    signals.push({
      type: 'DEEP_DIVE_IN_PROGRESS',
      confidence: totalExtendedViews > 5 ? 'HIGH' : 'MEDIUM',
      description: 'Extended time across multiple sections indicates thorough review',
      evidence: [
        `${totalExtendedViews} extended reading sessions (>2 min each)`,
      ],
      recommendations: [
        'Thorough evaluation in progress',
        'Prepare for detailed questions',
        'Consider proactive outreach to offer assistance',
      ],
      detectedAt: now,
    });
  }

  // 9. Check for COMPLIANCE_FOCUS
  const attestationViews = metrics.sectionViews.attestation || 0;
  if (questionnaireViews > 3 && attestationViews > 2) {
    signals.push({
      type: 'COMPLIANCE_FOCUS',
      confidence: 'MEDIUM',
      description: 'Heavy focus on questionnaire and attestation sections',
      evidence: [
        `${questionnaireViews} questionnaire views`,
        `${attestationViews} attestation views`,
      ],
      recommendations: [
        'Likely compliance or security team review',
        'Be prepared for detailed security questions',
        'Consider offering compliance-specific documentation',
      ],
      detectedAt: now,
    });
  }

  // 10. Check for TECHNICAL_REVIEW
  const evidenceViews = metrics.sectionViews.evidence || 0;
  if (whitepaperViews > 2 && evidenceViews > 1) {
    signals.push({
      type: 'TECHNICAL_REVIEW',
      confidence: 'MEDIUM',
      description: 'Focus on whitepaper and evidence suggests technical review',
      evidence: [
        `${whitepaperViews} whitepaper views`,
        `${evidenceViews} evidence section views`,
      ],
      recommendations: [
        'Likely technical/engineering team review',
        'Be prepared for architecture questions',
        'Consider offering a technical deep-dive session',
      ],
      detectedAt: now,
    });
  }

  // 11. Check for QUICK_REVIEW_COMPLETED
  const totalBriefViews = Object.values(metrics.sectionTimeDistribution)
    .reduce((sum, dist) => sum + (dist.BRIEF || 0), 0);
  const sectionsViewed = Object.values(metrics.sectionViews).filter(v => v > 0).length;
  if (sectionsViewed >= 4 && totalBriefViews > sectionsViewed * 0.7) {
    signals.push({
      type: 'QUICK_REVIEW_COMPLETED',
      confidence: 'MEDIUM',
      description: 'Brief review across all sections suggests initial screening',
      evidence: [
        `${sectionsViewed} sections viewed`,
        'Predominantly brief viewing times',
      ],
      recommendations: [
        'Initial screening may be complete',
        'Watch for follow-up engagement',
        'May need to highlight key points for deeper review',
      ],
      detectedAt: now,
    });
  }

  return signals;
}

/**
 * Detects friction points in bundle engagement.
 */
export function detectFrictionPoints(
  metrics: BundleEngagementMetrics
): FrictionPoint[] {
  const frictionPoints: FrictionPoint[] = [];

  // Check each section for friction indicators
  const sections: TrackedSection[] = ['summary', 'questionnaire', 'attestation', 'whitepaper', 'evidence'];

  for (const section of sections) {
    const views = metrics.sectionViews[section] || 0;
    const timeDist = metrics.sectionTimeDistribution[section];
    const extendedViews = timeDist?.EXTENDED || 0;

    // High friction: Many extended views on same section
    if (extendedViews > 2 && views > 3) {
      frictionPoints.push({
        section,
        severity: 'HIGH',
        indicator: 'Repeated extended reading suggests confusion or concerns',
        evidence: `${views} views, ${extendedViews} extended sessions (>2 min)`,
      });
    }
    // Medium friction: Many views but short times
    else if (views > 5 && extendedViews === 0) {
      frictionPoints.push({
        section,
        severity: 'MEDIUM',
        indicator: 'Frequent brief visits may indicate difficulty finding information',
        evidence: `${views} views, all brief or short duration`,
      });
    }
    // Low friction: Some extended reading
    else if (extendedViews >= 1 && views <= 2) {
      frictionPoints.push({
        section,
        severity: 'LOW',
        indicator: 'Moderate engagement, may have questions',
        evidence: `${views} views, ${extendedViews} extended session`,
      });
    }
  }

  // Sort by severity
  const severityOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  frictionPoints.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return frictionPoints;
}

/**
 * Determines deal stage indicator from signals.
 */
export function determineDealStage(signals: SalesSignal[]): DealStageIndicator {
  if (signals.length === 0) {
    return 'NO_ACTIVITY';
  }

  const signalTypes = new Set(signals.map(s => s.type));

  // Check for blockers first
  if (signalTypes.has('SECURITY_BLOCKER_SUSPECTED') || signalTypes.has('LOW_TRUST_READINESS')) {
    return 'POTENTIAL_BLOCKER';
  }

  // Check for stalled
  if (signalTypes.has('DEAL_STALLED')) {
    return 'STALLED';
  }

  // Check for procurement
  if (signalTypes.has('PROCUREMENT_STAGE_REACHED')) {
    return 'PROCUREMENT_LIKELY';
  }

  // Check for deep evaluation
  if (signalTypes.has('DEEP_DIVE_IN_PROGRESS') || signalTypes.has('COMPLIANCE_FOCUS') || signalTypes.has('TECHNICAL_REVIEW')) {
    return 'DEEP_EVALUATION';
  }

  // Check for active review
  if (signalTypes.has('ACTIVE_EVALUATION')) {
    return 'ACTIVE_REVIEW';
  }

  // Check for initial interest
  if (signalTypes.has('SUMMARY_ONLY_CONSUMER') || signalTypes.has('QUICK_REVIEW_COMPLETED')) {
    return 'INITIAL_INTEREST';
  }

  return 'INITIAL_INTEREST';
}

/**
 * Calculates engagement score (0-100).
 */
export function calculateEngagementScore(metrics: BundleEngagementMetrics): number {
  let score = 0;

  // Views contribute (max 30 points)
  score += Math.min(metrics.totalViews * 5, 30);

  // Sessions contribute (max 20 points)
  score += Math.min(metrics.uniqueSessions * 5, 20);

  // Section coverage (max 25 points)
  const sectionsViewed = Object.values(metrics.sectionViews).filter(v => v > 0).length;
  score += sectionsViewed * 5;

  // Extended engagement (max 15 points)
  const totalExtended = Object.values(metrics.sectionTimeDistribution)
    .reduce((sum, dist) => sum + (dist.EXTENDED || 0), 0);
  score += Math.min(totalExtended * 3, 15);

  // Exports (max 10 points)
  const totalExports = Object.values(metrics.exports).reduce((sum, n) => sum + n, 0);
  score += Math.min(totalExports * 5, 10);

  return Math.min(score, 100);
}

/**
 * Generates full sales intelligence for a bundle.
 */
export function generateBundleSalesIntelligence(
  metrics: BundleEngagementMetrics
): BundleSalesIntelligence {
  const signals = deriveSalesSignals(metrics);
  const frictionPoints = detectFrictionPoints(metrics);
  const dealStageIndicator = determineDealStage(signals);
  const engagementScore = calculateEngagementScore(metrics);

  // Primary signal is highest confidence or first detected
  const primarySignal = signals.length > 0
    ? signals.sort((a, b) => {
        const confOrder: Record<SignalConfidence, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        return confOrder[a.confidence] - confOrder[b.confidence];
      })[0]
    : null;

  return {
    bundleId: metrics.bundleId,
    signals,
    primarySignal,
    engagementScore,
    frictionPoints,
    dealStageIndicator,
    lastAnalyzedAt: new Date().toISOString(),
  };
}

// ============================================
// Label Functions
// ============================================

/**
 * Gets human-readable label for signal type.
 */
export function getSignalLabel(type: SalesSignalType): string {
  const labels: Record<SalesSignalType, string> = {
    SECURITY_BLOCKER_SUSPECTED: 'Security Concerns Detected',
    PROCUREMENT_STAGE_REACHED: 'Procurement in Progress',
    SUMMARY_ONLY_CONSUMER: 'Executive Review',
    LOW_TRUST_READINESS: 'Trust Readiness Issues',
    DEAL_STALLED: 'Deal May Be Stalled',
    ACTIVE_EVALUATION: 'Active Evaluation',
    DEEP_DIVE_IN_PROGRESS: 'Deep Technical Review',
    QUICK_REVIEW_COMPLETED: 'Initial Screening Done',
    COMPLIANCE_FOCUS: 'Compliance Review',
    TECHNICAL_REVIEW: 'Technical Review',
    NO_ENGAGEMENT: 'No Engagement Yet',
  };
  return labels[type];
}

/**
 * Gets human-readable label for deal stage.
 */
export function getDealStageLabel(stage: DealStageIndicator): string {
  const labels: Record<DealStageIndicator, string> = {
    NO_ACTIVITY: 'No Activity',
    INITIAL_INTEREST: 'Initial Interest',
    ACTIVE_REVIEW: 'Active Review',
    DEEP_EVALUATION: 'Deep Evaluation',
    POTENTIAL_BLOCKER: 'Potential Blocker',
    PROCUREMENT_LIKELY: 'Procurement Likely',
    STALLED: 'Stalled',
  };
  return labels[stage];
}

/**
 * Gets color/severity for deal stage (for UI).
 */
export function getDealStageSeverity(stage: DealStageIndicator): 'success' | 'warning' | 'error' | 'neutral' {
  switch (stage) {
    case 'PROCUREMENT_LIKELY':
      return 'success';
    case 'ACTIVE_REVIEW':
    case 'DEEP_EVALUATION':
      return 'success';
    case 'INITIAL_INTEREST':
      return 'neutral';
    case 'POTENTIAL_BLOCKER':
    case 'STALLED':
      return 'warning';
    case 'NO_ACTIVITY':
    default:
      return 'neutral';
  }
}

/**
 * Gets color/severity for signal confidence (for UI).
 */
export function getConfidenceSeverity(confidence: SignalConfidence): 'success' | 'warning' | 'neutral' {
  switch (confidence) {
    case 'HIGH':
      return 'success';
    case 'MEDIUM':
      return 'warning';
    case 'LOW':
      return 'neutral';
  }
}
