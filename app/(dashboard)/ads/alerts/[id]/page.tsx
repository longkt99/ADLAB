// ============================================
// AdLab Alert Detail Page
// ============================================
// Shows full alert details with traceability and actions.
// PHASE D1: Alert Actions Layer

import Link from 'next/link';
import { AdLabPageShell, AdLabEmptyState, AdLabErrorBox } from '@/components/adlab';
import { getAlertTrace, type AlertTrace } from '@/lib/adlab/queries';
import { ReadToggle, ResolveToggle, InternalNoteEditor } from './AlertActions';

export const dynamic = 'force-dynamic';

// Format date for display
function formatDateTime(dateString: string | null): string {
  if (!dateString) return '—';
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

// Format date only (no time)
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

// Format number
function formatNumber(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

// Shorten UUID for display (e.g., "88888888-....-8803" => "88888888…8803")
function shortenId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

// Severity badge
function SeverityBadge({ severity }: { severity: string }) {
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

// Status indicator
function StatusIndicator({ isRead }: { isRead: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${!isRead ? 'bg-blue-500' : 'bg-secondary'}`} />
      <span className={`text-[11px] ${!isRead ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
        {isRead ? 'Read' : 'Unread'}
      </span>
    </div>
  );
}

// Enabled badge for rules
function EnabledBadge({ isEnabled }: { isEnabled: boolean | null }) {
  const enabled = isEnabled ?? true;
  return (
    <span className={`px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded ${
      enabled
        ? 'bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400'
        : 'bg-secondary text-muted-foreground'
    }`}>
      {enabled ? 'Enabled' : 'Disabled'}
    </span>
  );
}

// Detail row component
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="text-[11px] text-muted-foreground uppercase tracking-wide min-w-[100px] pt-0.5">{label}</span>
      <div className="text-sm text-foreground flex-1">{children}</div>
    </div>
  );
}

// Section card component
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{title}</h3>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AlertDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { data: trace, error } = await getAlertTrace(id);

  // Build subtitle from alert info
  const subtitle = trace
    ? `${trace.alert.severity} • ${trace.alert.platform || 'All platforms'} • ${formatDateTime(trace.alert.created_at)}`
    : '';

  return (
    <AdLabPageShell
      title="Alert"
      description={subtitle}
      badge={trace?.alert.resolved_at ? { label: 'Resolved', variant: 'success' } : undefined}
      actions={
        <Link
          href="/ads/alerts"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Alerts
        </Link>
      }
    >
      {error && (
        <AdLabErrorBox
          message={error}
          hint="This may be due to RLS policies or the alert not existing."
        />
      )}

      {!trace && !error ? (
        <AdLabEmptyState
          title="Alert not found"
          description="The alert you're looking for doesn't exist or has been deleted."
          icon={
            <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />
      ) : trace ? (
        <div className="space-y-4">
          {/* Actions Section */}
          <div className="bg-card rounded-lg border border-border p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Actions</h3>
            <div className="flex flex-wrap gap-3">
              <ReadToggle alertId={trace.alert.id} isRead={trace.alert.is_read} />
              <ResolveToggle alertId={trace.alert.id} resolvedAt={trace.alert.resolved_at} />
            </div>
          </div>

          {/* Summary Section */}
          <SectionCard title="Summary">
            <DetailRow label="Message">
              <p className="text-foreground">{trace.alert.message}</p>
            </DetailRow>
            <DetailRow label="Severity">
              <SeverityBadge severity={trace.alert.severity} />
            </DetailRow>
            <DetailRow label="Platform">
              <PlatformBadge platform={trace.alert.platform} />
            </DetailRow>
            <DetailRow label="Read Status">
              <StatusIndicator isRead={trace.alert.is_read} />
            </DetailRow>
            <DetailRow label="Resolved">
              {trace.alert.resolved_at ? (
                <div className="flex items-center gap-2">
                  <span className="text-green-600 dark:text-green-400 font-medium">Yes</span>
                  <span className="text-muted-foreground text-[11px]">
                    at {formatDateTime(trace.alert.resolved_at)}
                  </span>
                </div>
              ) : (
                <span className="text-muted-foreground">No</span>
              )}
            </DetailRow>
            <DetailRow label="Triggered">
              {formatDateTime(trace.alert.created_at)}
            </DetailRow>
          </SectionCard>

          {/* Metric Snapshot Section */}
          <SectionCard title="Metric Snapshot">
            <DetailRow label="Metric">
              <span className="capitalize">{trace.alert.metric_key || '—'}</span>
            </DetailRow>
            <DetailRow label="Value">
              {formatNumber(trace.alert.metric_value)}
            </DetailRow>
            <DetailRow label="Operator">
              <span className="font-mono text-[12px] bg-secondary px-1.5 py-0.5 rounded">
                {trace.alert.operator || '—'}
              </span>
            </DetailRow>
            <DetailRow label="Threshold">
              {formatNumber(trace.alert.threshold)}
            </DetailRow>
            <DetailRow label="Metric Date">
              {formatDate(trace.alert.metric_date)}
            </DetailRow>
          </SectionCard>

          {/* Traceability Section */}
          <SectionCard title="Traceability">
            {trace.rule ? (
              <>
                <DetailRow label="Rule Name">
                  <Link
                    href="/ads/alert-rules"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {trace.rule.name || 'Unnamed Rule'}
                  </Link>
                </DetailRow>
                <DetailRow label="Rule Metric">
                  <span className="capitalize">{trace.rule.metric_key || '—'}</span>
                </DetailRow>
                <DetailRow label="Rule Operator">
                  <span className="font-mono text-[12px] bg-secondary px-1.5 py-0.5 rounded">
                    {trace.rule.operator || '—'}
                  </span>
                </DetailRow>
                <DetailRow label="Rule Threshold">
                  {formatNumber(trace.rule.threshold)}
                </DetailRow>
                <DetailRow label="Rule Severity">
                  {trace.rule.severity ? <SeverityBadge severity={trace.rule.severity} /> : '—'}
                </DetailRow>
                <DetailRow label="Rule Status">
                  <EnabledBadge isEnabled={trace.rule.is_enabled} />
                </DetailRow>
                <DetailRow label="Rule Scope">
                  <span className="capitalize">{trace.rule.scope || '—'}</span>
                </DetailRow>
              </>
            ) : (
              <DetailRow label="Rule">
                <span className="text-muted-foreground italic">No rule linked (may have been deleted)</span>
              </DetailRow>
            )}
          </SectionCard>

          {/* Context Section */}
          <SectionCard title="Context">
            <DetailRow label="Workspace">
              {trace.workspace?.name || <span className="text-muted-foreground font-mono text-[11px]">{trace.alert.workspace_id}</span>}
            </DetailRow>
            <DetailRow label="Client">
              {trace.alert.client_id ? (
                <Link
                  href={`/ads/clients/${trace.alert.client_id}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {trace.client?.name || shortenId(trace.alert.client_id)}
                </Link>
              ) : '—'}
            </DetailRow>
            <DetailRow label="Campaign">
              {trace.alert.campaign_id ? (
                <Link
                  href={`/ads/campaigns/${trace.alert.campaign_id}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {trace.campaign?.name || shortenId(trace.alert.campaign_id)}
                </Link>
              ) : '—'}
            </DetailRow>
            <DetailRow label="Ad Set">
              {trace.alert.ad_set_id ? (
                <Link
                  href={`/ads/ad-sets/${trace.alert.ad_set_id}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {trace.adSet?.name || shortenId(trace.alert.ad_set_id)}
                </Link>
              ) : '—'}
            </DetailRow>
            <DetailRow label="Ad">
              {trace.alert.ad_id ? (
                <Link
                  href={`/ads/ads/${trace.alert.ad_id}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {trace.ad?.name || shortenId(trace.alert.ad_id)}
                </Link>
              ) : '—'}
            </DetailRow>
            {/* Context explanation */}
            <div className="pt-3 mt-2 border-t border-border/50">
              <p className="text-[10px] text-muted-foreground/60">
                These are the entities involved when this alert condition was triggered.
              </p>
            </div>
          </SectionCard>

          {/* Internal Note Section */}
          <div className="bg-card rounded-lg border border-border p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Internal Note</h3>
            <InternalNoteEditor
              alertId={trace.alert.id}
              initialNote={trace.alert.note}
              updatedAt={trace.alert.updated_at}
            />
          </div>
        </div>
      ) : null}
    </AdLabPageShell>
  );
}
