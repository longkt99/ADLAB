// ============================================
// AdLab Ads Page
// ============================================
// List of individual ads.
// PHASE D15: Workspace-scoped, filter-aware.

import { AdLabPageShell, AdLabEmptyState, AdLabTable, AdLabErrorBox, AdLabContextBar } from '@/components/adlab';
import { getAds, type AdLabAd } from '@/lib/adlab/queries';
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

// Status badge
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400',
    paused: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400',
    completed: 'bg-secondary text-secondary-foreground',
    archived: 'bg-secondary text-muted-foreground',
    disapproved: 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400',
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

export default async function AdLabAdsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { context, noWorkspace, error: contextError } = await getAdLabPageContext(params);

  // No workspace state
  if (noWorkspace || !context) {
    return (
      <AdLabPageShell
        title="Ads"
        description="Individual ads in your workspace"
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

  // Fetch ads with workspace/client filters
  const { data: ads, error, count } = await getAds(filters, 50);

  const columns = [
    {
      key: 'name',
      header: 'Ad Name',
      render: (item: AdLabAd) => (
        <span className="font-medium">{item.name}</span>
      ),
    },
    {
      key: 'platform',
      header: 'Platform',
      render: (item: AdLabAd) => <PlatformBadge platform={item.platform} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: AdLabAd) => <StatusBadge status={item.status} />,
    },
    {
      key: 'creative_id',
      header: 'Creative ID',
      render: (item: AdLabAd) => (
        <span className="text-muted-foreground font-mono text-[11px]">
          {item.creative_id ? item.creative_id.slice(0, 12) + '...' : '—'}
        </span>
      ),
    },
    {
      key: 'landing_page_url',
      header: 'Landing Page',
      render: (item: AdLabAd) => (
        item.landing_page_url ? (
          <a
            href={item.landing_page_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline text-[11px] truncate max-w-[150px] block"
          >
            {new URL(item.landing_page_url).hostname}
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      ),
    },
    {
      key: 'first_seen_at',
      header: 'First Seen',
      render: (item: AdLabAd) => (
        <span className="text-muted-foreground">{formatDate(item.first_seen_at)}</span>
      ),
    },
  ];

  return (
    <AdLabPageShell
      title="Ads"
      description={`${count} ad${count !== 1 ? 's' : ''} in your workspace`}
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
        {ads.length > 0
          ? 'Ads shown here are referenced by alerts in your workspace.'
          : 'Entities appear here when they are referenced by alerts.'}
      </p>

      {ads.length === 0 && !error ? (
        <AdLabEmptyState
          title="No ads yet"
          description="No alerts currently reference individual ad performance."
          icon={
            <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
        />
      ) : (
        <AdLabTable
          columns={columns}
          data={ads}
          keyField="id"
          emptyMessage="No ads found"
        />
      )}
    </AdLabPageShell>
  );
}
