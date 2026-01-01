// ============================================
// AdLab Metrics Page
// ============================================
// Daily and demographic metrics preview.
// PHASE D15: Workspace-scoped, filter-aware.

import { AdLabPageShell, AdLabEmptyState, AdLabTable, AdLabErrorBox, AdLabContextBar, AdLabDataFreshness, AdLabStalenessBanner } from '@/components/adlab';
import { getDailyMetrics, getDemographicMetrics, type AdLabDailyMetric, type AdLabDemographicMetric } from '@/lib/adlab/queries';
import { getAdLabPageContext } from '@/lib/adlab/page-helpers';

export const dynamic = 'force-dynamic';

// Format date for display
function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

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
  return new Intl.NumberFormat('en-US').format(value);
}

// Platform badge
function PlatformBadge({ platform }: { platform: string }) {
  const platformNames: Record<string, string> = {
    meta: 'Meta',
    google: 'Google',
    tiktok: 'TikTok',
    linkedin: 'LinkedIn',
  };

  return (
    <span className="px-2 py-0.5 text-[10px] bg-secondary text-secondary-foreground rounded">
      {platformNames[platform] || platform}
    </span>
  );
}

// Entity type badge
function EntityTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    campaign: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
    ad_set: 'bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400',
    ad: 'bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400',
  };

  return (
    <span className={`px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded ${styles[type] || 'bg-secondary text-secondary-foreground'}`}>
      {type.replace('_', ' ')}
    </span>
  );
}

// Daily metrics table columns
const dailyColumns = [
  {
    key: 'date',
    header: 'Date',
    render: (item: AdLabDailyMetric) => formatDate(item.date),
  },
  {
    key: 'platform',
    header: 'Platform',
    render: (item: AdLabDailyMetric) => <PlatformBadge platform={item.platform} />,
  },
  {
    key: 'entity_type',
    header: 'Entity',
    render: (item: AdLabDailyMetric) => <EntityTypeBadge type={item.entity_type} />,
  },
  {
    key: 'spend',
    header: 'Spend',
    render: (item: AdLabDailyMetric) => (
      <span className="font-medium">{formatCurrency(item.spend)}</span>
    ),
  },
  {
    key: 'impressions',
    header: 'Impressions',
    render: (item: AdLabDailyMetric) => formatNumber(item.impressions),
  },
  {
    key: 'clicks',
    header: 'Clicks',
    render: (item: AdLabDailyMetric) => formatNumber(item.clicks),
  },
  {
    key: 'ctr',
    header: 'CTR',
    render: (item: AdLabDailyMetric) => `${(item.ctr * 100).toFixed(2)}%`,
  },
];

// Demographic metrics table columns
const demographicColumns = [
  {
    key: 'date',
    header: 'Date',
    render: (item: AdLabDemographicMetric) => formatDate(item.date),
  },
  {
    key: 'platform',
    header: 'Platform',
    render: (item: AdLabDemographicMetric) => <PlatformBadge platform={item.platform} />,
  },
  {
    key: 'dimension',
    header: 'Dimension',
    render: (item: AdLabDemographicMetric) => (
      <span className="capitalize">{item.dimension}</span>
    ),
  },
  {
    key: 'key',
    header: 'Value',
    render: (item: AdLabDemographicMetric) => (
      <span className="font-medium">{item.key}</span>
    ),
  },
  {
    key: 'spend',
    header: 'Spend',
    render: (item: AdLabDemographicMetric) => formatCurrency(item.spend),
  },
  {
    key: 'impressions',
    header: 'Impressions',
    render: (item: AdLabDemographicMetric) => formatNumber(item.impressions),
  },
  {
    key: 'clicks',
    header: 'Clicks',
    render: (item: AdLabDemographicMetric) => formatNumber(item.clicks),
  },
];

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdLabMetricsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { context, noWorkspace, error: contextError } = await getAdLabPageContext(params);

  // No workspace state
  if (noWorkspace || !context) {
    return (
      <AdLabPageShell
        title="Metrics"
        description="Performance metrics in your workspace"
        badge={{ label: 'Read-Only', variant: 'info' }}
      >
        {contextError ? (
          <AdLabErrorBox
            message={contextError}
            hint="Unable to resolve workspace. Please check your authentication."
          />
        ) : (
          <AdLabEmptyState
            title="No workspace found"
            description="Create a workspace to start tracking your ad performance."
          />
        )}
      </AdLabPageShell>
    );
  }

  const { workspace, clients: workspaceClients, filters } = context;

  // Fetch metrics with workspace/client/date filters in parallel
  const [dailyResult, demoResult] = await Promise.all([
    getDailyMetrics(filters, 50),
    getDemographicMetrics(filters, 50),
  ]);

  const hasAnyError = dailyResult.error || demoResult.error;
  const totalCount = dailyResult.count + demoResult.count;

  return (
    <AdLabPageShell
      title="Metrics"
      description={`${totalCount} metric record${totalCount !== 1 ? 's' : ''} in your workspace`}
      badge={{ label: 'Read-Only', variant: 'info' }}
    >
      {/* Context Bar */}
      <AdLabContextBar
        workspaceName={workspace.name}
        clients={workspaceClients}
      />

      {/* Data Freshness Badge */}
      <div className="-mt-2 mb-4">
        <AdLabDataFreshness
          workspaceId={filters.workspaceId}
          clientId={filters.clientId}
        />
      </div>

      {/* D28: Staleness Banner */}
      <AdLabStalenessBanner
        workspaceId={filters.workspaceId}
        clientId={filters.clientId}
      />

      {hasAnyError && (
        <AdLabErrorBox
          message={dailyResult.error || demoResult.error || 'Unknown error'}
          hint="This may be due to RLS policies. The UI is working correctly."
        />
      )}

      {/* Cognitive explanation */}
      <p className="text-[11px] text-muted-foreground/60 -mt-2 mb-4">
        Metrics derive from alert activity and tracked ad performance.
      </p>

      {/* Tabs - static UI, both sections shown */}
      <div className="space-y-8">
        {/* Daily Metrics Section */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Daily Metrics
            <span className="text-[11px] text-muted-foreground font-normal">
              ({dailyResult.count} records)
            </span>
          </h2>

          {dailyResult.data.length === 0 && !dailyResult.error ? (
            <AdLabEmptyState
              title="No daily metrics yet"
              description="No alert activity has generated daily performance data yet."
            />
          ) : (
            <AdLabTable
              columns={dailyColumns}
              data={dailyResult.data}
              keyField="id"
              emptyMessage="No daily metrics found"
            />
          )}
        </div>

        {/* Demographic Metrics Section */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Demographic Metrics
            <span className="text-[11px] text-muted-foreground font-normal">
              ({demoResult.count} records)
            </span>
          </h2>

          {demoResult.data.length === 0 && !demoResult.error ? (
            <AdLabEmptyState
              title="No demographic metrics yet"
              description="No alert activity has generated audience breakdown data yet."
            />
          ) : (
            <AdLabTable
              columns={demographicColumns}
              data={demoResult.data}
              keyField="id"
              emptyMessage="No demographic metrics found"
            />
          )}
        </div>
      </div>
    </AdLabPageShell>
  );
}
