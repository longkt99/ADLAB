// ============================================
// AdLab Sales Activation API
// ============================================
// PHASE D38: Revenue Enablement & Sales Activation.
//
// PROVIDES:
// - GET: Sales activation dashboard data (playbooks, timeline, ROI)
// - GET with bundleId: Specific bundle activation data
//
// INVARIANTS:
// - Admin/Sales role only
// - Read-only
// - No raw audit logs
// - No token values
// - No identities exposed
// - Advisory output only
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import {
  resolveActorFromRequest,
  NotAuthenticatedError,
  MissingMembershipError,
  InactiveMembershipError,
  type ResolvedActor,
} from '@/lib/adlab/auth';
import { auditLog } from '@/lib/adlab/audit';
import { listTrustBundles, getTrustBundle } from '@/lib/adlab/ops/trustBundleEngine';
import {
  getBundleEngagementMetrics,
  getWorkspaceEngagementSummary,
  type TrackedSection,
  type ExportFormat,
} from '@/lib/adlab/ops/trustEngagement';
import {
  generateBundleSalesIntelligence,
  type BundleSalesIntelligence,
} from '@/lib/adlab/ops/salesSignals';
import {
  generateBundlePlaybook,
  generateWorkspacePlaybookSummary,
  type BundlePlaybook,
  type WorkspacePlaybookSummary,
} from '@/lib/adlab/ops/salesPlaybooks';
import {
  generateTrustTimeline,
  type TrustTimeline,
  type RawTimelineEvent,
} from '@/lib/adlab/ops/trustTimeline';
import {
  computeTrustROIAnalytics,
  type TrustROIAnalytics,
  type ROIInputBundle,
} from '@/lib/adlab/ops/trustROI';

// ============================================
// Types
// ============================================

interface BundleActivationData {
  bundleId: string;
  label: string | null;
  createdAt: string;
  expiresAt: string;
  status: 'active' | 'expired' | 'revoked';

  // D37 Intelligence
  intelligence: BundleSalesIntelligence | null;

  // D38 Playbook
  playbook: BundlePlaybook | null;

  // D38 Timeline
  timeline: TrustTimeline | null;
}

interface ActivationDashboardData {
  summary: {
    totalBundles: number;
    activeBundles: number;
    totalViews: number;
    totalExports: number;
  };

  // D38 Workspace Playbook Summary
  playbookSummary: WorkspacePlaybookSummary;

  // D38 ROI Analytics
  roiAnalytics: TrustROIAnalytics;

  // Bundle list with activation data
  bundles: BundleActivationData[];
}

// ============================================
// Helpers
// ============================================

/**
 * Gets bundle status.
 */
function getBundleStatus(
  bundle: { expiresAt: string; revokedAt: string | null }
): 'active' | 'expired' | 'revoked' {
  if (bundle.revokedAt) return 'revoked';
  if (new Date(bundle.expiresAt) < new Date()) return 'expired';
  return 'active';
}

/**
 * Counts total exports from export record.
 */
function _countTotalExports(exports: Record<ExportFormat, number>): number {
  return Object.values(exports).reduce((sum, count) => sum + count, 0);
}

/**
 * Checks if any exports exist.
 */
function hasAnyExport(exports: Record<ExportFormat, number> | number): boolean {
  if (typeof exports === 'number') return exports > 0;
  return Object.values(exports).some((count) => count > 0);
}

