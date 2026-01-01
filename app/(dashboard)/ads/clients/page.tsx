// ============================================
// AdLab Clients Page
// ============================================
// List of advertising clients.
// PHASE D15: Workspace-scoped, filter-aware.

import { AdLabPageShell, AdLabEmptyState, AdLabTable, AdLabErrorBox, AdLabContextBar } from '@/components/adlab';
import { getClients, type AdLabClient } from '@/lib/adlab/queries';
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

// Platform tags display
function PlatformTags({ tags }: { tags: string[] }) {
  if (!tags || tags.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {tags.slice(0, 3).map((tag) => (
        <span
          key={tag}
          className="px-2 py-0.5 text-[10px] bg-secondary text-secondary-foreground rounded"
        >
          {tag}
        </span>
      ))}
      {tags.length > 3 && (
        <span className="px-2 py-0.5 text-[10px] text-muted-foreground">
          +{tags.length - 3}
        </span>
      )}
    </div>
  );
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdLabClientsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { context, noWorkspace, error: contextError } = await getAdLabPageContext(params);

  // No workspace state
  if (noWorkspace || !context) {
    return (
      <AdLabPageShell
        title="Clients"
        description="Advertising clients in your workspace"
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

  // Fetch clients (note: for clients page, we don't filter by clientId)
  const filtersWithoutClient = { ...filters, clientId: null };
  const { data: clients, error, count } = await getClients(filtersWithoutClient, 50);

  const columns = [
    {
      key: 'name',
      header: 'Client Name',
      render: (item: AdLabClient) => (
        <span className="font-medium">{item.name}</span>
      ),
    },
    {
      key: 'platform_tags',
      header: 'Platforms',
      render: (item: AdLabClient) => <PlatformTags tags={item.platform_tags} />,
    },
    {
      key: 'notes',
      header: 'Notes',
      render: (item: AdLabClient) => (
        <span className="text-muted-foreground truncate max-w-[200px] block">
          {item.notes || '—'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (item: AdLabClient) => (
        <span className="text-muted-foreground">{formatDate(item.created_at)}</span>
      ),
    },
  ];

  return (
    <AdLabPageShell
      title="Clients"
      description={`${count} advertising client${count !== 1 ? 's' : ''} in your workspace`}
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
        {clients.length > 0
          ? 'Clients shown here are referenced by alerts in your workspace.'
          : 'Entities appear here when they are referenced by alerts.'}
      </p>

      {clients.length === 0 && !error ? (
        <AdLabEmptyState
          title="No clients yet"
          description="No alerts currently reference client-level data."
          icon={
            <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
        />
      ) : (
        <AdLabTable
          columns={columns}
          data={clients}
          keyField="id"
          emptyMessage="No clients found"
        />
      )}
    </AdLabPageShell>
  );
}
