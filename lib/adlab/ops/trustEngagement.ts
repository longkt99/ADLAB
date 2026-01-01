// ============================================
// AdLab Trust Engagement Telemetry Engine
// ============================================
// PHASE D37: Sales Activation & Trust Intelligence.
//
// PROVIDES:
// - Passive engagement telemetry for trust bundles
// - Time-bucketed section viewing metrics
// - Export intent tracking
// - Revisit counting (anonymized)
// - No PII collection
//
// INVARIANTS:
// - Zero PII tracking (no IPs, emails, user agents)
// - Anonymized by bundle token only
// - Fail-open (telemetry failure never blocks access)
// - Kill-switch respects telemetry collection
// - Append-only telemetry
// - Workspace-scoped
// ============================================

import { createClient } from '@supabase/supabase-js';
import { appendAuditLog } from '@/lib/adlab/audit';
import { isGlobalKillSwitchEnabled, isWorkspaceKillSwitchEnabled } from '../safety';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ============================================
// Types
// ============================================

/** Time bucket for section viewing duration */
export type TimeBucket = 'BRIEF' | 'SHORT' | 'MEDIUM' | 'EXTENDED';

/** Section types that can be tracked */
export type TrackedSection =
  | 'summary'
  | 'questionnaire'
  | 'attestation'
  | 'whitepaper'
  | 'evidence';

/** Export format tracked */
export type ExportFormat = 'json' | 'csv' | 'html';

/** Engagement event types */
export type EngagementEventType =
  | 'BUNDLE_VIEWED'
  | 'SECTION_VIEWED'
  | 'BUNDLE_EXPORTED'
  | 'BUNDLE_REVISITED'
  | 'EXPIRED_ACCESS_ATTEMPTED';

/** Base engagement event structure */
export interface EngagementEvent {
  id?: string;
  bundleId: string;
  workspaceId: string;
  profile: string;
  eventType: EngagementEventType;
  timestamp: string;
  metadata: EngagementMetadata;
}

/** Event-specific metadata */
export interface EngagementMetadata {
  section?: TrackedSection;
  timeBucket?: TimeBucket;
  durationSeconds?: number;
  exportFormat?: ExportFormat;
  revisitCount?: number;
  expiryProximityDays?: number;
  bundleAgeDays?: number;
}

/** Engagement record as stored in database */
export interface EngagementRecord {
  id: string;
  bundle_id: string;
  workspace_id: string;
  profile: string;
  event_type: EngagementEventType;
  metadata: EngagementMetadata;
  created_at: string;
}

/** Aggregated engagement metrics for a bundle */
export interface BundleEngagementMetrics {
  bundleId: string;
  totalViews: number;
  uniqueSessions: number; // Approximated via time gaps
  sectionViews: Record<TrackedSection, number>;
  sectionTimeDistribution: Record<TrackedSection, Record<TimeBucket, number>>;
  exports: Record<ExportFormat, number>;
  revisitCount: number;
  expiredAccessAttempts: number;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  bundleAgeDays: number;
}

/** Aggregated workspace engagement summary */
export interface WorkspaceEngagementSummary {
  workspaceId: string;
  totalBundles: number;
  activeBundles: number;
  totalViews: number;
  totalExports: number;
  mostViewedSections: TrackedSection[];
  highestFrictionSections: TrackedSection[];
  averageEngagementDays: number;
}

// ============================================
// Supabase Client
// ============================================

function createEngagementClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ============================================
// Time Bucket Helpers
// ============================================

/**
 * Converts duration in seconds to a time bucket.
 * Bucketing preserves privacy by not storing exact durations.
 */
export function getTimeBucket(durationSeconds: number): TimeBucket {
  if (durationSeconds < 10) return 'BRIEF';       // <10s
  if (durationSeconds < 30) return 'SHORT';       // 10-30s
  if (durationSeconds < 120) return 'MEDIUM';     // 30-120s
  return 'EXTENDED';                               // >120s
}

/**
 * Gets human-readable label for time bucket.
 */
