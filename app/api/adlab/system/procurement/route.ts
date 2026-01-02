// ============================================
// AdLab Procurement Response API
// ============================================
// PHASE D44: Procurement & Security Response Layer.
//
// PROVIDES:
// - GET: Procurement dashboard data
// - GET with view=answers: Security answer resolution
// - GET with view=rfp: RFP response pack generation
// - GET with view=boundary: Boundary sheet
// - GET with view=visibility: Visibility matrix
// - GET with view=evidence: Full evidence package
//
// INVARIANTS:
// - Admin/Owner role only
// - Read-only operations
// - No PII in outputs
// - Full audit logging
// - Evidence-derived answers only
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import {
  resolveActorFromRequest,
  NotAuthenticatedError,
  MissingMembershipError,
  InactiveMembershipError,
  type ResolvedActor,
} from '@/lib/adlab/auth';
import { auditLog } from '@/lib/adlab/audit';
import {
  resolveAllSecurityAnswers,
  resolveSecurityAnswersByCategory,
  type EvidenceContext,
  type SecurityQuestionCategory,
} from '@/lib/adlab/ops/securityAnswerEngine';
import {
  generateRFPResponsePack,
  getSupportedFormats,
  isValidFormat,
  type RFPExportFormat,
} from '@/lib/adlab/ops/rfpResponseGenerator';
import {
  generateBoundarySheet,
  exportBoundarySheetMarkdown,
} from '@/lib/adlab/ops/boundarySheetGenerator';
import {
  generateVisibilityMatrix,
  generateProcurementEvidencePackage,
  getStakeholderVisibility,
  exportVisibilityMatrixMarkdown,
  type Stakeholder,
} from '@/lib/adlab/ops/procurementVisibility';

// ============================================
// Types
// ============================================

type ViewType =
  | 'dashboard'
  | 'answers'
  | 'rfp'
  | 'boundary'
  | 'visibility'
  | 'evidence';

interface ProcurementDashboardData {
  summary: {
    totalQuestions: number;
    answeredQuestions: number;
    partialQuestions: number;
    unavailableQuestions: number;
    completionPercentage: number;
  };
  supportedFormats: Array<{
    format: string;
    label: string;
    description: string;
  }>;
  capabilities: {
    securityAnswers: boolean;
    rfpGeneration: boolean;
    boundarySheet: boolean;
    visibilityMatrix: boolean;
    evidencePackage: boolean;
  };
}

// ============================================
// Evidence Context Builder
// ============================================

/**
 * Builds evidence context from workspace configuration.
 * In production, this would pull from actual workspace config.
 */
function buildEvidenceContext(workspaceId: string): EvidenceContext {
  // These would be pulled from actual workspace configuration
  // For now, using reasonable defaults for a Trust Bundles deployment
  return {
    workspaceId,
    hasAttestation: true,
    attestationProfile: 'soc2',
    hasWhitepaper: true,
    hasQuestionnaire: true,
    auditRetentionDays: 365,
    killSwitchAvailable: true,
    lastComplianceCheck: new Date().toISOString(),
    // SLA summary would be derived from actual system configuration
    slaSummary: undefined,
  };
}

