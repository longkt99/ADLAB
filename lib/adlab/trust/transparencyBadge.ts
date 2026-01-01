// ============================================
// Trust Transparency Badge
// ============================================
// PHASE D51: Trust Transparency Badge & Last-Updated Layer.
//
// PURPOSE:
// Exposes Trust to buyers as immutable, boring, static history.
// Zero behavioral inference. No surveillance language.
//
// DESIGN PRINCIPLES:
// - Descriptive, not persuasive
// - Zero behavioral inference
// - No "we watch / we track / we see" language
// - Buyer sees stability, not activity
// - Trust shown as immutable history, not live monitoring
//
// INVARIANTS:
// - Badge data comes ONLY from snapshot store
// - No manual override
// - No CMS editing
// - No marketing copy injection
// - Render-only from snapshot store
// ============================================

import {
  getActiveSnapshot,
  getActiveVersion,
  type TrustVersion,
  type TrustSnapshot,
} from './index';

// ============================================
// Types
// ============================================

/**
 * Trust badge data for buyer-facing display.
 * Contains only immutable, non-behavioral data.
 */
export interface TrustBadgeData {
  /** Current trust version (e.g., "v1.1.0") */
  version: TrustVersion | null;
  /** Last updated date (YYYY-MM-DD format) */
  lastUpdated: string | null;
  /** Link to change history */
  changeHistoryLink: string;
  /** Whether trust data is available */
  available: boolean;
}

/**
 * Trust badge display configuration.
 */
export interface TrustBadgeConfig {
  /** Show version number */
  showVersion: boolean;
  /** Show last updated date */
  showLastUpdated: boolean;
  /** Show change history link */
  showChangeHistory: boolean;
  /** Badge size variant */
  size: 'small' | 'medium' | 'large';
}

/**
 * Badge placement location.
 */
export type BadgePlacement =
  | 'trust-center'
  | 'security-page'
  | 'compliance-page'
  | 'procurement-page'
  | 'footer'
  | 'pricing-page';

// ============================================
// Forbidden Language Registry
// ============================================

/**
 * Words and phrases that MUST NEVER appear in trust-related buyer surfaces.
 * These create inference of surveillance or behavioral tracking.
 */
export const FORBIDDEN_LANGUAGE = [
  // Direct surveillance terms
  'tracked',
  'tracking',
  'observed',
  'observing',
  'monitored',
  'monitoring',
  'accessed',
  'accessing',
  'viewed',
  'viewing',
  'watched',
  'watching',

  // Engagement terms
  'engagement',
  'engaged',
  'activity',
  'active',
  'usage',
  'behavior',
  'behavioural',
  'behavioral',

  // Time-based inference terms
  'recently',
  'just now',
  'just updated',
  'today',
  'moments ago',
  'live',
  'real-time',
  'realtime',
  'current session',
  'your visit',

  // Personalization inference
  'for you',
  'personalized',
  'tailored',
  'customized',
  'based on',
  'we noticed',
  'we see',
  'we know',
  'your activity',
  'your engagement',
] as const;

/**
 * Allowed terms for trust badge copy.
 */
export const ALLOWED_LANGUAGE = [
  'version',
  'last updated',
  'change history',
  'public record',
  'trust commitments',
  'documented',
  'versioned',
  'immutable',
  'published',
  'available',
] as const;

// ============================================
// Badge Data Resolver
// ============================================

/**
 * Resolves trust badge data from the snapshot store.
 * This is the ONLY source of truth for badge content.
 *
 * NO manual override.
 * NO CMS injection.
 * NO marketing copy.
 */
export function resolveTrustBadgeData(): TrustBadgeData {
  const snapshot = getActiveSnapshot();

  if (!snapshot) {
    return {
      version: null,
      lastUpdated: null,
      changeHistoryLink: '/trust/changes',
      available: false,
    };
  }

  // Extract date from ISO timestamp (YYYY-MM-DD)
  const lastUpdated = snapshot.released_at
    ? snapshot.released_at.split('T')[0]
    : null;

  return {
    version: snapshot.version,
    lastUpdated,
    changeHistoryLink: '/trust/changes',
    available: true,
  };
}

/**
 * Formats the last updated date for display.
 * Returns human-readable date WITHOUT time-based inference.
 */
export function formatLastUpdated(dateString: string | null): string {
  if (!dateString) {
    return 'Not available';
  }

  try {
    const date = new Date(dateString);

    // Format: "January 12, 2026"
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateString; // Return as-is if parsing fails
  }
}

// ============================================
// Placement Validation
// ============================================

/**
 * Mandatory badge placement locations.
 */
export const MANDATORY_PLACEMENTS: BadgePlacement[] = [
  'trust-center',
  'security-page',
  'compliance-page',
  'procurement-page',
];

/**
 * Optional (enterprise-safe) badge placement locations.
 */
