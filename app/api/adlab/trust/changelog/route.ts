// ============================================
// Trust Changelog API
// ============================================
// PHASE D50: Trust Snapshot Versioning & Public Change Log.
//
// PROVIDES:
// - GET: Public changelog (read-only, no auth required)
//
// INVARIANTS:
// - Read-only operations
// - No authentication required (public)
// - No internal rationale exposed
// - Marketing-safe language only
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getChangelogEntries,
  getLatestChangelogEntry,
  getChangeTypeLabel,
} from '@/lib/adlab/trust';

// ============================================
// Types
// ============================================

interface PublicChangelogResponse {
  success: boolean;
  data: {
    entries: Array<{
      version: string;
      date: string;
      type: string;
      typeLabel: string;
      summary: string;
      customerImpact: string;
      link: string;
    }>;
    currentVersion: string | null;
    totalEntries: number;
  };
}

// ============================================
// GET Handler
// ============================================

export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    const entries = getChangelogEntries();
    const latest = getLatestChangelogEntry();

    // Transform to public format (ensure no internal data leaks)
    const publicEntries = entries.map((entry) => ({
      version: entry.version,
      date: entry.date,
      type: entry.type,
      typeLabel: getChangeTypeLabel(entry.type),
      summary: entry.summary,
      customerImpact: entry.customer_impact,
      link: entry.link,
    }));

    const response: PublicChangelogResponse = {
      success: true,
      data: {
        entries: publicEntries,
        currentVersion: latest?.version ?? null,
        totalEntries: entries.length,
      },
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    });
  } catch (e) {
    console.error('D50: Changelog API error:', e);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve changelog' },
      { status: 500 }
    );
  }
}
