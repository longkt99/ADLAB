// ============================================
// STEP 26: Validation Telemetry Tests
// ============================================
// Tests for the validation telemetry system.
// Verifies telemetry object shape for various scenarios.
// ============================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildValidationSummary,
  emitValidationTelemetry,
  logValidationSummary,
  type ValidationSummary,
  type ValidationSummaryInput,
} from './validationTelemetry';

// ============================================
// Test: buildValidationSummary
// ============================================

describe('buildValidationSummary', () => {
  describe('Success case', () => {
    it('should build correct summary for successful execution', () => {
      const input: ValidationSummaryInput = {
        taskType: 'CREATE',
        hasActiveDraft: false,
        hasPreviousMessages: false,
        messagesCountSentToLLM: 2,
        provider: 'openai',
        ok: true,
        reasonCode: null,
        retryCountUsed: 0,
        latencyMs: 1500,
      };

      const summary = buildValidationSummary(input);

      expect(summary.taskType).toBe('CREATE');
      expect(summary.hasActiveDraft).toBe(false);
      expect(summary.hasPreviousMessages).toBe(false);
      expect(summary.messagesCountSentToLLM).toBe(2);
      expect(summary.provider).toBe('openai');
      expect(summary.ok).toBe(true);
      expect(summary.reasonCode).toBeNull();
      expect(summary.failureClass).toBeNull();
      expect(summary.retryCountUsed).toBe(0);
      expect(summary.latencyMs).toBe(1500);
      expect(summary.timestamp).toBeDefined();
    });
  });

  describe('Failure case with reasonCode', () => {
    it('should build correct summary with failure classification', () => {
      const input: ValidationSummaryInput = {
        taskType: 'REWRITE_UPGRADE',
        hasActiveDraft: true,
        hasPreviousMessages: true,
        messagesCountSentToLLM: 5,
        provider: 'openai',
        ok: false,
        reasonCode: 'REWRITE_DIFF_EXCEEDED',
        retryCountUsed: 1,
        latencyMs: 2000,
      };

      const summary = buildValidationSummary(input);

      expect(summary.taskType).toBe('REWRITE_UPGRADE');
      expect(summary.hasActiveDraft).toBe(true);
      expect(summary.ok).toBe(false);
      expect(summary.reasonCode).toBe('REWRITE_DIFF_EXCEEDED');
      expect(summary.failureClass).not.toBeNull();
      expect(summary.failureClass?.layer).toBe('Rewrite Diff Guard');
      expect(summary.failureClass?.retryable).toBe(true);
      expect(summary.failureClass?.userFixable).toBe(true);
    });

    it('should handle unknown reasonCode gracefully', () => {
      const input: ValidationSummaryInput = {
        taskType: null,
        hasActiveDraft: false,
        hasPreviousMessages: false,
        messagesCountSentToLLM: 0,
        provider: null,
        ok: false,
        reasonCode: 'SOME_UNKNOWN_CODE',
        retryCountUsed: 0,
        latencyMs: 100,
      };

      const summary = buildValidationSummary(input);

      expect(summary.reasonCode).toBe('SOME_UNKNOWN_CODE');
      expect(summary.failureClass).not.toBeNull();
      expect(summary.failureClass?.layer).toBe('Unknown');
    });
  });

  describe('REWRITE_UPGRADE with anchors and diff metrics', () => {
    it('should include anchor and diff guard fields when provided', () => {
      const input: ValidationSummaryInput = {
        taskType: 'REWRITE_UPGRADE',
        hasActiveDraft: true,
        hasPreviousMessages: true,
        messagesCountSentToLLM: 4,
        provider: 'openai',
        ok: true,
        reasonCode: null,
        retryCountUsed: 0,
        latencyMs: 3000,
        // REWRITE_UPGRADE specific
        anchorsApplied: true,
        anchorCount: 3,
        anchorValidationOk: true,
        diffGuardOk: true,
        diffMetrics: {
          lengthRatioMax: 1.2,
          sentenceReplacementMax: 0.3,
          keywordPreserveMin: 0.8,
          ctaAddedDetected: false,
        },
      };

      const summary = buildValidationSummary(input);

      expect(summary.taskType).toBe('REWRITE_UPGRADE');
      expect(summary.anchorsApplied).toBe(true);
      expect(summary.anchorCount).toBe(3);
      expect(summary.anchorValidationOk).toBe(true);
      expect(summary.diffGuardOk).toBe(true);
      expect(summary.diffMetrics).toBeDefined();
      expect(summary.diffMetrics?.lengthRatioMax).toBe(1.2);
      expect(summary.diffMetrics?.sentenceReplacementMax).toBe(0.3);
      expect(summary.diffMetrics?.keywordPreserveMin).toBe(0.8);
      expect(summary.diffMetrics?.ctaAddedDetected).toBe(false);
    });

    it('should not include anchor fields when not provided', () => {
      const input: ValidationSummaryInput = {
        taskType: 'QA',
        hasActiveDraft: true,
        hasPreviousMessages: true,
        messagesCountSentToLLM: 3,
        provider: 'anthropic',
        ok: true,
        reasonCode: null,
        retryCountUsed: 0,
        latencyMs: 500,
      };

      const summary = buildValidationSummary(input);

      expect(summary.anchorsApplied).toBeUndefined();
      expect(summary.anchorCount).toBeUndefined();
      expect(summary.anchorValidationOk).toBeUndefined();
      expect(summary.diffGuardOk).toBeUndefined();
      expect(summary.diffMetrics).toBeUndefined();
    });
  });

  describe('STEP 27: Intent Confirmation telemetry', () => {
    it('should include intentConfirmation when provided', () => {
      const input: ValidationSummaryInput = {
        taskType: 'REWRITE_UPGRADE',
        hasActiveDraft: true,
        hasPreviousMessages: true,
        messagesCountSentToLLM: 4,
        provider: 'openai',
        ok: true,
        reasonCode: null,
        retryCountUsed: 0,
        latencyMs: 2000,
        intentConfirmation: {
          shown: true,
          accepted: true,
        },
      };

      const summary = buildValidationSummary(input);

      expect(summary.intentConfirmation).toBeDefined();
      expect(summary.intentConfirmation?.shown).toBe(true);
      expect(summary.intentConfirmation?.accepted).toBe(true);
    });

    it('should not include intentConfirmation when not provided', () => {
      const input: ValidationSummaryInput = {
        taskType: 'CREATE',
        hasActiveDraft: false,
        hasPreviousMessages: false,
        messagesCountSentToLLM: 2,
        provider: 'openai',
        ok: true,
        reasonCode: null,
        retryCountUsed: 0,
        latencyMs: 1000,
      };

      const summary = buildValidationSummary(input);

      expect(summary.intentConfirmation).toBeUndefined();
    });
  });
});

