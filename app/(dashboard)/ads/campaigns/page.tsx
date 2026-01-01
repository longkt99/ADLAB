// ============================================
// AdLab Campaigns Page
// ============================================
// List of advertising campaigns.
// PHASE D15: Workspace-scoped, filter-aware.

import { AdLabPageShell, AdLabEmptyState, AdLabTable, AdLabErrorBox, AdLabContextBar } from '@/components/adlab';
import { getCampaigns, type AdLabCampaign } from '@/lib/adlab/queries';
import { getAdLabPageContext } from '@/lib/adlab/page-helpers';

export const dynamic = 'force-dynamic';

// Format date for display
function formatDate(dateString: string | null): string {
  if (!dateString) return '—';
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

export default async function AdLabCampaignsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { context, noWorkspace, error: contextError } = await getAdLabPageContext(params);

  // No workspace state
  if (noWorkspace || !context) {
    return (
      <AdLabPageShell
        title="Campaigns"
        description="Advertising campaigns in your workspace"
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

  // Fetch campaigns with workspace/client filters
  const { data: campaigns, error, count } = await getCampaigns(filters, 50);

  const columns = [
    {
      key: 'name',
      header: 'Campaign Name',
      render: (item: AdLabCampaign) => (
        <div>
          <span className="font-medium block">{item.name}</span>
          {item.client_name && (
            <span className="text-[11px] text-muted-foreground">{item.client_name}</span>
          )}
        </div>
      ),
    },
    {
      key: 'platform',
      header: 'Platform',
      render: (item: AdLabCampaign) => <PlatformBadge platform={item.platform} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: AdLabCampaign) => <StatusBadge status={item.status} />,
    },
    {
      key: 'objective',
      header: 'Objective',
      render: (item: AdLabCampaign) => (
        <span className="text-muted-foreground">{item.objective || '—'}</span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (item: AdLabCampaign) => (
        <span className="text-muted-foreground">{formatDate(item.created_at)}</span>
      ),
    },
  ];

  return (
    <AdLabPageShell
      title="Campaigns"
      description={`${count} campaign${count !== 1 ? 's' : ''} in your workspace`}
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
        {campaigns.length > 0
          ? 'Campaigns shown here are referenced by alerts in your workspace.'
          : 'Entities appear here when they are referenced by alerts.'}
      </p>

      {campaigns.length === 0 && !error ? (
        <AdLabEmptyState
          title="No campaigns yet"
          description="No alerts currently reference campaign-level performance."
          icon={
            <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
            </svg>
          }
        />
      ) : (
        <AdLabTable
          columns={columns}
          data={campaigns}
          keyField="id"
          emptyMessage="No campaigns found"
        />
      )}
    </AdLabPageShell>
  );
}