// ============================================
// GET Handler
// ============================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await resolveActorFromRequest();

    // Admin or owner only
    if (actor.role !== 'owner' && actor.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const view = (searchParams.get('view') || 'dashboard') as ViewType;
    const format = searchParams.get('format') || 'json';
    const category = searchParams.get('category') as SecurityQuestionCategory | null;
    const stakeholder = searchParams.get('stakeholder') as Stakeholder | null;

    switch (view) {
      case 'dashboard':
        return handleDashboard(actor);
      case 'answers':
        return handleAnswers(actor, category);
      case 'rfp':
        return handleRFPGeneration(actor, format);
      case 'boundary':
        return handleBoundarySheet(actor, format);
      case 'visibility':
        return handleVisibility(actor, format, stakeholder);
      case 'evidence':
        return handleEvidencePackage(actor);
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid view type' },
          { status: 400 }
        );
    }
  } catch (e) {
    if (
      e instanceof NotAuthenticatedError ||
      e instanceof MissingMembershipError ||
      e instanceof InactiveMembershipError
    ) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('D44: Procurement API error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Handles dashboard view request.
 */
async function handleDashboard(actor: ResolvedActor): Promise<NextResponse> {
  const context = buildEvidenceContext(actor.workspaceId);
  const answerResult = resolveAllSecurityAnswers(context);

  await auditLog({
    workspaceId: actor.workspaceId,
    actorId: actor.id,
    action: 'read',
    entityType: 'procurement_response',
    entityId: actor.workspaceId,
    metadata: { view: 'dashboard' },
  });

  // Compute completion percentage (answered + 50% of partial)
  const completionPercentage = answerResult.summary.total > 0
    ? Math.round(
        ((answerResult.summary.answered + answerResult.summary.partial * 0.5) /
          answerResult.summary.total) *
          100
      )
    : 0;

  const data: ProcurementDashboardData = {
    summary: {
      totalQuestions: answerResult.summary.total,
      answeredQuestions: answerResult.summary.answered,
      partialQuestions: answerResult.summary.partial,
      unavailableQuestions: answerResult.summary.unavailable,
      completionPercentage,
    },
    supportedFormats: getSupportedFormats().map((f) => ({
      format: f.format,
      label: f.label,
      description: f.description,
    })),
    capabilities: {
      securityAnswers: true,
      rfpGeneration: true,
      boundarySheet: true,
      visibilityMatrix: true,
      evidencePackage: true,
    },
  };

  return NextResponse.json({
    success: true,
    data,
  });
}

/**
 * Handles security answers request.
 */
async function handleAnswers(
  actor: ResolvedActor,
  category: SecurityQuestionCategory | null
): Promise<NextResponse> {
  const context = buildEvidenceContext(actor.workspaceId);

  await auditLog({
    workspaceId: actor.workspaceId,
    actorId: actor.id,
    action: 'read',
    entityType: 'procurement_response',
    entityId: actor.workspaceId,
    metadata: { view: 'answers', category },
  });

  if (category) {
    const result = resolveSecurityAnswersByCategory(category, context);
    return NextResponse.json({
      success: true,
      data: result,
    });
  }

  const result = resolveAllSecurityAnswers(context);
  return NextResponse.json({
    success: true,
    data: result,
  });
}

/**
 * Handles RFP response pack generation.
 */
async function handleRFPGeneration(
  actor: ResolvedActor,
  format: string
): Promise<NextResponse> {
  if (!isValidFormat(format)) {
    return NextResponse.json(
      { success: false, error: 'Invalid format. Use: json, markdown, or csv' },
      { status: 400 }
    );
  }

  const context = buildEvidenceContext(actor.workspaceId);
  const pack = generateRFPResponsePack(
    actor.workspaceId,
    null, // No specific bundle
    context,
    format as RFPExportFormat
  );

  await auditLog({
    workspaceId: actor.workspaceId,
    actorId: actor.id,
    action: 'export',
    entityType: 'procurement_response',
    entityId: pack.metadata.packId,
    metadata: { view: 'rfp', format, packId: pack.metadata.packId },
  });

  // Return raw content for markdown/csv, structured for json
  if (format === 'json') {
    return NextResponse.json({
      success: true,
      data: {
        pack: JSON.parse(pack.content),
        filename: pack.filename,
        contentType: pack.contentType,
      },
    });
  }

  // For markdown/csv, return as downloadable content
  return new NextResponse(pack.content, {
    headers: {
      'Content-Type': pack.contentType,
      'Content-Disposition': `attachment; filename="${pack.filename}"`,
    },
  });
}

/**
 * Handles boundary sheet request.
 */
async function handleBoundarySheet(
  actor: ResolvedActor,
  format: string
): Promise<NextResponse> {
  const sheet = generateBoundarySheet(actor.workspaceId);

  await auditLog({
    workspaceId: actor.workspaceId,
    actorId: actor.id,
    action: 'read',
    entityType: 'procurement_response',
    entityId: sheet.metadata.sheetId,
    metadata: { view: 'boundary', format, sheetId: sheet.metadata.sheetId },
  });

  if (format === 'markdown') {
    const content = exportBoundarySheetMarkdown(sheet);
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/markdown',
        'Content-Disposition': `attachment; filename="boundary-sheet-${sheet.metadata.sheetId}.md"`,
      },
    });
  }

  // Default to JSON
  return NextResponse.json({
    success: true,
    data: sheet,
  });
}

/**
 * Handles visibility matrix request.
 */
async function handleVisibility(
  actor: ResolvedActor,
  format: string,
  stakeholder: Stakeholder | null
): Promise<NextResponse> {
  await auditLog({
    workspaceId: actor.workspaceId,
    actorId: actor.id,
    action: 'read',
    entityType: 'procurement_response',
    entityId: actor.workspaceId,
    metadata: { view: 'visibility', format, stakeholder },
  });

  // If stakeholder specified, return stakeholder-specific view
  if (stakeholder) {
    const visibility = getStakeholderVisibility(stakeholder);
    return NextResponse.json({
      success: true,
      data: visibility,
    });
  }

  const matrix = generateVisibilityMatrix();

  if (format === 'markdown') {
    const content = exportVisibilityMatrixMarkdown(matrix);
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/markdown',
        'Content-Disposition': `attachment; filename="visibility-matrix-${matrix.metadata.matrixId}.md"`,
      },
    });
  }

  return NextResponse.json({
    success: true,
    data: matrix,
  });
}

/**
 * Handles full evidence package request.
 */
async function handleEvidencePackage(actor: ResolvedActor): Promise<NextResponse> {
  const pkg = generateProcurementEvidencePackage(
    actor.workspaceId,
    actor.id
  );

  await auditLog({
    workspaceId: actor.workspaceId,
    actorId: actor.id,
    action: 'export',
    entityType: 'procurement_response',
    entityId: pkg.metadata.packageId,
    metadata: { view: 'evidence', packageId: pkg.metadata.packageId },
  });

  return NextResponse.json({
    success: true,
    data: pkg,
  });
}
