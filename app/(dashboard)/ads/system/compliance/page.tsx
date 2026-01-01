// ============================================
// AdLab Compliance Dashboard
// ============================================
// PHASE D26: Go-Live Gate & Continuous Compliance.
// PHASE D28: Data Freshness Truth + Staleness Controls.
//
// READ-ONLY visibility for:
// - Current production readiness status
// - Last deploy gate result
// - Drift timeline (from audit logs)
// - Active snapshot map
// - Data freshness map (D28)
//
// RULES:
// - No mutations allowed from UI
// - Uses snapshot-bound analytics only
// - Viewer role can read, never act
// ============================================

import { createClient } from '@supabase/supabase-js';
import { checkProductionReadiness } from '@/lib/adlab/safety';
import { AdLabPageShell } from '@/components/adlab/AdLabPageShell';
import {
  getWorkspaceFreshnessMap,
  type WorkspaceFreshnessMap,
} from '@/lib/adlab/ops/freshnessStatus';
import { formatAge } from '@/lib/adlab/ops/freshnessPolicy';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function createServerClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function getGoLiveStatus() {
  try {
    const supabase = createServerClient();

    // Get last go-live gate result from audit logs
    const { data } = await supabase
      .from('adlab_audit_logs')
      .select('created_at, metadata')
      .eq('scope_dataset', 'go_live_gate')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      return {
        lastCheck: data.created_at,
        result: data.metadata?.gateResult || 'UNKNOWN',
        checksPassed: data.metadata?.checksPassed || 0,
        checksFailed: data.metadata?.checksFailed || 0,
      };
    }

    return null;
  } catch {
    return null;
  }
}

async function getActiveSnapshots() {
  try {
    const supabase = createServerClient();

    const { data } = await supabase
      .from('adlab_production_snapshots')
      .select('id, workspace_id, platform, dataset, created_at, is_active')
      .eq('is_active', true)
      .order('platform')
      .order('dataset');

    return data || [];
  } catch {
    return [];
  }
}

async function getRecentDriftEvents() {
  try {
    const supabase = createServerClient();

    const { data } = await supabase
      .from('adlab_audit_logs')
      .select('id, created_at, workspace_id, metadata')
      .eq('scope_dataset', 'compliance')
      .order('created_at', { ascending: false })
      .limit(20);

    return (data || []).map((event) => ({
      id: event.id,
      timestamp: event.created_at,
      workspaceId: event.workspace_id,
      eventType: event.metadata?.complianceEvent || 'UNKNOWN',
      status: event.metadata?.status || 'UNKNOWN',
      severity: event.metadata?.severity,
      driftCount: event.metadata?.driftCount || 0,
    }));
  } catch {
    return [];
  }
}

async function getRecentIncidents() {
  try {
    const supabase = createServerClient();

    const { data } = await supabase
      .from('adlab_audit_logs')
      .select('id, created_at, workspace_id, metadata')
      .eq('scope_dataset', 'auto_response')
      .order('created_at', { ascending: false })
      .limit(10);

    return (data || []).map((event) => ({
      id: event.metadata?.incidentId || event.id,
      timestamp: event.created_at,
      workspaceId: event.workspace_id,
      severity: event.metadata?.severity,
      reason: event.metadata?.reason,
      actionsExecuted: event.metadata?.actionsExecuted || [],
    }));
  } catch {
    return [];
  }
}

async function getFreshnessData(): Promise<WorkspaceFreshnessMap | null> {
  try {
    const workspaceId = process.env.ADLAB_DEFAULT_WORKSPACE_ID || 'system';
    const platform = process.env.ADLAB_DEFAULT_PLATFORM || 'meta';
    return await getWorkspaceFreshnessMap(workspaceId, platform);
  } catch {
    return null;
  }
}

