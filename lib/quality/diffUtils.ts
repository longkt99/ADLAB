// ============================================
// Minimal Diff Utility for Auto Fix Preview
// ============================================
// Simple word-level diff for comparing original vs refined content
// Vietnamese-friendly tokenization

/**
 * Diff token with change type
 */
export interface DiffToken {
  text: string;
  type: 'unchanged' | 'added' | 'removed';
}

/**
 * Diff result with summary stats
 */
export interface DiffResult {
  tokens: DiffToken[];
  stats: {
    added: number;
    removed: number;
    unchanged: number;
  };
}

/**
 * Tokenize text into words while preserving whitespace and newlines
 * Vietnamese-friendly: treats each space-separated token as a word
 */
function tokenize(text: string): string[] {
  // Split on word boundaries but keep whitespace/newlines as separate tokens
  const tokens: string[] = [];
  let current = '';

  for (const char of text) {
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      // Keep each whitespace char as its own token (to preserve formatting)
      tokens.push(char);
    } else {
      current += char;
    }
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Compute word-level diff between original and modified text
 * Uses a simple LCS-based approach suitable for short-to-medium content
 */
export function computeWordDiff(original: string, modified: string): DiffResult {
  const originalTokens = tokenize(original);
  const modifiedTokens = tokenize(modified);

  // Build LCS table
  const m = originalTokens.length;
  const n = modifiedTokens.length;

  // For very long content, use simpler line-based approach
  if (m * n > 1000000) {
    return computeLineDiff(original, modified);
  }

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (originalTokens[i - 1] === modifiedTokens[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find diff
  const result: DiffToken[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && originalTokens[i - 1] === modifiedTokens[j - 1]) {
      result.unshift({ text: originalTokens[i - 1], type: 'unchanged' });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ text: modifiedTokens[j - 1], type: 'added' });
      j--;
    } else {
      result.unshift({ text: originalTokens[i - 1], type: 'removed' });
      i--;
    }
  }

  // Compute stats
  const stats = {
    added: result.filter(t => t.type === 'added').length,
    removed: result.filter(t => t.type === 'removed').length,
    unchanged: result.filter(t => t.type === 'unchanged').length,
  };

  return { tokens: result, stats };
}

/**
 * Line-based diff for long content
 */
function computeLineDiff(original: string, modified: string): DiffResult {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');

  const result: DiffToken[] = [];
  const m = originalLines.length;
  const n = modifiedLines.length;

  // Simple line-by-line comparison with basic LCS
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (originalLines[i - 1] === modifiedLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && originalLines[i - 1] === modifiedLines[j - 1]) {
      if (result.length > 0) result.unshift({ text: '\n', type: 'unchanged' });
      result.unshift({ text: originalLines[i - 1], type: 'unchanged' });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      if (result.length > 0) result.unshift({ text: '\n', type: 'added' });
      result.unshift({ text: modifiedLines[j - 1], type: 'added' });
      j--;
    } else {
      if (result.length > 0) result.unshift({ text: '\n', type: 'removed' });
      result.unshift({ text: originalLines[i - 1], type: 'removed' });
      i--;
    }
  }

  const stats = {
    added: result.filter(t => t.type === 'added').length,
    removed: result.filter(t => t.type === 'removed').length,
    unchanged: result.filter(t => t.type === 'unchanged').length,
  };

  return { tokens: result, stats };
}

/**
 * Merge consecutive tokens of the same type for cleaner display
 */
export function mergeConsecutiveTokens(tokens: DiffToken[]): DiffToken[] {
  if (tokens.length === 0) return [];

  const merged: DiffToken[] = [];
  let current: DiffToken = { ...tokens[0] };

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === current.type) {
      current.text += token.text;
    } else {
      merged.push(current);
      current = { ...token };
    }
  }

  merged.push(current);
  return merged;
}

/**
 * Get only changed tokens (filter out unchanged, optionally with context)
 */
export function getChangedTokensWithContext(
  tokens: DiffToken[],
  contextSize: number = 2
): DiffToken[] {
  const result: DiffToken[] = [];
  const changedIndices = new Set<number>();

  // Mark changed indices and their context
  tokens.forEach((token, i) => {
    if (token.type !== 'unchanged') {
      for (let j = Math.max(0, i - contextSize); j <= Math.min(tokens.length - 1, i + contextSize); j++) {
        changedIndices.add(j);
      }
    }
  });

  // Build result with ellipsis for gaps
  let lastIncluded = -1;

  changedIndices.forEach(i => {
    if (lastIncluded !== -1 && i > lastIncluded + 1) {
      // Add ellipsis for gap
      result.push({ text: ' ... ', type: 'unchanged' });
    }
    result.push(tokens[i]);
    lastIncluded = i;
  });

  return result;
}
