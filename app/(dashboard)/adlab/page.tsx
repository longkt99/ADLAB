// ============================================
// AdLab Dashboard Page
// ============================================
// Marketing Laboratory v2.0: AdLab Overview Dashboard
//
// Shows:
// - KPI cards (spend, clicks, conversions, ROAS)
// - Trend chart (last 30 days)
// - Platform breakdown
// - Recent alerts
// ============================================

import { resolveWorkspace, getWorkspaceClients } from '@/lib/supabase/server';
import {
  getOverviewCounts,
  getOverviewSummary,
  getDailyMetrics,
  getAlertsFiltered,
  getDateRangeFromPreset,
  type AdLabFilters,
} from '@/lib/adlab/queries';
import { AdLabDashboardContent } from './AdLabDashboardContent';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdLabDashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { workspace, error: workspaceError } = await resolveWorkspace();

  // If no workspace, show with empty state
  if (!workspace) {
    return (
      <AdLabDashboardContent
        workspace={null}
        error={workspaceError}
        clients={[]}
        counts={null}
        summary={null}
        dailyMetrics={[]}
        alerts={[]}
        platformBreakdown={[]}
      />
    );
  }

  // Parse filters
  const clientId = params.client as string | undefined;
  const range = (params.range as '7d' | '14d' | '30d') || '30d';
  const dateRange = getDateRangeFromPreset(range);

  const filters: AdLabFilters = {
    workspaceId: workspace.id,
    clientId: clientId && clientId !== 'all' ? clientId : null,
    from: dateRange.from,
    to: dateRange.to,
  };

  // Fetch all data in parallel
  const [
    { clients },
    counts,
    summary,
    { data: dailyMetrics },
    { data: alerts },
  ] = await Promise.all([
    getWorkspaceClients(workspace.id),
    getOverviewCounts(filters),
    getOverviewSummary(filters),
    getDailyMetrics(filters, 30),
    getAlertsFiltered(filters, { status: 'unread' }, 5),
  ]);

  // Calculate platform breakdown from daily metrics
  const platformBreakdown = calculatePlatformBreakdown(dailyMetrics);

  return (
    <AdLabDashboardContent
      workspace={workspace}
      error={null}
      clients={clients}
      counts={counts}
      summary={summary}
      dailyMetrics={dailyMetrics}
      alerts={alerts}
      platformBreakdown={platformBreakdown}
    />
  );
}

// Helper to calculate platform breakdown
function calculatePlatformBreakdown(
  metrics: Array<{ platform: string; spend: number; clicks: number; conversions: number; conversion_value: number }>
): Array<{ platform: string; spend: number; clicks: number; conversions: number; revenue: number }> {
  const byPlatform = new Map<string, { spend: number; clicks: number; conversions: number; revenue: number }>();

  metrics.forEach((m) => {
    const existing = byPlatform.get(m.platform) || { spend: 0, clicks: 0, conversions: 0, revenue: 0 };
    byPlatform.set(m.platform, {
      spend: existing.spend + (m.spend || 0),
      clicks: existing.clicks + (m.clicks || 0),
      conversions: existing.conversions + (m.conversions || 0),
      revenue: existing.revenue + (m.conversion_value || 0),
    });
  });

  return Array.from(byPlatform.entries())
    .map(([platform, data]) => ({ platform, ...data }))
    .sort((a, b) => b.spend - a.spend);
}
