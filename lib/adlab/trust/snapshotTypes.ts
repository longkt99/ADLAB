// ============================================
// Trust Snapshot Versioning Types
// ============================================
// PHASE D50: Trust Snapshot Versioning & Public Change Log.
//
// PURPOSE:
// Defines the canonical types for trust content versioning.
// All trust content MUST flow through this schema.
//
// INVARIANTS:
// - One snapshot = one immutable version
// - Exactly one snapshot may be active at a time
// - Old versions are never deleted
// - No silent changes allowed
// - Every change requires version bump
// ============================================

// ============================================
// Version Types
// ============================================

/**
 * Semantic version string (e.g., "v1.0.0").
 */
export type TrustVersion = `v${number}.${number}.${number}`;

/**
 * Snapshot status.
 * - active: Currently deployed and visible
 * - retired: Historical version, no longer active
 */
export type SnapshotStatus = 'active' | 'retired';

/**
 * Author role for trust content changes.
 */
export type AuthorRole = 'Product' | 'Legal' | 'Trust Committee';

/**
 * Change type for changelog entries.
 */
export type ChangeType = 'clarification' | 'addition' | 'scope-change';

/**
 * Version bump type based on change magnitude.
 * - PATCH: Wording clarification (no meaning change)
 * - MINOR: Add/remove section
 * - MAJOR: Meaning or scope change
 */
export type VersionBumpType = 'PATCH' | 'MINOR' | 'MAJOR';

// ============================================
// Snapshot Schema
// ============================================

/**
 * Author information for a trust snapshot.
 */
export interface SnapshotAuthor {
  /** Author name */
  name: string;
  /** Author role */
  role: AuthorRole;
}

/**
 * A section within a trust snapshot.
 */
export interface TrustSection {
  /** Unique section identifier */
  id: string;
  /** Section title */
  title: string;
  /** Content lines (each line is a separate string) */
  lines: string[];
}

/**
 * Complete trust snapshot schema.
 * This is the canonical source of truth for trust content.
 */
export interface TrustSnapshot {
  /** Version identifier (e.g., "v1.0.0") */
  version: TrustVersion;
  /** ISO-8601 timestamp of release */
  released_at: string;
  /** Current status of this snapshot */
  status: SnapshotStatus;
  /** Author information */
  author: SnapshotAuthor;
  /** Plain-language description of why this version exists */
  summary: string;
  /** Trust content sections */
  sections: TrustSection[];
}

// ============================================
// Changelog Schema
// ============================================

/**
 * A single changelog entry for public display.
 */
export interface ChangelogEntry {
  /** Version this entry describes */
  version: TrustVersion;
  /** Release date (YYYY-MM-DD) */
  date: string;
  /** Type of change */
  type: ChangeType;
  /** What changed (plain language, marketing-safe) */
  summary: string;
  /** What this means for customers */
  customer_impact: string;
  /** Link to full snapshot */
  link: string;
}

/**
 * Complete changelog structure.
 */
export interface TrustChangelog {
  /** Changelog entries, newest first */
  entries: ChangelogEntry[];
}

// ============================================
// Diff Types
// ============================================

/**
 * Type of change for a single line.
 */
export type DiffLineType = 'added' | 'removed' | 'unchanged';

/**
 * A single line in a diff.
 */
export interface DiffLine {
  /** Type of change */
  type: DiffLineType;
  /** Line content */
  content: string;
  /** Line number in old version (null if added) */
  oldLineNumber: number | null;
  /** Line number in new version (null if removed) */
  newLineNumber: number | null;
}

/**
 * Diff for a single section.
 */
export interface SectionDiff {
  /** Section ID */
  sectionId: string;
  /** Section title (from new version, or old if removed) */
  title: string;
  /** Whether section was added */
  added: boolean;
  /** Whether section was removed */
  removed: boolean;
  /** Line-by-line diff */
  lines: DiffLine[];
}

/**
 * Complete diff between two snapshots.
 */
export interface SnapshotDiff {
  /** Old version */
  fromVersion: TrustVersion;
  /** New version */
  toVersion: TrustVersion;
  /** Section-by-section diffs */
  sections: SectionDiff[];
  /** Summary statistics */
  stats: {
    sectionsAdded: number;
    sectionsRemoved: number;
    sectionsModified: number;
    linesAdded: number;
    linesRemoved: number;
  };
}

// ============================================
// Audit Event Types
// ============================================

/**
 * Trust snapshot audit event types.
 */
export type TrustAuditEventType =
  | 'SNAPSHOT_CREATED'
  | 'SNAPSHOT_ACTIVATED'
  | 'SNAPSHOT_RETIRED'
  | 'TRUST_ROLLBACK';

/**
 * Trust audit event record.
 */