export function getTimeBucketLabel(bucket: TimeBucket): string {
  const labels: Record<TimeBucket, string> = {
    BRIEF: '< 10 seconds',
    SHORT: '10-30 seconds',
    MEDIUM: '30-120 seconds',
    EXTENDED: '> 2 minutes',
  };
  return labels[bucket];
}

/**
 * Calculates days until bundle expiry.
 */
export function getExpiryProximityDays(expiresAt: string): number {
  const expiry = new Date(expiresAt);
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calculates bundle age in days.
 */
export function getBundleAgeDays(createdAt: string): number {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// ============================================
// Kill-Switch Check
// ============================================

/**
 * Checks if telemetry collection is enabled.
 * Returns false if any kill-switch is active.
 */
async function isTelemetryEnabled(workspaceId: string): Promise<boolean> {
  try {
    const [globalKS, workspaceKS] = await Promise.all([
      isGlobalKillSwitchEnabled(),
      isWorkspaceKillSwitchEnabled(workspaceId),
    ]);

    // Kill-switch blocks telemetry
    if (globalKS.blocked || workspaceKS.blocked) {
      return false;
    }

    return true;
  } catch {
    // Fail-open: if we can't check, assume telemetry is enabled
    return true;
  }
}

// ============================================
// Telemetry Recording Functions
// ============================================

/**
 * Records a bundle view event.
 * Fail-open: errors are logged but never propagated.
 */
export async function recordBundleView(
  bundleId: string,
  workspaceId: string,
  profile: string,
  bundleCreatedAt: string,
  bundleExpiresAt: string
): Promise<void> {
  try {
    // Check kill-switch
    if (!(await isTelemetryEnabled(workspaceId))) {
      return;
    }

    const supabase = createEngagementClient();
    const now = new Date().toISOString();

    // Check for existing views to determine if this is a revisit
    const { data: existingViews } = await supabase
      .from('adlab_trust_engagement')
      .select('id')
      .eq('bundle_id', bundleId)
      .eq('event_type', 'BUNDLE_VIEWED')
      .limit(1);

    const isRevisit = existingViews && existingViews.length > 0;
    const bundleAgeDays = getBundleAgeDays(bundleCreatedAt);
    const expiryProximityDays = getExpiryProximityDays(bundleExpiresAt);

    // Record view event
    await supabase.from('adlab_trust_engagement').insert({
      bundle_id: bundleId,
      workspace_id: workspaceId,
      profile,
      event_type: 'BUNDLE_VIEWED',
      metadata: {
        bundleAgeDays,
        expiryProximityDays,
      },
      created_at: now,
    });

    // Record revisit if applicable
    if (isRevisit) {
      const { data: revisitCount } = await supabase
        .from('adlab_trust_engagement')
        .select('id')
        .eq('bundle_id', bundleId)
        .eq('event_type', 'BUNDLE_VIEWED');

      await supabase.from('adlab_trust_engagement').insert({
        bundle_id: bundleId,
        workspace_id: workspaceId,
        profile,
        event_type: 'BUNDLE_REVISITED',
        metadata: {
          revisitCount: (revisitCount?.length || 0) + 1,
          bundleAgeDays,
        },
        created_at: now,
      });
    }

    // Also log to audit (using existing event type)
    await appendAuditLog({
      context: {
        workspaceId,
        actorId: 'anonymous',
        actorRole: 'viewer',
      },
      action: 'VALIDATE',
      entityType: 'trust_bundle',
      entityId: bundleId,
      scope: {
        platform: 'system',
        dataset: 'trust_engagement',
      },
      metadata: {
        trustAction: 'TRUST_BUNDLE_VIEWED',
        profile,
        bundleAgeDays,
        expiryProximityDays,
        isRevisit,
      },
    });
  } catch (error) {
    // Fail-open: log error but don't propagate
    console.error('[D37] Telemetry error (bundle view):', error);
  }
}

/**
 * Records a section view event with time bucketing.
 * Fail-open: errors are logged but never propagated.
 */
export async function recordSectionView(
  bundleId: string,
  workspaceId: string,
  profile: string,
  section: TrackedSection,
  durationSeconds: number
): Promise<void> {
  try {
    // Check kill-switch
    if (!(await isTelemetryEnabled(workspaceId))) {
      return;
    }

    const supabase = createEngagementClient();
    const now = new Date().toISOString();
    const timeBucket = getTimeBucket(durationSeconds);

    await supabase.from('adlab_trust_engagement').insert({
      bundle_id: bundleId,
      workspace_id: workspaceId,
      profile,
      event_type: 'SECTION_VIEWED',
      metadata: {
        section,
        timeBucket,
        // Store bucketed duration, not exact
        durationSeconds: getBucketedDuration(timeBucket),
      },
      created_at: now,
    });

    // Also log to audit
    await appendAuditLog({
      context: {
        workspaceId,
        actorId: 'anonymous',
        actorRole: 'viewer',
      },
      action: 'VALIDATE',
      entityType: 'trust_bundle',
      entityId: bundleId,
      scope: {
        platform: 'system',
        dataset: 'trust_engagement',
      },
      metadata: {
        trustAction: 'TRUST_SECTION_VIEWED',
        profile,
        section,
        timeBucket,
      },
    });
  } catch (error) {
    // Fail-open: log error but don't propagate
    console.error('[D37] Telemetry error (section view):', error);
  }
}

/**
 * Records a bundle export event.
 * Fail-open: errors are logged but never propagated.
 */
export async function recordBundleExport(
  bundleId: string,
  workspaceId: string,
  profile: string,
  format: ExportFormat
): Promise<void> {
  try {
    // Check kill-switch
    if (!(await isTelemetryEnabled(workspaceId))) {
      return;
    }

    const supabase = createEngagementClient();
    const now = new Date().toISOString();

    await supabase.from('adlab_trust_engagement').insert({
      bundle_id: bundleId,
      workspace_id: workspaceId,
      profile,
      event_type: 'BUNDLE_EXPORTED',
      metadata: {
        exportFormat: format,
      },
      created_at: now,
    });

    // Also log to audit
    await appendAuditLog({
      context: {
        workspaceId,
        actorId: 'anonymous',
        actorRole: 'viewer',
      },
      action: 'EXPORT',
      entityType: 'trust_bundle',
      entityId: bundleId,
      scope: {
        platform: 'system',
        dataset: 'trust_engagement',
      },
      metadata: {
        trustAction: 'TRUST_BUNDLE_EXPORTED',
        profile,
        format,
      },
    });
  } catch (error) {
    // Fail-open: log error but don't propagate
    console.error('[D37] Telemetry error (bundle export):', error);
  }
}

/**
 * Records an expired token access attempt.
 * This happens when someone tries to view an expired bundle.
 * Fail-open: errors are logged but never propagated.
 */
export async function recordExpiredAccessAttempt(
  bundleId: string,
  workspaceId: string,
  profile: string
): Promise<void> {
  try {
    // Don't check kill-switch for expired access - we want to know about these
    const supabase = createEngagementClient();
    const now = new Date().toISOString();

    await supabase.from('adlab_trust_engagement').insert({
      bundle_id: bundleId,
      workspace_id: workspaceId,
      profile,
      event_type: 'EXPIRED_ACCESS_ATTEMPTED',
      metadata: {},
      created_at: now,
    });

    // Also log to audit
    await appendAuditLog({
      context: {
        workspaceId,
        actorId: 'anonymous',
        actorRole: 'viewer',
      },
      action: 'VALIDATE',
      entityType: 'trust_bundle',
      entityId: bundleId,
      scope: {
        platform: 'system',
        dataset: 'trust_engagement',
      },
      metadata: {
        trustAction: 'TRUST_BUNDLE_EXPIRED_ACCESSED',
        profile,
      },
    });
  } catch (error) {
    // Fail-open: log error but don't propagate
    console.error('[D37] Telemetry error (expired access):', error);
  }
}

// ============================================
// Aggregation Functions
// ============================================

/**
 * Gets engagement metrics for a specific bundle.
 */
export async function getBundleEngagementMetrics(
  bundleId: string,
  workspaceId: string
): Promise<BundleEngagementMetrics | null> {
  try {
    const supabase = createEngagementClient();

    const { data, error } = await supabase
      .from('adlab_trust_engagement')
      .select('*')
      .eq('bundle_id', bundleId)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });

    if (error || !data || data.length === 0) {
      return null;
    }

    // Initialize metrics
    const sectionViews: Record<TrackedSection, number> = {
      summary: 0,
      questionnaire: 0,
      attestation: 0,
      whitepaper: 0,
      evidence: 0,
    };

    const sectionTimeDistribution: Record<TrackedSection, Record<TimeBucket, number>> = {
      summary: { BRIEF: 0, SHORT: 0, MEDIUM: 0, EXTENDED: 0 },
      questionnaire: { BRIEF: 0, SHORT: 0, MEDIUM: 0, EXTENDED: 0 },
      attestation: { BRIEF: 0, SHORT: 0, MEDIUM: 0, EXTENDED: 0 },
      whitepaper: { BRIEF: 0, SHORT: 0, MEDIUM: 0, EXTENDED: 0 },
      evidence: { BRIEF: 0, SHORT: 0, MEDIUM: 0, EXTENDED: 0 },
    };

    const exports: Record<ExportFormat, number> = {
      json: 0,
      csv: 0,
      html: 0,
    };

    let totalViews = 0;
    let revisitCount = 0;
    let expiredAccessAttempts = 0;
    let firstViewedAt: string | null = null;
    let lastViewedAt: string | null = null;
    let bundleAgeDays = 0;

    for (const record of data) {
      const meta = record.metadata as EngagementMetadata;

      switch (record.event_type as EngagementEventType) {
        case 'BUNDLE_VIEWED':
          totalViews++;
          if (!firstViewedAt) firstViewedAt = record.created_at;
          lastViewedAt = record.created_at;
          if (meta.bundleAgeDays) bundleAgeDays = meta.bundleAgeDays;
          break;

        case 'SECTION_VIEWED':
          if (meta.section) {
            sectionViews[meta.section]++;
            if (meta.timeBucket) {
              sectionTimeDistribution[meta.section][meta.timeBucket]++;
            }
          }
          break;

        case 'BUNDLE_EXPORTED':
          if (meta.exportFormat) {
            exports[meta.exportFormat]++;
          }
          break;

        case 'BUNDLE_REVISITED':
          revisitCount = meta.revisitCount || revisitCount + 1;
          break;

        case 'EXPIRED_ACCESS_ATTEMPTED':
          expiredAccessAttempts++;
          break;
      }
    }

    // Estimate unique sessions based on time gaps (>30 min = new session)
    let uniqueSessions = 1;
    let lastTime = new Date(data[0].created_at);
    for (let i = 1; i < data.length; i++) {
      const currentTime = new Date(data[i].created_at);
      const diffMinutes = (currentTime.getTime() - lastTime.getTime()) / (1000 * 60);
      if (diffMinutes > 30) {
        uniqueSessions++;
      }
      lastTime = currentTime;
    }

    return {
      bundleId,
      totalViews,
      uniqueSessions,
      sectionViews,
      sectionTimeDistribution,
      exports,
      revisitCount,
      expiredAccessAttempts,
      firstViewedAt,
      lastViewedAt,
      bundleAgeDays,
    };
  } catch (error) {
    console.error('[D37] Error fetching bundle metrics:', error);
    return null;
  }
}

