// ============================================
// AdLab Trust Timeline Generator
// ============================================
// PHASE D38: Revenue Enablement & Sales Activation.
//
// PROVIDES:
// - Human-readable trust engagement timeline
// - Day-bucketed activity summaries
// - Risk indicators for sales visibility
//
// INVARIANTS:
// - READ-ONLY: No mutations
// - NO PII: Zero identity data
// - NO RAW LOGS: Aggregated summaries only
// - Deterministic ordering
// - Time-bucketed (day-level)
// ============================================

import {
  type EngagementEventType,
  type TrackedSection,
  type ExportFormat,
  type EngagementMetadata,
} from './trustEngagement';
import { type DealStageIndicator } from './salesSignals';

// ============================================
// Types
// ============================================

/** Timeline event type (aggregated) */
export type TimelineEventType =
  | 'FIRST_VIEW'
  | 'SECTION_DEEP_DIVE'
  | 'MULTIPLE_SECTIONS'
  | 'EXPORT_INTENT'
  | 'REVISIT'
  | 'EXTENDED_READING'
  | 'EXPIRED_ACCESS'
  | 'INACTIVITY_GAP'
  | 'BUNDLE_CREATED';

/** Risk indicator for timeline events */
export type TimelineRisk = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

/** A single timeline entry */
export interface TimelineEntry {
  day: number; // Days since bundle creation (0 = creation day)
  date: string; // ISO date string (date only, no time)
  eventType: TimelineEventType;
  description: string;
  details: string[];
  risk: TimelineRisk;
}

/** Full trust timeline for a bundle */
export interface TrustTimeline {
  bundleId: string;
  createdAt: string;
  totalDays: number;
  entries: TimelineEntry[];
  currentRisk: TimelineRisk;
  riskSummary: string;
  lastActivityDay: number;
  generatedAt: string;
}

/** Raw engagement event for timeline processing */
export interface RawTimelineEvent {
  eventType: EngagementEventType;
  createdAt: string;
  metadata: EngagementMetadata;
}

// ============================================
// Timeline Generation
// ============================================

/**
 * Generates a trust timeline from engagement events.
 * Events are bucketed by day and summarized for sales readability.
 */
