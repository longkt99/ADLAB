// ============================================
// Trust Badge API
// ============================================
// PHASE D51: Trust Transparency Badge & Last-Updated Layer.
//
// PROVIDES:
// - GET: Public badge data (no auth required)
//
// INVARIANTS:
// - Public read-only endpoint
// - Data comes ONLY from snapshot store
// - No behavioral tracking
// - No personalization
// - Cache headers for CDN caching
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import {
  resolveTrustBadgeData,
  formatLastUpdated,
  type BadgePlacement,
  getDefaultConfig,
  isPlacementAllowed,
  BADGE_LABELS,
  BADGE_HEADING,
  TRUST_CENTER_INTRO,
  TRUST_TOOLTIP,
} from '@/lib/adlab/trust';

// ============================================
// Types
// ============================================

interface BadgeResponse {
  success: boolean;
  data?: {
    /** Current trust version */
    version: string | null;
    /** Last updated (raw date string) */
    lastUpdated: string | null;
    /** Formatted last updated for display */
    lastUpdatedFormatted: string;
    /** Link to change history */
    changeHistoryLink: string;
    /** Whether trust data is available */
    available: boolean;
    /** Configuration for requested placement */
    config?: {
      showVersion: boolean;
      showLastUpdated: boolean;
      showChangeHistory: boolean;
      size: 'small' | 'medium' | 'large';
    };
    /** Canonical labels */
    labels: {
      version: string;
      lastUpdated: string;
      changeHistory: string;
      publicRecord: string;
    };
    /** Canonical heading */
    heading: string;
    /** Canonical intro copy (for trust center) */
    intro?: string;
    /** Canonical tooltip copy */
    tooltip?: string;
  };
  error?: string;
}

// ============================================
// GET Handler - Public Badge Data
// ============================================

export async function GET(request: NextRequest): Promise<NextResponse<BadgeResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const placement = searchParams.get('placement') as BadgePlacement | null;
    const includeIntro = searchParams.get('includeIntro') === 'true';
    const includeTooltip = searchParams.get('includeTooltip') === 'true';

    // Validate placement if provided
    if (placement && !isPlacementAllowed(placement)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Placement not allowed for trust badge',
        },
        {
          status: 400,
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    // Resolve badge data from snapshot store
    const badgeData = resolveTrustBadgeData();

    // Get configuration for placement
    const config = placement ? getDefaultConfig(placement) : undefined;

    // Build response
    const response: BadgeResponse = {
      success: true,
      data: {
        version: badgeData.version,
        lastUpdated: badgeData.lastUpdated,
        lastUpdatedFormatted: formatLastUpdated(badgeData.lastUpdated),
        changeHistoryLink: badgeData.changeHistoryLink,
        available: badgeData.available,
        config,
        labels: { ...BADGE_LABELS },
        heading: BADGE_HEADING,
      },
    };

    // Include intro copy if requested (for trust center)
    if (includeIntro && response.data) {
      response.data.intro = TRUST_CENTER_INTRO;
    }

    // Include tooltip copy if requested
    if (includeTooltip && response.data) {
      response.data.tooltip = TRUST_TOOLTIP;
    }

    // Return with aggressive caching
    // Badge data only changes when trust version changes
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
        'X-Trust-Version': badgeData.version || 'unavailable',
      },
    });
  } catch (e) {
    console.error('D51: Badge API error:', e);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve badge data',
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}
