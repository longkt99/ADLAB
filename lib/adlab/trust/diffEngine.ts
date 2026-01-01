// ============================================
// Trust Snapshot Diff Engine
// ============================================
// PHASE D50: Trust Snapshot Versioning & Public Change Log.
//
// PURPOSE:
// Computes text-only diffs between trust snapshots.
// Used for version comparison and change visualization.
//
// INVARIANTS:
// - Line-by-line comparison only
// - No metadata in diffs
// - No code/formatting noise
// - Pure text comparison
// ============================================

import {
  type TrustSnapshot,
  type TrustSection,
  type TrustVersion,
  type DiffLine,
  type DiffLineType,
  type SectionDiff,
  type SnapshotDiff,
} from './snapshotTypes';
import { getSnapshot, getPreviousVersion } from './snapshotStore';

// ============================================
// Line Diff Algorithm (Simple LCS-based)
// ============================================

interface LCSCell {
  length: number;
  direction: 'diagonal' | 'up' | 'left' | null;
}

/**
 * Computes Longest Common Subsequence matrix.
 */
function computeLCS(oldLines: string[], newLines: string[]): LCSCell[][] {
  const m = oldLines.length;
  const n = newLines.length;

  // Initialize matrix
  const matrix: LCSCell[][] = [];
  for (let i = 0; i <= m; i++) {
    matrix[i] = [];
    for (let j = 0; j <= n; j++) {
      matrix[i][j] = { length: 0, direction: null };
    }
  }

  // Fill matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        matrix[i][j] = {
          length: matrix[i - 1][j - 1].length + 1,
          direction: 'diagonal',
        };
      } else if (matrix[i - 1][j].length >= matrix[i][j - 1].length) {
        matrix[i][j] = {
          length: matrix[i - 1][j].length,
          direction: 'up',
        };
      } else {
        matrix[i][j] = {
          length: matrix[i][j - 1].length,
          direction: 'left',
        };
      }
    }
  }

  return matrix;
}

/**
 * Backtracks through LCS matrix to produce diff.
 */
function backtrackDiff(
  matrix: LCSCell[][],
  oldLines: string[],
  newLines: string[]
): DiffLine[] {
  const result: DiffLine[] = [];
  let i = oldLines.length;
  let j = newLines.length;
  let oldLineNum = oldLines.length;
  let newLineNum = newLines.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && matrix[i][j].direction === 'diagonal') {
      // Lines are equal
      result.unshift({
        type: 'unchanged',
        content: oldLines[i - 1],
        oldLineNumber: oldLineNum,
        newLineNumber: newLineNum,
      });
      i--;
      j--;
      oldLineNum--;
      newLineNum--;
    } else if (j > 0 && (i === 0 || matrix[i][j].direction === 'left')) {
      // Line added in new version
      result.unshift({
        type: 'added',
        content: newLines[j - 1],
        oldLineNumber: null,
        newLineNumber: newLineNum,
      });
      j--;
      newLineNum--;
    } else if (i > 0) {
      // Line removed from old version
      result.unshift({
        type: 'removed',
        content: oldLines[i - 1],
        oldLineNumber: oldLineNum,
        newLineNumber: null,
      });
      i--;
      oldLineNum--;
    }
  }

  return result;
}

/**
 * Computes line-by-line diff between two arrays of lines.
 */
export function diffLines(oldLines: string[], newLines: string[]): DiffLine[] {
  // Handle edge cases
  if (oldLines.length === 0 && newLines.length === 0) {
    return [];
  }

  if (oldLines.length === 0) {
    return newLines.map((content, i) => ({
      type: 'added' as DiffLineType,
      content,
      oldLineNumber: null,
      newLineNumber: i + 1,
    }));
  }

  if (newLines.length === 0) {
    return oldLines.map((content, i) => ({
      type: 'removed' as DiffLineType,
      content,
      oldLineNumber: i + 1,
      newLineNumber: null,
    }));
  }

  const matrix = computeLCS(oldLines, newLines);
  return backtrackDiff(matrix, oldLines, newLines);
}

// ============================================
// Section Diff
// ============================================

/**
 * Computes diff for a single section.
 */
