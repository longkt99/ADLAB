// ============================================
// AdLab Reports Page
// ============================================
// List of generated reports.
// PHASE D15: Workspace-scoped, filter-aware.

import { AdLabPageShell, AdLabEmptyState, AdLabTable, AdLabErrorBox, AdLabContextBar } from '@/components/adlab';
import { getReports, type AdLabReport } from '@/lib/adlab/queries';
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
    draft: 'bg-secondary text-secondary-foreground',
    generating: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
    completed: 'bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400',
    failed: 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400',
  };

  return (
    <span className={`px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded ${styles[status] || styles.draft}`}>
      {status}
    </span>
  );
}

// Report type badge
function ReportTypeBadge({ type }: { type: string }) {
  const typeLabels: Record<string, string> = {
    performance: 'Performance',
    demographic: 'Demographic',
    creative: 'Creative',
    comparison: 'Comparison',
    custom: 'Custom',
  };

  return (
    <span className="px-2 py-0.5 text-[10px] bg-secondary text-secondary-foreground rounded">
      {typeLabels[type] || type}
    </span>
  );
}

// Platform pills
function PlatformPills({ platforms }: { platforms: string[] }) {
  if (!platforms || platforms.length === 0) {
    return <span className="text-muted-foreground">All</span>;
  }

  const platformNames: Record<string, string> = {
    meta: 'Meta',
    google: 'Google',
    tiktok: 'TikTok',
    linkedin: 'LinkedIn',
  };

  return (
    <div className="flex flex-wrap gap-1">
      {platforms.slice(0, 2).map((p) => (
        <span key={p} className="px-1.5 py-0.5 text-[9px] bg-secondary text-secondary-foreground rounded">
          {platformNames[p] || p}
        </span>
      ))}
      {platforms.length > 2 && (
        <span className="px-1.5 py-0.5 text-[9px] text-muted-foreground">
          +{platforms.length - 2}
        </span>
      )}
    </div>
  );
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdLabReportsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { context, noWorkspace, error: contextError } = await getAdLabPageContext(params);

  // No workspace state
  if (noWorkspace || !context) {
    return (
      <AdLabPageShell
        title="Reports"
        description="Generated reports in your workspace"
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

  // Fetch reports with workspace/client filters
  const { data: reports, error, count } = await getReports(filters, 50);

  const columns = [
    {
      key: 'name',
      header: 'Report Name',
      render: (item: AdLabReport) => (
        <span className="font-medium">{item.name}</span>
      ),
    },
    {
      key: 'report_type',
      header: 'Type',
      render: (item: AdLabReport) => <ReportTypeBadge type={item.report_type} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: AdLabReport) => <StatusBadge status={item.status} />,
    },
    {
      key: 'platforms',
      header: 'Platforms',
      render: (item: AdLabReport) => <PlatformPills platforms={item.platforms} />,
    },
    {
      key: 'date_range',
      header: 'Date Range',
      render: (item: AdLabReport) => (
        <span className="text-muted-foreground text-[11px]">
          {formatDate(item.date_from)} – {formatDate(item.date_to)}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (item: AdLabReport) => (
        <span className="text-muted-foreground">{formatDate(item.created_at)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (item: AdLabReport) => (
        item.file_url ? (
          <a
            href={item.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline text-[11px]"
          >
            Download
          </a>
        ) : (
          <span className="text-muted-foreground text-[11px]">—</span>
        )
      ),
    },
  ];

  return (
    <AdLabPageShell
      title="Reports"
      description={`${count} report${count !== 1 ? 's' : ''} in your workspace`}
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
        Reports summarize alert-driven activity over time.
      </p>

      {reports.length === 0 && !error ? (
        <AdLabEmptyState
          title="No reports yet"
          description="No alert activity has been summarized into reports yet."
          icon={
            <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
      ) : (
        <AdLabTable
          columns={columns}
          data={reports}
          keyField="id"
          emptyMessage="No reports found"
        />
      )}
    </AdLabPageShell>
  );
}
