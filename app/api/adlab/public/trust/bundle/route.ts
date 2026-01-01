// ============================================
// AdLab Public Trust Bundle API
// ============================================
// PHASE D36: Sales-Ready Trust Bundle Engine.
//
// PROVIDES:
// - GET: Public bundle retrieval via token
//
// INVARIANTS:
// - Zero authentication
// - Token-based access only
// - 404 on invalid/expired/revoked (no info leak)
// - All access audited
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import {
  verifyBundleToken,
  getBundleContents,
} from '@/lib/adlab/ops/trustBundleEngine';

// ============================================
// GET: Retrieve Bundle Contents
// ============================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  // No token = 404
  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Not found' },
      { status: 404 }
    );
  }

  try {
    // Verify token (handles expiry, revocation)
    const verification = await verifyBundleToken(token);

    if (!verification.valid) {
      // Return 404 for all failures (no info leak)
      return NextResponse.json(
        { success: false, error: 'Not found' },
        { status: 404 }
      );
    }

    // Get bundle contents
    const result = await getBundleContents(token);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: 'Not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.bundle,
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-cache',
        'X-Bundle-Checksum': result.bundle?.checksum || '',
      },
    });
  } catch (error) {
    console.error('D36: Public bundle API error:', error);
    return NextResponse.json(
      { success: false, error: 'Not found' },
      { status: 404 }
    );
  }
}
