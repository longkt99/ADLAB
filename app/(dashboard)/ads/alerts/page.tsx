// ============================================
// AdLab Alerts Page
// ============================================
// List of triggered alerts with bulk actions.
// PHASE D15: Workspace-scoped, filter-aware.

import { AdLabPageShell, AdLabEmptyState, AdLabErrorBox, AdLabContextBar } from '@/components/adlab';
import {
  getAlertsFiltered,
  type AlertFilters,
  type AlertStatusFilter,
  type AlertSeverityFilter,
  type AlertPlatformFilter,
} from '@/lib/adlab/queries';
import { getAdLabPageContext } from '@/lib/adlab/page-helpers';
import { AlertsTableClient } from './AlertsTableClient';
import { AlertsFilters } from './AlertsFilters';

export const dynamic = 'force-dynamic';

// Valid filter values for validation
const VALID_STATUS: AlertStatusFilter[] = ['all', 'unread', 'read', 'resolved'];
const VALID_SEVERITY: AlertSeverityFilter[] = ['all', 'warning', 'critical', 'info'];
const VALID_PLATFORM: AlertPlatformFilter[] = ['all', 'meta', 'google', 'tiktok', 'linkedin'];

// Parse and validate filter from searchParams
function parseStatus(value: string | undefined): AlertStatusFilter {
  if (value && VALID_STATUS.includes(value as AlertStatusFilter)) {
    return value as AlertStatusFilter;
  }
  return 'all';
}

function parseSeverity(value: string | undefined): AlertSeverityFilter {
  if (value && VALID_SEVERITY.includes(value as AlertSeverityFilter)) {
    return value as AlertSeverityFilter;
  }
  return 'all';
}

function parsePlatform(value: string | undefined): AlertPlatformFilter {
  if (value && VALID_PLATFORM.includes(value as AlertPlatformFilter)) {
    return value as AlertPlatformFilter;
  }
  return 'all';
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdLabAlertsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { context, noWorkspace, error: contextError } = await getAdLabPageContext(params);

  // No workspace state
  if (noWorkspace || !context) {
    return (
      <AdLabPageShell
        title="Alerts"
        description="Performance alerts in your workspace"
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

  const { workspace, clients: workspaceClients, filters: workspaceFilters } = context;

  // Parse alert-specific filters from URL
  const status = parseStatus(params.status as string | undefined);
  const severity = parseSeverity(params.severity as string | undefined);
  const platform = parsePlatform(params.platform as string | undefined);

  const alertFilters: AlertFilters = { status, severity, platform };

  // Fetch filtered alerts with workspace scope
  const { data: alerts, error, count } = await getAlertsFiltered(workspaceFilters, alertFilters, 50);

  // Count unread and resolved from filtered results
  const unreadCount = alerts.filter(a => !a.is_read).length;
  const resolvedCount = alerts.filter(a => !!a.resolved_at).length;

  // Build description based on active filters
  const hasFilters = status !== 'all' || severity !== 'all' || platform !== 'all';
  const filterLabel = hasFilters ? ' (filtered)' : '';
  const description = `${count} alert${count !== 1 ? 's' : ''}${filterLabel} • ${unreadCount} unread • ${resolvedCount} resolved`;

  // Build filter scope description for subtitle
  const buildFilterScope = (): string | null => {
    if (!hasFilters) return null;
    const parts: string[] = [];
    if (status !== 'all') parts.push(status);
    if (severity !== 'all') parts.push(severity);
    if (platform !== 'all') parts.push(platform.charAt(0).toUpperCase() + platform.slice(1));
    return `Showing alerts filtered by: ${parts.join(', ')}`;
  };
  const filterScope = buildFilterScope();

  return (
    <AdLabPageShell
      title="Alerts"
      description={description}
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
      <p className="text-[11px] text-muted-foreground/60 -mt-2 mb-3">
        Alerts surface abnormal performance detected across your ad entities.
      </p>

      {/* Filter scope indicator */}
      {filterScope && (
        <p className="text-[11px] text-muted-foreground/70 -mt-1 mb-2 flex items-center gap-1.5">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          {filterScope}
        </p>
      )}

      {/* Filters */}
      <AlertsFilters status={status} severity={severity} platform={platform} />

      {alerts.length === 0 && !error ? (
        <AdLabEmptyState
          title={hasFilters ? "No alerts match filters" : "No alerts yet"}
          description={hasFilters ? "Try adjusting your filters to see more alerts." : "Configure alert rules to receive notifications about your ad performance."}
          icon={
            <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          }
        />
      ) : (
        <AlertsTableClient alerts={alerts} />
      )}
    </AdLabPageShell>
  );
}
