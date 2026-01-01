// ============================================
// Server-Side Analytics Tracking
// ============================================
// Lightweight server-side event logging for API routes.
// Privacy-safe: No raw content, only IDs, counts, buckets.
// Uses spec-compliant forbidden pattern and bucket labels.

/**
 * FORBIDDEN KEYS pattern - matches client-side spec exactly
 * Case-insensitive regex for: content, text, prompt, output, diff, snippet
 */
const FORBIDDEN_PATTERN = /^(content|text|prompt|output|diff|snippet)$/i;

/**
 * Log server-side analytics event
 * In production, this would send to an analytics backend.
 * For now, logs to console in a structured format.
 */
export function serverTrack(
  eventName: string,
  payload: Record<string, unknown>
): void {
  // Strip forbidden keys using regex pattern
  const cleanedPayload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (FORBIDDEN_PATTERN.test(key)) {
      console.warn(`[Analytics:Server] Stripped forbidden key: ${key}`);
      continue;
    }
    cleanedPayload[key] = value;
  }

  console.log('[Analytics:Server]', JSON.stringify({
    event: eventName,
    ts: new Date().toISOString(),
    ...cleanedPayload,
  }));
}

// ============================================
// Bucket helpers (spec-compliant labels)
// ============================================

type SimilarityBucket = '>=0.85' | '0.70-0.84' | '0.50-0.69' | '<0.50';
type DurationBucket = '0-500' | '501-2000' | '2001-5000' | '>5000';

function bucketSimilarityServer(score: number): SimilarityBucket {
  if (score >= 0.85) return '>=0.85';
  if (score >= 0.70) return '0.70-0.84';
  if (score >= 0.50) return '0.50-0.69';
  return '<0.50';
}

function bucketDurationServer(ms: number): DurationBucket {
  if (ms <= 500) return '0-500';
  if (ms <= 2000) return '501-2000';
  if (ms <= 5000) return '2001-5000';
  return '>5000';
}

// ============================================
// Auto Fix API Events
// ============================================

/**
 * Track Auto Fix attempt started (at start of each attempt)
 */
export function trackAutoFixAttemptStartedServer(params: {
  intent: string;
  templateId?: string;
  attempt_number: number;
}): void {
  serverTrack('auto_fix.attempt_started', {
    intent_id: params.intent,
    template_id: params.templateId,
    attempt_number: params.attempt_number,
  });
}

/**
 * Track Auto Fix API call completed
 */
export function trackAutoFixAPI(params: {
  intent: string;
  templateId?: string;
  hardFailCount: number;
  softFailCount: number;
  attempt: number;
  similarityScore?: number;
  usedFallback?: boolean;
  success: boolean;
  durationMs: number;
}): void {
  serverTrack('auto_fix.api_completed', {
    intent_id: params.intent,
    template_id: params.templateId,
    hard_fail_count: params.hardFailCount,
    soft_fail_count: params.softFailCount,
    attempt_number: params.attempt,
    similarity_bucket: params.similarityScore !== undefined
      ? bucketSimilarityServer(params.similarityScore)
      : undefined,
    used_fallback: params.usedFallback,
    success: params.success,
    duration_ms_bucket: bucketDurationServer(params.durationMs),
  });
}
