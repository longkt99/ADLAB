// ============================================
// AdLab Security Questionnaire API
// ============================================
// PHASE D35: Customer Security Questionnaire Engine.
//
// PROVIDES:
// - POST: Submit questions and receive evidence-based answers
// - GET: Retrieve standard questionnaire with pre-resolved answers
//
// INVARIANTS:
// - Public access (no auth)
// - All answers evidence-derived
// - UNAVAILABLE if evidence missing
// - All access audited
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import {
  resolveQuestionnaire,
  resolveCustomQuestions,
  validateQuestion,
  STANDARD_QUESTIONS,
  type SecurityQuestion,
} from '@/lib/adlab/ops/questionnaireEngine';
import { appendAuditLog } from '@/lib/adlab/audit';
import crypto from 'crypto';

const SYSTEM_WORKSPACE_ID = process.env.ADLAB_SYSTEM_WORKSPACE_ID || 'system';

// ============================================
// GET: Standard Questionnaire
// ============================================

export async function GET(): Promise<NextResponse> {
  const generatedAt = new Date().toISOString();

  try {
    const result = await resolveQuestionnaire();

    // Audit access
    await appendAuditLog({
      context: {
        workspaceId: SYSTEM_WORKSPACE_ID,
        actorId: 'public',
        actorRole: 'viewer',
      },
      action: 'VALIDATE',
      entityType: 'public_trust',
      entityId: 'security-questionnaire',
      scope: {
        platform: 'system',
        dataset: 'questionnaire',
      },
      metadata: {
        trustAction: 'QUESTIONNAIRE_STANDARD_ACCESSED',
        questionsCount: result.questions.length,
        answersResolved: result.summary.passed + result.summary.warned,
        timestamp: generatedAt,
      },
    });

    return NextResponse.json({
      success: true,
      data: result,
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        'X-Questionnaire-Checksum': result.checksum,
        'X-Questionnaire-Generated': generatedAt,
      },
    });
  } catch (error) {
    console.error('D35: Questionnaire API error:', error);
    return NextResponse.json(
      { success: false, error: 'Questionnaire temporarily unavailable' },
      { status: 503 }
    );
  }
}

// ============================================
// POST: Custom Questionnaire
// ============================================

interface CustomQuestionnaireRequest {
  questions: SecurityQuestion[];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const generatedAt = new Date().toISOString();

  try {
    const body = await request.json() as CustomQuestionnaireRequest;
    const { questions } = body;

    // Validate request
    if (!questions || !Array.isArray(questions)) {
      return NextResponse.json(
        { success: false, error: 'questions array is required' },
        { status: 400 }
      );
    }

    if (questions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one question is required' },
        { status: 400 }
      );
    }

    if (questions.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Maximum 100 questions allowed per request' },
        { status: 400 }
      );
    }

    // Validate each question
    const validationErrors: Array<{ index: number; errors: string[] }> = [];
    for (let i = 0; i < questions.length; i++) {
      const validation = validateQuestion(questions[i]);
      if (!validation.valid) {
        validationErrors.push({ index: i, errors: validation.errors });
      }
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Question validation failed',
          validationErrors,
        },
        { status: 400 }
      );
    }

    // Resolve custom questions
    const result = await resolveCustomQuestions(questions);

    // Audit access
    await appendAuditLog({
      context: {
        workspaceId: SYSTEM_WORKSPACE_ID,
        actorId: 'public',
        actorRole: 'viewer',
      },
      action: 'VALIDATE',
      entityType: 'public_trust',
      entityId: 'security-questionnaire-custom',
      scope: {
        platform: 'system',
        dataset: 'questionnaire',
      },
      metadata: {
        trustAction: 'QUESTIONNAIRE_CUSTOM_SUBMITTED',
        questionsCount: questions.length,
        answersResolved: result.summary.passed + result.summary.warned,
        checksum: result.checksum,
        timestamp: generatedAt,
      },
    });

    return NextResponse.json({
      success: true,
      data: result,
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Questionnaire-Checksum': result.checksum,
        'X-Questionnaire-Generated': generatedAt,
      },
    });
  } catch (error) {
    console.error('D35: Custom questionnaire error:', error);
    return NextResponse.json(
      { success: false, error: 'Questionnaire processing failed' },
      { status: 500 }
    );
  }
}
