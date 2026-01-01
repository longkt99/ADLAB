// ============================================
// AdLab Sales Trust Intelligence API
// ============================================
// PHASE D37: Sales Activation & Trust Intelligence.
//
// PROVIDES:
// - GET: Aggregated sales intelligence dashboard data
//
// INVARIANTS:
// - Admin/Sales role only
// - Read-only
// - No raw audit logs
// - No token values
// - No identities exposed
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import {
  resolveActorFromRequest,
  NotAuthenticatedError,
  MissingMembershipError,
  InactiveMembershipError,
} from '@/lib/adlab/auth';
import { listTrustBundles } from '@/lib/adlab/ops/trustBundleEngine';
import {
  getBundleEngagementMetrics,
  getWorkspaceEngagementSummary,
  type TrackedSection,
} from '@/lib/adlab/ops/trustEngagement';
import {
  generateBundleSalesIntelligence,
  type DealStageIndicator,
  type SalesSignalType,
  type BundleSalesIntelligence,
} from '@/lib/adlab/ops/salesSignals';

// ============================================
// GET: Dashboard Data
// ============================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await resolveActorFromRequest();

    // Admin or owner only (sales would be handled via role check if available)
    if (actor.role !== 'owner' && actor.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get all bundles for workspace
    const bundlesResult = await listTrustBundles(actor.workspaceId);
    if (!bundlesResult.success) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch bundles' },
        { status: 500 }
      );
    }

    const bundles = bundlesResult.bundles || [];

    // Get workspace engagement summary
    const workspaceSummary = await getWorkspaceEngagementSummary(actor.workspaceId);

    // Generate intelligence for each bundle
    const bundleIntelligence: BundleSalesIntelligence[] = [];
    const bundlesByStage: Record<DealStageIndicator, number> = {
      NO_ACTIVITY: 0,
      INITIAL_INTEREST: 0,
      ACTIVE_REVIEW: 0,
      DEEP_EVALUATION: 0,
      POTENTIAL_BLOCKER: 0,
      PROCUREMENT_LIKELY: 0,
      STALLED: 0,
    };
    const signalCounts: Record<SalesSignalType, number> = {
      SECURITY_BLOCKER_SUSPECTED: 0,
      PROCUREMENT_STAGE_REACHED: 0,
      SUMMARY_ONLY_CONSUMER: 0,
      LOW_TRUST_READINESS: 0,
      DEAL_STALLED: 0,
      ACTIVE_EVALUATION: 0,
      DEEP_DIVE_IN_PROGRESS: 0,
      QUICK_REVIEW_COMPLETED: 0,
      COMPLIANCE_FOCUS: 0,
      TECHNICAL_REVIEW: 0,
      NO_ENGAGEMENT: 0,
    };
    const frictionBySection: Record<TrackedSection, number> = {
      summary: 0,
      questionnaire: 0,
      attestation: 0,
      whitepaper: 0,
      evidence: 0,
    };
    const sectionEngagement: Record<TrackedSection, number> = {
      summary: 0,
      questionnaire: 0,
      attestation: 0,
      whitepaper: 0,
      evidence: 0,
    };

    let totalEngagementScore = 0;

    for (const bundle of bundles) {
      // Skip revoked bundles
      if (bundle.revokedAt) continue;

      const metrics = await getBundleEngagementMetrics(bundle.id, actor.workspaceId);

      if (metrics) {
        const intelligence = generateBundleSalesIntelligence(metrics);
        bundleIntelligence.push(intelligence);

        // Aggregate stage counts
        bundlesByStage[intelligence.dealStageIndicator]++;

        // Aggregate signal counts
        for (const signal of intelligence.signals) {
          signalCounts[signal.type]++;
        }

        // Aggregate friction points
        for (const fp of intelligence.frictionPoints) {
          frictionBySection[fp.section]++;
        }

        // Aggregate section views
        for (const section of Object.keys(metrics.sectionViews) as TrackedSection[]) {
          sectionEngagement[section] += metrics.sectionViews[section] || 0;
        }

        totalEngagementScore += intelligence.engagementScore;
      } else {
        // Bundle with no engagement data
        bundlesByStage.NO_ACTIVITY++;
        signalCounts.NO_ENGAGEMENT++;
        bundleIntelligence.push({
          bundleId: bundle.id,
          signals: [{
            type: 'NO_ENGAGEMENT',
            confidence: 'HIGH',
            description: 'Bundle has not been viewed',
            evidence: ['No engagement data recorded'],
            recommendations: ['Verify bundle link was shared'],
            detectedAt: new Date().toISOString(),
          }],
          primarySignal: {
            type: 'NO_ENGAGEMENT',
            confidence: 'HIGH',
            description: 'Bundle has not been viewed',
            evidence: ['No engagement data recorded'],
            recommendations: ['Verify bundle link was shared'],
            detectedAt: new Date().toISOString(),
          },
          engagementScore: 0,
          frictionPoints: [],
          dealStageIndicator: 'NO_ACTIVITY',
          lastAnalyzedAt: new Date().toISOString(),
        });
      }
    }

    // Calculate active bundles (not revoked, not expired)
    const now = new Date();
    const activeBundles = bundles.filter(
      (b) => !b.revokedAt && new Date(b.expiresAt) > now
    ).length;

    // Build signal distribution (sorted by count)
    const signalDistribution = (Object.entries(signalCounts) as [SalesSignalType, number][])
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }));

    // Build friction sections (sorted by count)
    const topFrictionSections = (Object.entries(frictionBySection) as [TrackedSection, number][])
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([section, count]) => ({ section, count }));

    // Calculate average engagement
    const averageEngagementScore = bundleIntelligence.length > 0
      ? totalEngagementScore / bundleIntelligence.length
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalBundles: bundles.filter((b) => !b.revokedAt).length,
          activeBundles,
          totalViews: workspaceSummary?.totalViews || 0,
          totalExports: workspaceSummary?.totalExports || 0,
          averageEngagementScore: Math.round(averageEngagementScore * 10) / 10,
        },
        bundlesByStage,
        signalDistribution,
        topFrictionSections,
        sectionEngagement,
        bundles: bundleIntelligence.sort((a, b) => {
          // Sort by engagement score descending
          return b.engagementScore - a.engagementScore;
        }),
      },
    });
  } catch (e) {
    if (
      e instanceof NotAuthenticatedError ||
      e instanceof MissingMembershipError ||
      e instanceof InactiveMembershipError
    ) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('D37: Sales intelligence error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
