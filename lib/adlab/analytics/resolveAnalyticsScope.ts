// ============================================
// AdLab Analytics Scope Resolution
// ============================================
// PHASE D17B: Snapshot-bound analytics scope resolver.
//
// CORE INVARIANTS:
// 1. Analytics queries MUST resolve through active snapshot
// 2. If no active snapshot exists, queries MUST fail fast
// 3. Rollback instantly affects analytics results
// 4. Production truth is defined ONLY by active snapshot
//
// WARNING: Do NOT bypass this layer. All analytics queries
// MUST use resolveAnalyticsScope() or assertProductionBound().
// ============================================

import { resolveActiveIngestionLogId, getActiveSnapshot } from '../ingestion/snapshots';
import type { DatasetType, PlatformType } from '../ingestion/validate';

// ============================================
// Types
// ============================================

/**
 * Scope definition for analytics queries.
 * ALL analytics queries require this scope.
 */
export interface AnalyticsScope {
  workspaceId: string;
  platform: PlatformType;
  dataset: DatasetType;
}

/**
 * Resolved analytics scope with ingestion log binding.
 * This is what analytics queries receive after resolution.
 */
export interface ResolvedAnalyticsScope {
  workspaceId: string;
  platform: PlatformType;
  dataset: DatasetType;
  /** The ingestion log ID that defines production truth */
  ingestionLogId: string;
  /** Snapshot ID for audit trail */
  snapshotId: string;
  /** When this snapshot became active */
  promotedAt: string;
}

/**
 * Error thrown when no active production snapshot exists.
 * This is a HARD error - analytics cannot proceed.
 */
export class NoActiveSnapshotError extends Error {
  public readonly scope: AnalyticsScope;

  constructor(scope: AnalyticsScope) {
    super(
      `No active production snapshot for dataset "${scope.dataset}" ` +
      `on platform "${scope.platform}" in workspace "${scope.workspaceId}". ` +
      `Analytics queries require promoted production data.`
    );
    this.name = 'NoActiveSnapshotError';
    this.scope = scope;
  }
}

/**
 * Error thrown when production binding assertion fails.
 */
export class ProductionBindingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductionBindingError';
  }
}

// ============================================
// Main Resolution Function
// ============================================

/**
 * Resolve analytics scope to production-bound ingestion log.
 *
 * BEHAVIOR:
 * 1. Look up active snapshot for (workspace, platform, dataset)
 * 2. If no active snapshot → throw NoActiveSnapshotError
 * 3. Return resolved scope with ingestion_log_id
 *
 * USAGE:
 * ```typescript
 * const scope = await resolveAnalyticsScope({
 *   workspaceId: 'xxx',
 *   platform: 'meta',
 *   dataset: 'daily_metrics'
 * });
 * // scope.ingestionLogId is guaranteed to exist
 * ```
 *
 * @throws {NoActiveSnapshotError} if no active snapshot exists
 */
export async function resolveAnalyticsScope(
  scope: AnalyticsScope
): Promise<ResolvedAnalyticsScope> {
  // Analytics is snapshot-bound. Do NOT bypass.
  const { data: snapshot, error } = await getActiveSnapshot(
    scope.workspaceId,
    scope.platform,
    scope.dataset
  );

  if (error) {
    throw new ProductionBindingError(
      `Failed to resolve production snapshot: ${error}`
    );
  }

  if (!snapshot) {
    throw new NoActiveSnapshotError(scope);
  }

  return {
    workspaceId: scope.workspaceId,
    platform: scope.platform,
    dataset: scope.dataset,
    ingestionLogId: snapshot.ingestion_log_id,
    snapshotId: snapshot.id,
    promotedAt: snapshot.promoted_at,
  };
}

/**
 * Try to resolve analytics scope, returning null instead of throwing.
 * Use this for graceful degradation when no production data exists.
 *
 * NOTE: Most analytics queries should use resolveAnalyticsScope()
 * which throws. Use this only when you need to handle missing
 * production data gracefully in the UI layer.
 */
export async function tryResolveAnalyticsScope(
  scope: AnalyticsScope
): Promise<ResolvedAnalyticsScope | null> {
  try {
    return await resolveAnalyticsScope(scope);
  } catch (e) {
    if (e instanceof NoActiveSnapshotError) {
      return null;
    }
    throw e;
  }
}

// ============================================
// Assertion Helpers
// ============================================

/**
 * Assert that a resolved scope is production-bound.
 *
 * GUARDRAILS:
 * - ingestionLogId must be present
 * - snapshotId must be present
 * - workspaceId must match expected
 *
 * @throws {ProductionBindingError} if any assertion fails
 */
export function assertProductionBound(
  resolvedScope: ResolvedAnalyticsScope,
  expectedWorkspaceId: string
): void {
  // Analytics is snapshot-bound. Do NOT bypass.

  if (!resolvedScope.ingestionLogId) {
    throw new ProductionBindingError(
      'Resolved scope is missing ingestionLogId. ' +
      'Analytics queries require snapshot binding.'
    );
  }

  if (!resolvedScope.snapshotId) {
    throw new ProductionBindingError(
      'Resolved scope is missing snapshotId. ' +
      'Analytics queries require snapshot binding.'
    );
  }

  if (resolvedScope.workspaceId !== expectedWorkspaceId) {
    throw new ProductionBindingError(
      `Workspace mismatch: resolved scope belongs to "${resolvedScope.workspaceId}" ` +
      `but expected "${expectedWorkspaceId}". ` +
      'This may indicate a security issue.'
    );
  }
}

/**
 * Assert that an ingestion log ID matches the active production snapshot.
 * Use this to verify data integrity before processing.
 *
 * @throws {ProductionBindingError} if the log ID doesn't match active snapshot
 */
export async function assertIsActiveProductionLog(
  ingestionLogId: string,
  scope: AnalyticsScope
): Promise<void> {
  const activeLogId = await resolveActiveIngestionLogId(scope);

  if (!activeLogId) {
    throw new NoActiveSnapshotError(scope);
  }

  if (activeLogId !== ingestionLogId) {
    throw new ProductionBindingError(
      `Ingestion log "${ingestionLogId}" is not the active production snapshot. ` +
      `Current active log is "${activeLogId}". ` +
      'Analytics must use the active snapshot.'
    );
  }
}

// ============================================
// Multi-Dataset Resolution
// ============================================

/**
 * Resolve multiple analytics scopes in parallel.
 * Useful when a dashboard needs data from multiple datasets.
 *
 * @throws {NoActiveSnapshotError} if ANY scope lacks an active snapshot
 */
export async function resolveMultipleAnalyticsScopes(
  scopes: AnalyticsScope[]
): Promise<ResolvedAnalyticsScope[]> {
  const results = await Promise.all(
    scopes.map((scope) => resolveAnalyticsScope(scope))
  );
  return results;
}

/**
 * Check which datasets have active production snapshots.
 * Useful for showing data availability in UI.
 *
 * Returns a map of dataset -> boolean (has active snapshot)
 */
export async function checkDatasetAvailability(
  workspaceId: string,
  platform: PlatformType,
  datasets: DatasetType[]
): Promise<Map<DatasetType, boolean>> {
  const availability = new Map<DatasetType, boolean>();

  await Promise.all(
    datasets.map(async (dataset) => {
      const resolved = await tryResolveAnalyticsScope({
        workspaceId,
        platform,
        dataset,
      });
      availability.set(dataset, resolved !== null);
    })
  );

  return availability;
}
