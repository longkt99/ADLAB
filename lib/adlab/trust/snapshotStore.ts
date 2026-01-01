// ============================================
// Trust Snapshot Store
// ============================================
// PHASE D50: Trust Snapshot Versioning & Public Change Log.
//
// PURPOSE:
// Provides storage and retrieval for trust snapshots.
// All snapshots are immutable once created.
//
// INVARIANTS:
// - Snapshots are stored as JSON files in /trust/snapshots/
// - Exactly one snapshot may be active at a time
// - Old versions are never deleted
// - All reads return immutable copies
// ============================================

import * as fs from 'fs';
import * as path from 'path';
import {
  type TrustSnapshot,
  type TrustVersion,
  type SnapshotStatus,
  type TrustAuditEvent,
  type TrustAuditEventType,
  validateSnapshot,
  isValidVersion,
  compareVersions,
} from './snapshotTypes';

// ============================================
// Configuration
// ============================================

/**
 * Base directory for trust content.
 * In production, this would be configurable.
 */
const TRUST_BASE_DIR = process.env.TRUST_BASE_DIR || path.join(process.cwd(), 'trust');
const SNAPSHOTS_DIR = path.join(TRUST_BASE_DIR, 'snapshots');
const AUDIT_LOG_FILE = path.join(TRUST_BASE_DIR, 'audit', 'trust-audit.log');

// ============================================
// In-Memory Cache (for serverless)
// ============================================

let snapshotCache: Map<TrustVersion, TrustSnapshot> = new Map();
let activeVersionCache: TrustVersion | null = null;
let cacheInitialized = false;

// ============================================
// Directory Initialization
// ============================================

/**
 * Ensures all required directories exist.
 */