export default async function ComplianceDashboardPage() {
  const [readiness, goLiveStatus, snapshots, driftEvents, incidents, freshnessMap] = await Promise.all([
    checkProductionReadiness(),
    getGoLiveStatus(),
    getActiveSnapshots(),
    getRecentDriftEvents(),
    getRecentIncidents(),
    getFreshnessData(),
  ]);

  const statusColor =
    readiness.status === 'READY'
      ? 'green'
      : readiness.status === 'DEGRADED'
      ? 'amber'
      : 'red';

  return (
    <AdLabPageShell
      title="System Compliance"
      description="Production readiness and compliance monitoring"
      badge={{
        label: readiness.status,
        variant: statusColor === 'green' ? 'success' : statusColor === 'amber' ? 'warning' : 'info',
      }}
    >
      <div className="space-y-6">
        {/* Production Readiness Status */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-[15px] font-semibold text-foreground mb-4">
            Production Readiness
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="p-3 rounded-lg bg-secondary">
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
                Status
              </div>
              <div
                className={`text-[18px] font-semibold ${
                  statusColor === 'green'
                    ? 'text-green-600'
                    : statusColor === 'amber'
                    ? 'text-amber-600'
                    : 'text-red-600'
                }`}
              >
                {readiness.status}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-secondary">
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
                Checks Passed
              </div>
              <div className="text-[18px] font-semibold text-foreground">
                {readiness.summary.passed}/{readiness.summary.total}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-secondary">
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
                Warnings
              </div>
              <div className="text-[18px] font-semibold text-amber-600">
                {readiness.summary.warnings}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-secondary">
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
                Failures
              </div>
              <div className="text-[18px] font-semibold text-red-600">
                {readiness.summary.failed}
              </div>
            </div>
          </div>

          {/* Individual Checks */}
          <div className="space-y-2">
            {readiness.checks.map((check) => (
              <div
                key={check.name}
                className={`flex items-center justify-between p-2 rounded-lg ${
                  check.status === 'PASS'
                    ? 'bg-green-50 dark:bg-green-950/20'
                    : check.status === 'WARN'
                    ? 'bg-amber-50 dark:bg-amber-950/20'
                    : 'bg-red-50 dark:bg-red-950/20'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      check.status === 'PASS'
                        ? 'bg-green-500'
                        : check.status === 'WARN'
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                  />
                  <span className="text-[12px] font-medium text-foreground">
                    {check.name}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {check.message}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Deploy Gate Status */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-[15px] font-semibold text-foreground mb-4">
            Last Deploy Gate Result
          </h2>
          {goLiveStatus ? (
            <div className="flex items-center gap-4">
              <div
                className={`px-3 py-1 rounded-full text-[12px] font-medium ${
                  goLiveStatus.result === 'PASS'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}
              >
                {goLiveStatus.result}
              </div>
              <span className="text-[12px] text-muted-foreground">
                {new Date(goLiveStatus.lastCheck).toLocaleString()}
              </span>
              <span className="text-[12px] text-muted-foreground">
                {goLiveStatus.checksPassed} passed, {goLiveStatus.checksFailed} failed
              </span>
            </div>
          ) : (
            <div className="text-[13px] text-muted-foreground">
              No deploy gate results available
            </div>
          )}
        </div>

        {/* D28: Freshness Map */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-[15px] font-semibold text-foreground mb-4">
            Data Freshness Map
          </h2>
          {freshnessMap ? (
            <div className="space-y-4">
              {/* Freshness Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="p-3 rounded-lg bg-secondary">
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
                    Datasets
                  </div>
                  <div className="text-[18px] font-semibold text-foreground">
                    {freshnessMap.summary.total}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-secondary">
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
                    Fresh
                  </div>
                  <div className="text-[18px] font-semibold text-green-600">
                    {freshnessMap.summary.fresh}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-secondary">
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
                    Warnings
                  </div>
                  <div className="text-[18px] font-semibold text-amber-600">
                    {freshnessMap.summary.warn}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-secondary">
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
                    Stale
                  </div>
                  <div className="text-[18px] font-semibold text-red-600">
                    {freshnessMap.summary.fail}
                    {freshnessMap.summary.criticalFail > 0 && (
                      <span className="text-[11px] ml-1">
                        ({freshnessMap.summary.criticalFail} critical)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Dataset List */}
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">
                        Dataset
                      </th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">
                        Status
                      </th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">
                        Age
                      </th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">
                        Warn At
                      </th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">
                        Fail At
                      </th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">
                        Last Ingestion
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {freshnessMap.datasets.map((ds) => (
                      <tr key={ds.dataset} className="border-b border-border/50">
                        <td className="py-2 px-3 font-medium text-foreground">
                          {ds.dataset}
                          {ds.policy.critical && (
                            <span className="ml-1 text-[10px] text-red-500">(critical)</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                              ds.freshness.status === 'fresh'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : ds.freshness.status === 'warn'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}
                          >
                            {ds.freshness.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-foreground">
                          {ds.freshness.reason === 'NO_INGESTION' ? (
                            <span className="text-red-500">No ingestion</span>
                          ) : (
                            formatAge(ds.freshness.ageMinutes)
                          )}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {formatAge(ds.freshness.warnAtMinutes)}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {formatAge(ds.freshness.failAtMinutes)}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {ds.freshness.lastIngestedAt
                            ? new Date(ds.freshness.lastIngestedAt).toLocaleString()
                            : 'Never'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-[13px] text-muted-foreground">
              Unable to load freshness data
            </div>
          )}
        </div>

        {/* Active Snapshots Map */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-[15px] font-semibold text-foreground mb-4">
            Active Snapshot Map
          </h2>
          {snapshots.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">
                      Platform
                    </th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">
                      Dataset
                    </th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">
                      Snapshot ID
                    </th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((snapshot) => (
                    <tr key={snapshot.id} className="border-b border-border/50">
                      <td className="py-2 px-3 font-medium text-foreground">
                        {snapshot.platform}
                      </td>
                      <td className="py-2 px-3 text-foreground">{snapshot.dataset}</td>
                      <td className="py-2 px-3 font-mono text-[11px] text-muted-foreground">
                        {snapshot.id.substring(0, 8)}...
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">
                        {new Date(snapshot.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-[13px] text-muted-foreground">
              No active snapshots found
            </div>
          )}
        </div>

        {/* Drift Timeline */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-[15px] font-semibold text-foreground mb-4">
            Compliance Timeline
          </h2>
          {driftEvents.length > 0 ? (
            <div className="space-y-2">
              {driftEvents.map((event) => (
                <div
                  key={event.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    event.eventType === 'COMPLIANCE_PASS'
                      ? 'bg-green-50 dark:bg-green-950/20'
                      : event.eventType === 'COMPLIANCE_WARN'
                      ? 'bg-amber-50 dark:bg-amber-950/20'
                      : 'bg-red-50 dark:bg-red-950/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        event.eventType === 'COMPLIANCE_PASS'
                          ? 'bg-green-100 text-green-700'
                          : event.eventType === 'COMPLIANCE_WARN'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {event.eventType}
                    </span>
                    {event.severity && (
                      <span className="text-[11px] text-muted-foreground">
                        Severity: {event.severity}
                      </span>
                    )}
                    {event.driftCount > 0 && (
                      <span className="text-[11px] text-muted-foreground">
                        {event.driftCount} drift item(s)
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(event.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[13px] text-muted-foreground">
              No compliance events recorded
            </div>
          )}
        </div>

        {/* Recent Incidents */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-[15px] font-semibold text-foreground mb-4">
            Recent Auto-Response Incidents
          </h2>
          {incidents.length > 0 ? (
            <div className="space-y-2">
              {incidents.map((incident) => (
                <div
                  key={incident.id}
                  className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[11px] text-red-700 dark:text-red-400">
                      {incident.id}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(incident.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-[12px] text-foreground mb-1">
                    {incident.reason}
                  </div>
                  <div className="flex gap-2">
                    {incident.actionsExecuted.map(
                      (action: { action: string; success: boolean }, idx: number) => (
                        <span
                          key={idx}
                          className={`px-2 py-0.5 rounded text-[10px] ${
                            action.success
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {action.action}
                        </span>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[13px] text-muted-foreground">
              No auto-response incidents recorded
            </div>
          )}
        </div>

        {/* Read-Only Notice */}
        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-blue-600 dark:text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-[12px] text-blue-700 dark:text-blue-300">
              This dashboard is read-only. All actions require API access with appropriate
              permissions.
            </span>
          </div>
        </div>
      </div>
    </AdLabPageShell>
  );
}
