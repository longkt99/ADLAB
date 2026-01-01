// ============================================
// Intent Summary Derivation
// ============================================
// STEP 4: UX Enhancement Layer
//
// This module derives user-facing intent summaries
// from IntentSnapshots for display purposes ONLY.
//
// CRITICAL: This code is PRESENTATION ONLY.
// It MUST NOT affect execution logic in any way.
// ============================================

import type { IntentSnapshot, IntentSummary, IntentMode } from '@/types/studio';

// ============================================
// DEV-ONLY FLAG
// ============================================
const IS_DEV = process.env.NODE_ENV === 'development';

// ============================================
// Action Label Mappings (Vietnamese)
// ============================================
// Maps internal action types to user-friendly Vietnamese labels

const ACTION_LABELS: Record<string, string> = {
  REWRITE: 'Viết lại',
  SHORTEN: 'Rút gọn',
  EXPAND: 'Mở rộng',
  CREATE_CONTENT: 'Tạo nội dung',
  OPTIMIZE: 'Tối ưu',
  TRANSLATE: 'Dịch',
  SUMMARIZE: 'Tóm tắt',
  EXPLAIN: 'Giải thích',
};

// ============================================
// Modifier Extraction Patterns
// ============================================
// Patterns to extract modifiers from userTypedText
// These are for DISPLAY only - no NLP reprocessing

const MODIFIER_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // Tone modifiers
  { pattern: /giọng\s+(?:văn\s+)?tự nhiên/i, label: 'Giọng tự nhiên' },
  { pattern: /giọng\s+(?:văn\s+)?chuyên nghiệp/i, label: 'Giọng chuyên nghiệp' },
  { pattern: /giọng\s+(?:văn\s+)?thân thiện/i, label: 'Giọng thân thiện' },
  { pattern: /giọng\s+(?:văn\s+)?gen\s*z/i, label: 'Giọng Gen Z' },
  { pattern: /giọng\s+(?:văn\s+)?hài hước/i, label: 'Giọng hài hước' },
  { pattern: /giọng\s+(?:văn\s+)?trang trọng/i, label: 'Giọng trang trọng' },

  // Length modifiers
  { pattern: /ngắn\s+(?:gọn\s+)?hơn/i, label: 'Ngắn hơn' },
  { pattern: /dài\s+hơn/i, label: 'Dài hơn' },
  { pattern: /súc\s+tích/i, label: 'Súc tích' },
  { pattern: /còn\s+(\d+)\s+từ/i, label: 'Giới hạn từ' },

  // Style modifiers
  { pattern: /theo\s+phong\s+cách/i, label: 'Theo phong cách' },
  { pattern: /đổi\s+cách\s+diễn\s+đạt/i, label: 'Đổi cách diễn đạt' },
  { pattern: /giữ\s+nguyên\s+ý/i, label: 'Giữ nguyên ý' },
];

const EXTRA_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // Add directives
  { pattern: /thêm\s+(?:phần\s+)?cta/i, label: 'Thêm CTA' },
  { pattern: /thêm\s+(?:phần\s+)?hotline/i, label: 'Thêm hotline' },
  { pattern: /thêm\s+(?:số\s+)?(?:điện\s+thoại|sđt)/i, label: 'Thêm SĐT' },
  { pattern: /thêm\s+(?:phần\s+)?chi\s+tiết/i, label: 'Thêm chi tiết' },
  { pattern: /thêm\s+(?:phần\s+)?giá/i, label: 'Thêm giá' },
  { pattern: /thêm\s+emoji/i, label: 'Thêm emoji' },
  { pattern: /thêm\s+hashtag/i, label: 'Thêm hashtag' },

  // Keep directives
  { pattern: /giữ\s+(?:nguyên\s+)?cta/i, label: 'Giữ CTA' },
  { pattern: /giữ\s+(?:nguyên\s+)?hashtag/i, label: 'Giữ hashtag' },
  { pattern: /giữ\s+(?:nguyên\s+)?giọng\s+(?:văn\s+)?thương\s+hiệu/i, label: 'Giữ giọng thương hiệu' },
  { pattern: /giữ\s+(?:nguyên\s+)?hook/i, label: 'Giữ hook' },

  // Emphasis
  { pattern: /nhấn\s+mạnh\s+(?:vào\s+)?lợi\s+ích/i, label: 'Nhấn mạnh lợi ích' },
  { pattern: /nhấn\s+mạnh\s+(?:vào\s+)?ưu\s+đãi/i, label: 'Nhấn mạnh ưu đãi' },
];

// ============================================
// Core Derivation Function
// ============================================

/**
 * Derive an IntentSummary from an IntentSnapshot
 *
 * INVARIANTS:
 * 1. Derived ONLY from snapshot data (no external lookups)
 * 2. Deterministic (same snapshot = same summary)
 * 3. Never throws (returns incomplete summary on failure)
 * 4. Never affects execution
 *
 * @param snapshot - The IntentSnapshot to derive from
 * @returns IntentSummary for display purposes
 */