function ensureDirectories(): void {
  const dirs = [
    TRUST_BASE_DIR,
    SNAPSHOTS_DIR,
    path.dirname(AUDIT_LOG_FILE),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

// ============================================
// File Path Helpers
// ============================================

/**
 * Gets the file path for a snapshot.
 */
function getSnapshotPath(version: TrustVersion): string {
  return path.join(SNAPSHOTS_DIR, `${version}.json`);
}

/**
 * Lists all snapshot files in the snapshots directory.
 */
function listSnapshotFiles(): string[] {
  ensureDirectories();
  if (!fs.existsSync(SNAPSHOTS_DIR)) {
    return [];
  }

  return fs.readdirSync(SNAPSHOTS_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.replace('.json', ''))
    .filter((version) => isValidVersion(version)) as TrustVersion[];
}

// ============================================
// Cache Management
// ============================================

/**
 * Initializes the in-memory cache from disk.
 */
function initializeCache(): void {
  if (cacheInitialized) return;

  ensureDirectories();
  snapshotCache.clear();
  activeVersionCache = null;

  const versions = listSnapshotFiles() as TrustVersion[];

  for (const version of versions) {
    try {
      const filePath = getSnapshotPath(version);
      const content = fs.readFileSync(filePath, 'utf-8');
      const snapshot = JSON.parse(content);

      if (validateSnapshot(snapshot)) {
        snapshotCache.set(version, snapshot);

        if (snapshot.status === 'active') {
          if (activeVersionCache !== null) {
            console.error(
              `[TRUST] Multiple active snapshots found: ${activeVersionCache} and ${version}`
            );
          }
          activeVersionCache = version;
        }
      } else {
        console.error(`[TRUST] Invalid snapshot format: ${version}`);
      }
    } catch (e) {
      console.error(`[TRUST] Failed to load snapshot ${version}:`, e);
    }
  }

  cacheInitialized = true;
}

/**
 * Invalidates the cache, forcing a reload on next access.
 */
export function invalidateCache(): void {
  cacheInitialized = false;
  snapshotCache.clear();
  activeVersionCache = null;
}

// ============================================
// Audit Logging
// ============================================

/**
 * Appends an audit event to the audit log.
 */
function appendAuditLog(event: TrustAuditEvent): void {
  ensureDirectories();

  const logLine = JSON.stringify(event) + '\n';

  try {
    fs.appendFileSync(AUDIT_LOG_FILE, logLine, 'utf-8');
  } catch (e) {
    console.error('[TRUST] Failed to write audit log:', e);
    // Audit logging should not block operations
  }
}

/**
 * Creates an audit event.
 */
function createAuditEvent(
  event: TrustAuditEventType,
  actor: string,
  role: string,
  version: TrustVersion,
  reason: string,
  metadata?: Record<string, unknown>
): TrustAuditEvent {
  return {
    event,
    actor,
    role,
    timestamp: new Date().toISOString(),
    version,
    reason,
    metadata,
  };
}

// ============================================
// Snapshot Operations (Read)
// ============================================

/**
 * Gets all snapshots, sorted by version (newest first).
 */
export function getAllSnapshots(): TrustSnapshot[] {
  initializeCache();

  return Array.from(snapshotCache.values())
    .sort((a, b) => -compareVersions(a.version, b.version));
}

/**
 * Gets a specific snapshot by version.
 */
export function getSnapshot(version: TrustVersion): TrustSnapshot | null {
  initializeCache();
  return snapshotCache.get(version) ?? null;
}

/**
 * Gets the currently active snapshot.
 */
export function getActiveSnapshot(): TrustSnapshot | null {
  initializeCache();

  if (activeVersionCache === null) {
    return null;
  }

  return snapshotCache.get(activeVersionCache) ?? null;
}

/**
 * Gets the active version string.
 */
export function getActiveVersion(): TrustVersion | null {
  initializeCache();
  return activeVersionCache;
}

/**
 * Gets all versions, sorted by version (newest first).
 */
export function getAllVersions(): TrustVersion[] {
  initializeCache();

  return Array.from(snapshotCache.keys())
    .sort((a, b) => -compareVersions(a, b));
}

/**
 * Checks if a version exists.
 */
export function versionExists(version: TrustVersion): boolean {
  initializeCache();
  return snapshotCache.has(version);
}

/**
 * Gets the previous version (for diff calculation).
 */
export function getPreviousVersion(version: TrustVersion): TrustVersion | null {
  const versions = getAllVersions();
  const index = versions.indexOf(version);

  if (index === -1 || index === versions.length - 1) {
    return null;
  }

  return versions[index + 1];
}

// ============================================
// Snapshot Operations (Write)
// ============================================

/**
 * Creates a new snapshot.
 * Does NOT activate it automatically.
 */
export function createSnapshot(
  snapshot: TrustSnapshot,
  actor: string,
  role: string,
  reason: string
): { success: boolean; error?: string } {
  initializeCache();

  // Validate snapshot
  if (!validateSnapshot(snapshot)) {
    return { success: false, error: 'Invalid snapshot format' };
  }

  // Check version doesn't exist
  if (versionExists(snapshot.version)) {
    return { success: false, error: `Version ${snapshot.version} already exists` };
  }

  // New snapshots must be created as 'retired' status
  // Activation is a separate, explicit step
  if (snapshot.status !== 'retired') {
    return {
      success: false,
      error: 'New snapshots must be created with status "retired". Use activateSnapshot to activate.',
    };
  }

  // Write to disk
  ensureDirectories();
  const filePath = getSnapshotPath(snapshot.version);

  try {
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
  } catch (e) {
    return { success: false, error: `Failed to write snapshot: ${e}` };
  }

  // Update cache
  snapshotCache.set(snapshot.version, snapshot);

  // Log audit event
  appendAuditLog(
    createAuditEvent('SNAPSHOT_CREATED', actor, role, snapshot.version, reason, {
      summary: snapshot.summary,
      sectionCount: snapshot.sections.length,
    })
  );

  return { success: true };
}

/**
 * Activates a snapshot.
 * Retires the currently active snapshot (if any).
 */
export function activateSnapshot(
  version: TrustVersion,
  actor: string,
  role: string,
  reason: string
): { success: boolean; error?: string; previousVersion?: TrustVersion } {
  initializeCache();

  // Check version exists
  if (!versionExists(version)) {
    return { success: false, error: `Version ${version} does not exist` };
  }

  const snapshot = snapshotCache.get(version)!;
  const previousActive = activeVersionCache;

  // If already active, nothing to do
  if (snapshot.status === 'active') {
    return { success: true, previousVersion: undefined };
  }

  try {
    // Retire current active snapshot
    if (previousActive !== null && previousActive !== version) {
      const currentActive = snapshotCache.get(previousActive)!;
      const retiredSnapshot: TrustSnapshot = {
        ...currentActive,
        status: 'retired',
      };

      fs.writeFileSync(
        getSnapshotPath(previousActive),
        JSON.stringify(retiredSnapshot, null, 2),
        'utf-8'
      );

      snapshotCache.set(previousActive, retiredSnapshot);

      appendAuditLog(
        createAuditEvent(
          'SNAPSHOT_RETIRED',
          actor,
          role,
          previousActive,
          `Retired due to activation of ${version}`
        )
      );
    }

    // Activate new snapshot
    const activatedSnapshot: TrustSnapshot = {
      ...snapshot,
      status: 'active',
    };

    fs.writeFileSync(
      getSnapshotPath(version),
      JSON.stringify(activatedSnapshot, null, 2),
      'utf-8'
    );

    snapshotCache.set(version, activatedSnapshot);
    activeVersionCache = version;

    appendAuditLog(
      createAuditEvent('SNAPSHOT_ACTIVATED', actor, role, version, reason)
    );

    return {
      success: true,
      previousVersion: previousActive ?? undefined,
    };
  } catch (e) {
    invalidateCache(); // Reset cache to ensure consistency
    return { success: false, error: `Failed to activate snapshot: ${e}` };
  }
}

/**
 * Rolls back to a previous version.
 * This is a special activation with audit trail.
 */
export function rollbackToVersion(
  version: TrustVersion,
  actor: string,
  role: string,
  reason: string
): { success: boolean; error?: string; previousVersion?: TrustVersion } {
  initializeCache();

  if (!versionExists(version)) {
    return { success: false, error: `Version ${version} does not exist` };
  }

  const previousActive = activeVersionCache;

  // Perform the rollback (same as activation but with different audit event)
  const result = activateSnapshot(version, actor, role, reason);

  if (result.success && previousActive !== null && previousActive !== version) {
    // Log rollback-specific audit event
    appendAuditLog(
      createAuditEvent('TRUST_ROLLBACK', actor, role, version, reason, {
        previousVersion: previousActive,
      })
    );
  }

  return result;
}

// ============================================
// Audit Log Reading
// ============================================

/**
 * Reads the audit log.
 */
export function getAuditLog(): TrustAuditEvent[] {
  ensureDirectories();

  if (!fs.existsSync(AUDIT_LOG_FILE)) {
    return [];
  }

  try {
    const content = fs.readFileSync(AUDIT_LOG_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    return lines.map((line) => JSON.parse(line) as TrustAuditEvent).reverse();
  } catch (e) {
    console.error('[TRUST] Failed to read audit log:', e);
    return [];
  }
}

/**
 * Gets audit events for a specific version.
 */
export function getAuditEventsForVersion(version: TrustVersion): TrustAuditEvent[] {
  return getAuditLog().filter((event) => event.version === version);
}

// ============================================
// Export for testing
// ============================================

export const __testing = {
  TRUST_BASE_DIR,
  SNAPSHOTS_DIR,
  AUDIT_LOG_FILE,
  ensureDirectories,
  getSnapshotPath,
};
