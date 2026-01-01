// ============================================
// Trust Changelog Store
// ============================================
// PHASE D50: Trust Snapshot Versioning & Public Change Log.
//
// PURPOSE:
// Manages the public trust changelog.
// One entry per snapshot, customer-safe language only.
//
// INVARIANTS:
// - One entry per snapshot version
// - No internal rationale exposed
// - Language must be marketing-safe
// - Entries are append-only (no deletion)
// ============================================

import * as fs from 'fs';
import * as path from 'path';
import {
  type TrustVersion,
  type ChangelogEntry,
  type TrustChangelog,
  type ChangeType,
  validateChangelogEntry,
  isValidVersion,
  compareVersions,
} from './snapshotTypes';

// ============================================
// Configuration
// ============================================

const TRUST_BASE_DIR = process.env.TRUST_BASE_DIR || path.join(process.cwd(), 'trust');
const CHANGELOG_DIR = path.join(TRUST_BASE_DIR, 'changelog');
const CHANGELOG_FILE = path.join(CHANGELOG_DIR, 'changelog.json');

// ============================================
// In-Memory Cache
// ============================================

let changelogCache: TrustChangelog | null = null;
let cacheInitialized = false;

// ============================================
// Directory Initialization
// ============================================

function ensureDirectories(): void {
  if (!fs.existsSync(CHANGELOG_DIR)) {
    fs.mkdirSync(CHANGELOG_DIR, { recursive: true });
  }
}

// ============================================
// Cache Management
// ============================================

function initializeCache(): void {
  if (cacheInitialized) return;

  ensureDirectories();

  if (!fs.existsSync(CHANGELOG_FILE)) {
    changelogCache = { entries: [] };
    cacheInitialized = true;
    return;
  }

  try {
    const content = fs.readFileSync(CHANGELOG_FILE, 'utf-8');
    const parsed = JSON.parse(content);

    // Handle both array format and object format
    if (Array.isArray(parsed)) {
      changelogCache = { entries: parsed.filter(validateChangelogEntry) };
    } else if (parsed.entries && Array.isArray(parsed.entries)) {
      changelogCache = { entries: parsed.entries.filter(validateChangelogEntry) };
    } else {
      changelogCache = { entries: [] };
    }

    // Sort entries newest first
    changelogCache.entries.sort((a, b) => -compareVersions(a.version, b.version));

    cacheInitialized = true;
  } catch (e) {
    console.error('[TRUST] Failed to load changelog:', e);
    changelogCache = { entries: [] };
    cacheInitialized = true;
  }
}

/**
 * Invalidates the cache.
 */
export function invalidateCache(): void {
  cacheInitialized = false;
  changelogCache = null;
}

/**
 * Saves the changelog to disk.
 */
function saveChangelog(): void {
  if (!changelogCache) return;

  ensureDirectories();

  try {
    // Sort before saving
    changelogCache.entries.sort((a, b) => -compareVersions(a.version, b.version));

    fs.writeFileSync(
      CHANGELOG_FILE,
      JSON.stringify(changelogCache.entries, null, 2),
      'utf-8'
    );
  } catch (e) {
    console.error('[TRUST] Failed to save changelog:', e);
    throw new Error('Failed to save changelog');
  }
}

// ============================================
// Changelog Operations (Read)
// ============================================

/**
 * Gets the complete changelog.
 */
export function getChangelog(): TrustChangelog {
  initializeCache();
  return { entries: [...changelogCache!.entries] };
}

/**
 * Gets all changelog entries.
 */
export function getChangelogEntries(): ChangelogEntry[] {
  initializeCache();
  return [...changelogCache!.entries];
}

/**
 * Gets a changelog entry for a specific version.
 */
export function getChangelogEntry(version: TrustVersion): ChangelogEntry | null {
  initializeCache();
  return changelogCache!.entries.find((e) => e.version === version) ?? null;
}

/**
 * Checks if a changelog entry exists for a version.
 */
export function hasChangelogEntry(version: TrustVersion): boolean {
  initializeCache();
  return changelogCache!.entries.some((e) => e.version === version);
}

/**
 * Gets the most recent changelog entry.
 */
export function getLatestChangelogEntry(): ChangelogEntry | null {
  initializeCache();
  return changelogCache!.entries[0] ?? null;
}

/**
 * Gets changelog entries by type.
 */
export function getEntriesByType(type: ChangeType): ChangelogEntry[] {
  initializeCache();
  return changelogCache!.entries.filter((e) => e.type === type);
}