export function deriveIntentSummary(snapshot: IntentSnapshot | null | undefined): IntentSummary {
  // Handle null/undefined gracefully
  if (!snapshot) {
    return createEmptySummary();
  }

  try {
    // Extract primary action from detectedActions
    const primaryAction = derivePrimaryAction(snapshot);

    // Extract modifiers from userTypedText
    const modifiers = deriveModifiers(snapshot.userTypedText);

    // Extract extras from userTypedText
    const extras = deriveExtras(snapshot.userTypedText);

    // Check completeness
    const isComplete = !!primaryAction && primaryAction !== 'Không xác định';

    return Object.freeze({
      primaryAction,
      modifiers: Object.freeze(modifiers),
      extras: Object.freeze(extras),
      displayMode: snapshot.detectedMode,
      isComplete,
    });
  } catch (error) {
    // DEV warning only
    if (IS_DEV) {
      console.warn('[IntentSummary:DERIVATION_ERROR]', {
        snapshotId: snapshot.snapshotId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    return createEmptySummary(snapshot.detectedMode);
  }
}

/**
 * Create an empty/fallback summary
 */
function createEmptySummary(mode: IntentMode = 'CREATE'): IntentSummary {
  return Object.freeze({
    primaryAction: 'Không xác định',
    modifiers: Object.freeze([]),
    extras: Object.freeze([]),
    displayMode: mode,
    isComplete: false,
  });
}

/**
 * Derive primary action from snapshot
 */
function derivePrimaryAction(snapshot: IntentSnapshot): string {
  // Use first detected action
  const firstAction = snapshot.detectedActions[0];

  if (!firstAction) {
    // For CREATE mode without explicit action
    if (snapshot.detectedMode === 'CREATE') {
      return 'Tạo nội dung';
    }
    return 'Không xác định';
  }

  // Map to Vietnamese label
  return ACTION_LABELS[firstAction] || firstAction;
}

/**
 * Derive modifiers from user text (pattern matching only)
 */
function deriveModifiers(userText: string): string[] {
  const modifiers: string[] = [];
  const normalizedText = userText.toLowerCase();

  for (const { pattern, label } of MODIFIER_PATTERNS) {
    if (pattern.test(normalizedText)) {
      modifiers.push(label);
    }
  }

  return modifiers;
}

/**
 * Derive extras from user text (pattern matching only)
 */
function deriveExtras(userText: string): string[] {
  const extras: string[] = [];
  const normalizedText = userText.toLowerCase();

  for (const { pattern, label } of EXTRA_PATTERNS) {
    if (pattern.test(normalizedText)) {
      extras.push(label);
    }
  }

  return extras;
}

// ============================================
// Display Formatting
// ============================================

/**
 * Format summary for compact display
 * e.g., "Đã hiểu: Viết lại · Giọng chuyên nghiệp · Thêm hotline"
 */
export function formatSummaryForDisplay(summary: IntentSummary): string {
  const parts: string[] = [summary.primaryAction];

  // Add modifiers
  parts.push(...summary.modifiers);

  // Add extras
  parts.push(...summary.extras);

  return parts.join(' · ');
}

/**
 * Format summary with prefix for different states
 */
export function formatSummaryWithPrefix(
  summary: IntentSummary,
  state: 'understanding' | 'processing' | 'completed'
): string {
  const content = formatSummaryForDisplay(summary);

  switch (state) {
    case 'understanding':
      return `Đã hiểu: ${content}`;
    case 'processing':
      return `Đang xử lý: ${content}`;
    case 'completed':
      return `Hoàn thành: ${content}`;
    default:
      return content;
  }
}

// ============================================
// Guardrail Warnings (DEV-ONLY)
// ============================================

/**
 * Warn if summary cannot be fully derived
 * DEV-ONLY: Never throws, never blocks execution
 */
export function warnIfSummaryIncomplete(
  summary: IntentSummary,
  snapshot: IntentSnapshot,
  context: string
): void {
  if (!IS_DEV) return;

  if (!summary.isComplete) {
    console.warn(
      `[IntentSummary:GUARDRAIL] Summary is incomplete`,
      {
        context,
        snapshotId: snapshot.snapshotId,
        primaryAction: summary.primaryAction,
        modifiersCount: summary.modifiers.length,
        extrasCount: summary.extras.length,
      }
    );
  }
}

/**
 * Warn if snapshot has conflicting actions
 * DEV-ONLY: Never throws, never blocks execution
 */
export function warnIfConflictingActions(
  snapshot: IntentSnapshot,
  context: string
): void {
  if (!IS_DEV) return;

  const actions = snapshot.detectedActions;

  // Check for conflicting pairs
  const conflicts: Array<[string, string]> = [
    ['SHORTEN', 'EXPAND'],
    ['SUMMARIZE', 'EXPAND'],
  ];

  for (const [a, b] of conflicts) {
    if (actions.includes(a) && actions.includes(b)) {
      console.warn(
        `[IntentSummary:GUARDRAIL] Conflicting actions detected`,
        {
          context,
          snapshotId: snapshot.snapshotId,
          conflictingPair: [a, b],
          allActions: actions,
        }
      );
    }
  }
}

/**
 * Warn if summary changes mid-chain
 * DEV-ONLY: Never throws, never blocks execution
 */
export function warnIfSummaryChangedInChain(
  currentSummary: IntentSummary,
  previousSummary: IntentSummary | undefined,
  context: string
): void {
  if (!IS_DEV) return;
  if (!previousSummary) return;

  // Summary should be stable for same action type
  if (currentSummary.primaryAction !== previousSummary.primaryAction) {
    // Only warn if both are transforms (CREATE → TRANSFORM change is expected)
    const bothTransforms =
      previousSummary.displayMode !== 'CREATE' &&
      currentSummary.displayMode !== 'CREATE';

    if (bothTransforms) {
      console.warn(
        `[IntentSummary:GUARDRAIL] Summary changed mid-chain`,
        {
          context,
          previousAction: previousSummary.primaryAction,
          currentAction: currentSummary.primaryAction,
        }
      );
    }
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Check if a summary has any meaningful content
 */
export function hasMeaningfulSummary(summary: IntentSummary): boolean {
  return (
    summary.isComplete ||
    summary.modifiers.length > 0 ||
    summary.extras.length > 0
  );
}

/**
 * Get the total number of intent parts (for UI sizing)
 */
export function getSummaryPartCount(summary: IntentSummary): number {
  return 1 + summary.modifiers.length + summary.extras.length;
}