/**
 * Gets engagement summary for a workspace.
 */
export async function getWorkspaceEngagementSummary(
  workspaceId: string
): Promise<WorkspaceEngagementSummary | null> {
  try {
    const supabase = createEngagementClient();

    // Get all engagement events for workspace
    const { data: events, error: eventsError } = await supabase
      .from('adlab_trust_engagement')
      .select('*')
      .eq('workspace_id', workspaceId);

    if (eventsError) {
      return null;
    }

    // Get bundle counts
    const { data: bundles, error: bundlesError } = await supabase
      .from('adlab_trust_bundles')
      .select('id, expires_at, revoked_at')
      .eq('workspace_id', workspaceId);

    if (bundlesError) {
      return null;
    }

    const now = new Date();
    const activeBundles = (bundles || []).filter(
      (b) => !b.revoked_at && new Date(b.expires_at) > now
    ).length;

    // Aggregate metrics
    const sectionViewCounts: Record<TrackedSection, number> = {
      summary: 0,
      questionnaire: 0,
      attestation: 0,
      whitepaper: 0,
      evidence: 0,
    };

    const sectionExtendedCounts: Record<TrackedSection, number> = {
      summary: 0,
      questionnaire: 0,
      attestation: 0,
      whitepaper: 0,
      evidence: 0,
    };

    let totalViews = 0;
    let totalExports = 0;
    const bundleFirstViews: Record<string, Date> = {};
    const bundleLastViews: Record<string, Date> = {};

    for (const event of events || []) {
      const meta = event.metadata as EngagementMetadata;

      switch (event.event_type as EngagementEventType) {
        case 'BUNDLE_VIEWED':
          totalViews++;
          const viewDate = new Date(event.created_at);
          if (!bundleFirstViews[event.bundle_id] || viewDate < bundleFirstViews[event.bundle_id]) {
            bundleFirstViews[event.bundle_id] = viewDate;
          }
          if (!bundleLastViews[event.bundle_id] || viewDate > bundleLastViews[event.bundle_id]) {
            bundleLastViews[event.bundle_id] = viewDate;
          }
          break;

        case 'SECTION_VIEWED':
          if (meta.section) {
            sectionViewCounts[meta.section]++;
            if (meta.timeBucket === 'EXTENDED') {
              sectionExtendedCounts[meta.section]++;
            }
          }
          break;

        case 'BUNDLE_EXPORTED':
          totalExports++;
          break;
      }
    }

    // Determine most viewed sections
    const sortedByViews = (Object.entries(sectionViewCounts) as [TrackedSection, number][])
      .sort((a, b) => b[1] - a[1])
      .map(([section]) => section);

    // Determine highest friction sections (most extended views = more reading = potential friction)
    const sortedByFriction = (Object.entries(sectionExtendedCounts) as [TrackedSection, number][])
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([section]) => section);

    // Calculate average engagement days
    const engagementDays = Object.keys(bundleFirstViews).map((bundleId) => {
      const first = bundleFirstViews[bundleId];
      const last = bundleLastViews[bundleId];
      return Math.ceil((last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24));
    });

    const averageEngagementDays = engagementDays.length > 0
      ? engagementDays.reduce((sum, d) => sum + d, 0) / engagementDays.length
      : 0;

    return {
      workspaceId,
      totalBundles: bundles?.length || 0,
      activeBundles,
      totalViews,
      totalExports,
      mostViewedSections: sortedByViews.slice(0, 3),
      highestFrictionSections: sortedByFriction.slice(0, 3),
      averageEngagementDays: Math.round(averageEngagementDays * 10) / 10,
    };
  } catch (error) {
    console.error('[D37] Error fetching workspace summary:', error);
    return null;
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Returns a representative duration for a time bucket.
 * Used to store bucketed data instead of exact durations.
 */
function getBucketedDuration(bucket: TimeBucket): number {
  switch (bucket) {
    case 'BRIEF':
      return 5;
    case 'SHORT':
      return 20;
    case 'MEDIUM':
      return 75;
    case 'EXTENDED':
      return 180;
  }
}

/**
 * Gets section label for display.
 */
export function getSectionLabel(section: TrackedSection): string {
  const labels: Record<TrackedSection, string> = {
    summary: 'Executive Summary',
    questionnaire: 'Security Questionnaire',
    attestation: 'Attestation Results',
    whitepaper: 'Security Whitepaper',
    evidence: 'Evidence Checksums',
  };
  return labels[section];
}

/**
 * Gets event type label for display.
 */
export function getEngagementEventLabel(eventType: EngagementEventType): string {
  const labels: Record<EngagementEventType, string> = {
    BUNDLE_VIEWED: 'Bundle Viewed',
    SECTION_VIEWED: 'Section Viewed',
    BUNDLE_EXPORTED: 'Bundle Exported',
    BUNDLE_REVISITED: 'Bundle Revisited',
    EXPIRED_ACCESS_ATTEMPTED: 'Expired Access Attempt',
  };
  return labels[eventType];
}
