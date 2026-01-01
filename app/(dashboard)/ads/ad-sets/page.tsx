// ============================================
// AdLab Ad Sets Page
// ============================================
// List of ad sets / ad groups.
// PHASE D15: Workspace-scoped, filter-aware.

import { AdLabPageShell, AdLabEmptyState, AdLabTable, AdLabErrorBox, AdLabContextBar } from '@/components/adlab';
import { getAdSets, type AdLabAdSet } from '@/lib/adlab/queries';
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
function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

// Status badge
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400',
    paused: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400',
    completed: 'bg-secondary text-secondary-foreground',
    archived: 'bg-secondary text-muted-foreground',
  };

  return (
    <span className={`px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded ${styles[status] || styles.archived}`}>
      {status}
    </span>
  );
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

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdLabAdSetsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { context, noWorkspace, error: contextError } = await getAdLabPageContext(params);

  // No workspace state
  if (noWorkspace || !context) {
    return (
      <AdLabPageShell
        title="Ad Sets"
        description="Ad sets in your workspace"
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

  // Fetch ad sets with workspace/client filters
  const { data: adSets, error, count } = await getAdSets(filters, 50);

  const columns = [
    {
      key: 'name',
      header: 'Ad Set Name',
      render: (item: AdLabAdSet) => (
        <span className="font-medium">{item.name}</span>
      ),
    },
    {
      key: 'platform',
      header: 'Platform',
      render: (item: AdLabAdSet) => <PlatformBadge platform={item.platform} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: AdLabAdSet) => <StatusBadge status={item.status} />,
    },
    {
      key: 'daily_budget',
      header: 'Daily Budget',
      render: (item: AdLabAdSet) => (
        <span className="text-muted-foreground">{formatCurrency(item.daily_budget)}</span>
      ),
    },
    {
      key: 'bid_strategy',
      header: 'Bid Strategy',
      render: (item: AdLabAdSet) => (
        <span className="text-muted-foreground">{item.bid_strategy || '—'}</span>
      ),
    },
    {
      key: 'first_seen_at',
      header: 'First Seen',
      render: (item: AdLabAdSet) => (
        <span className="text-muted-foreground">{formatDate(item.first_seen_at)}</span>
      ),
    },
  ];

  return (
    <AdLabPageShell
      title="Ad Sets"
      description={`${count} ad set${count !== 1 ? 's' : ''} in your workspace`}
      badge={{ label: 'Read-Only', variant: 'info' }}
    >
      {/* Context Bar */}
      <AdLabContextBar
        workspaceName={workspace.name}
        clients={workspaceClients}
      />

      {error && (
        <AdLabErrorBox
          message={error}
          hint="This may be due to RLS policies. The UI is working correctly."
        />
      )}

      {/* Cognitive explanation */}
      <p className="text-[11px] text-muted-foreground/60 -mt-2 mb-4">
        {adSets.length > 0
          ? 'Ad sets shown here are referenced by alerts in your workspace.'
          : 'Entities appear here when they are referenced by alerts.'}
      </p>

      {adSets.length === 0 && !error ? (
        <AdLabEmptyState
          title="No ad sets yet"
          description="No alerts currently reference ad set-level targeting."
          icon={
            <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
        />
      ) : (
        <AdLabTable
          columns={columns}
          data={adSets}
          keyField="id"
          emptyMessage="No ad sets found"
        />
      )}
    </AdLabPageShell>
  );
}
