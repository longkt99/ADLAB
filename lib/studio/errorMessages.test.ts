// ============================================
// Error Messages Tests
// ============================================
// Tests for user-facing AI error message mapping.
// Verifies VN/EN messages for known reason codes.
// ============================================

import { describe, it, expect } from 'vitest';
import {
  getUserFacingAiError,
  isKnownReasonCode,
  type AiReasonCode,
} from './errorMessages';

// ============================================
// Test: getUserFacingAiError
// ============================================

describe('getUserFacingAiError', () => {
  it('should return Vietnamese message for known reason code', () => {
    const msg = getUserFacingAiError({
      lang: 'vi',
      reasonCode: 'REWRITE_NO_CONTEXT',
    });
    expect(msg).toBe('Bạn muốn viết lại bài nào? Hãy chọn một bài/draft trước.');
  });

  it('should return English message for known reason code', () => {
    const msg = getUserFacingAiError({
      lang: 'en',
      reasonCode: 'REWRITE_NO_CONTEXT',
    });
    expect(msg).toBe('Which post do you want to rewrite? Please select a draft first.');
  });

  it('should return fallback for unknown reason code', () => {
    const msg = getUserFacingAiError({
      lang: 'vi',
      reasonCode: 'SOME_UNKNOWN_CODE',
      fallback: 'Custom fallback message',
    });
    expect(msg).toBe('Custom fallback message');
  });

  it('should return default UNKNOWN message when no fallback provided', () => {
    const msg = getUserFacingAiError({
      lang: 'vi',
      reasonCode: 'SOME_UNKNOWN_CODE',
    });
    expect(msg).toBe('Không thể thực hiện yêu cầu. Vui lòng thử lại.');
  });

  it('should return default UNKNOWN message for null reasonCode', () => {
    const msg = getUserFacingAiError({
      lang: 'en',
      reasonCode: null,
    });
    expect(msg).toBe('Could not complete the request. Please try again.');
  });

  it('should return default UNKNOWN message for undefined reasonCode', () => {
    const msg = getUserFacingAiError({
      lang: 'vi',
      reasonCode: undefined,
    });
    expect(msg).toBe('Không thể thực hiện yêu cầu. Vui lòng thử lại.');
  });

  // Test all known reason codes have messages
  const knownCodes: AiReasonCode[] = [
    'EMPTY_USER_PROMPT',
    'MISSING_SYSTEM',
    'INVALID_META',
    'BINDING_MISMATCH',
    'REWRITE_NO_CONTEXT',
    'REWRITE_ANCHOR_MISMATCH',
    'REWRITE_DIFF_EXCEEDED',
    'EDIT_SCOPE_REQUIRED',
    'EXECUTION_BLOCKED',
    'UNKNOWN',
  ];

  it.each(knownCodes)('should have Vietnamese message for %s', (code: AiReasonCode) => {
    const msg = getUserFacingAiError({ lang: 'vi', reasonCode: code });
    expect(msg).toBeTruthy();
    expect(msg.length).toBeGreaterThan(10);
  });

  it.each(knownCodes)('should have English message for %s', (code: AiReasonCode) => {
    const msg = getUserFacingAiError({ lang: 'en', reasonCode: code });
    expect(msg).toBeTruthy();
    expect(msg.length).toBeGreaterThan(10);
  });
});

// ============================================
// Test: isKnownReasonCode
// ============================================

describe('isKnownReasonCode', () => {
  it('should return true for known reason codes', () => {
    expect(isKnownReasonCode('REWRITE_NO_CONTEXT')).toBe(true);
    expect(isKnownReasonCode('BINDING_MISMATCH')).toBe(true);
    expect(isKnownReasonCode('EMPTY_USER_PROMPT')).toBe(true);
  });

  it('should return false for unknown reason codes', () => {
    expect(isKnownReasonCode('SOME_RANDOM_CODE')).toBe(false);
    expect(isKnownReasonCode('NOT_A_REAL_CODE')).toBe(false);
  });

  it('should return false for null/undefined', () => {
    expect(isKnownReasonCode(null)).toBe(false);
    expect(isKnownReasonCode(undefined)).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isKnownReasonCode('')).toBe(false);
  });
});

// ============================================
// Test: Error Message Content Quality
// ============================================

describe('Error Message Content Quality', () => {
  it('REWRITE_ANCHOR_MISMATCH should mention paragraph structure', () => {
    const vi = getUserFacingAiError({ lang: 'vi', reasonCode: 'REWRITE_ANCHOR_MISMATCH' });
    const en = getUserFacingAiError({ lang: 'en', reasonCode: 'REWRITE_ANCHOR_MISMATCH' });

    expect(vi).toContain('đoạn');
    expect(en.toLowerCase()).toContain('paragraph');
  });

  it('REWRITE_DIFF_EXCEEDED should mention original content', () => {
    const vi = getUserFacingAiError({ lang: 'vi', reasonCode: 'REWRITE_DIFF_EXCEEDED' });
    const en = getUserFacingAiError({ lang: 'en', reasonCode: 'REWRITE_DIFF_EXCEEDED' });

    expect(vi).toContain('gốc');
    expect(en.toLowerCase()).toContain('original');
  });

  it('EDIT_SCOPE_REQUIRED should mention Hook/Body/CTA', () => {
    const vi = getUserFacingAiError({ lang: 'vi', reasonCode: 'EDIT_SCOPE_REQUIRED' });
    const en = getUserFacingAiError({ lang: 'en', reasonCode: 'EDIT_SCOPE_REQUIRED' });

    expect(vi).toContain('Hook');
    expect(vi).toContain('Body');
    expect(vi).toContain('CTA');
    expect(en).toContain('Hook');
    expect(en).toContain('Body');
    expect(en).toContain('CTA');
  });
});