export const OPTIONAL_PLACEMENTS: BadgePlacement[] = [
  'footer',
  'pricing-page',
];

/**
 * Forbidden badge placement locations.
 * Badge MUST NOT appear in these contexts.
 */
export const FORBIDDEN_PLACEMENTS = [
  'sales-email',
  'in-app-notification',
  'marketing-popup',
  'chat-widget',
  'onboarding-flow',
  'account-dashboard',
] as const;

/**
 * Checks if a placement is allowed.
 */
export function isPlacementAllowed(placement: string): boolean {
  const forbidden = FORBIDDEN_PLACEMENTS as readonly string[];
  return !forbidden.includes(placement);
}

// ============================================
// Copy Validation
// ============================================

/**
 * Validates that text does not contain forbidden language.
 * Returns list of violations found.
 */
export function validateBadgeCopy(text: string): string[] {
  const violations: string[] = [];
  const lowerText = text.toLowerCase();

  for (const term of FORBIDDEN_LANGUAGE) {
    if (lowerText.includes(term.toLowerCase())) {
      violations.push(`Contains forbidden term: "${term}"`);
    }
  }

  return violations;
}

/**
 * Checks if text is safe for buyer-facing trust surfaces.
 */
export function isCopySafe(text: string): boolean {
  return validateBadgeCopy(text).length === 0;
}

// ============================================
// Canonical Copy (Marketing-Safe)
// ============================================

/**
 * Canonical badge heading text.
 */
export const BADGE_HEADING = 'Trust Commitments';

/**
 * Canonical Trust Center intro copy.
 * This is the ONLY approved intro text.
 */
export const TRUST_CENTER_INTRO =
  'Our Trust commitments are versioned and publicly recorded. ' +
  'Changes are documented. Silent changes are not possible.';

/**
 * Canonical tooltip/info icon copy.
 */
export const TRUST_TOOLTIP =
  'Trust commitments are published as immutable versions. ' +
  'Previous versions remain available for reference.';

/**
 * Canonical labels for badge elements.
 */
export const BADGE_LABELS = {
  version: 'Version',
  lastUpdated: 'Last updated',
  changeHistory: 'Change history',
  publicRecord: 'Public record',
} as const;

// ============================================
// Default Configuration
// ============================================

/**
 * Default badge configuration for different placements.
 */
export function getDefaultConfig(placement: BadgePlacement): TrustBadgeConfig {
  switch (placement) {
    case 'trust-center':
    case 'security-page':
    case 'compliance-page':
    case 'procurement-page':
      return {
        showVersion: true,
        showLastUpdated: true,
        showChangeHistory: true,
        size: 'large',
      };
    case 'footer':
      return {
        showVersion: true,
        showLastUpdated: false,
        showChangeHistory: true,
        size: 'small',
      };
    case 'pricing-page':
      return {
        showVersion: true,
        showLastUpdated: true,
        showChangeHistory: true,
        size: 'medium',
      };
    default:
      return {
        showVersion: true,
        showLastUpdated: true,
        showChangeHistory: true,
        size: 'medium',
      };
  }
}

// ============================================
// Badge Render Data
// ============================================

/**
 * Complete badge render data for a specific placement.
 */
export interface BadgeRenderData {
  /** Badge data from snapshot store */
  data: TrustBadgeData;
  /** Configuration for this placement */
  config: TrustBadgeConfig;
  /** Canonical labels */
  labels: typeof BADGE_LABELS;
  /** Heading text */
  heading: string;
  /** Formatted last updated date */
  formattedDate: string;
}

/**
 * Gets complete render data for a badge placement.
 */
export function getBadgeRenderData(placement: BadgePlacement): BadgeRenderData {
  const data = resolveTrustBadgeData();
  const config = getDefaultConfig(placement);

  return {
    data,
    config,
    labels: BADGE_LABELS,
    heading: BADGE_HEADING,
    formattedDate: formatLastUpdated(data.lastUpdated),
  };
}

// ============================================
// What D51 Explicitly Does NOT Do
// ============================================

/**
 * D51 Explicit Non-Features.
 * These are documented to prevent future feature creep.
 */
export const D51_NON_FEATURES = [
  'No real-time status',
  'No "currently valid" banners',
  'No alerts',
  'No "you\'re viewing the latest version"',
  'No dynamic language tied to visitor behavior',
] as const;

/**
 * Mental test for D51 compliance.
 * If buyer thinks any of these, D51 FAILS.
 */
export const D51_FAILURE_INDICATORS = [
  'They know I\'m here',
  'This updated because of me',
  'This feels reactive',
] as const;

/**
 * Mental test for D51 success.
 * If buyer thinks any of these, D51 PASSES.
 */
export const D51_SUCCESS_INDICATORS = [
  'This feels stable',
  'Nothing here suggests they\'re watching me',
  'I can check changes without asking Sales',
] as const;
