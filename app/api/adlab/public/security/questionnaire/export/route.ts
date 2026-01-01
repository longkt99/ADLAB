// ============================================
// AdLab Security Questionnaire Export API
// ============================================
// PHASE D35: Customer Security Questionnaire Engine.
//
// PROVIDES:
// - POST: Export questionnaire results in various formats
//
// FORMATS:
// - JSON: Machine-readable
// - Markdown: Human-readable
// - CSV: Spreadsheet-compatible
// - HTML: Printable PDF-ready
//
// INVARIANTS:
// - Public access (no auth)
// - All answers evidence-derived
// - Includes disclaimers
// - All access audited
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import {
  resolveQuestionnaire,
  resolveCustomQuestions,
  validateQuestion,
  type SecurityQuestion,
  type QuestionnaireResult,
  type ResolvedAnswer,
} from '@/lib/adlab/ops/questionnaireEngine';
import { appendAuditLog } from '@/lib/adlab/audit';

const SYSTEM_WORKSPACE_ID = process.env.ADLAB_SYSTEM_WORKSPACE_ID || 'system';

type ExportFormat = 'json' | 'markdown' | 'csv' | 'html';

// ============================================
// Export Formatters
// ============================================

function formatAsMarkdown(result: QuestionnaireResult): string {
  const lines: string[] = [];

  lines.push('# Security Questionnaire Response');
  lines.push('');
  lines.push(`**Generated:** ${result.generatedAt}`);
  lines.push(`**Checksum:** ${result.checksum.substring(0, 16)}...`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Questions | ${result.summary.total} |`);
  lines.push(`| Passed | ${result.summary.passed} |`);
  lines.push(`| Warnings | ${result.summary.warned} |`);
  lines.push(`| Unavailable | ${result.summary.unavailable} |`);
  lines.push(`| High Confidence | ${result.summary.confidenceBreakdown.high} |`);
  lines.push(`| Medium Confidence | ${result.summary.confidenceBreakdown.medium} |`);
  lines.push(`| Low Confidence | ${result.summary.confidenceBreakdown.low} |`);
  lines.push('');

  // Group by category
  const categories = new Map<string, Array<{ q: SecurityQuestion; a: ResolvedAnswer }>>();
  for (let i = 0; i < result.questions.length; i++) {
    const q = result.questions[i];
    const a = result.answers[i];
    const cat = q.category;
    if (!categories.has(cat)) {
      categories.set(cat, []);
    }
    categories.get(cat)!.push({ q, a });
  }

  lines.push('## Detailed Responses');
  lines.push('');

  for (const [category, items] of categories) {
    lines.push(`### ${formatCategoryName(category)}`);
    lines.push('');

    for (const { q, a } of items) {
      const statusIcon = a.status === 'PASS' ? '✅' : a.status === 'WARN' ? '⚠️' : '❓';
      lines.push(`#### ${statusIcon} ${q.question}`);
      lines.push('');
      lines.push(`**Answer:** ${formatAnswer(a.answer)}`);
      lines.push('');
      lines.push(`**Status:** ${a.status} | **Confidence:** ${a.confidence}`);
      lines.push('');
      if (a.explanation) {
        lines.push(`**Explanation:** ${a.explanation}`);
        lines.push('');
      }
      if (a.evidence.length > 0) {
        lines.push('**Evidence Sources:**');
        for (const e of a.evidence) {
          lines.push(`- ${e.source}: ${e.reference}`);
        }
        lines.push('');
      }
    }
  }

  // Evidence sources
  lines.push('---');
  lines.push('');
  lines.push('## Evidence Sources');
  lines.push('');
  for (const source of result.evidenceSources) {
    lines.push(`- **${source.phase}:** ${source.name} - ${source.description}`);
  }
  lines.push('');

  // Disclaimer
  lines.push('---');
  lines.push('');
  lines.push('## Disclaimer');
  lines.push('');
  lines.push('This questionnaire was auto-generated from production system evidence. All answers are derived from live system state and governance artifacts. No claims are manually authored. This document should be verified against the system checksum before use.');
  lines.push('');
  lines.push(`Document checksum: \`${result.checksum}\``);

  return lines.join('\n');
}

function formatAsCSV(result: QuestionnaireResult): string {
  const lines: string[] = [];

  // Header
  lines.push('Question ID,Category,Question,Answer,Status,Confidence,Evidence Sources,Explanation');

  // Data rows
  for (let i = 0; i < result.questions.length; i++) {
    const q = result.questions[i];
    const a = result.answers[i];

    const row = [
      escapeCSV(q.id),
      escapeCSV(q.category),
      escapeCSV(q.question),
      escapeCSV(formatAnswer(a.answer)),
      escapeCSV(a.status),
      escapeCSV(a.confidence),
      escapeCSV(a.evidence.map(e => e.source).join('; ')),
      escapeCSV(a.explanation || ''),
    ];

    lines.push(row.join(','));
  }

  return lines.join('\n');
}

