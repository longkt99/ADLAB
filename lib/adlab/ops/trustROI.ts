// ============================================
// AdLab Trust ROI Analytics (Advisory)
// ============================================
// PHASE D38: Revenue Enablement & Sales Activation.
//
// PROVIDES:
// - Time-to-close insights (with vs without engagement)
// - Signal-to-close correlation (advisory)
// - Stalled deal detection
// - Engagement effectiveness metrics
//
// INVARIANTS:
// - READ-ONLY: No mutations
// - NO PII: Zero identity data
// - NO FORECASTING: No predictions about deals
// - NO SCORING CUSTOMERS: No ranking/rating prospects
// - Advisory output only
// - All insights are observational, not prescriptive
// ============================================

import { type DealStageIndicator } from './salesSignals';
import { type TimelineRisk } from './trustTimeline';

// ============================================
// Types
// ============================================

/** ROI insight type */
export type ROIInsightType =
  | 'ENGAGEMENT_CORRELATION'
  | 'TIME_TO_ACTION'
  | 'SECTION_EFFECTIVENESS'
  | 'EXPORT_CORRELATION'
  | 'STALLED_PATTERN'
  | 'REVISIT_PATTERN';

/** Engagement tier for ROI analysis */
export type EngagementTier =
  | 'NONE'        // No views
  | 'MINIMAL'     // 1-2 views, no sections
  | 'MODERATE'    // Multiple views, some sections
  | 'HIGH'        // Multiple sections, extended reading
  | 'DEEP'        // Exports, revisits, all sections

/** Time-to-action bucket */
export type TimeToActionBucket =
  | 'IMMEDIATE'   // <1 day
  | 'QUICK'       // 1-3 days
  | 'STANDARD'    // 4-7 days
  | 'EXTENDED'    // 8-14 days
  | 'PROLONGED'   // >14 days
  | 'NO_ACTION';  // No action taken

/** Bundle outcome for correlation */
export type BundleOutcome =
  | 'EXPORTED'          // Has export
  | 'DEEP_ENGAGEMENT'   // Deep engagement but no export
  | 'MODERATE_REVIEW'   // Moderate engagement
  | 'MINIMAL_INTEREST'  // Minimal engagement
  | 'NO_ENGAGEMENT'     // Zero engagement
  | 'STALLED'           // Was active, now stalled
  | 'EXPIRED_INTEREST'; // Tried to access after expiry

/** Single ROI insight */
export interface ROIInsight {
  type: ROIInsightType;
  title: string;
  description: string;
  metric: string;
  evidence: string[];
  advisory: true; // ALWAYS true - not actionable automation
}

/** Bundle ROI metrics */
export interface BundleROIMetrics {
  bundleId: string;
  createdAt: string;
  engagementTier: EngagementTier;
  outcome: BundleOutcome;
  timeToFirstView: TimeToActionBucket | null;
  timeToExport: TimeToActionBucket | null;
  totalViewDays: number;
  sectionsViewed: number;
  hasRevisits: boolean;
  hasExpiredAccess: boolean;
}

/** Aggregated ROI analytics */
export interface TrustROIAnalytics {
  workspaceId: string;
  bundleCount: number;

  // Engagement distribution
  engagementDistribution: Record<EngagementTier, number>;

  // Outcome distribution
  outcomeDistribution: Record<BundleOutcome, number>;

  // Time-to-action analysis
  timeToFirstViewDistribution: Record<TimeToActionBucket, number>;
  timeToExportDistribution: Record<TimeToActionBucket, number>;

  // Correlation insights (advisory)
  insights: ROIInsight[];

  // Summary metrics
  summary: {
    avgDaysToFirstView: number | null;
    avgDaysToExport: number | null;
    exportRate: number; // 0-100 percentage
    stalledRate: number; // 0-100 percentage
    deepEngagementRate: number; // 0-100 percentage
  };

  generatedAt: string;
}

/** Input for ROI calculation */
export interface ROIInputBundle {
  bundleId: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;

  // Engagement data
  totalViews: number;
  uniqueViewDays: number;
  sectionViews: Record<string, number>;
  hasExport: boolean;
  hasRevisit: boolean;
  hasExpiredAccess: boolean;

