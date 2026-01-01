// ============================================
// AdLab Alert Rules Page
// ============================================
// List of alert rule configurations.
// PHASE D15: Workspace-scoped, filter-aware.

import { AdLabPageShell, AdLabEmptyState, AdLabTable, AdLabErrorBox, AdLabContextBar } from '@/components/adlab';
import { getAlertRules, type AdLabAlertRule } from '@/lib/adlab/queries';
import { getAdLabPageContext } from '@/lib/adlab/page-helpers';

export const dynamic = 'force-dynamic';

// Format date for display
function formatDateTime(dateString: string): string {
  try {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

// Format number
function formatNumber(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-US').format(value);
}

// Enabled indicator
function EnabledIndicator({ isEnabled }: { isEnabled: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-green-500' : 'bg-secondary'}`} />
      <span className={`text-[11px] ${isEnabled ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
        {isEnabled ? 'enabled' : 'disabled'}
      </span>
    </div>
  );
}

// Severity badge
function SeverityBadge({ severity }: { severity: string | null }) {
  if (!severity) return <span className="text-muted-foreground">—</span>;

  const styles: Record<string, string> = {
    critical: 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400',
    warning: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400',
    info: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
  };

  return (
    <span className={`px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded ${styles[severity] || styles.info}`}>
      {severity}
    </span>
  );
}

// Platform badge
function PlatformBadge({ platform }: { platform: string | null }) {
  if (!platform) return <span className="text-muted-foreground">—</span>;

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

export default async function AdLabAlertRulesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { context, noWorkspace, error: contextError } = await getAdLabPageContext(params);

  // No workspace state
  if (noWorkspace || !context) {
    return (
      <AdLabPageShell
        title="Alert Rules"
        description="Alert rules in your workspace"
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

  // Fetch alert rules with workspace/client filters
  const { data: rules, error, count } = await getAlertRules(filters, 50);

  const columns = [
    {
      key: 'is_enabled',
      header: 'Status',
      render: (item: AdLabAlertRule) => (
        <EnabledIndicator isEnabled={item.is_enabled ?? true} />
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (item: AdLabAlertRule) => (
        <span className="font-medium truncate max-w-[150px] block">
          {item.name || 'Rule'}
        </span>
      ),
    },
    {
      key: 'severity',
      header: 'Severity',
      render: (item: AdLabAlertRule) => <SeverityBadge severity={item.severity} />,
    },
    {
      key: 'platform',
      header: 'Platform',
      render: (item: AdLabAlertRule) => <PlatformBadge platform={item.platform} />,
    },
    {
      key: 'metric_key',
      header: 'Metric',
      render: (item: AdLabAlertRule) => (
        <span className="text-muted-foreground capitalize">{item.metric_key || '—'}</span>
      ),
    },
    {
      key: 'operator',
      header: 'Operator',
      render: (item: AdLabAlertRule) => (
        <span className="text-muted-foreground font-mono text-[11px]">{item.operator || '—'}</span>
      ),
    },
    {
      key: 'threshold',
      header: 'Threshold',
      render: (item: AdLabAlertRule) => (
        <span className="text-muted-foreground">{formatNumber(item.threshold)}</span>
      ),
    },
    {
      key: 'scope',
      header: 'Scope',
      render: (item: AdLabAlertRule) => (
        <span className="text-muted-foreground capitalize">{item.scope || '—'}</span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (item: AdLabAlertRule) => (
        <span className="text-muted-foreground">{formatDateTime(item.created_at)}</span>
      ),
    },
  ];

  return (
    <AdLabPageShell
      title="Alert Rules"
      description={`${count} rule${count !== 1 ? 's' : ''} in your workspace`}
      badge={{ label: 'Read-Only', variant: 'info' }}
      actions={
        // UI-only toggle - no functionality in Phase 6
        <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-1.5">
          <span className="text-[11px] text-muted-foreground">Enabled only</span>
          <button
            disabled
            className="relative inline-flex h-5 w-9 items-center rounded-full bg-secondary cursor-not-allowed"
          >
            <span className="inline-block h-3.5 w-3.5 transform rounded-full bg-muted-foreground/50 translate-x-1" />
          </button>
          <span className="text-[10px] text-muted-foreground">(Coming soon)</span>
        </div>
      }
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

      {rules.length === 0 && !error ? (
        <AdLabEmptyState
          title="No alert rules yet"
          description="Create alert rules to monitor your ad performance and receive notifications."
          icon={
            <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          }
        />
      ) : (
        <AdLabTable
          columns={columns}
          data={rules}
          keyField="id"
          emptyMessage="No alert rules found"
        />
      )}
    </AdLabPageShell>
  );
}