// ============================================
// Test: emitValidationTelemetry
// ============================================

describe('emitValidationTelemetry', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;
  });

  it('should emit telemetry with [STUDIO_RUN] prefix in DEV mode', () => {
    process.env.NODE_ENV = 'development';

    const summary: ValidationSummary = {
      timestamp: new Date().toISOString(),
      taskType: 'CREATE',
      hasActiveDraft: false,
      hasPreviousMessages: false,
      messagesCountSentToLLM: 2,
      provider: 'openai',
      ok: true,
      reasonCode: null,
      failureClass: null,
      retryCountUsed: 0,
      latencyMs: 1000,
    };

    emitValidationTelemetry(summary);

    // In development mode, should use console.log with full summary
    expect(consoleLogSpy).toHaveBeenCalledWith('[STUDIO_RUN]', summary);
  });

  it('should emit safe subset in PROD mode', () => {
    process.env.NODE_ENV = 'production';

    const summary: ValidationSummary = {
      timestamp: new Date().toISOString(),
      taskType: 'CREATE',
      hasActiveDraft: false,
      hasPreviousMessages: false,
      messagesCountSentToLLM: 2,
      provider: 'openai',
      ok: true,
      reasonCode: null,
      failureClass: null,
      retryCountUsed: 0,
      latencyMs: 1000,
    };

    emitValidationTelemetry(summary);

    // In production mode, should use console.info with safe subset
    expect(consoleInfoSpy).toHaveBeenCalledWith('[STUDIO_RUN]', expect.objectContaining({
      taskType: 'CREATE',
      ok: true,
      latencyMs: 1000,
    }));
    // Should NOT include sensitive fields like full timestamp or failureClass
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });
});

// ============================================
// Test: logValidationSummary (combined)
// ============================================

describe('logValidationSummary', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;
  });

  it('should build and emit in one call', () => {
    const input: ValidationSummaryInput = {
      taskType: 'EDIT_PATCH',
      hasActiveDraft: true,
      hasPreviousMessages: true,
      messagesCountSentToLLM: 4,
      provider: 'openai',
      ok: true,
      reasonCode: null,
      retryCountUsed: 0,
      latencyMs: 800,
    };

    const result = logValidationSummary(input);

    expect(result.taskType).toBe('EDIT_PATCH');
    expect(result.ok).toBe(true);
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it('should return the built summary', () => {
    const input: ValidationSummaryInput = {
      taskType: 'QA',
      hasActiveDraft: false,
      hasPreviousMessages: true,
      messagesCountSentToLLM: 3,
      provider: 'anthropic',
      ok: true,
      reasonCode: null,
      retryCountUsed: 0,
      latencyMs: 600,
    };

    const result = logValidationSummary(input);

    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('taskType', 'QA');
    expect(result).toHaveProperty('provider', 'anthropic');
    expect(result).toHaveProperty('ok', true);
    expect(result).toHaveProperty('latencyMs', 600);
  });
});

// ============================================
// Test: Telemetry Contract Shape
// ============================================

describe('Telemetry Contract Shape', () => {
  it('should have all required fields for base summary', () => {
    const input: ValidationSummaryInput = {
      taskType: 'CREATE',
      hasActiveDraft: false,
      hasPreviousMessages: false,
      messagesCountSentToLLM: 2,
      provider: 'openai',
      ok: true,
      reasonCode: null,
      retryCountUsed: 0,
      latencyMs: 1000,
    };

    const summary = buildValidationSummary(input);

    // All required fields must be present
    expect(summary).toHaveProperty('timestamp');
    expect(summary).toHaveProperty('taskType');
    expect(summary).toHaveProperty('hasActiveDraft');
    expect(summary).toHaveProperty('hasPreviousMessages');
    expect(summary).toHaveProperty('messagesCountSentToLLM');
    expect(summary).toHaveProperty('provider');
    expect(summary).toHaveProperty('ok');
    expect(summary).toHaveProperty('reasonCode');
    expect(summary).toHaveProperty('failureClass');
    expect(summary).toHaveProperty('retryCountUsed');
    expect(summary).toHaveProperty('latencyMs');
  });

  it('timestamp should be valid ISO string', () => {
    const input: ValidationSummaryInput = {
      taskType: 'CREATE',
      hasActiveDraft: false,
      hasPreviousMessages: false,
      messagesCountSentToLLM: 2,
      provider: 'openai',
      ok: true,
      reasonCode: null,
      retryCountUsed: 0,
      latencyMs: 1000,
    };

    const summary = buildValidationSummary(input);
    const parsed = new Date(summary.timestamp);

    expect(parsed.toISOString()).toBe(summary.timestamp);
  });
});