// ============================================
// GET: Dashboard Data or Single Bundle
// ============================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await resolveActorFromRequest();

    // Admin or owner only
    if (actor.role !== 'owner' && actor.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const bundleId = searchParams.get('bundleId');
    const view = searchParams.get('view') || 'dashboard'; // dashboard, playbook, timeline, roi

    // Single bundle mode
    if (bundleId) {
      return await handleSingleBundle(actor, bundleId, view);
    }

    // Dashboard mode
    return await handleDashboard(actor, view);
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

    console.error('D38: Sales activation error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Handles single bundle activation data request.
 */
async function handleSingleBundle(
  actor: ResolvedActor,
  bundleId: string,
  view: string
): Promise<NextResponse> {
  // Get bundle
  const bundleResult = await getTrustBundle(bundleId, actor.workspaceId);
  if (!bundleResult.success || !bundleResult.bundle) {
    return NextResponse.json(
      { success: false, error: 'Bundle not found' },
      { status: 404 }
    );
  }

  const bundle = bundleResult.bundle;

  // Get engagement metrics
  const metrics = await getBundleEngagementMetrics(bundleId, actor.workspaceId);

  // Generate intelligence
  const intelligence = metrics ? generateBundleSalesIntelligence(metrics) : null;

  // Generate playbook
  let playbook: BundlePlaybook | null = null;
  if (intelligence && (view === 'dashboard' || view === 'playbook')) {
    playbook = generateBundlePlaybook(
      bundleId,
      intelligence.dealStageIndicator,
      intelligence.signals
    );
  }

  // Generate timeline
  let timeline: TrustTimeline | null = null;
  if (view === 'dashboard' || view === 'timeline') {
    // Build raw events from available metrics
    const rawEvents: RawTimelineEvent[] = [];
    if (metrics) {
      // Add view event
      if (metrics.totalViews > 0) {
        rawEvents.push({
          eventType: 'BUNDLE_VIEWED',
          createdAt: metrics.firstViewedAt || bundle.createdAt,
          metadata: {},
        });
      }
      // Add section events
      for (const [section, count] of Object.entries(metrics.sectionViews)) {
        if (count > 0) {
          rawEvents.push({
            eventType: 'SECTION_VIEWED',
            createdAt: metrics.lastViewedAt || bundle.createdAt,
            metadata: { section: section as TrackedSection },
          });
        }
      }
      // Add export event
      if (hasAnyExport(metrics.exports)) {
        rawEvents.push({
          eventType: 'BUNDLE_EXPORTED',
          createdAt: metrics.lastViewedAt || bundle.createdAt,
          metadata: { exportFormat: 'json' as ExportFormat },
        });
      }
    }

    timeline = generateTrustTimeline(bundleId, bundle.createdAt, rawEvents);
  }

  // Audit log
  await auditLog({
    workspaceId: actor.workspaceId,
    actorId: actor.id,
    action: 'read',
    entityType: 'trust_engagement',
    entityId: bundleId,
    metadata: { view, bundleId },
  });

  const data: BundleActivationData = {
    bundleId: bundle.id,
    label: bundle.label || null,
    createdAt: bundle.createdAt,
    expiresAt: bundle.expiresAt,
    status: getBundleStatus(bundle),
    intelligence,
    playbook,
    timeline,
  };

  return NextResponse.json({
    success: true,
    data,
  });
}

/**
 * Handles dashboard data request.
 */
async function handleDashboard(
  actor: ResolvedActor,
  view: string
): Promise<NextResponse> {
  // Get all bundles for workspace
  const bundlesResult = await listTrustBundles(actor.workspaceId);
  if (!bundlesResult.success) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bundles' },
      { status: 500 }
    );
  }

  const bundles = bundlesResult.bundles || [];
  const activeBundlesRaw = bundles.filter((b) => !b.revokedAt);

  // Get workspace engagement summary
  const workspaceSummary = await getWorkspaceEngagementSummary(actor.workspaceId);

  // Collect playbooks for workspace summary
  const allPlaybooks: BundlePlaybook[] = [];
  const bundleActivationData: BundleActivationData[] = [];
  const roiInputBundles: ROIInputBundle[] = [];

  for (const bundle of activeBundlesRaw) {
    const metrics = await getBundleEngagementMetrics(bundle.id, actor.workspaceId);
    const intelligence = metrics ? generateBundleSalesIntelligence(metrics) : null;

    let playbook: BundlePlaybook | null = null;
    if (intelligence) {
      playbook = generateBundlePlaybook(
        bundle.id,
        intelligence.dealStageIndicator,
        intelligence.signals
      );
      allPlaybooks.push(playbook);
    }

    // Build ROI input
    roiInputBundles.push({
      bundleId: bundle.id,
      createdAt: bundle.createdAt,
      expiresAt: bundle.expiresAt,
      revokedAt: bundle.revokedAt || null,
      totalViews: metrics?.totalViews || 0,
      uniqueViewDays: metrics?.uniqueSessions || 0, // Use uniqueSessions as proxy
      sectionViews: metrics?.sectionViews || {},
      hasExport: metrics ? hasAnyExport(metrics.exports) : false,
      hasRevisit: (metrics?.revisitCount || 0) > 0,
      hasExpiredAccess: (metrics?.expiredAccessAttempts || 0) > 0,
      firstViewAt: metrics?.firstViewedAt || null,
      lastViewAt: metrics?.lastViewedAt || null,
      firstExportAt: null, // Not available in current metrics
      dealStage: intelligence?.dealStageIndicator || 'NO_ACTIVITY',
    });

    // Only include timeline for single bundle view
    bundleActivationData.push({
      bundleId: bundle.id,
      label: bundle.label || null,
      createdAt: bundle.createdAt,
      expiresAt: bundle.expiresAt,
      status: getBundleStatus(bundle),
      intelligence,
      playbook,
      timeline: null, // Timeline only for single bundle view
    });
  }

  // Generate workspace playbook summary
  const playbookSummary = generateWorkspacePlaybookSummary(actor.workspaceId, allPlaybooks);

  // Generate ROI analytics
  const roiAnalytics = computeTrustROIAnalytics(actor.workspaceId, roiInputBundles);

  // Audit log
  await auditLog({
    workspaceId: actor.workspaceId,
    actorId: actor.id,
    action: 'read',
    entityType: 'trust_engagement',
    entityId: actor.workspaceId,
    metadata: { view, type: 'dashboard' },
  });

  const now = new Date();
  const data: ActivationDashboardData = {
    summary: {
      totalBundles: activeBundlesRaw.length,
      activeBundles: activeBundlesRaw.filter(
        (b) => !b.revokedAt && new Date(b.expiresAt) > now
      ).length,
      totalViews: workspaceSummary?.totalViews || 0,
      totalExports: workspaceSummary?.totalExports || 0,
    },
    playbookSummary,
    roiAnalytics,
    bundles: bundleActivationData.sort((a, b) => {
      // Sort by most recent first
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }),
  };

  return NextResponse.json({
    success: true,
    data,
  });
}