// ============================================
// Changelog Operations (Write)
// ============================================

/**
 * Adds a new changelog entry.
 * Entry must not already exist for this version.
 */
export function addChangelogEntry(
  entry: ChangelogEntry
): { success: boolean; error?: string } {
  initializeCache();

  // Validate entry
  if (!validateChangelogEntry(entry)) {
    return { success: false, error: 'Invalid changelog entry format' };
  }

  // Check version doesn't exist
  if (hasChangelogEntry(entry.version)) {
    return { success: false, error: `Entry for ${entry.version} already exists` };
  }

  // Add entry
  changelogCache!.entries.push(entry);

  // Save
  try {
    saveChangelog();
    return { success: true };
  } catch (e) {
    // Remove the entry we just added on failure
    changelogCache!.entries = changelogCache!.entries.filter(
      (e) => e.version !== entry.version
    );
    return { success: false, error: `Failed to save changelog: ${e}` };
  }
}

/**
 * Creates a changelog entry with standard formatting.
 */
export function createChangelogEntry(
  version: TrustVersion,
  type: ChangeType,
  summary: string,
  customerImpact: string
): ChangelogEntry {
  const date = new Date().toISOString().split('T')[0];

  return {
    version,
    date,
    type,
    summary,
    customer_impact: customerImpact,
    link: `/trust/versions/${version}`,
  };
}

/**
 * Adds a rollback entry to the changelog.
 */
export function addRollbackEntry(
  version: TrustVersion,
  reason?: string
): { success: boolean; error?: string } {
  const summary = reason
    ? `Reverted to ${version}: ${reason}`
    : `Reverted to ${version} for clarity.`;

  const entry = createChangelogEntry(
    version,
    'clarification',
    summary,
    'No impact to existing functionality. Previous version restored for consistency.'
  );

  // Override date to now (rollback is a new event)
  entry.date = new Date().toISOString().split('T')[0];

  // For rollbacks, we update the existing entry if it exists
  // or add a new one if it doesn't
  initializeCache();

  const existingIndex = changelogCache!.entries.findIndex(
    (e) => e.version === version
  );

  if (existingIndex !== -1) {
    // Update existing entry
    changelogCache!.entries[existingIndex] = entry;
  } else {
    // Add new entry
    changelogCache!.entries.push(entry);
  }

  try {
    saveChangelog();
    return { success: true };
  } catch (e) {
    invalidateCache();
    return { success: false, error: `Failed to save changelog: ${e}` };
  }
}

// ============================================
// Validation Helpers
// ============================================

/**
 * Validates that a summary is marketing-safe.
 * Returns issues found.
 */
export function validateMarketingSafe(text: string): string[] {
  const issues: string[] = [];

  // Check for internal jargon
  const internalTerms = [
    'internal',
    'TODO',
    'FIXME',
    'refactor',
    'bug',
    'hotfix',
    'sprint',
    'backlog',
    'tech debt',
    'regression',
  ];

  for (const term of internalTerms) {
    if (text.toLowerCase().includes(term.toLowerCase())) {
      issues.push(`Contains internal term: "${term}"`);
    }
  }

  // Check for blame language
  const blameTerms = ['fixed error', 'corrected mistake', 'resolved issue'];
  for (const term of blameTerms) {
    if (text.toLowerCase().includes(term.toLowerCase())) {
      issues.push(`Contains blame language: "${term}"`);
    }
  }

  // Check length
  if (text.length > 500) {
    issues.push('Summary too long (max 500 characters)');
  }

  if (text.length < 10) {
    issues.push('Summary too short (min 10 characters)');
  }

  return issues;
}

/**
 * Gets change type label for display.
 */
export function getChangeTypeLabel(type: ChangeType): string {
  const labels: Record<ChangeType, string> = {
    clarification: 'Clarification',
    addition: 'New Addition',
    'scope-change': 'Scope Change',
  };
  return labels[type];
}

/**
 * Gets change type description.
 */
export function getChangeTypeDescription(type: ChangeType): string {
  const descriptions: Record<ChangeType, string> = {
    clarification: 'Wording improvements for clarity',
    addition: 'New sections or content added',
    'scope-change': 'Changes to coverage or meaning',
  };
  return descriptions[type];
}

// ============================================
// Export for testing
// ============================================

export const __testing = {
  CHANGELOG_DIR,
  CHANGELOG_FILE,
  ensureDirectories,
};
