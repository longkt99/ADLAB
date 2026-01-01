// ============================================
// STEP 9: Intent Outcome Store Tests
// ============================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  put,
  get,
  update,
  updateAndDerive,
  listRecent,
  remove,
  cleanupExpired,
  clearAll,
  getStats,
} from './intentOutcomeStore';
import {
  createOutcome,
  appendSignal,
  deriveOutcome,
  OUTCOME_TTL_MS,
  type IntentOutcome,
} from './intentOutcome';

// ============================================
// Mock localStorage
// ============================================
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get _store() {
      return store;
    },
    _reset() {
      store = {};
      this.getItem.mockClear();
      this.setItem.mockClear();
      this.removeItem.mockClear();
    },
  };
})();

beforeEach(() => {
  vi.stubGlobal('window', {
    localStorage: localStorageMock,
  });
  localStorageMock._reset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ============================================
// put / get
// ============================================
describe('put / get', () => {
  it('should store and retrieve an outcome', () => {
    const outcome = createOutcome({
      intentId: 'test-1',
      routeUsed: 'CREATE',
      patternHash: 'abc123',
    });

    put(outcome);
    const retrieved = get('test-1');

    expect(retrieved).not.toBeNull();
    expect(retrieved?.intentId).toBe('test-1');
    expect(retrieved?.routeUsed).toBe('CREATE');
    expect(retrieved?.patternHash).toBe('abc123');
  });

  it('should return null for non-existent outcome', () => {
    expect(get('non-existent')).toBeNull();
  });

  it('should clean up and return null for expired outcome', () => {
    const outcome = createOutcome({
      intentId: 'expired-1',
      routeUsed: 'CREATE',
    });
    // Make it expired
    const expired: IntentOutcome = {
      ...outcome,
      createdAt: Date.now() - OUTCOME_TTL_MS - 1000,
    };

    // Directly store the expired outcome (bypass put which uses current time)
    const key = 'studio:intentOutcome:v1:expired-1';
    const encoded = JSON.stringify({ version: 1, outcome: expired });
    localStorageMock.setItem(key, encoded);

    expect(get('expired-1')).toBeNull();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(key);
  });

  it('should overwrite existing outcome with same ID', () => {
    const outcome1 = createOutcome({
      intentId: 'test-overwrite',
      routeUsed: 'CREATE',
    });
    put(outcome1);

    const outcome2 = createOutcome({
      intentId: 'test-overwrite',
      routeUsed: 'TRANSFORM',
    });
    put(outcome2);

    const retrieved = get('test-overwrite');
    expect(retrieved?.routeUsed).toBe('TRANSFORM');
  });
});

// ============================================
// update
// ============================================
describe('update', () => {
  it('should update an existing outcome', () => {
    const outcome = createOutcome({
      intentId: 'update-test',
      routeUsed: 'CREATE',
    });
    put(outcome);

    const updated = update('update-test', o =>
      appendSignal(o, { type: 'EDIT_AFTER' })
    );

    expect(updated).not.toBeNull();
    expect(updated?.signals).toHaveLength(1);
    expect(updated?.signals[0].type).toBe('EDIT_AFTER');

    // Verify persisted
    const retrieved = get('update-test');
    expect(retrieved?.signals).toHaveLength(1);
  });

  it('should return null for non-existent outcome', () => {
    const result = update('non-existent', o => o);
    expect(result).toBeNull();
  });
});

// ============================================
// updateAndDerive
// ============================================
describe('updateAndDerive', () => {
  it('should update and re-derive outcome', () => {
    const outcome = createOutcome({
      intentId: 'derive-test',
      routeUsed: 'CREATE',
    });
    put(outcome);

    const updated = updateAndDerive('derive-test', o =>
      appendSignal(o, { type: 'UNDO_WITHIN_WINDOW' })
    );

    expect(updated).not.toBeNull();
    expect(updated?.derived.negative).toBe(true);
    expect(updated?.derived.severity).toBe('high');
  });

  it('should return null for non-existent outcome', () => {
    const result = updateAndDerive('non-existent', o => o);
    expect(result).toBeNull();
  });
});

// ============================================
// listRecent
// ============================================
describe('listRecent', () => {
  it('should list outcomes in order (newest first)', () => {
    const outcome1 = createOutcome({
      intentId: 'list-1',
      routeUsed: 'CREATE',
    });
    const outcome2 = createOutcome({
      intentId: 'list-2',
      routeUsed: 'TRANSFORM',
    });
    const outcome3 = createOutcome({
      intentId: 'list-3',
      routeUsed: 'LOCAL_APPLY',
    });

    put(outcome1);
    put(outcome2);
    put(outcome3);

    const recent = listRecent(10);

    expect(recent).toHaveLength(3);
    expect(recent[0].intentId).toBe('list-3');
    expect(recent[1].intentId).toBe('list-2');
    expect(recent[2].intentId).toBe('list-1');
  });

  it('should respect limit', () => {
    put(createOutcome({ intentId: 'limit-1', routeUsed: 'CREATE' }));
    put(createOutcome({ intentId: 'limit-2', routeUsed: 'CREATE' }));
    put(createOutcome({ intentId: 'limit-3', routeUsed: 'CREATE' }));

    const recent = listRecent(2);
    expect(recent).toHaveLength(2);
  });

  it('should return empty array when no outcomes', () => {
    const recent = listRecent(10);
    expect(recent).toEqual([]);
  });
});

// ============================================
// remove
// ============================================
describe('remove', () => {
  it('should remove an outcome', () => {
    const outcome = createOutcome({
      intentId: 'remove-test',
      routeUsed: 'CREATE',
    });
    put(outcome);

    expect(get('remove-test')).not.toBeNull();

    remove('remove-test');

    expect(get('remove-test')).toBeNull();
  });

  it('should be safe to remove non-existent outcome', () => {
    expect(() => remove('non-existent')).not.toThrow();
  });
});

// ============================================
// cleanupExpired
// ============================================
describe('cleanupExpired', () => {
  it('should remove expired outcomes', () => {
    // Store a fresh outcome
    put(createOutcome({ intentId: 'fresh', routeUsed: 'CREATE' }));

    // Store an expired outcome directly
    const expired: IntentOutcome = {
      ...createOutcome({ intentId: 'old', routeUsed: 'CREATE' }),
      createdAt: Date.now() - OUTCOME_TTL_MS - 1000,
    };
    const key = 'studio:intentOutcome:v1:old';
    const encoded = JSON.stringify({ version: 1, outcome: expired });
    localStorageMock.setItem(key, encoded);

    // Add to index manually
    const indexKey = 'studio:intentOutcome:index:v1';
    const currentIndex = JSON.parse(
      localStorageMock.getItem(indexKey) || '{"version":1,"ids":[]}'
    );
    currentIndex.ids.push('old');
    localStorageMock.setItem(indexKey, JSON.stringify(currentIndex));

    const removed = cleanupExpired();

    expect(removed).toBe(1);
    expect(get('fresh')).not.toBeNull();
    expect(get('old')).toBeNull();
  });

  it('should return 0 when no expired outcomes', () => {
    put(createOutcome({ intentId: 'fresh-1', routeUsed: 'CREATE' }));
    put(createOutcome({ intentId: 'fresh-2', routeUsed: 'TRANSFORM' }));

    const removed = cleanupExpired();
    expect(removed).toBe(0);
  });
});

// ============================================
// clearAll
// ============================================
describe('clearAll', () => {
  it('should clear all outcomes', () => {
    put(createOutcome({ intentId: 'clear-1', routeUsed: 'CREATE' }));
    put(createOutcome({ intentId: 'clear-2', routeUsed: 'TRANSFORM' }));

    clearAll();

    expect(listRecent(10)).toEqual([]);
    expect(get('clear-1')).toBeNull();
    expect(get('clear-2')).toBeNull();
  });
});

// ============================================
// getStats
// ============================================
describe('getStats', () => {
  it('should return correct statistics', () => {
    // Create outcomes with different states
    let outcome1 = createOutcome({ intentId: 'stat-1', routeUsed: 'CREATE' });
    outcome1 = appendSignal(outcome1, { type: 'ACCEPT_SILENTLY' });
    outcome1 = deriveOutcome(outcome1);
    put(outcome1);

    let outcome2 = createOutcome({ intentId: 'stat-2', routeUsed: 'TRANSFORM' });
    outcome2 = appendSignal(outcome2, { type: 'UNDO_WITHIN_WINDOW' });
    outcome2 = deriveOutcome(outcome2);
    put(outcome2);

    let outcome3 = createOutcome({ intentId: 'stat-3', routeUsed: 'LOCAL_APPLY' });
    outcome3 = appendSignal(outcome3, { type: 'EDIT_AFTER' });
    outcome3 = deriveOutcome(outcome3);
    put(outcome3);

    const stats = getStats();

    expect(stats.total).toBe(3);
    expect(stats.accepted).toBe(1);
    expect(stats.negative).toBe(2); // UNDO + EDIT_AFTER
    expect(stats.highSeverity).toBe(1); // UNDO only
  });

  it('should return zeros for empty store', () => {
    const stats = getStats();

    expect(stats.total).toBe(0);
    expect(stats.accepted).toBe(0);
    expect(stats.negative).toBe(0);
    expect(stats.highSeverity).toBe(0);
  });
});

// ============================================
// Storage unavailable (SSR)
// ============================================
describe('storage unavailable', () => {
  beforeEach(() => {
    vi.stubGlobal('window', undefined);
  });

  it('should not throw on put', () => {
    const outcome = createOutcome({ intentId: 'ssr-test', routeUsed: 'CREATE' });
    expect(() => put(outcome)).not.toThrow();
  });

  it('should return null on get', () => {
    expect(get('ssr-test')).toBeNull();
  });

  it('should return null on update', () => {
    expect(update('ssr-test', o => o)).toBeNull();
  });

  it('should return empty array on listRecent', () => {
    expect(listRecent(10)).toEqual([]);
  });

  it('should not throw on remove', () => {
    expect(() => remove('ssr-test')).not.toThrow();
  });

  it('should return 0 on cleanupExpired', () => {
    expect(cleanupExpired()).toBe(0);
  });
});
