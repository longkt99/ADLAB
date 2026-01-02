// ============================================
// Tests for Intent Snapshot
// ============================================
// STEP 3: Verify snapshot creation, immutability,
// and chain preservation across transforms.
//
// CRITICAL: These tests verify OBSERVABILITY ONLY.
// No execution logic should be tested here.
// ============================================

import { describe, it, expect } from 'vitest';
import { createIntentSnapshot, type IntentSnapshot, type ChatMessage } from '../../types/studio';
import {
  createTransformSnapshot,
  createCreateSnapshot,
  getMessageSnapshot,
  hasIntentSnapshot,
  validateSnapshot,
  formatSnapshotForDebug,
} from './intentSnapshot';

// ============================================
// SNAPSHOT CREATION TESTS
// ============================================

describe('createIntentSnapshot', () => {
  it('should create a valid snapshot with all required fields', () => {
    const snapshot = createIntentSnapshot({
      userTypedText: 'viết lại giọng tự nhiên hơn',
      detectedMode: 'DIRECTED_TRANSFORM',
      detectedActions: ['REWRITE'],
      sourceMessageId: 'msg-123',
      turnIndex: 2,
    });

    expect(snapshot.userTypedText).toBe('viết lại giọng tự nhiên hơn');
    expect(snapshot.detectedMode).toBe('DIRECTED_TRANSFORM');
    expect(snapshot.detectedActions).toEqual(['REWRITE']);
    expect(snapshot.sourceMessageId).toBe('msg-123');
    expect(snapshot.turnIndex).toBe(2);
    expect(snapshot.snapshotId).toMatch(/^snapshot-\d+-/);
    expect(snapshot.createdAt).toBeGreaterThan(0);
    expect(snapshot.originSnapshotId).toBeNull();
  });

  it('should preserve originSnapshotId when provided', () => {
    const snapshot = createIntentSnapshot({
      userTypedText: 'rút gọn còn 50 từ',
      detectedMode: 'DIRECTED_TRANSFORM',
      detectedActions: ['SHORTEN'],
      sourceMessageId: 'msg-456',
      turnIndex: 3,
      originSnapshotId: 'snapshot-original-123',
    });

    expect(snapshot.originSnapshotId).toBe('snapshot-original-123');
  });

  it('should generate unique snapshotIds', () => {
    const snapshot1 = createIntentSnapshot({
      userTypedText: 'test1',
      detectedMode: 'CREATE',
      detectedActions: [],
      sourceMessageId: null,
      turnIndex: 0,
    });

    const snapshot2 = createIntentSnapshot({
      userTypedText: 'test2',
      detectedMode: 'CREATE',
      detectedActions: [],
      sourceMessageId: null,
      turnIndex: 1,
    });

    expect(snapshot1.snapshotId).not.toBe(snapshot2.snapshotId);
  });
});

// ============================================
// SNAPSHOT IMMUTABILITY TESTS
// ============================================

