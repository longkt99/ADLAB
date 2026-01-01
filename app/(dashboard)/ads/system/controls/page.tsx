// ============================================
// AdLab Controls Page
// ============================================
// PHASE D29: Compliance Control Panel (Owner-only) + Safe Overrides.
//
// OWNER-ONLY controls for:
// - Kill-switch toggle
// - Failure injection configuration
// - Freshness threshold overrides
// - Manual compliance check trigger
//
// RULES:
// - Owner role required for all mutations
// - All changes require human reason
// - All changes logged to audit trail
// ============================================

import { AdLabPageShell } from '@/components/adlab/AdLabPageShell';
import { resolveActorWithDevFallback } from '@/lib/adlab/auth/resolveActor';
import { hasAtLeastRole } from '@/lib/adlab/auth/roles';
import { getKillSwitchStatus, type KillSwitchStatus } from '@/lib/adlab/safety/killSwitch';
import { listInjectionConfigs } from '@/lib/adlab/safety/failureInjection';
import { listOverrides, DEFAULT_FRESHNESS_POLICIES, ALL_DATASET_KEYS } from '@/lib/adlab/ops';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getControlsData() {
  try {
    const actor = await resolveActorWithDevFallback();

    // Check if owner
    const isOwner = hasAtLeastRole(actor.role, 'owner');

    // Get current states
    const [killSwitchStatus, injectionResult, overridesResult] = await Promise.all([
      getKillSwitchStatus(actor.workspaceId),
      listInjectionConfigs(actor.workspaceId),
      listOverrides(actor.workspaceId),
    ]);

    // Filter freshness overrides
    const freshnessOverrides = (overridesResult.data || []).filter((o) =>
      o.key.startsWith('freshness.')
    );

    return {
      actor,
      isOwner,
      killSwitch: killSwitchStatus,
      injectionConfigs: injectionResult.configs || [],
      freshnessOverrides,
    };
  } catch (error) {
    const fallbackKillSwitch: KillSwitchStatus = { blocked: false };
    return {
      actor: null,
      isOwner: false,
      killSwitch: fallbackKillSwitch,
      injectionConfigs: [],
      freshnessOverrides: [],
      error: String(error),
    };
  }
}