  // Timing data
  firstViewAt: string | null;
  lastViewAt: string | null;
  firstExportAt: string | null;

  // Stage indicator
  dealStage: DealStageIndicator;
}

// ============================================
// Tier Classification
// ============================================

/**
 * Classifies bundle into engagement tier.
 */
export function classifyEngagementTier(
  totalViews: number,
  sectionsViewed: number,
  hasExport: boolean,
  hasRevisit: boolean
): EngagementTier {
  if (totalViews === 0) {
    return 'NONE';
  }

  if (hasExport || (sectionsViewed >= 4 && hasRevisit)) {
    return 'DEEP';
  }

  if (sectionsViewed >= 3 || hasRevisit) {
    return 'HIGH';
  }

  if (sectionsViewed >= 1 || totalViews >= 2) {
    return 'MODERATE';
  }

  return 'MINIMAL';
}

/**
 * Determines bundle outcome.
 */
export function determineBundleOutcome(
  input: ROIInputBundle
): BundleOutcome {
  // Check for export first (strongest positive signal)
  if (input.hasExport) {
    return 'EXPORTED';
  }

  // Check for expired interest
  if (input.hasExpiredAccess) {
    return 'EXPIRED_INTEREST';
  }

  // Check for stalled
  if (
    input.dealStage === 'STALLED' ||
    input.dealStage === 'POTENTIAL_BLOCKER'
  ) {
    return 'STALLED';
  }

  // Classify by engagement level
  const sectionsViewed = Object.values(input.sectionViews).filter((v) => v > 0).length;

  if (sectionsViewed >= 3 || input.hasRevisit) {
    return 'DEEP_ENGAGEMENT';
  }

  if (sectionsViewed >= 1 || input.totalViews >= 2) {
    return 'MODERATE_REVIEW';
  }

  if (input.totalViews > 0) {
    return 'MINIMAL_INTEREST';
  }

  return 'NO_ENGAGEMENT';
}

/**
 * Calculates time-to-action bucket from days.
 */
export function getTimeToActionBucket(days: number | null): TimeToActionBucket {
  if (days === null || days < 0) {
    return 'NO_ACTION';
  }

  if (days < 1) {
    return 'IMMEDIATE';
  }

  if (days <= 3) {
    return 'QUICK';
  }

  if (days <= 7) {
    return 'STANDARD';
  }

  if (days <= 14) {
    return 'EXTENDED';
  }

  return 'PROLONGED';
}

/**
 * Gets label for engagement tier.
 */
export function getEngagementTierLabel(tier: EngagementTier): string {
  const labels: Record<EngagementTier, string> = {
    NONE: 'No Engagement',
    MINIMAL: 'Minimal',
    MODERATE: 'Moderate',
    HIGH: 'High',
    DEEP: 'Deep Engagement',
  };
  return labels[tier];
}

/**
 * Gets label for outcome.
 */
export function getOutcomeLabel(outcome: BundleOutcome): string {
  const labels: Record<BundleOutcome, string> = {
    EXPORTED: 'Exported',
    DEEP_ENGAGEMENT: 'Deep Engagement',
    MODERATE_REVIEW: 'Moderate Review',
    MINIMAL_INTEREST: 'Minimal Interest',
    NO_ENGAGEMENT: 'No Engagement',
    STALLED: 'Stalled',
    EXPIRED_INTEREST: 'Expired Interest',
  };
  return labels[outcome];
}

/**
 * Gets label for time bucket.
 */
export function getTimeToActionLabel(bucket: TimeToActionBucket): string {
  const labels: Record<TimeToActionBucket, string> = {
    IMMEDIATE: 'Same day',
    QUICK: '1-3 days',
    STANDARD: '4-7 days',
    EXTENDED: '8-14 days',
    PROLONGED: '14+ days',
    NO_ACTION: 'No action',
  };
  return labels[bucket];
}

// ============================================
// ROI Calculation
// ============================================

/**
 * Computes ROI metrics for a single bundle.
 */