export interface TrustAuditEvent {
  /** Event type */
  event: TrustAuditEventType;
  /** Actor who performed the action */
  actor: string;
  /** Actor's role */
  role: string;
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Version affected */
  version: TrustVersion;
  /** Reason for the action */
  reason: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================
// Deploy Gate Types
// ============================================

/**
 * Deploy gate check result.
 */
export interface DeployGateCheck {
  /** Check name */
  check: string;
  /** Whether check passed */
  passed: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Complete deploy gate verification result.
 */
export interface DeployGateResult {
  /** Whether all checks passed */
  passed: boolean;
  /** Individual check results */
  checks: DeployGateCheck[];
  /** Active snapshot version (if any) */
  activeVersion: TrustVersion | null;
  /** UI version (if detectable) */
  uiVersion: TrustVersion | null;
  /** Timestamp of verification */
  verifiedAt: string;
}

// ============================================
// Permission Types
// ============================================

/**
 * Actions on trust snapshots.
 */
export type TrustAction =
  | 'create_snapshot'
  | 'activate_snapshot'
  | 'view_public_history'
  | 'view_audit_logs';

/**
 * Role permissions for trust actions.
 */
export const TRUST_PERMISSIONS: Record<TrustAction, string[]> = {
  create_snapshot: ['product', 'legal'],
  activate_snapshot: ['owner'],
  view_public_history: ['*'], // Anyone
  view_audit_logs: ['admin'],
};

// ============================================
// Validation Helpers
// ============================================

/**
 * Validates a version string format.
 */
export function isValidVersion(version: string): version is TrustVersion {
  return /^v\d+\.\d+\.\d+$/.test(version);
}

/**
 * Parses a version string into components.
 */
export function parseVersion(version: TrustVersion): {
  major: number;
  minor: number;
  patch: number;
} {
  const match = version.match(/^v(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Invalid version format: ${version}`);
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Compares two versions.
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareVersions(a: TrustVersion, b: TrustVersion): number {
  const va = parseVersion(a);
  const vb = parseVersion(b);

  if (va.major !== vb.major) return va.major < vb.major ? -1 : 1;
  if (va.minor !== vb.minor) return va.minor < vb.minor ? -1 : 1;
  if (va.patch !== vb.patch) return va.patch < vb.patch ? -1 : 1;
  return 0;
}

/**
 * Computes the next version based on bump type.
 */
export function bumpVersion(
  current: TrustVersion,
  bumpType: VersionBumpType
): TrustVersion {
  const { major, minor, patch } = parseVersion(current);

  switch (bumpType) {
    case 'MAJOR':
      return `v${major + 1}.0.0`;
    case 'MINOR':
      return `v${major}.${minor + 1}.0`;
    case 'PATCH':
      return `v${major}.${minor}.${patch + 1}`;
  }
}

/**
 * Determines bump type needed based on change type.
 */
export function getBumpTypeForChange(changeType: ChangeType): VersionBumpType {
  switch (changeType) {
    case 'clarification':
      return 'PATCH';
    case 'addition':
      return 'MINOR';
    case 'scope-change':
      return 'MAJOR';
  }
}

/**
 * Validates a complete snapshot schema.
 */
export function validateSnapshot(snapshot: unknown): snapshot is TrustSnapshot {
  if (typeof snapshot !== 'object' || snapshot === null) return false;

  const s = snapshot as Record<string, unknown>;

  // Required fields
  if (!isValidVersion(s.version as string)) return false;
  if (typeof s.released_at !== 'string') return false;
  if (s.status !== 'active' && s.status !== 'retired') return false;
  if (typeof s.summary !== 'string') return false;

  // Author validation
  if (typeof s.author !== 'object' || s.author === null) return false;
  const author = s.author as Record<string, unknown>;
  if (typeof author.name !== 'string') return false;
  if (!['Product', 'Legal', 'Trust Committee'].includes(author.role as string)) {
    return false;
  }

  // Sections validation
  if (!Array.isArray(s.sections)) return false;
  for (const section of s.sections) {
    if (typeof section !== 'object' || section === null) return false;
    const sec = section as Record<string, unknown>;
    if (typeof sec.id !== 'string') return false;
    if (typeof sec.title !== 'string') return false;
    if (!Array.isArray(sec.lines)) return false;
    for (const line of sec.lines) {
      if (typeof line !== 'string') return false;
    }
  }

  return true;
}

/**
 * Validates a changelog entry.
 */
export function validateChangelogEntry(entry: unknown): entry is ChangelogEntry {
  if (typeof entry !== 'object' || entry === null) return false;

  const e = entry as Record<string, unknown>;

  if (!isValidVersion(e.version as string)) return false;
  if (typeof e.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) {
    return false;
  }
  if (!['clarification', 'addition', 'scope-change'].includes(e.type as string)) {
    return false;
  }
  if (typeof e.summary !== 'string') return false;
  if (typeof e.customer_impact !== 'string') return false;
  if (typeof e.link !== 'string') return false;

  return true;
}
