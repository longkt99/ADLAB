// ============================================
// AdLab Drills API
// ============================================
// PHASE D25: Production Drill & Operator Certification.
//
// ENDPOINTS:
// GET  - List available drills for current operator
// POST - Start a new drill
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import {
  resolveActorFromRequest,
  NotAuthenticatedError,
  MissingMembershipError,
  InactiveMembershipError,
  notAuthenticatedResponse,
  noMembershipResponse,
} from '@/lib/adlab/auth';
import {
  getDrillsForRole,
  getDrillById,
  canParticipate,
} from '@/lib/adlab/ops/drills';
import {
  startDrill,
  getOperatorActiveDrill,
} from '@/lib/adlab/ops/drillRunner';
import {
  getOperatorCertificationStatus,
  getRequiredDrillsForRole,
  canRoleParticipate,
} from '@/lib/adlab/ops/drillEvaluator';

// GET: List available drills
export async function GET() {
  try {
    let actor;
    try {
      actor = await resolveActorFromRequest();
    } catch (e) {
      if (e instanceof NotAuthenticatedError) {
        return notAuthenticatedResponse();
      }
      if (e instanceof MissingMembershipError || e instanceof InactiveMembershipError) {
        return noMembershipResponse();
      }
      throw e;
    }

    // Check if role can participate
    if (!canRoleParticipate(actor.role)) {
      return NextResponse.json({
        canParticipate: false,
        message: 'Viewers cannot participate in drills',
        drills: [],
        certificationStatus: null,
      });
    }

    // Get drills available for this role
    const availableDrills = getDrillsForRole(actor.role).map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      incidentType: d.incidentType,
      severity: d.severity,
      totalTimeLimit: d.totalTimeLimit,
      slaTarget: d.slaTarget,
      requiredActions: d.requiredActions.length,
      certificationLevel: d.certificationLevel,
    }));

    // Get current active drill if any
    const activeDrill = getOperatorActiveDrill(actor.id);

    // Get certification status
    const requiredDrills = getRequiredDrillsForRole(actor.role);
    const certStatus = getOperatorCertificationStatus(actor.id, actor.role, requiredDrills);

    return NextResponse.json({
      canParticipate: true,
      drills: availableDrills,
      activeDrill: activeDrill
        ? {
            instanceId: activeDrill.id,
            drillId: activeDrill.drillId,
            status: activeDrill.status,
            currentStep: activeDrill.currentStep,
            expiresAt: activeDrill.expiresAt,
          }
        : null,
      certificationStatus: {
        requiredDrillsPassed: certStatus.requiredDrillsPassed,
        requiredDrillsTotal: certStatus.requiredDrillsTotal,
        fullyOperational: certStatus.fullyOperational,
        nextRequiredDrill: certStatus.nextRequiredDrill,
      },
    });
  } catch (e) {
    console.error('Drills list error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to list drills' },
      { status: 500 }
    );
  }
}

// POST: Start a drill
export async function POST(request: NextRequest) {
  try {
    let actor;
    try {
      actor = await resolveActorFromRequest();
    } catch (e) {
      if (e instanceof NotAuthenticatedError) {
        return notAuthenticatedResponse();
      }
      if (e instanceof MissingMembershipError || e instanceof InactiveMembershipError) {
        return noMembershipResponse();
      }
      throw e;
    }

    // Check if role can participate
    if (!canRoleParticipate(actor.role)) {
      return NextResponse.json(
        { success: false, error: 'Viewers cannot participate in drills' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { drillId } = body;

    if (!drillId) {
      return NextResponse.json(
        { success: false, error: 'Drill ID is required' },
        { status: 400 }
      );
    }

    // Verify drill exists
    const drill = getDrillById(drillId);
    if (!drill) {
      return NextResponse.json(
        { success: false, error: `Drill not found: ${drillId}` },
        { status: 404 }
      );
    }

    // Check if role can participate in this specific drill
    if (!canParticipate(actor.role, drill)) {
      return NextResponse.json(
        { success: false, error: `Role "${actor.role}" cannot participate in this drill` },
        { status: 403 }
      );
    }

    // Start the drill
    const result = await startDrill(drillId, actor, 'DRY_RUN');

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      instance: {
        instanceId: result.instance!.id,
        drillId: result.instance!.drillId,
        status: result.instance!.status,
        currentStep: result.instance!.currentStep,
        startedAt: result.instance!.startedAt,
        expiresAt: result.instance!.expiresAt,
      },
      scenario: drill.scenario,
      firstAction: drill.requiredActions[0],
    });
  } catch (e) {
    console.error('Drill start error:', e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Failed to start drill' },
      { status: 500 }
    );
  }
}
