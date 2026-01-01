// ============================================
// AdLab Ingestion Validation API
// ============================================
// Validates CSV content and creates a log entry.
// PHASE D16A: Dry-run validation only.
// PHASE D19: Audit logging for validation actions.
// PHASE D20: Permission checks (owner | admin | operator).
// PHASE D21: Server-derived actor resolution.
// PHASE D23: Failure injection support.

import { NextRequest, NextResponse } from 'next/server';
import {
  validateCSV,
  type DatasetType,
  type PlatformType,
  isIngestionEnabled,
  createIngestionLog,
} from '@/lib/adlab/ingestion';
import { appendAuditLog } from '@/lib/adlab/audit';
import {
  resolveActorFromRequest,
  requirePermission,
  permissionDeniedResponse,
  notAuthenticatedResponse,
  noMembershipResponse,
  PermissionDeniedError,
  NotAuthenticatedError,
  MissingMembershipError,
  InactiveMembershipError,
} from '@/lib/adlab/auth';
import { assertNoInjectedFailure, InjectedFailureError } from '@/lib/adlab/safety';

// D21: Simplified request - no role or userId from client
interface ValidateRequest {
  content: string;
  dataset: DatasetType;
  platform: PlatformType;
  clientId?: string | null;
  fileName: string;
  fileSize: number;
}

export async function POST(request: NextRequest) {
  try {
    // Check feature flag first
    if (!isIngestionEnabled()) {
      return NextResponse.json(
        { error: 'Ingestion feature is disabled' },
        { status: 403 }
      );
    }

    // D21: Resolve actor from server session + membership
    // Role comes from database, NOT from client
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

    const body: ValidateRequest = await request.json();

    // Validate required fields
    if (!body.content) {
      return NextResponse.json(
        { error: 'CSV content is required' },
        { status: 400 }
      );
    }

    if (!body.dataset) {
      return NextResponse.json(
        { error: 'Dataset type is required' },
        { status: 400 }
      );
    }

    // D23: Failure injection check (before permission)
    // Allows controlled chaos testing without corrupting data
    try {
      await assertNoInjectedFailure(actor, 'VALIDATE');
    } catch (e) {
      if (e instanceof InjectedFailureError) {
        return NextResponse.json(
          { error: e.message },
          { status: 500 }
        );
      }
      throw e;
    }

    // D20/D21: Permission check with server-derived actor
    // VALIDATE requires owner, admin, or operator role
    try {
      await requirePermission(actor, 'VALIDATE', {
        logDenial: true,
        scope: {
          platform: body.platform,
          dataset: body.dataset,
          clientId: body.clientId || undefined,
        },
      });
    } catch (e) {
      if (e instanceof PermissionDeniedError) {
        return permissionDeniedResponse('VALIDATE', actor.role);
      }
      throw e;
    }

    // Validate CSV
    const result = validateCSV(body.content, body.dataset);

    // Generate message
    let message: string;
    if (result.status === 'pass') {
      message = `Successfully validated ${result.validRows} rows`;
    } else if (result.status === 'warn') {
      message = `Validated with ${result.warningCount} warnings and ${result.errorCount} errors`;
    } else {
      message = `Validation failed with ${result.errorCount} errors`;
    }

    // Create ingestion log using server-derived actor context
    const { data: logEntry } = await createIngestionLog({
      workspace_id: actor.workspaceId, // D21: Use actor's workspace
      client_id: body.clientId || null,
      platform: body.platform,
      dataset: body.dataset,
      file_name: body.fileName || 'unknown.csv',
      file_size: body.fileSize || 0,
      rows_parsed: result.rowsParsed,
      valid_rows: result.validRows,
      status: result.status,
      message,
      preview_json: result.preview,
      errors_json: result.errors,
      validated_rows_json: result.validatedRows,
    });

    // D19: Write audit log for validation using server-derived actor
    if (logEntry) {
      await appendAuditLog({
        context: {
          workspaceId: actor.workspaceId,
          actorId: actor.id, // D21: Server-derived actor ID
          actorRole: actor.role, // D21: Server-derived role
        },
        action: 'VALIDATE',
        entityType: 'ingestion_log',
        entityId: logEntry.id,
        scope: {
          platform: body.platform,
          dataset: body.dataset,
          clientId: body.clientId || undefined,
        },
        metadata: {
          fileName: body.fileName,
          fileSize: body.fileSize,
          rowsParsed: result.rowsParsed,
          validRows: result.validRows,
          errorCount: result.errorCount,
          warningCount: result.warningCount,
          status: result.status,
        },
      });
    }

    return NextResponse.json({ result, message, logId: logEntry?.id });
  } catch (e) {
    console.error('Ingestion validation error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Validation failed' },
      { status: 500 }
    );
  }
}