export function diffSection(
  oldSection: TrustSection | null,
  newSection: TrustSection | null
): SectionDiff {
  // Section added
  if (oldSection === null && newSection !== null) {
    return {
      sectionId: newSection.id,
      title: newSection.title,
      added: true,
      removed: false,
      lines: newSection.lines.map((content, i) => ({
        type: 'added' as DiffLineType,
        content,
        oldLineNumber: null,
        newLineNumber: i + 1,
      })),
    };
  }

  // Section removed
  if (oldSection !== null && newSection === null) {
    return {
      sectionId: oldSection.id,
      title: oldSection.title,
      added: false,
      removed: true,
      lines: oldSection.lines.map((content, i) => ({
        type: 'removed' as DiffLineType,
        content,
        oldLineNumber: i + 1,
        newLineNumber: null,
      })),
    };
  }

  // Section modified (both exist)
  if (oldSection !== null && newSection !== null) {
    return {
      sectionId: newSection.id,
      title: newSection.title,
      added: false,
      removed: false,
      lines: diffLines(oldSection.lines, newSection.lines),
    };
  }

  // Should never happen
  throw new Error('Both sections cannot be null');
}

// ============================================
// Snapshot Diff
// ============================================

/**
 * Computes diff between two snapshots.
 */
export function diffSnapshots(
  oldSnapshot: TrustSnapshot,
  newSnapshot: TrustSnapshot
): SnapshotDiff {
  const sectionDiffs: SectionDiff[] = [];
  const processedOldSections = new Set<string>();

  // Process sections in new snapshot
  for (const newSection of newSnapshot.sections) {
    const oldSection = oldSnapshot.sections.find((s) => s.id === newSection.id);

    if (oldSection) {
      processedOldSections.add(oldSection.id);
    }

    sectionDiffs.push(diffSection(oldSection || null, newSection));
  }

  // Process sections only in old snapshot (removed)
  for (const oldSection of oldSnapshot.sections) {
    if (!processedOldSections.has(oldSection.id)) {
      sectionDiffs.push(diffSection(oldSection, null));
    }
  }

  // Compute stats
  let sectionsAdded = 0;
  let sectionsRemoved = 0;
  let sectionsModified = 0;
  let linesAdded = 0;
  let linesRemoved = 0;

  for (const section of sectionDiffs) {
    if (section.added) {
      sectionsAdded++;
    } else if (section.removed) {
      sectionsRemoved++;
    } else {
      const hasChanges = section.lines.some((l) => l.type !== 'unchanged');
      if (hasChanges) {
        sectionsModified++;
      }
    }

    for (const line of section.lines) {
      if (line.type === 'added') linesAdded++;
      if (line.type === 'removed') linesRemoved++;
    }
  }

  return {
    fromVersion: oldSnapshot.version,
    toVersion: newSnapshot.version,
    sections: sectionDiffs,
    stats: {
      sectionsAdded,
      sectionsRemoved,
      sectionsModified,
      linesAdded,
      linesRemoved,
    },
  };
}

/**
 * Gets diff for a version compared to its previous version.
 */
export function getDiffFromPrevious(version: TrustVersion): SnapshotDiff | null {
  const snapshot = getSnapshot(version);
  if (!snapshot) {
    return null;
  }

  const previousVersion = getPreviousVersion(version);
  if (!previousVersion) {
    // First version - show all as added
    const emptySnapshot: TrustSnapshot = {
      version: 'v0.0.0',
      released_at: '',
      status: 'retired',
      author: { name: '', role: 'Product' },
      summary: '',
      sections: [],
    };
    return diffSnapshots(emptySnapshot, snapshot);
  }

  const previousSnapshot = getSnapshot(previousVersion);
  if (!previousSnapshot) {
    return null;
  }

  return diffSnapshots(previousSnapshot, snapshot);
}

// ============================================
// Diff Formatting
// ============================================

/**
 * Formats a diff as unified diff text.
 */
