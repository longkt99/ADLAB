// ============================================
// Trust Deploy Gate API
// ============================================
// PHASE D50: Trust Snapshot Versioning & Public Change Log.
//
// PROVIDES:
// - GET: Run deploy gate checks
//
// RETURNS:
// - 200 if all checks pass
// - 412 Precondition Failed if any check fails
//
// INVARIANTS:
// - All checks must pass for deployment
// - No silent changes allowed
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import {
  runDeployGateChecks,
  getDeployGateResponse,
} from '@/lib/adlab/trust';

// ============================================
// GET Handler - Run Gate Checks
// ============================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { status, body } = getDeployGateResponse();

    return NextResponse.json({
      success: body.passed,
      data: body,
    }, { status });
  } catch (e) {
    console.error('D50: Deploy gate API error:', e);
    return NextResponse.json(
      {
        success: false,
        error: 'Deploy gate check failed with error',
        data: {
          passed: false,
          checks: [{
            check: 'Gate execution',
            passed: false,
            error: String(e),
          }],
          activeVersion: null,
          uiVersion: null,
          verifiedAt: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