export default async function ControlsPage() {
  const data = await getControlsData();

  // If not owner, show access denied
  if (!data.isOwner) {
    return (
      <AdLabPageShell
        title="System Controls"
        description="Owner-only system controls"
        badge={{ label: 'Owner Only', variant: 'warning' }}
      >
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-8 text-center">
          <svg
            className="w-12 h-12 mx-auto text-red-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <h2 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-2">
            Access Denied
          </h2>
          <p className="text-[13px] text-red-600 dark:text-red-400">
            This page is restricted to workspace owners only.
          </p>
          <Link
            href="/ads/system/compliance"
            className="inline-block mt-4 text-[12px] text-blue-600 hover:underline"
          >
            View read-only compliance dashboard instead
          </Link>
        </div>
      </AdLabPageShell>
    );
  }

  return (
    <AdLabPageShell
      title="System Controls"
      description="Owner-only system controls for kill-switch, failure injection, and overrides"
      badge={{ label: 'Owner Only', variant: 'warning' }}
    >
      <div className="space-y-6">
        {/* Warning Banner */}
        <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 p-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <h3 className="text-[13px] font-semibold text-amber-800 dark:text-amber-200">
                Caution: Production Controls
              </h3>
              <p className="text-[12px] text-amber-700 dark:text-amber-300 mt-1">
                Changes on this page affect production behavior. All actions require a reason
                and are logged to the audit trail.
              </p>
            </div>
          </div>
        </div>

        {/* Kill-Switch Section */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">Kill-Switch</h2>
              <p className="text-[12px] text-muted-foreground mt-1">
                Emergency stop for all dangerous operations
              </p>
            </div>
            <div
              className={`px-3 py-1 rounded-full text-[12px] font-medium ${
                data.killSwitch.blocked
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              }`}
            >
              {data.killSwitch.blocked ? 'ACTIVE' : 'INACTIVE'}
            </div>
          </div>

          {data.killSwitch.blocked && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 mb-4">
              <div className="text-[12px] text-red-700 dark:text-red-300">
                <strong>Reason:</strong> {data.killSwitch.reason}
              </div>
              <div className="text-[11px] text-red-600 dark:text-red-400 mt-1">
                Activated: {data.killSwitch.activatedAt ? new Date(data.killSwitch.activatedAt).toLocaleString() : 'Unknown'}
                {data.killSwitch.activatedBy && ` by ${data.killSwitch.activatedBy}`}
              </div>
            </div>
          )}

          <div className="text-[12px] text-muted-foreground">
            <strong>API Endpoint:</strong>{' '}
            <code className="px-1.5 py-0.5 rounded bg-secondary text-[11px]">
              POST /api/adlab/system/controls/kill-switch
            </code>
            <div className="mt-2 p-3 rounded bg-secondary text-[11px] font-mono">
              {'{'} &quot;enabled&quot;: true, &quot;reason&quot;: &quot;Emergency stop for data investigation&quot; {'}'}
            </div>
          </div>
        </div>

        {/* Failure Injection Section */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">Failure Injection</h2>
              <p className="text-[12px] text-muted-foreground mt-1">
                Controlled chaos testing for production resilience
              </p>
            </div>
            <div
              className={`px-3 py-1 rounded-full text-[12px] font-medium ${
                data.injectionConfigs.some((c) => c.enabled)
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  : 'bg-secondary text-muted-foreground'
              }`}
            >
              {data.injectionConfigs.filter((c) => c.enabled).length} ACTIVE
            </div>
          </div>

          {data.injectionConfigs.length > 0 ? (
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Action</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Type</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Probability</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Status</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {data.injectionConfigs.map((config) => (
                    <tr key={config.id} className="border-b border-border/50">
                      <td className="py-2 px-3 font-medium text-foreground">{config.action}</td>
                      <td className="py-2 px-3 text-foreground">{config.failure_type}</td>
                      <td className="py-2 px-3 text-foreground">{config.probability}%</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                            config.enabled
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                              : 'bg-secondary text-muted-foreground'
                          }`}
                        >
                          {config.enabled ? 'ENABLED' : 'DISABLED'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground truncate max-w-[200px]">
                        {config.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-secondary text-center text-[12px] text-muted-foreground mb-4">
              No failure injection configs defined
            </div>
          )}

          <div className="text-[12px] text-muted-foreground">
            <strong>API Endpoint:</strong>{' '}
            <code className="px-1.5 py-0.5 rounded bg-secondary text-[11px]">
              POST /api/adlab/system/controls/failure-injection
            </code>
            <div className="mt-2 p-3 rounded bg-secondary text-[11px] font-mono">
              {'{'} &quot;action&quot;: &quot;PROMOTE&quot;, &quot;failureType&quot;: &quot;THROW&quot;, &quot;probability&quot;: 50, &quot;reason&quot;: &quot;Chaos test&quot;, &quot;enabled&quot;: true {'}'}
            </div>
          </div>
        </div>

        {/* Freshness Overrides Section */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">Freshness Overrides</h2>
              <p className="text-[12px] text-muted-foreground mt-1">
                Custom freshness thresholds for this workspace
              </p>
            </div>
            <div className="px-3 py-1 rounded-full text-[12px] font-medium bg-secondary text-muted-foreground">
              {data.freshnessOverrides.length} OVERRIDES
            </div>
          </div>

          {/* Default Thresholds */}
          <div className="mb-4">
            <h3 className="text-[12px] font-medium text-muted-foreground mb-2">
              Default Thresholds
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Dataset</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Warn After</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Fail After</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Critical</th>
                  </tr>
                </thead>
                <tbody>
                  {ALL_DATASET_KEYS.map((key) => {
                    const policy = DEFAULT_FRESHNESS_POLICIES[key];
                    const warnOverride = data.freshnessOverrides.find(
                      (o) => o.key === `freshness.${key}.warn_minutes`
                    );
                    const failOverride = data.freshnessOverrides.find(
                      (o) => o.key === `freshness.${key}.fail_minutes`
                    );
                    return (
                      <tr key={key} className="border-b border-border/50">
                        <td className="py-2 px-3 font-medium text-foreground">{key}</td>
                        <td className="py-2 px-3">
                          <span className={warnOverride ? 'text-amber-600' : 'text-foreground'}>
                            {warnOverride
                              ? `${warnOverride.valueJson}m`
                              : `${policy.warnAfterMinutes}m`}
                          </span>
                          {warnOverride && (
                            <span className="text-[10px] text-muted-foreground ml-1">
                              (override)
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <span className={failOverride ? 'text-amber-600' : 'text-foreground'}>
                            {failOverride
                              ? `${failOverride.valueJson}m`
                              : `${policy.failAfterMinutes}m`}
                          </span>
                          {failOverride && (
                            <span className="text-[10px] text-muted-foreground ml-1">
                              (override)
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {policy.critical ? (
                            <span className="text-red-500 text-[10px] font-medium">Yes</span>
                          ) : (
                            <span className="text-muted-foreground text-[10px]">No</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-[12px] text-muted-foreground">
            <strong>API Endpoint:</strong>{' '}
            <code className="px-1.5 py-0.5 rounded bg-secondary text-[11px]">
              POST /api/adlab/system/controls/freshness-override
            </code>
            <div className="mt-2 p-3 rounded bg-secondary text-[11px] font-mono">
              {'{'} &quot;dataset&quot;: &quot;daily_metrics&quot;, &quot;warnMinutes&quot;: 2880, &quot;failMinutes&quot;: 5760, &quot;reason&quot;: &quot;Extended threshold for holiday&quot; {'}'}
            </div>
          </div>
        </div>

        {/* Manual Compliance Check */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">Manual Compliance Check</h2>
              <p className="text-[12px] text-muted-foreground mt-1">
                Trigger a compliance check on demand
              </p>
            </div>
          </div>

          <div className="text-[12px] text-muted-foreground">
            <strong>API Endpoint:</strong>{' '}
            <code className="px-1.5 py-0.5 rounded bg-secondary text-[11px]">
              POST /api/adlab/system/controls/compliance
            </code>
            <div className="mt-2 p-3 rounded bg-secondary text-[11px] font-mono">
              {'{'} &quot;scope&quot;: &quot;workspace&quot;, &quot;reason&quot;: &quot;Pre-deployment verification&quot; {'}'}
            </div>
          </div>

          <div className="mt-4">
            <Link
              href="/ads/system/compliance"
              className="inline-flex items-center gap-2 text-[12px] text-blue-600 hover:underline"
            >
              View Compliance Dashboard
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Audit Trail Notice */}
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span className="text-[12px] text-blue-700 dark:text-blue-300">
              All control changes are logged to the immutable audit trail with actor ID, timestamp,
              and reason.
            </span>
          </div>
        </div>
      </div>
    </AdLabPageShell>
  );
}
