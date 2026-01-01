// ============================================
// Analytics API Route
// ============================================
// Receives batched analytics events from the client.
// PRIVACY BOUNDARY: Validates and strips forbidden keys server-side.

import { NextRequest, NextResponse } from 'next/server';

// ============================================
// PRIVACY CONSTANTS (MIRROR CLIENT-SIDE SPEC)
// ============================================

/**
 * FORBIDDEN KEYS pattern - matches client-side spec exactly
 * Case-insensitive regex for: content, text, prompt, output, diff, snippet
 */
const FORBIDDEN_PATTERN = /^(content|text|prompt|output|diff|snippet)$/i;

// ============================================
// VALIDATION
// ============================================

/**
 * Recursively strip forbidden keys from payload
 * Uses regex pattern matching (same as client-side)
 */
function stripForbiddenKeys(
  payload: Record<string, unknown>,
  violations: string[] = []
): { cleaned: Record<string, unknown>; violations: string[] } {
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    // Check if key matches forbidden pattern
    if (FORBIDDEN_PATTERN.test(key)) {
      violations.push(key);
      continue;
    }

    // Recursively clean nested objects
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const nested = stripForbiddenKeys(value as Record<string, unknown>, violations);
      cleaned[key] = nested.cleaned;
    }
    // Clean arrays of objects
    else if (Array.isArray(value)) {
      cleaned[key] = value.map(item => {
        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          return stripForbiddenKeys(item as Record<string, unknown>, violations).cleaned;
        }
        return item;
      });
    }
    // Pass through primitives
    else {
      cleaned[key] = value;
    }
  }

  return { cleaned, violations };
}

/**
 * Validate event structure - accepts new client schema
 * Schema: { event: string; props: Record<string, unknown> }
 */
function isValidEvent(event: unknown): event is {
  event: string;
  props: Record<string, unknown>;
} {
  if (typeof event !== 'object' || event === null) return false;
  const e = event as Record<string, unknown>;
  return (
    typeof e.event === 'string' &&
    typeof e.props === 'object' &&
    e.props !== null
  );
}

// ============================================
// STORAGE (Placeholder - replace with actual analytics backend)
// ============================================

/**
 * Store events to analytics backend
 * TODO: Replace with actual analytics service (PostHog, Amplitude, etc.)
 */
async function storeEvents(
  events: Array<{
    event: string;
    props: Record<string, unknown>;
  }>
): Promise<void> {
  // For now, just log to console
  // In production, send to analytics service
  for (const event of events) {
    console.log('[Analytics:Stored]', event.event, event.props);
  }

  // Example PostHog integration (uncomment when ready):
  // const posthog = getPostHogClient();
  // for (const event of events) {
  //   await posthog.capture({
  //     distinctId: event.props.session_id as string,
  //     event: event.event,
  //     properties: event.props,
  //     timestamp: new Date(event.props.ts as string),
  //   });
  // }
}

// ============================================
// ROUTE HANDLER
// ============================================

/**
 * POST /api/analytics
 *
 * Request body (new client schema):
 * {
 *   events: Array<{
 *     event: string,
 *     props: Record<string, unknown>
 *   }>
 * }
 *
 * Response (always 200):
 * {
 *   received: number,
 *   stored: number,
 *   violations: string[]  // Keys that were stripped
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Parse body - handle both JSON and sendBeacon blob
    let body: { events?: unknown[] };

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await request.json();
    } else {
      // Handle sendBeacon text/plain
      const text = await request.text();
      body = JSON.parse(text);
    }

    // Validate structure - always return 200 even if invalid
    if (!body.events || !Array.isArray(body.events)) {
      console.warn('[Analytics] Invalid request: events array missing');
      return NextResponse.json(
        {
          received: 0,
          stored: 0,
          violations: [],
        },
        { status: 200 }
      );
    }

    // Process events
    const validEvents: Array<{
      event: string;
      props: Record<string, unknown>;
    }> = [];
    const allViolations: string[] = [];

    for (const event of body.events) {
      // Validate event structure
      if (!isValidEvent(event)) {
        console.warn('[Analytics] Invalid event structure, skipping:', event);
        continue;
      }

      // Strip forbidden keys from props
      const { cleaned, violations } = stripForbiddenKeys(event.props);

      if (violations.length > 0) {
        console.warn(`[Analytics] Stripped forbidden keys from ${event.event}:`, violations);
        allViolations.push(...violations);
      }

      validEvents.push({
        event: event.event,
        props: cleaned,
      });
    }

    // Store valid events
    if (validEvents.length > 0) {
      await storeEvents(validEvents);
    }

    // Log summary
    console.log(`[Analytics] Received ${body.events.length}, stored ${validEvents.length}`);
    if (allViolations.length > 0) {
      console.warn(`[Analytics] Total violations stripped: ${allViolations.length}`);
    }

    return NextResponse.json(
      {
        received: body.events.length,
        stored: validEvents.length,
        violations: Array.from(new Set(allViolations)), // Dedupe
      },
      { status: 200 }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Analytics processing failed';
    console.error('[Analytics] Error:', errorMessage);

    // Always return 200 for analytics - don't break client
    return NextResponse.json(
      {
        received: 0,
        stored: 0,
        violations: [],
        error: errorMessage,
      },
      { status: 200 }
    );
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
