// ============================================
// AdLab Production Readiness API
// ============================================
// PHASE D24: Production Readiness Proof.
//
// RULES:
// - Read-only, no mutations
// - Returns comprehensive readiness status
// - No authentication required (status is operational)
// - Includes guard coverage, kill-switches, injections
// ============================================

import { NextResponse } from 'next/server';
import { checkProductionReadiness, type ReadinessStatus } from '@/lib/adlab/safety/readiness';
import { verifyCoverage, type CoverageSummary } from '@/lib/adlab/safety/guardRegistry';

interface ReadinessResponse {
  production: ReadinessStatus;
  guards: CoverageSummary;
  timestamp: string;
  version: string;
}

export async function GET(): Promise<NextResponse<ReadinessResponse>> {
  try {
    // Run production readiness checks
    const productionStatus = await checkProductionReadiness();

    // Verify guard coverage
    const guardCoverage = verifyCoverage();

    return NextResponse.json({
      production: productionStatus,
      guards: guardCoverage,
      timestamp: new Date().toISOString(),
      version: 'D24', // Phase version
    });
  } catch (e) {
    console.error('Readiness check error:', e);

    // Return error state
    return NextResponse.json(
      {
        production: {
          ready: false,
          status: 'BLOCKED',
          checks: [
            {
              name: 'readiness_check_error',
              category: 'CONFIG',
              status: 'FAIL',
              message: e instanceof Error ? e.message : 'Unknown error',
            },
          ],
          timestamp: new Date().toISOString(),
          summary: {
            total: 1,
            passed: 0,
            failed: 1,
            warnings: 0,
          },
        },
        guards: {
          totalRoutes: 0,
          coveredRoutes: 0,
          uncoveredRoutes: 0,
          coverage: 0,
          criticalCoverage: 0,
          reports: [],
        },
        timestamp: new Date().toISOString(),
        version: 'D24',
      } as ReadinessResponse,
      { status: 500 }
    );
  }
}