function formatAsHTML(result: QuestionnaireResult): string {
  const categoryColors: Record<string, string> = {
    ACCESS_CONTROL: '#3b82f6',
    AUDIT_LOGGING: '#8b5cf6',
    DATA_PROTECTION: '#10b981',
    INCIDENT_RESPONSE: '#ef4444',
    AVAILABILITY: '#f59e0b',
    COMPLIANCE: '#6366f1',
    BUSINESS_CONTINUITY: '#14b8a6',
    CHANGE_MANAGEMENT: '#ec4899',
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Questionnaire Response</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; background: #f9fafb; padding: 2rem; }
    .container { max-width: 900px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    h1 { font-size: 1.75rem; margin-bottom: 0.5rem; }
    .meta { color: #6b7280; font-size: 0.875rem; margin-bottom: 1.5rem; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }
    .stat { background: #f3f4f6; padding: 1rem; border-radius: 6px; text-align: center; }
    .stat-value { font-size: 1.5rem; font-weight: 600; }
    .stat-label { font-size: 0.75rem; color: #6b7280; text-transform: uppercase; }
    .stat.passed .stat-value { color: #10b981; }
    .stat.warned .stat-value { color: #f59e0b; }
    .stat.unavailable .stat-value { color: #6b7280; }
    .category { margin-bottom: 2rem; }
    .category-header { font-size: 1.125rem; font-weight: 600; padding: 0.5rem 1rem; border-radius: 4px; color: white; margin-bottom: 1rem; }
    .question { background: #f9fafb; padding: 1rem; border-radius: 6px; margin-bottom: 0.75rem; border-left: 3px solid #e5e7eb; }
    .question.pass { border-left-color: #10b981; }
    .question.warn { border-left-color: #f59e0b; }
    .question.unavailable { border-left-color: #9ca3af; }
    .q-text { font-weight: 500; margin-bottom: 0.5rem; }
    .q-answer { color: #374151; }
    .q-meta { font-size: 0.75rem; color: #6b7280; margin-top: 0.5rem; }
    .badge { display: inline-block; padding: 0.125rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; }
    .badge.pass { background: #d1fae5; color: #065f46; }
    .badge.warn { background: #fef3c7; color: #92400e; }
    .badge.unavailable { background: #f3f4f6; color: #4b5563; }
    .badge.high { background: #dbeafe; color: #1e40af; }
    .badge.medium { background: #e0e7ff; color: #3730a3; }
    .badge.low { background: #f3f4f6; color: #6b7280; }
    .evidence { font-size: 0.75rem; color: #6b7280; margin-top: 0.5rem; }
    .disclaimer { margin-top: 2rem; padding: 1rem; background: #fef3c7; border-radius: 6px; font-size: 0.875rem; }
    .checksum { font-family: monospace; font-size: 0.75rem; color: #6b7280; margin-top: 1rem; word-break: break-all; }
    @media print {
      body { background: white; padding: 0; }
      .container { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Security Questionnaire Response</h1>
    <div class="meta">
      Generated: ${result.generatedAt}<br>
      Checksum: ${result.checksum.substring(0, 16)}...
    </div>

    <div class="summary">
      <div class="stat passed">
        <div class="stat-value">${result.summary.passed}</div>
        <div class="stat-label">Passed</div>
      </div>
      <div class="stat warned">
        <div class="stat-value">${result.summary.warned}</div>
        <div class="stat-label">Warnings</div>
      </div>
      <div class="stat unavailable">
        <div class="stat-value">${result.summary.unavailable}</div>
        <div class="stat-label">Unavailable</div>
      </div>
      <div class="stat">
        <div class="stat-value">${result.summary.total}</div>
        <div class="stat-label">Total</div>
      </div>
    </div>

    ${generateCategorySections(result, categoryColors)}

    <div class="disclaimer">
      <strong>Disclaimer:</strong> This questionnaire was auto-generated from production system evidence. All answers are derived from live system state and governance artifacts. No claims are manually authored.
    </div>

    <div class="checksum">
      <strong>Document Checksum:</strong> ${result.checksum}
    </div>
  </div>
</body>
</html>`;
}

function generateCategorySections(result: QuestionnaireResult, colors: Record<string, string>): string {
  const categories = new Map<string, Array<{ q: SecurityQuestion; a: ResolvedAnswer }>>();

  for (let i = 0; i < result.questions.length; i++) {
    const q = result.questions[i];
    const a = result.answers[i];
    const cat = q.category;
    if (!categories.has(cat)) {
      categories.set(cat, []);
    }
    categories.get(cat)!.push({ q, a });
  }

  let html = '';

  for (const [category, items] of categories) {
    const color = colors[category] || '#6b7280';
    html += `<div class="category">
      <div class="category-header" style="background: ${color}">${formatCategoryName(category)}</div>`;

    for (const { q, a } of items) {
      const statusClass = a.status.toLowerCase();
      const confidenceClass = a.confidence.toLowerCase();

      html += `<div class="question ${statusClass}">
        <div class="q-text">${escapeHTML(q.question)}</div>
        <div class="q-answer"><strong>Answer:</strong> ${escapeHTML(formatAnswer(a.answer))}</div>
        <div class="q-meta">
          <span class="badge ${statusClass}">${a.status}</span>
          <span class="badge ${confidenceClass}">${a.confidence} confidence</span>
        </div>
        ${a.explanation ? `<div class="evidence"><strong>Explanation:</strong> ${escapeHTML(a.explanation)}</div>` : ''}
        ${a.evidence.length > 0 ? `<div class="evidence"><strong>Evidence:</strong> ${a.evidence.map(e => escapeHTML(e.source)).join(', ')}</div>` : ''}
      </div>`;
    }

    html += '</div>';
  }

  return html;
}

// ============================================
// Helpers
// ============================================

function formatCategoryName(category: string): string {
  return category
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

function formatAnswer(answer: unknown): string {
  if (answer === null || answer === undefined) {
    return 'N/A';
  }
  if (Array.isArray(answer)) {
    return answer.join(', ');
  }
  if (typeof answer === 'boolean') {
    return answer ? 'Yes' : 'No';
  }
  return String(answer);
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function escapeHTML(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================
// POST: Export Questionnaire
// ============================================

interface ExportRequest {
  format?: ExportFormat;
  questions?: SecurityQuestion[];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const generatedAt = new Date().toISOString();

  try {
    const body = await request.json() as ExportRequest;
    const { format = 'json', questions } = body;

    // Validate format
    if (!['json', 'markdown', 'csv', 'html'].includes(format)) {
      return NextResponse.json(
        { success: false, error: 'Invalid format. Must be one of: json, markdown, csv, html' },
        { status: 400 }
      );
    }

    // Validate custom questions if provided
    if (questions && Array.isArray(questions)) {
      if (questions.length > 100) {
        return NextResponse.json(
          { success: false, error: 'Maximum 100 questions allowed' },
          { status: 400 }
        );
      }

      for (let i = 0; i < questions.length; i++) {
        const validation = validateQuestion(questions[i]);
        if (!validation.valid) {
          return NextResponse.json(
            {
              success: false,
              error: `Question ${i} validation failed: ${validation.errors.join(', ')}`,
            },
            { status: 400 }
          );
        }
      }
    }

    // Resolve questionnaire
    const result = questions
      ? await resolveCustomQuestions(questions)
      : await resolveQuestionnaire();

    // Format response
    let content: string;
    let contentType: string;
    let filename: string;

    switch (format) {
      case 'markdown':
        content = formatAsMarkdown(result);
        contentType = 'text/markdown';
        filename = 'security-questionnaire.md';
        break;

      case 'csv':
        content = formatAsCSV(result);
        contentType = 'text/csv';
        filename = 'security-questionnaire.csv';
        break;

      case 'html':
        content = formatAsHTML(result);
        contentType = 'text/html';
        filename = 'security-questionnaire.html';
        break;

      case 'json':
      default:
        content = JSON.stringify(result, null, 2);
        contentType = 'application/json';
        filename = 'security-questionnaire.json';
        break;
    }

    // Audit access
    await appendAuditLog({
      context: {
        workspaceId: SYSTEM_WORKSPACE_ID,
        actorId: 'public',
        actorRole: 'viewer',
      },
      action: 'EXPORT',
      entityType: 'public_trust',
      entityId: 'security-questionnaire-export',
      scope: {
        platform: 'system',
        dataset: 'questionnaire',
      },
      metadata: {
        trustAction: 'QUESTIONNAIRE_EXPORTED',
        format,
        questionsCount: result.questions.length,
        customQuestions: !!questions,
        checksum: result.checksum,
        timestamp: generatedAt,
      },
    });

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Questionnaire-Checksum': result.checksum,
        'X-Questionnaire-Generated': generatedAt,
      },
    });
  } catch (error) {
    console.error('D35: Questionnaire export error:', error);
    return NextResponse.json(
      { success: false, error: 'Export failed' },
      { status: 500 }
    );
  }
}