describe('Snapshot Immutability', () => {
  it('should be frozen (immutable)', () => {
    const snapshot = createIntentSnapshot({
      userTypedText: 'viết lại',
      detectedMode: 'PURE_TRANSFORM',
      detectedActions: ['REWRITE'],
      sourceMessageId: 'msg-123',
      turnIndex: 1,
    });

    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('should have frozen detectedActions array', () => {
    const snapshot = createIntentSnapshot({
      userTypedText: 'viết lại',
      detectedMode: 'PURE_TRANSFORM',
      detectedActions: ['REWRITE', 'OPTIMIZE'],
      sourceMessageId: 'msg-123',
      turnIndex: 1,
    });

    expect(Object.isFrozen(snapshot.detectedActions)).toBe(true);
  });

  it('should not allow mutation of userTypedText', () => {
    const snapshot = createIntentSnapshot({
      userTypedText: 'original text',
      detectedMode: 'CREATE',
      detectedActions: [],
      sourceMessageId: null,
      turnIndex: 0,
    });

    // Attempt to mutate should fail silently or throw in strict mode
    expect(() => {
      (snapshot as any).userTypedText = 'mutated text';
    }).toThrow();
  });
});

// ============================================
// HELPER FUNCTION TESTS
// ============================================

describe('createTransformSnapshot', () => {
  it('should create a TRANSFORM snapshot with correct mode', () => {
    const snapshot = createTransformSnapshot({
      userTypedText: 'viết lại giọng tự nhiên hơn',
      transformMode: 'DIRECTED_TRANSFORM',
      actionType: 'REWRITE',
      sourceMessageId: 'msg-123',
      turnIndex: 2,
    });

    expect(snapshot.detectedMode).toBe('DIRECTED_TRANSFORM');
    expect(snapshot.detectedActions).toContain('REWRITE');
    expect(snapshot.sourceMessageId).toBe('msg-123');
  });

  it('should preserve origin chain when previousSnapshot provided', () => {
    const originalSnapshot = createIntentSnapshot({
      userTypedText: 'original',
      detectedMode: 'CREATE',
      detectedActions: ['CREATE_CONTENT'],
      sourceMessageId: null,
      turnIndex: 0,
    });

    const chainedSnapshot = createTransformSnapshot({
      userTypedText: 'viết lại',
      transformMode: 'PURE_TRANSFORM',
      actionType: 'REWRITE',
      sourceMessageId: 'msg-123',
      turnIndex: 1,
      previousSnapshot: originalSnapshot,
    });

    expect(chainedSnapshot.originSnapshotId).toBe(originalSnapshot.snapshotId);
  });

  it('should use originSnapshotId from previousSnapshot if available', () => {
    // First transform in chain
    const firstSnapshot = createIntentSnapshot({
      userTypedText: 'viết lại',
      detectedMode: 'PURE_TRANSFORM',
      detectedActions: ['REWRITE'],
      sourceMessageId: 'msg-123',
      turnIndex: 1,
      originSnapshotId: 'snapshot-origin-abc',
    });

    // Second transform in chain
    const secondSnapshot = createTransformSnapshot({
      userTypedText: 'rút gọn',
      transformMode: 'PURE_TRANSFORM',
      actionType: 'SHORTEN',
      sourceMessageId: 'msg-456',
      turnIndex: 2,
      previousSnapshot: firstSnapshot,
    });

    // Should preserve the ORIGINAL origin, not the first snapshot's ID
    expect(secondSnapshot.originSnapshotId).toBe('snapshot-origin-abc');
  });
});

describe('createCreateSnapshot', () => {
  it('should create a CREATE snapshot', () => {
    const snapshot = createCreateSnapshot({
      userTypedText: 'Viết bài về MIK Ocean City',
      turnIndex: 0,
    });

    expect(snapshot.detectedMode).toBe('CREATE');
    expect(snapshot.detectedActions).toContain('CREATE_CONTENT');
    expect(snapshot.sourceMessageId).toBeNull();
    expect(snapshot.originSnapshotId).toBeNull();
  });
});

// ============================================
// MESSAGE SNAPSHOT EXTRACTION TESTS
// ============================================

describe('getMessageSnapshot', () => {
  it('should return snapshot from message meta', () => {
    const testSnapshot = createIntentSnapshot({
      userTypedText: 'test',
      detectedMode: 'CREATE',
      detectedActions: [],
      sourceMessageId: null,
      turnIndex: 0,
    });

    const message: ChatMessage = {
      id: 'msg-1',
      role: 'user',
      content: 'test',
      timestamp: new Date(),
      meta: {
        intentSnapshot: testSnapshot,
      },
    };

    expect(getMessageSnapshot(message)).toBe(testSnapshot);
  });

  it('should return null if no snapshot', () => {
    const message: ChatMessage = {
      id: 'msg-1',
      role: 'user',
      content: 'test',
      timestamp: new Date(),
    };

    expect(getMessageSnapshot(message)).toBeNull();
  });
});

describe('hasIntentSnapshot', () => {
  it('should return true if message has snapshot', () => {
    const message: ChatMessage = {
      id: 'msg-1',
      role: 'user',
      content: 'test',
      timestamp: new Date(),
      meta: {
        intentSnapshot: createIntentSnapshot({
          userTypedText: 'test',
          detectedMode: 'CREATE',
          detectedActions: [],
          sourceMessageId: null,
          turnIndex: 0,
        }),
      },
    };

    expect(hasIntentSnapshot(message)).toBe(true);
  });

  it('should return false if no snapshot', () => {
    const message: ChatMessage = {
      id: 'msg-1',
      role: 'user',
      content: 'test',
      timestamp: new Date(),
    };

    expect(hasIntentSnapshot(message)).toBe(false);
  });
});

// ============================================
// CHAIN PRESERVATION TESTS (MULTI-TRANSFORM)
// ============================================

describe('Snapshot Chain Preservation', () => {
  it('should maintain same origin across 3+ transforms', () => {
    // CREATE: Original content
    const createSnapshot = createCreateSnapshot({
      userTypedText: 'Viết bài về MIK',
      turnIndex: 0,
    });

    // TRANSFORM 1
    const transform1 = createTransformSnapshot({
      userTypedText: 'viết lại giọng tự nhiên hơn',
      transformMode: 'DIRECTED_TRANSFORM',
      actionType: 'REWRITE',
      sourceMessageId: 'msg-1',
      turnIndex: 1,
      previousSnapshot: createSnapshot,
    });

    // TRANSFORM 2
    const transform2 = createTransformSnapshot({
      userTypedText: 'rút gọn còn 100 từ',
      transformMode: 'DIRECTED_TRANSFORM',
      actionType: 'SHORTEN',
      sourceMessageId: 'msg-2',
      turnIndex: 2,
      previousSnapshot: transform1,
    });

    // TRANSFORM 3
    const transform3 = createTransformSnapshot({
      userTypedText: 'thêm CTA',
      transformMode: 'DIRECTED_TRANSFORM',
      actionType: 'EXPAND',
      sourceMessageId: 'msg-3',
      turnIndex: 3,
      previousSnapshot: transform2,
    });

    // All should point to the CREATE snapshot as origin
    expect(transform1.originSnapshotId).toBe(createSnapshot.snapshotId);
    expect(transform2.originSnapshotId).toBe(createSnapshot.snapshotId);
    expect(transform3.originSnapshotId).toBe(createSnapshot.snapshotId);
  });

  it('should preserve userTypedText exactly through chain', () => {
    const instructions = [
      'viết lại giọng tự nhiên hơn',
      'rút gọn còn 100 từ',
      'thêm CTA kêu gọi liên hệ',
    ];

    const snapshots: IntentSnapshot[] = [];

    // Create chain
    let previousSnapshot: IntentSnapshot | undefined;
    instructions.forEach((text, i) => {
      const snapshot = createTransformSnapshot({
        userTypedText: text,
        transformMode: 'DIRECTED_TRANSFORM',
        actionType: 'REWRITE',
        sourceMessageId: `msg-${i}`,
        turnIndex: i + 1,
        previousSnapshot,
      });
      snapshots.push(snapshot);
      previousSnapshot = snapshot;
    });

    // Verify each snapshot preserves exact userTypedText
    instructions.forEach((text, i) => {
      expect(snapshots[i].userTypedText).toBe(text);
    });
  });
});

// ============================================
// VALIDATION TESTS
// ============================================

describe('validateSnapshot', () => {
  it('should return valid for correct snapshot', () => {
    const snapshot = createIntentSnapshot({
      userTypedText: 'viết lại',
      detectedMode: 'PURE_TRANSFORM',
      detectedActions: ['REWRITE'],
      sourceMessageId: 'msg-123',
      turnIndex: 1,
    });

    const result = validateSnapshot(snapshot);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('should warn for empty userTypedText', () => {
    const snapshot = createIntentSnapshot({
      userTypedText: '',
      detectedMode: 'PURE_TRANSFORM',
      detectedActions: ['REWRITE'],
      sourceMessageId: 'msg-123',
      turnIndex: 1,
    });

    const result = validateSnapshot(snapshot);
    expect(result.valid).toBe(false);
    expect(result.warnings).toContain('userTypedText is empty');
  });

  it('should warn for transform without sourceMessageId', () => {
    const snapshot = createIntentSnapshot({
      userTypedText: 'viết lại',
      detectedMode: 'PURE_TRANSFORM',
      detectedActions: ['REWRITE'],
      sourceMessageId: null,
      turnIndex: 1,
    });

    const result = validateSnapshot(snapshot);
    expect(result.valid).toBe(false);
    expect(result.warnings).toContain('sourceMessageId missing for transform');
  });

  it('should warn for CREATE with sourceMessageId', () => {
    const snapshot = createIntentSnapshot({
      userTypedText: 'viết bài mới',
      detectedMode: 'CREATE',
      detectedActions: ['CREATE_CONTENT'],
      sourceMessageId: 'msg-123',
      turnIndex: 0,
    });

    const result = validateSnapshot(snapshot);
    expect(result.valid).toBe(false);
    expect(result.warnings).toContain('sourceMessageId should be null for CREATE');
  });
});

// ============================================
// NO EXECUTION LOGIC TESTS
// ============================================

describe('Snapshot does NOT affect execution', () => {
  it('snapshot data should be purely observational', () => {
    const snapshot = createIntentSnapshot({
      userTypedText: 'viết lại giọng tự nhiên hơn',
      detectedMode: 'DIRECTED_TRANSFORM',
      detectedActions: ['REWRITE'],
      sourceMessageId: 'msg-123',
      turnIndex: 1,
    });

    // Snapshot should have no methods that could affect state
    expect(typeof snapshot.userTypedText).toBe('string');
    expect(typeof snapshot.detectedMode).toBe('string');
    expect(Array.isArray(snapshot.detectedActions)).toBe(true);
    expect(typeof snapshot.snapshotId).toBe('string');
    expect(typeof snapshot.createdAt).toBe('number');

    // No functions on the snapshot
    const keys = Object.keys(snapshot);
    keys.forEach(key => {
      expect(typeof (snapshot as any)[key]).not.toBe('function');
    });
  });
});

// ============================================
// DEBUG FORMATTING TESTS
// ============================================

describe('formatSnapshotForDebug', () => {
  it('should return null for null snapshot', () => {
    expect(formatSnapshotForDebug(null)).toBeNull();
  });

  // Note: In production, formatSnapshotForDebug returns null
  // This test verifies DEV behavior
  it('should format snapshot for display in DEV', () => {
    // This test only runs in dev mode
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    const snapshot = createIntentSnapshot({
      userTypedText: 'viết lại giọng tự nhiên hơn',
      detectedMode: 'DIRECTED_TRANSFORM',
      detectedActions: ['REWRITE'],
      sourceMessageId: 'msg-123',
      turnIndex: 1,
    });

    const formatted = formatSnapshotForDebug(snapshot);
    expect(formatted).not.toBeNull();
    expect(formatted).toHaveProperty('mode');
    expect(formatted).toHaveProperty('actions');
    expect(formatted).toHaveProperty('turn');
  });
});