export function formatUnifiedDiff(diff: SnapshotDiff): string {
  const lines: string[] = [];

  lines.push(`--- ${diff.fromVersion}`);
  lines.push(`+++ ${diff.toVersion}`);
  lines.push('');

  for (const section of diff.sections) {
    if (section.added) {
      lines.push(`+++ Section: ${section.title} [ADDED]`);
    } else if (section.removed) {
      lines.push(`--- Section: ${section.title} [REMOVED]`);
    } else {
      const hasChanges = section.lines.some((l) => l.type !== 'unchanged');
      if (hasChanges) {
        lines.push(`=== Section: ${section.title}`);
      } else {
        continue; // Skip unchanged sections
      }
    }

    lines.push('');

    for (const line of section.lines) {
      switch (line.type) {
        case 'added':
          lines.push(`+ ${line.content}`);
          break;
        case 'removed':
          lines.push(`- ${line.content}`);
          break;
        case 'unchanged':
          // Only show context around changes
          break;
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Formats a diff as simple change list.
 */
export function formatChangeList(diff: SnapshotDiff): string {
  const changes: string[] = [];

  for (const section of diff.sections) {
    if (section.added) {
      changes.push(`Added section: ${section.title}`);
    } else if (section.removed) {
      changes.push(`Removed section: ${section.title}`);
    } else {
      const added = section.lines.filter((l) => l.type === 'added').length;
      const removed = section.lines.filter((l) => l.type === 'removed').length;

      if (added > 0 || removed > 0) {
        const parts: string[] = [];
        if (added > 0) parts.push(`+${added} lines`);
        if (removed > 0) parts.push(`-${removed} lines`);
        changes.push(`Modified section: ${section.title} (${parts.join(', ')})`);
      }
    }
  }

  if (changes.length === 0) {
    return 'No changes';
  }

  return changes.join('\n');
}

/**
 * Formats a diff as HTML for display.
 */
export function formatDiffHTML(diff: SnapshotDiff): string {
  const lines: string[] = [];

  lines.push('<div class="trust-diff">');
  lines.push(`  <div class="diff-header">`);
  lines.push(`    <span class="old-version">${diff.fromVersion}</span>`);
  lines.push(`    <span class="arrow">→</span>`);
  lines.push(`    <span class="new-version">${diff.toVersion}</span>`);
  lines.push(`  </div>`);

  for (const section of diff.sections) {
    const hasChanges = section.lines.some((l) => l.type !== 'unchanged');

    if (!hasChanges && !section.added && !section.removed) {
      continue;
    }

    let sectionClass = 'diff-section';
    if (section.added) sectionClass += ' section-added';
    if (section.removed) sectionClass += ' section-removed';

    lines.push(`  <div class="${sectionClass}">`);
    lines.push(`    <div class="section-title">${escapeHTML(section.title)}</div>`);
    lines.push(`    <div class="section-lines">`);

    for (const line of section.lines) {
      if (line.type === 'unchanged') continue;

      const lineClass = line.type === 'added' ? 'line-added' : 'line-removed';
      const prefix = line.type === 'added' ? '+' : '-';

      lines.push(
        `      <div class="diff-line ${lineClass}">` +
        `<span class="prefix">${prefix}</span>` +
        `<span class="content">${escapeHTML(line.content)}</span>` +
        `</div>`
      );
    }

    lines.push(`    </div>`);
    lines.push(`  </div>`);
  }

  lines.push('</div>');

  return lines.join('\n');
}

/**
 * Escapes HTML special characters.
 */
function escapeHTML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================
// Diff Statistics
// ============================================

/**
 * Checks if a diff has any meaningful changes.
 */
export function hasChanges(diff: SnapshotDiff): boolean {
  return (
    diff.stats.sectionsAdded > 0 ||
    diff.stats.sectionsRemoved > 0 ||
    diff.stats.linesAdded > 0 ||
    diff.stats.linesRemoved > 0
  );
}

/**
 * Gets a summary of changes for display.
 */
export function getDiffSummary(diff: SnapshotDiff): string {
  const parts: string[] = [];

  if (diff.stats.sectionsAdded > 0) {
    parts.push(`${diff.stats.sectionsAdded} section(s) added`);
  }
  if (diff.stats.sectionsRemoved > 0) {
    parts.push(`${diff.stats.sectionsRemoved} section(s) removed`);
  }
  if (diff.stats.sectionsModified > 0) {
    parts.push(`${diff.stats.sectionsModified} section(s) modified`);
  }

  const netLines = diff.stats.linesAdded - diff.stats.linesRemoved;
  if (netLines > 0) {
    parts.push(`+${netLines} net lines`);
  } else if (netLines < 0) {
    parts.push(`${netLines} net lines`);
  }

  if (parts.length === 0) {
    return 'No changes';
  }

  return parts.join(', ');
}
