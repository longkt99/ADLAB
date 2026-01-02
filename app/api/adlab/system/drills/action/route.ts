// ============================================
// AdLab Drill Action API
// ============================================
// PHASE D25: Production Drill & Operator Certification.
//
// ENDPOINT: POST
// Records an operator action during a drill.
//
// RULES:
// - Wrong action = drill continues but marked incorrect
// - Must provide reason for every action
// - Drill auto-evaluates when all steps complete
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
import { type DrillAction, getDrillById, DRILL_ACTIONS } from '@/lib/adlab/ops/drills';
import {
  recordDrillAction,
  getActiveDrill,
} from '@/lib/adlab/ops/drillRunner';
import { evaluateDrill } from '@/lib/adlab/ops/drillEvaluator';

interface ActionRequest {
  instanceId: string;
  action: DrillAction;
  reason: string;
}

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

    const body: ActionRequest = await request.json();

    // Validate request
    if (!body.instanceId) {
      return NextResponse.json(
        { success: false, error: 'Instance ID is required' },
        { status: 400 }
      );
    }

    if (!body.action || !DRILL_ACTIONS.includes(body.action)) {
      return NextResponse.json(
        { success: false, error: `Invalid action. Must be one of: ${DRILL_ACTIONS.join(', ')}` },
        { status: 400 }
      );
    }

    if (!body.reason || body.reason.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Reason is required for every action' },
        { status: 400 }
      );
    }

    // Get drill instance
    const instance = getActiveDrill(body.instanceId);
    if (!instance) {
      return NextResponse.json(
        { success: false, error: 'Drill instance not found' },
        { status: 404 }
      );
    }

    // Verify operator owns this drill
    if (instance.operatorId !== actor.id) {
      return NextResponse.json(
        { success: false, error: 'This drill belongs to another operator' },
        { status: 403 }
      );
    }

    // Record the action
    const result = await recordDrillAction(body.instanceId, body.action, body.reason);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Get drill definition for context
    const drill = getDrillById(instance.drillId);

    // Check if drill is complete and needs evaluation
    let evaluationResult = null;
    if (result.instance?.status === 'EVALUATING') {
      evaluationResult = await evaluateDrill(body.instanceId);
    }

    // Get next action if drill is still active
    let nextAction = null;
    if (
      result.instance &&
      (result.instance.status === 'ACTIVE' || result.instance.status === 'AWAITING_ACTION') &&
      drill
    ) {
      const nextStep = result.instance.currentStep;
      if (nextStep <= drill.requiredActions.length) {
        nextAction = drill.requiredActions[nextStep - 1];
      }
    }

    return NextResponse.json({
      success: true,
      feedback: result.feedback,
      instance: {
        instanceId: result.instance!.id,
        status: result.instance!.status,
        currentStep: result.instance!.currentStep,
        actionsTaken: result.instance!.actionsTaken.length,
      },
      nextAction: nextAction
        ? {
            action: nextAction.action,
            description: nextAction.description,
            timeLimit: nextAction.timeLimit,
          }
        : null,
      evaluation: evaluationResult
        ? {
            passed: evaluationResult.passed,
            score: evaluationResult.score,
            withinSLA: evaluationResult.withinSLA,
            feedback: evaluationResult.feedback,
            certificationGranted: evaluationResult.certificationGranted,
          }
        : null,
    });
  } catch (e) {
    console.error('Drill action error:', e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Failed to record action' },
      { status: 500 }
    );
  }
}