export function generateTrustTimeline(
  bundleId: string,
  bundleCreatedAt: string,
  events: RawTimelineEvent[]
): TrustTimeline {
  const createdDate = new Date(bundleCreatedAt);
  createdDate.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const totalDays = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
  const entries: TimelineEntry[] = [];

  // Add bundle creation entry
  entries.push({
    day: 0,
    date: createdDate.toISOString().split('T')[0],
    eventType: 'BUNDLE_CREATED',
    description: 'Trust bundle created and shared',
    details: [],
    risk: 'NONE',
  });

  // Group events by day
  const eventsByDay = new Map<number, RawTimelineEvent[]>();

  for (const event of events) {
    const eventDate = new Date(event.createdAt);
    eventDate.setHours(0, 0, 0, 0);
    const day = Math.floor((eventDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

    if (!eventsByDay.has(day)) {
      eventsByDay.set(day, []);
    }
    eventsByDay.get(day)!.push(event);
  }

  // Process each day's events
  const sortedDays = Array.from(eventsByDay.keys()).sort((a, b) => a - b);
  let lastActivityDay = 0;
  let hasExport = false;

  for (const day of sortedDays) {
    const dayEvents = eventsByDay.get(day)!;
    const dateStr = new Date(createdDate.getTime() + day * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    // Analyze day's activity
    const dayEntries = analyzeDayActivity(day, dateStr, dayEvents);
    entries.push(...dayEntries);

    lastActivityDay = day;
    if (dayEvents.some((e) => e.eventType === 'BUNDLE_EXPORTED')) {
      hasExport = true;
    }
  }

  // Check for inactivity gaps
  if (sortedDays.length > 0) {
    let prevDay = 0;
    for (const day of sortedDays) {
      const gap = day - prevDay;
      if (gap >= 7 && prevDay > 0) {
        const gapStartDate = new Date(createdDate.getTime() + (prevDay + 1) * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];
        entries.push({
          day: prevDay + 1,
          date: gapStartDate,
          eventType: 'INACTIVITY_GAP',
          description: `${gap} days of no activity`,
          details: [`Gap from day ${prevDay + 1} to day ${day}`],
          risk: gap >= 14 ? 'HIGH' : 'MEDIUM',
        });
      }
      prevDay = day;
    }

    // Check for trailing inactivity
    const daysSinceLastActivity = totalDays - lastActivityDay;
    if (daysSinceLastActivity >= 7) {
      entries.push({
        day: lastActivityDay + 1,
        date: new Date(createdDate.getTime() + (lastActivityDay + 1) * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        eventType: 'INACTIVITY_GAP',
        description: `${daysSinceLastActivity} days since last activity`,
        details: ['No engagement recorded'],
        risk: daysSinceLastActivity >= 14 ? 'HIGH' : 'MEDIUM',
      });
    }
  }

  // Sort entries by day
  entries.sort((a, b) => a.day - b.day);

  // Calculate current risk
  const currentRisk = calculateCurrentRisk(totalDays, lastActivityDay, hasExport, events.length);
  const riskSummary = generateRiskSummary(currentRisk, totalDays, lastActivityDay, hasExport);

  return {
    bundleId,
    createdAt: bundleCreatedAt,
    totalDays,
    entries,
    currentRisk,
    riskSummary,
    lastActivityDay,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Analyzes a single day's activity and generates timeline entries.
 */
function analyzeDayActivity(
  day: number,
  dateStr: string,
  events: RawTimelineEvent[]
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  // Count event types
  const viewCount = events.filter((e) => e.eventType === 'BUNDLE_VIEWED').length;
  const sectionEvents = events.filter((e) => e.eventType === 'SECTION_VIEWED');
  const exportEvents = events.filter((e) => e.eventType === 'BUNDLE_EXPORTED');
  const revisitEvents = events.filter((e) => e.eventType === 'BUNDLE_REVISITED');
  const expiredEvents = events.filter((e) => e.eventType === 'EXPIRED_ACCESS_ATTEMPTED');

  // Analyze sections viewed
  const sectionsViewed = new Set<TrackedSection>();
  let hasExtendedReading = false;
  for (const event of sectionEvents) {
    if (event.metadata.section) {
      sectionsViewed.add(event.metadata.section);
    }
    if (event.metadata.timeBucket === 'EXTENDED') {
      hasExtendedReading = true;
    }
  }

  // First view
  if (day === 0 && viewCount > 0) {
    // Skip - already covered by BUNDLE_CREATED
  } else if (viewCount > 0 && !revisitEvents.length) {
    entries.push({
      day,
      date: dateStr,
      eventType: 'FIRST_VIEW',
      description: 'Bundle viewed for the first time',
      details: sectionsViewed.size > 0
        ? [`Sections: ${Array.from(sectionsViewed).map(getSectionShortLabel).join(', ')}`]
        : [],
      risk: 'NONE',
    });
  }

  // Revisits
  if (revisitEvents.length > 0) {
    entries.push({
      day,
      date: dateStr,
      eventType: 'REVISIT',
      description: `Bundle revisited (${revisitEvents.length} times)`,
      details: [],
      risk: 'NONE',
    });
  }

  // Section deep dive
  if (sectionsViewed.size >= 3) {
    entries.push({
      day,
      date: dateStr,
      eventType: 'MULTIPLE_SECTIONS',
      description: `${sectionsViewed.size} sections reviewed`,
      details: Array.from(sectionsViewed).map(getSectionShortLabel),
      risk: 'NONE',
    });
  } else if (hasExtendedReading) {
    const extendedSections = sectionEvents
      .filter((e) => e.metadata.timeBucket === 'EXTENDED')
      .map((e) => e.metadata.section)
      .filter((s): s is TrackedSection => s !== undefined);

    entries.push({
      day,
      date: dateStr,
      eventType: 'SECTION_DEEP_DIVE',
      description: 'Extended reading detected',
      details: [`Deep dive: ${extendedSections.map(getSectionShortLabel).join(', ')}`],
      risk: 'NONE',
    });
  }

  // Extended reading indicator
  if (hasExtendedReading && sectionsViewed.size < 3) {
    entries.push({
      day,
      date: dateStr,
      eventType: 'EXTENDED_READING',
      description: 'Extended reading session (>2 min)',
      details: [],
      risk: 'NONE',
    });
  }

  // Exports
  if (exportEvents.length > 0) {
    const formats = exportEvents
      .map((e) => e.metadata.exportFormat)
      .filter((f): f is ExportFormat => f !== undefined);

    entries.push({
      day,
      date: dateStr,
      eventType: 'EXPORT_INTENT',
      description: `Bundle exported (${formats.join(', ')})`,
      details: ['Export action indicates procurement intent'],
      risk: 'NONE',
    });
  }

  // Expired access attempts
  if (expiredEvents.length > 0) {
    entries.push({
      day,
      date: dateStr,
      eventType: 'EXPIRED_ACCESS',
      description: `Attempted access after expiry (${expiredEvents.length} times)`,
      details: ['Interest continues past bundle expiration'],
      risk: 'MEDIUM',
    });
  }

  return entries;
}

/**
 * Calculates current risk level.
 */
function calculateCurrentRisk(
  totalDays: number,
  lastActivityDay: number,
  hasExport: boolean,
  totalEvents: number
): TimelineRisk {
  const daysSinceLastActivity = totalDays - lastActivityDay;

  // No engagement at all
  if (totalEvents === 0) {
    return totalDays >= 7 ? 'HIGH' : 'MEDIUM';
  }

  // Has export - generally positive
  if (hasExport) {
    return daysSinceLastActivity >= 14 ? 'MEDIUM' : 'NONE';
  }

  // Activity patterns
  if (daysSinceLastActivity >= 14) {
    return 'HIGH';
  }
  if (daysSinceLastActivity >= 7) {
    return 'MEDIUM';
  }
  if (totalDays >= 30 && !hasExport) {
    return 'MEDIUM';
  }

  return 'LOW';
}

/**
 * Generates human-readable risk summary.
 */
function generateRiskSummary(
  risk: TimelineRisk,
  totalDays: number,
  lastActivityDay: number,
  hasExport: boolean
): string {
  const daysSinceLastActivity = totalDays - lastActivityDay;

  switch (risk) {
    case 'HIGH':
      if (lastActivityDay === 0 && totalDays > 0) {
        return `No engagement in ${totalDays} days. Verify contact and delivery.`;
      }
      return `${daysSinceLastActivity} days since last activity. Deal may be stalled.`;

    case 'MEDIUM':
      if (!hasExport && totalDays >= 30) {
        return 'Extended evaluation period without export. Consider follow-up.';
      }
      return `${daysSinceLastActivity} days since last activity. Monitor closely.`;

    case 'LOW':
      return 'Some engagement recorded. Continue monitoring.';

    case 'NONE':
      if (hasExport) {
        return 'Positive signals detected. Export action indicates progression.';
      }
      return 'Evaluation progressing normally.';
  }
}

// ============================================
// Label Functions
// ============================================

/**
 * Gets short label for section.
 */
function getSectionShortLabel(section: TrackedSection): string {
  const labels: Record<TrackedSection, string> = {
    summary: 'Summary',
    questionnaire: 'Questionnaire',
    attestation: 'Attestation',
    whitepaper: 'Whitepaper',
    evidence: 'Evidence',
  };
  return labels[section];
}

/**
 * Gets human-readable label for timeline event type.
 */
export function getTimelineEventLabel(eventType: TimelineEventType): string {
  const labels: Record<TimelineEventType, string> = {
    FIRST_VIEW: 'First View',
    SECTION_DEEP_DIVE: 'Deep Dive',
    MULTIPLE_SECTIONS: 'Multi-Section Review',
    EXPORT_INTENT: 'Export',
    REVISIT: 'Revisit',
    EXTENDED_READING: 'Extended Reading',
    EXPIRED_ACCESS: 'Expired Access',
    INACTIVITY_GAP: 'Inactivity',
    BUNDLE_CREATED: 'Bundle Created',
  };
  return labels[eventType];
}

/**
 * Gets icon for timeline event type.
 */
export function getTimelineEventIcon(eventType: TimelineEventType): string {
  const icons: Record<TimelineEventType, string> = {
    FIRST_VIEW: '👁',
    SECTION_DEEP_DIVE: '🔍',
    MULTIPLE_SECTIONS: '📋',
    EXPORT_INTENT: '📤',
    REVISIT: '🔄',
    EXTENDED_READING: '📖',
    EXPIRED_ACCESS: '⚠️',
    INACTIVITY_GAP: '⏸️',
    BUNDLE_CREATED: '📦',
  };
  return icons[eventType];
}

/**
 * Gets risk label.
 */
export function getRiskLabel(risk: TimelineRisk): string {
  const labels: Record<TimelineRisk, string> = {
    NONE: 'No Risk',
    LOW: 'Low Risk',
    MEDIUM: 'Moderate Risk',
    HIGH: 'High Risk',
  };
  return labels[risk];
}

/**
 * Gets risk color for UI.
 */
export function getRiskColor(risk: TimelineRisk): string {
  switch (risk) {
    case 'HIGH':
      return 'red';
    case 'MEDIUM':
      return 'orange';
    case 'LOW':
      return 'yellow';
    case 'NONE':
      return 'green';
  }
}

/**
 * Formats timeline as human-readable text.
 */
export function formatTimelineAsText(timeline: TrustTimeline): string {
  const lines: string[] = [];

  lines.push(`Trust Timeline for ${timeline.bundleId.slice(0, 20)}...`);
  lines.push(`Created: ${timeline.createdAt.split('T')[0]}`);
  lines.push(`Total Days: ${timeline.totalDays}`);
  lines.push(`Risk: ${getRiskLabel(timeline.currentRisk)}`);
  lines.push('');

  for (const entry of timeline.entries) {
    const icon = getTimelineEventIcon(entry.eventType);
    lines.push(`Day ${entry.day}: ${icon} ${entry.description}`);
    for (const detail of entry.details) {
      lines.push(`  → ${detail}`);
    }
  }

  lines.push('');
  lines.push(`Summary: ${timeline.riskSummary}`);

  return lines.join('\n');
}
