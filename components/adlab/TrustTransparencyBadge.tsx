// ============================================
// Trust Transparency Badge Component
// ============================================
// PHASE D51: Trust Transparency Badge & Last-Updated Layer.
//
// PURPOSE:
// Buyer-facing badge that shows Trust as immutable, boring, static history.
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
// - Badge data comes ONLY from props (server-resolved)
// - No client-side fetching
// - No dynamic updates
// - No personalization
// - Render-only from snapshot store data
// ============================================

import React from 'react';

// ============================================
// Types (Server-Side Resolution)
// ============================================

export interface TrustBadgeProps {
  /** Version string (e.g., "v1.1.0") */
  version: string | null;
  /** Formatted date (e.g., "January 12, 2026") */
  lastUpdated: string;
  /** Link to change history page */
  changeHistoryLink: string;
  /** Whether trust data is available */
  available: boolean;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Show version number */
  showVersion?: boolean;
  /** Show last updated date */
  showLastUpdated?: boolean;
  /** Show change history link */
  showChangeHistory?: boolean;
  /** Custom class name */
  className?: string;
}

// ============================================
// Size Configurations
// ============================================

const SIZE_CLASSES = {
  small: {
    container: 'p-3',
    heading: 'text-sm font-medium',
    version: 'text-xs',
    date: 'text-xs',
    link: 'text-xs',
    icon: 'w-4 h-4',
  },
  medium: {
    container: 'p-4',
    heading: 'text-base font-semibold',
    version: 'text-sm',
    date: 'text-sm',
    link: 'text-sm',
    icon: 'w-5 h-5',
  },
  large: {
    container: 'p-6',
    heading: 'text-lg font-semibold',
    version: 'text-base',
    date: 'text-base',
    link: 'text-base',
    icon: 'w-6 h-6',
  },
} as const;

// ============================================
// Badge Icon (Shield with checkmark)
// ============================================

function BadgeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}

// ============================================
// Main Badge Component
// ============================================

/**
 * Trust Transparency Badge
 *
 * Displays trust version and last-updated information in a buyer-safe format.
 * All data comes from server-side resolution - NO client-side fetching.
 *
 * Mental test: Buyer should think "This feels stable" NOT "They know I'm here".
 */
export function TrustTransparencyBadge({
  version,
  lastUpdated,
  changeHistoryLink,
  available,
  size = 'medium',
  showVersion = true,
  showLastUpdated = true,
  showChangeHistory = true,
  className = '',
}: TrustBadgeProps) {
  const sizeClasses = SIZE_CLASSES[size];

  // If trust data is not available, show minimal placeholder
  if (!available) {
    return (
      <div
        className={`bg-gray-50 border border-gray-200 rounded-lg ${sizeClasses.container} ${className}`}
        role="region"
        aria-label="Trust Commitments"
      >
        <div className="flex items-center gap-2 text-gray-400">
          <BadgeIcon className={sizeClasses.icon} />
          <span className={sizeClasses.heading}>Trust Commitments</span>
        </div>
        <p className={`${sizeClasses.date} text-gray-400 mt-2`}>
          Not available
        </p>
      </div>
    );
  }

  return (
    <div
      className={`bg-white border border-gray-200 rounded-lg ${sizeClasses.container} ${className}`}
      role="region"
      aria-label="Trust Commitments"
    >
      {/* Header */}
      <div className="flex items-center gap-2 text-gray-900">
        <BadgeIcon className={`${sizeClasses.icon} text-blue-600`} />
        <span className={sizeClasses.heading}>Trust Commitments</span>
      </div>

      {/* Content */}
      <div className="mt-3 space-y-2">
        {/* Version */}
        {showVersion && version && (
          <div className="flex items-center gap-2">
            <span className={`${sizeClasses.version} text-gray-500`}>
              Version
            </span>
            <span
              className={`${sizeClasses.version} font-medium text-gray-900`}
            >
              {version}
            </span>
          </div>
        )}

        {/* Last Updated */}
        {showLastUpdated && (
          <div className="flex items-center gap-2">
            <span className={`${sizeClasses.date} text-gray-500`}>
              Last updated
            </span>
            <span className={`${sizeClasses.date} font-medium text-gray-900`}>
              {lastUpdated}
            </span>
          </div>
        )}

        {/* Change History Link */}
        {showChangeHistory && (
          <div className="pt-2">
            <a
              href={changeHistoryLink}
              className={`${sizeClasses.link} text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1`}
            >
              Change history
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Inline Badge (Compact Variant)
// ============================================

export interface TrustBadgeInlineProps {
  /** Version string (e.g., "v1.1.0") */
  version: string | null;
  /** Link to change history page */
  changeHistoryLink: string;
  /** Whether trust data is available */
  available: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * Trust Badge Inline
 *
 * Compact inline version for footer or sidebar placement.
 * Shows only version with link to full changelog.
 */
export function TrustBadgeInline({
  version,
  changeHistoryLink,
  available,
  className = '',
}: TrustBadgeInlineProps) {
  if (!available || !version) {
    return null;
  }

  return (
    <a
      href={changeHistoryLink}
      className={`inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 ${className}`}
    >
      <BadgeIcon className="w-4 h-4 text-blue-500" />
      <span>Trust {version}</span>
    </a>
  );
}

// ============================================
// Trust Center Header Component
// ============================================

export interface TrustCenterHeaderProps {
  /** Version string */
  version: string | null;
  /** Formatted date */
  lastUpdated: string;
  /** Link to change history */
  changeHistoryLink: string;
  /** Whether trust data is available */
  available: boolean;
}

/**
 * Trust Center Header
 *
 * Full-width header for Trust Center landing page.
 * Uses canonical intro copy. NO customization allowed.
 */
export function TrustCenterHeader({
  version,
  lastUpdated,
  changeHistoryLink,
  available,
}: TrustCenterHeaderProps) {
  // Canonical intro copy - NO marketing injection
  const INTRO_COPY =
    'Our Trust commitments are versioned and publicly recorded. ' +
    'Changes are documented. Silent changes are not possible.';

  if (!available) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
        <BadgeIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-400">Trust Commitments</h1>
        <p className="text-gray-400 mt-2">Not available</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-8">
      <div className="max-w-3xl mx-auto text-center">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
            <BadgeIcon className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-bold text-gray-900">Trust Commitments</h1>

        {/* Intro Copy (Canonical - No Override) */}
        <p className="text-lg text-gray-600 mt-4 max-w-2xl mx-auto">
          {INTRO_COPY}
        </p>

        {/* Version & Date */}
        <div className="flex items-center justify-center gap-6 mt-6 text-sm text-gray-500">
          {version && (
            <div className="flex items-center gap-2">
              <span>Version</span>
              <span className="font-semibold text-gray-900">{version}</span>
            </div>
          )}
          <div className="w-px h-4 bg-gray-300" />
          <div className="flex items-center gap-2">
            <span>Last updated</span>
            <span className="font-semibold text-gray-900">{lastUpdated}</span>
          </div>
        </div>

        {/* Change History Link */}
        <div className="mt-6">
          <a
            href={changeHistoryLink}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            View change history
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Export Default
// ============================================

export default TrustTransparencyBadge;
