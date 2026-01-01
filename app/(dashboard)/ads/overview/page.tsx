// ============================================
// AdLab Overview Page
// ============================================
// Dashboard overview with counts and quick stats.
// PHASE D15: Workspace-scoped, filter-aware.

import { AdLabPageShell, AdLabErrorBox, AdLabEmptyState, AdLabContextBar, AdLabDataFreshness, AdLabStalenessBanner } from '@/components/adlab';
import { getOverviewCounts, getOverviewSummary, getDateRangeFromPreset, type AdLabFilters } from '@/lib/adlab/queries';
import { resolveWorkspace, getWorkspaceClients } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Format currency
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

// Format number with commas
function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(value));
}

// Format percentage
function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

// Stat card component
function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
          <p className="text-2xl font-semibold text-foreground mt-1">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        </div>
        <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center">
          {icon}
        </div>
      </div>
    </div>
  );
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdLabOverviewPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Resolve workspace
  const { workspace, error: workspaceError } = await resolveWorkspace();

  // If no workspace, show empty state
  if (!workspace) {
    return (
      <AdLabPageShell
        title="AdLab Overview"
        description="Monitor your ad performance across all platforms"
        badge={{ label: 'Read-Only', variant: 'info' }}
      >
        {workspaceError ? (
          <AdLabErrorBox
            message={workspaceError}
            hint="Unable to resolve workspace. Please check your authentication."
          />
        ) : (
          <AdLabEmptyState
            title="No workspace found"
            description="Create a workspace to start tracking your ad performance."
            icon={
              <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
          />
        )}
      </AdLabPageShell>
    );
  }

  // Parse filters from URL
  const clientId = params.client as string | undefined;
  const range = (params.range as '7d' | '14d' | '30d' | 'custom') || '7d';
  const customFrom = params.from as string | undefined;
  const customTo = params.to as string | undefined;

  // Calculate date range
  const dateRange = getDateRangeFromPreset(range, customFrom, customTo);

  // Build filters
  const filters: AdLabFilters = {
    workspaceId: workspace.id,
    clientId: clientId && clientId !== 'all' ? clientId : null,
    from: dateRange.from,
    to: dateRange.to,
  };

  // Fetch data in parallel
  const [counts, summary, { clients }] = await Promise.all([
    getOverviewCounts(filters),
    getOverviewSummary(filters),
    getWorkspaceClients(workspace.id),
  ]);

  const hasAnyError = counts.error || summary.error;

  return (
    <AdLabPageShell
      title="AdLab Overview"
      description="Monitor your ad performance across all platforms"
      badge={{ label: 'Read-Only', variant: 'info' }}
    >
      {/* Context Bar */}
      <AdLabContextBar
        workspaceName={workspace.name}
        clients={clients}
      />

      {/* Data Freshness Badge */}
      <div className="-mt-2 mb-4">
        <AdLabDataFreshness
          workspaceId={workspace.id}
          clientId={filters.clientId}
        />
      </div>

      {/* D28: Staleness Banner */}
      <AdLabStalenessBanner
        workspaceId={workspace.id}
        clientId={filters.clientId}
      />

      {hasAnyError && (
        <AdLabErrorBox
          message={counts.error || summary.error || 'Unknown error'}
          hint="This may be due to RLS policies. The UI is working correctly."
        />
      )}

      {/* Entity Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Clients"
          value={counts.clients}
          icon={
            <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />
        <StatCard
          label="Campaigns"
          value={counts.campaigns}
          icon={
            <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
        />
        <StatCard
          label="Ad Sets"
          value={counts.adSets}
          icon={
            <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          }
        />
        <StatCard
          label="Ads"
          value={counts.ads}
          icon={
            <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
        <StatCard
          label="Unread Alerts"
          value={counts.unreadAlerts}
          icon={
            <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          }
        />
      </div>

      {/* Metrics Summary */}
      <div className="mt-6">
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Performance Summary
          <span className="text-[11px] text-muted-foreground font-normal">
            (selected date range)
          </span>
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-card rounded-lg border border-border p-4">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Total Spend
            </p>
            <p className="text-lg font-semibold text-foreground mt-1">
              {formatCurrency(summary.totalSpend)}
            </p>
          </div>
          <div className="bg-card rounded-lg border border-border p-4">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Impressions
            </p>
            <p className="text-lg font-semibold text-foreground mt-1">
              {formatNumber(summary.totalImpressions)}
            </p>
          </div>
          <div className="bg-card rounded-lg border border-border p-4">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Clicks
            </p>
            <p className="text-lg font-semibold text-foreground mt-1">
              {formatNumber(summary.totalClicks)}
            </p>
          </div>
          <div className="bg-card rounded-lg border border-border p-4">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Conversions
            </p>
            <p className="text-lg font-semibold text-foreground mt-1">
              {formatNumber(summary.totalConversions)}
            </p>
          </div>
          <div className="bg-card rounded-lg border border-border p-4">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Avg CTR
            </p>
            <p className="text-lg font-semibold text-foreground mt-1">
              {formatPercent(summary.avgCtr)}
            </p>
          </div>
          <div className="bg-card rounded-lg border border-border p-4">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Avg CPC
            </p>
            <p className="text-lg font-semibold text-foreground mt-1">
              {formatCurrency(summary.avgCpc)}
            </p>
          </div>
        </div>
      </div>

      {/* Info placeholder */}
      <div className="bg-card rounded-xl border border-border p-8 text-center mt-6">
        <p className="text-sm text-muted-foreground">
          More dashboard widgets coming soon. Import data to see metrics.
        </p>
      </div>
    </AdLabPageShell>
  );
}