export function computeBundleROIMetrics(input: ROIInputBundle): BundleROIMetrics {
  const sectionsViewed = Object.values(input.sectionViews).filter((v) => v > 0).length;

  const engagementTier = classifyEngagementTier(
    input.totalViews,
    sectionsViewed,
    input.hasExport,
    input.hasRevisit
  );

  const outcome = determineBundleOutcome(input);

  // Calculate time-to-action
  let timeToFirstView: TimeToActionBucket | null = null;
  let timeToExport: TimeToActionBucket | null = null;

  if (input.firstViewAt) {
    const createdDate = new Date(input.createdAt);
    const viewDate = new Date(input.firstViewAt);
    const daysDiff = (viewDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
    timeToFirstView = getTimeToActionBucket(daysDiff);
  }

  if (input.firstExportAt) {
    const createdDate = new Date(input.createdAt);
    const exportDate = new Date(input.firstExportAt);
    const daysDiff = (exportDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
    timeToExport = getTimeToActionBucket(daysDiff);
  }

  return {
    bundleId: input.bundleId,
    createdAt: input.createdAt,
    engagementTier,
    outcome,
    timeToFirstView,
    timeToExport,
    totalViewDays: input.uniqueViewDays,
    sectionsViewed,
    hasRevisits: input.hasRevisit,
    hasExpiredAccess: input.hasExpiredAccess,
  };
}

/**
 * Generates ROI insights from aggregated data.
 * All insights are advisory-only.
 */
function generateROIInsights(
  bundleMetrics: BundleROIMetrics[],
  outcomeDistribution: Record<BundleOutcome, number>,
  engagementDistribution: Record<EngagementTier, number>
): ROIInsight[] {
  const insights: ROIInsight[] = [];
  const total = bundleMetrics.length;

  if (total === 0) {
    return insights;
  }

  // Engagement correlation insight
  const exportedBundles = bundleMetrics.filter((b) => b.outcome === 'EXPORTED');
  const deepOrHighBundles = bundleMetrics.filter(
    (b) => b.engagementTier === 'DEEP' || b.engagementTier === 'HIGH'
  );

  if (exportedBundles.length > 0 && deepOrHighBundles.length > 0) {
    const exportedWithHighEngagement = exportedBundles.filter(
      (b) => b.engagementTier === 'DEEP' || b.engagementTier === 'HIGH'
    ).length;
    const correlationRate = Math.round((exportedWithHighEngagement / exportedBundles.length) * 100);

    insights.push({
      type: 'ENGAGEMENT_CORRELATION',
      title: 'Engagement-Export Correlation',
      description: `${correlationRate}% of exported bundles had high or deep engagement before export.`,
      metric: `${correlationRate}%`,
      evidence: [
        `${exportedBundles.length} total exports`,
        `${exportedWithHighEngagement} with high/deep engagement`,
        `${deepOrHighBundles.length} bundles with high/deep engagement overall`,
      ],
      advisory: true,
    });
  }

  // Time-to-action insight
  const bundlesWithFirstView = bundleMetrics.filter((b) => b.timeToFirstView !== null);
  const immediateViews = bundlesWithFirstView.filter((b) => b.timeToFirstView === 'IMMEDIATE').length;

  if (bundlesWithFirstView.length > 0) {
    const quickViewRate = Math.round((immediateViews / bundlesWithFirstView.length) * 100);

    insights.push({
      type: 'TIME_TO_ACTION',
      title: 'First View Timing',
      description: `${quickViewRate}% of bundles were viewed on the same day they were shared.`,
      metric: `${quickViewRate}%`,
      evidence: [
        `${bundlesWithFirstView.length} bundles with view data`,
        `${immediateViews} viewed same day`,
      ],
      advisory: true,
    });
  }

  // Section effectiveness insight
  const avgSectionsViewed = bundleMetrics.reduce((sum, b) => sum + b.sectionsViewed, 0) / total;
  const avgSectionsExported = exportedBundles.length > 0
    ? exportedBundles.reduce((sum, b) => sum + b.sectionsViewed, 0) / exportedBundles.length
    : 0;

  if (exportedBundles.length > 0 && avgSectionsExported > avgSectionsViewed) {
    insights.push({
      type: 'SECTION_EFFECTIVENESS',
      title: 'Section Depth Impact',
      description: `Exported bundles averaged ${avgSectionsExported.toFixed(1)} sections viewed vs ${avgSectionsViewed.toFixed(1)} overall.`,
      metric: `${avgSectionsExported.toFixed(1)} vs ${avgSectionsViewed.toFixed(1)}`,
      evidence: [
        `Higher section engagement correlates with exports`,
        `${exportedBundles.length} bundles exported`,
      ],
      advisory: true,
    });
  }

  // Stalled pattern insight
  const stalledCount = outcomeDistribution.STALLED || 0;
  if (stalledCount > 0 && total >= 5) {
    const stalledRate = Math.round((stalledCount / total) * 100);
    const stalledBundles = bundleMetrics.filter((b) => b.outcome === 'STALLED');
    const avgViewDays = stalledBundles.reduce((sum, b) => sum + b.totalViewDays, 0) / stalledCount;

    insights.push({
      type: 'STALLED_PATTERN',
      title: 'Stalled Deal Pattern',
      description: `${stalledRate}% of bundles show stalled activity patterns.`,
      metric: `${stalledRate}%`,
      evidence: [
        `${stalledCount} bundles stalled`,
        `Avg ${avgViewDays.toFixed(1)} days of activity before stalling`,
      ],
      advisory: true,
    });
  }

  // Revisit pattern insight
  const revisitBundles = bundleMetrics.filter((b) => b.hasRevisits);
  if (revisitBundles.length > 0 && total >= 3) {
    const revisitRate = Math.round((revisitBundles.length / total) * 100);
    const revisitExported = revisitBundles.filter((b) => b.outcome === 'EXPORTED').length;

    insights.push({
      type: 'REVISIT_PATTERN',
      title: 'Revisit Behavior',
      description: `${revisitRate}% of bundles had return visits.`,
      metric: `${revisitRate}%`,
      evidence: [
        `${revisitBundles.length} bundles with revisits`,
        `${revisitExported} of those resulted in exports`,
      ],
      advisory: true,
    });
  }

  return insights;
}

/**
 * Computes aggregated Trust ROI analytics.
 * All output is advisory-only.
 */
export function computeTrustROIAnalytics(
  workspaceId: string,
  bundles: ROIInputBundle[]
): TrustROIAnalytics {
  // Initialize distributions
  const engagementDistribution: Record<EngagementTier, number> = {
    NONE: 0,
    MINIMAL: 0,
    MODERATE: 0,
    HIGH: 0,
    DEEP: 0,
  };

  const outcomeDistribution: Record<BundleOutcome, number> = {
    EXPORTED: 0,
    DEEP_ENGAGEMENT: 0,
    MODERATE_REVIEW: 0,
    MINIMAL_INTEREST: 0,
    NO_ENGAGEMENT: 0,
    STALLED: 0,
    EXPIRED_INTEREST: 0,
  };

  const timeToFirstViewDistribution: Record<TimeToActionBucket, number> = {
    IMMEDIATE: 0,
    QUICK: 0,
    STANDARD: 0,
    EXTENDED: 0,
    PROLONGED: 0,
    NO_ACTION: 0,
  };

  const timeToExportDistribution: Record<TimeToActionBucket, number> = {
    IMMEDIATE: 0,
    QUICK: 0,
    STANDARD: 0,
    EXTENDED: 0,
    PROLONGED: 0,
    NO_ACTION: 0,
  };

  // Compute metrics for each bundle
  const bundleMetrics: BundleROIMetrics[] = [];

  for (const input of bundles) {
    const metrics = computeBundleROIMetrics(input);
    bundleMetrics.push(metrics);

    engagementDistribution[metrics.engagementTier]++;
    outcomeDistribution[metrics.outcome]++;

    if (metrics.timeToFirstView) {
      timeToFirstViewDistribution[metrics.timeToFirstView]++;
    } else {
      timeToFirstViewDistribution.NO_ACTION++;
    }

    if (metrics.timeToExport) {
      timeToExportDistribution[metrics.timeToExport]++;
    } else {
      timeToExportDistribution.NO_ACTION++;
    }
  }

  // Calculate summary metrics
  const total = bundles.length;
  const exportCount = outcomeDistribution.EXPORTED;
  const stalledCount = outcomeDistribution.STALLED;
  const deepCount = engagementDistribution.DEEP + engagementDistribution.HIGH;

  // Calculate average days to first view
  let avgDaysToFirstView: number | null = null;
  const viewedBundles = bundles.filter((b) => b.firstViewAt);
  if (viewedBundles.length > 0) {
    const totalDays = viewedBundles.reduce((sum, b) => {
      const created = new Date(b.createdAt);
      const viewed = new Date(b.firstViewAt!);
      return sum + (viewed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    }, 0);
    avgDaysToFirstView = Math.round((totalDays / viewedBundles.length) * 10) / 10;
  }

  // Calculate average days to export
  let avgDaysToExport: number | null = null;
  const exportedBundles = bundles.filter((b) => b.firstExportAt);
  if (exportedBundles.length > 0) {
    const totalDays = exportedBundles.reduce((sum, b) => {
      const created = new Date(b.createdAt);
      const exported = new Date(b.firstExportAt!);
      return sum + (exported.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    }, 0);
    avgDaysToExport = Math.round((totalDays / exportedBundles.length) * 10) / 10;
  }

  // Generate insights
  const insights = generateROIInsights(
    bundleMetrics,
    outcomeDistribution,
    engagementDistribution
  );

  return {
    workspaceId,
    bundleCount: total,
    engagementDistribution,
    outcomeDistribution,
    timeToFirstViewDistribution,
    timeToExportDistribution,
    insights,
    summary: {
      avgDaysToFirstView,
      avgDaysToExport,
      exportRate: total > 0 ? Math.round((exportCount / total) * 100) : 0,
      stalledRate: total > 0 ? Math.round((stalledCount / total) * 100) : 0,
      deepEngagementRate: total > 0 ? Math.round((deepCount / total) * 100) : 0,
    },
    generatedAt: new Date().toISOString(),
  };
}

// ============================================
// Display Helpers
// ============================================

/**
 * Gets color for engagement tier (for UI).
 */
export function getEngagementTierColor(tier: EngagementTier): string {
  switch (tier) {
    case 'DEEP':
      return 'green';
    case 'HIGH':
      return 'blue';
    case 'MODERATE':
      return 'yellow';
    case 'MINIMAL':
      return 'orange';
    case 'NONE':
      return 'gray';
  }
}

/**
 * Gets color for outcome (for UI).
 */
export function getOutcomeColor(outcome: BundleOutcome): string {
  switch (outcome) {
    case 'EXPORTED':
      return 'green';
    case 'DEEP_ENGAGEMENT':
      return 'blue';
    case 'MODERATE_REVIEW':
      return 'yellow';
    case 'MINIMAL_INTEREST':
      return 'orange';
    case 'STALLED':
      return 'red';
    case 'EXPIRED_INTEREST':
      return 'purple';
    case 'NO_ENGAGEMENT':
      return 'gray';
  }
}

/**
 * Formats analytics as human-readable text.
 */
export function formatROIAnalyticsAsText(analytics: TrustROIAnalytics): string {
  const lines: string[] = [];

  lines.push(`Trust ROI Analytics`);
  lines.push(`Bundles Analyzed: ${analytics.bundleCount}`);
  lines.push('');

  lines.push('Summary:');
  lines.push(`  Export Rate: ${analytics.summary.exportRate}%`);
  lines.push(`  Stalled Rate: ${analytics.summary.stalledRate}%`);
  lines.push(`  Deep Engagement Rate: ${analytics.summary.deepEngagementRate}%`);
  if (analytics.summary.avgDaysToFirstView !== null) {
    lines.push(`  Avg Days to First View: ${analytics.summary.avgDaysToFirstView}`);
  }
  if (analytics.summary.avgDaysToExport !== null) {
    lines.push(`  Avg Days to Export: ${analytics.summary.avgDaysToExport}`);
  }
  lines.push('');

  if (analytics.insights.length > 0) {
    lines.push('Insights (Advisory):');
    for (const insight of analytics.insights) {
      lines.push(`  • ${insight.title}: ${insight.description}`);
    }
  }

  return lines.join('\n');
}
