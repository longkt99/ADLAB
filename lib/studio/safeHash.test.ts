// ============================================
// STEP 18: Safe Hash Utility Tests
// ============================================

import { describe, it, expect } from 'vitest';
import {
  safeHash,
  safeHashMultiple,
  generateEventId,
  createRequestBinding,
  validateBinding,
} from './safeHash';

// ============================================
// safeHash Tests
// ============================================
describe('safeHash', () => {
  it('should return deterministic hash for same input', () => {
    const input = 'Hello, World!';
    const hash1 = safeHash(input);
    const hash2 = safeHash(input);

    expect(hash1).toBe(hash2);
  });

  it('should return different hashes for different inputs', () => {
    const hash1 = safeHash('Input A');
    const hash2 = safeHash('Input B');

    expect(hash1).not.toBe(hash2);
  });

  it('should return "0" for empty string', () => {
    expect(safeHash('')).toBe('0');
  });

  it('should return base36 string', () => {
    const hash = safeHash('Test input');
    // Base36 uses 0-9 and a-z
    expect(hash).toMatch(/^[0-9a-z]+$/);
  });

  it('should handle Unicode characters', () => {
    const hash1 = safeHash('Xin chào thế giới');
    const hash2 = safeHash('Xin chào thế giới');

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBeGreaterThan(0);
  });

  it('should handle long strings', () => {
    const longString = 'a'.repeat(10000);
    const hash = safeHash(longString);

    expect(hash.length).toBeLessThan(15); // Should be compact
    expect(hash.length).toBeGreaterThan(0);
  });

  it('should be case sensitive', () => {
    const hashLower = safeHash('hello');
    const hashUpper = safeHash('HELLO');

    expect(hashLower).not.toBe(hashUpper);
  });
});

// ============================================
// safeHashMultiple Tests
// ============================================
describe('safeHashMultiple', () => {
  it('should return deterministic hash for same inputs', () => {
    const inputs = ['one', 'two', 'three'];
    const hash1 = safeHashMultiple(inputs);
    const hash2 = safeHashMultiple(inputs);

    expect(hash1).toBe(hash2);
  });

  it('should return different hash for different order', () => {
    const hash1 = safeHashMultiple(['a', 'b']);
    const hash2 = safeHashMultiple(['b', 'a']);

    expect(hash1).not.toBe(hash2);
  });

  it('should return different hash for different inputs', () => {
    const hash1 = safeHashMultiple(['a', 'b']);
    const hash2 = safeHashMultiple(['a', 'c']);

    expect(hash1).not.toBe(hash2);
  });

  it('should handle empty array', () => {
    const hash = safeHashMultiple([]);

    expect(hash).toBe('0'); // Empty combined string
  });
});

// ============================================
// generateEventId Tests
// ============================================
describe('generateEventId', () => {
  it('should return string starting with evt_', () => {
    const eventId = generateEventId();

    expect(eventId).toMatch(/^evt_\d+_[a-z0-9]+$/);
  });

  it('should generate unique IDs', () => {
    const ids = new Set<string>();

    for (let i = 0; i < 100; i++) {
      ids.add(generateEventId());
    }

    expect(ids.size).toBe(100);
  });

  it('should include timestamp', () => {
    const before = Date.now();
    const eventId = generateEventId();
    const after = Date.now();

    const timestampPart = eventId.split('_')[1];
    const timestamp = parseInt(timestampPart, 10);

    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });
});

// ============================================
// createRequestBinding Tests
// ============================================
describe('createRequestBinding', () => {
  it('should create binding with all required fields', () => {
    const userPrompt = 'Test prompt';
    const binding = createRequestBinding(userPrompt);

    expect(binding.eventId).toMatch(/^evt_/);
    expect(binding.uiSendAt).toBeGreaterThan(0);
    expect(binding.uiInputHash).toBe(safeHash(userPrompt));
    expect(binding.uiInputLength).toBe(userPrompt.length);
  });

  it('should create consistent hash for same input', () => {
    const userPrompt = 'Test prompt';
    const binding1 = createRequestBinding(userPrompt);
    const binding2 = createRequestBinding(userPrompt);

    expect(binding1.uiInputHash).toBe(binding2.uiInputHash);
    expect(binding1.uiInputLength).toBe(binding2.uiInputLength);
  });

  it('should create unique eventIds', () => {
    const binding1 = createRequestBinding('Test');
    const binding2 = createRequestBinding('Test');

    expect(binding1.eventId).not.toBe(binding2.eventId);
  });
});

// ============================================
// validateBinding Tests
// ============================================
describe('validateBinding', () => {
  it('should return true for matching binding', () => {
    const userPrompt = 'Test prompt';
    const binding = createRequestBinding(userPrompt);

    expect(validateBinding(userPrompt, binding)).toBe(true);
  });

  it('should return false for different content', () => {
    const binding = createRequestBinding('Original prompt');

    expect(validateBinding('Different prompt', binding)).toBe(false);
  });

  it('should return false for length mismatch', () => {
    const userPrompt = 'Test prompt';
    const binding = {
      uiInputHash: safeHash(userPrompt),
      uiInputLength: 999, // Wrong length
    };

    expect(validateBinding(userPrompt, binding)).toBe(false);
  });

  it('should return false for hash mismatch', () => {
    const userPrompt = 'Test prompt';
    const binding = {
      uiInputHash: 'wronghash',
      uiInputLength: userPrompt.length,
    };

    expect(validateBinding(userPrompt, binding)).toBe(false);
  });

  it('should handle empty string', () => {
    const binding = createRequestBinding('');

    expect(validateBinding('', binding)).toBe(true);
    expect(validateBinding('not empty', binding)).toBe(false);
  });
});
