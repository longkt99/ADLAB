// ============================================
// AdLab Trust Bundle Export API
// ============================================
// PHASE D36: Sales-Ready Trust Bundle Engine.
//
// PROVIDES:
// - GET: Export bundle in various formats
//
// FORMATS:
// - json: Full bundle as JSON
// - csv: Questionnaire as CSV
// - html: Full bundle as printable HTML
//
// INVARIANTS:
// - Zero authentication
// - Token-based access only
// - Evidence-derived only
// - Includes checksums & disclaimers
// - No internal IDs exposed
// - All access audited
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import {
  verifyBundleToken,
  getBundleContents,
  type TrustBundle,
} from '@/lib/adlab/ops/trustBundleEngine';
import { appendAuditLog } from '@/lib/adlab/audit';

type ExportFormat = 'json' | 'csv' | 'html';

// ============================================
// Format Helpers
// ============================================

function formatQuestionnaireCSV(bundle: TrustBundle): string {
  if (!bundle.contents.questionnaire) return '';

  const lines: string[] = [];
  lines.push('Question ID,Category,Question,Answer,Status,Confidence,Explanation');

  for (let i = 0; i < bundle.contents.questionnaire.questions.length; i++) {
    const q = bundle.contents.questionnaire.questions[i];
    const a = bundle.contents.questionnaire.answers[i];

    const answer = a.answer === null ? 'N/A' :
      Array.isArray(a.answer) ? a.answer.join('; ') :
      typeof a.answer === 'boolean' ? (a.answer ? 'Yes' : 'No') :
      String(a.answer);

    const row = [
      escapeCSV(q.id),
      escapeCSV(q.category),
      escapeCSV(q.question),
      escapeCSV(answer),
      escapeCSV(a.status),
      escapeCSV(a.confidence),
      escapeCSV(a.explanation || ''),
    ];

    lines.push(row.join(','));
  }

  return lines.join('\n');
}

function formatFullHTML(bundle: TrustBundle): string {
  const manifest = bundle.manifest;
  const questionnaire = bundle.contents.questionnaire;
  const attestation = bundle.contents.attestation;
  const summary = bundle.contents.securitySummary;
  const whitepaper = bundle.contents.whitepaper;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Trust Bundle - ${manifest.label || manifest.profile}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; background: #fff; }
    .container { max-width: 900px; margin: 0 auto; padding: 40px 20px; }
    h1 { font-size: 2rem; color: #4f46e5; margin-bottom: 0.5rem; }
    h2 { font-size: 1.5rem; margin: 2rem 0 1rem; color: #111827; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem; }
    h3 { font-size: 1.125rem; margin: 1.5rem 0 0.75rem; color: #374151; }
    .meta { color: #6b7280; font-size: 0.875rem; margin-bottom: 2rem; }
    .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 500; }
    .status.ready, .status.pass { background: #d1fae5; color: #065f46; }
    .status.partial, .status.warn { background: #fef3c7; color: #92400e; }
    .status.unavailable, .status.fail { background: #fee2e2; color: #991b1b; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin: 1.5rem 0; }
    .summary-item { background: #f9fafb; padding: 1rem; border-radius: 8px; text-align: center; }
    .summary-value { font-size: 1.5rem; font-weight: 700; color: #111827; }
    .summary-label { font-size: 0.75rem; color: #6b7280; text-transform: uppercase; }
    .section { background: #f9fafb; padding: 1rem; border-radius: 8px; margin: 1rem 0; border-left: 4px solid #e5e7eb; }
    .section.pass { border-left-color: #10b981; }
    .section.warn { border-left-color: #f59e0b; }
    .section.fail { border-left-color: #ef4444; }
    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
    .section-title { font-weight: 600; }
    .commitment { display: flex; align-items: flex-start; gap: 0.5rem; margin: 0.5rem 0; }
    .commitment-icon { color: #10b981; }
    .qa-item { margin: 1rem 0; padding: 1rem; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; }
    .qa-question { font-weight: 500; color: #111827; margin-bottom: 0.5rem; }
    .qa-answer { color: #374151; }
    .qa-meta { font-size: 0.75rem; color: #6b7280; margin-top: 0.5rem; }
    .checksum-table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.875rem; }
    .checksum-table th, .checksum-table td { padding: 0.5rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
    .checksum-table th { background: #f9fafb; font-weight: 500; }
    .checksum-table td:last-child { font-family: monospace; font-size: 0.75rem; }
    .disclaimer { margin-top: 2rem; padding: 1rem; background: #fef3c7; border-radius: 8px; font-size: 0.875rem; }
    .footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e5e7eb; font-size: 0.75rem; color: #6b7280; }
    @media print {
      .container { max-width: 100%; padding: 20px; }
      .section, .qa-item { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Trust Bundle</h1>
    ${manifest.label ? `<p style="font-size: 1.25rem; color: #6b7280;">${escapeHTML(manifest.label)}</p>` : ''}
    <div class="meta">
      <span class="status ${manifest.overallStatus.toLowerCase()}">${manifest.overallStatus}</span>
      <span style="margin-left: 1rem;">Profile: ${manifest.profile.replace(/_/g, ' ')}</span><br>
      Created: ${new Date(manifest.createdAt).toLocaleString()}<br>
      Expires: ${new Date(manifest.expiresAt).toLocaleString()}
    </div>

    ${summary ? `
    <h2>Executive Summary</h2>
    <p>${escapeHTML(summary.overview.description)}</p>
    <div class="summary-grid">
      <div class="summary-item">
        <div class="summary-value">${summary.sla.rto || 'N/A'}</div>
        <div class="summary-label">Recovery Time (RTO)</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${summary.sla.rpo || 'N/A'}</div>
        <div class="summary-label">Recovery Point (RPO)</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${summary.sla.availabilityClass || 'N/A'}</div>
        <div class="summary-label">Availability Class</div>
      </div>
    </div>
    <h3>Security Commitments</h3>
    ${summary.commitments.map(c => `
      <div class="commitment">
        <span class="commitment-icon">✓</span>
        <span>${escapeHTML(c)}</span>
      </div>
    `).join('')}
    ` : ''}

    ${attestation ? `
    <h2>Attestation Results</h2>
    <p><strong>${attestation.profileName}</strong> <span class="status ${attestation.overallStatus.toLowerCase()}">${attestation.overallStatus}</span></p>
    <div class="summary-grid">
      <div class="summary-item">
        <div class="summary-value">${attestation.summary.sectionsTotal}</div>
        <div class="summary-label">Total Sections</div>
      </div>
      <div class="summary-item">
        <div class="summary-value" style="color: #10b981">${attestation.summary.sectionsPassed}</div>
        <div class="summary-label">Passed</div>
      </div>
      <div class="summary-item">
        <div class="summary-value" style="color: #ef4444">${attestation.summary.sectionsFailed}</div>
        <div class="summary-label">Failed</div>
      </div>
    </div>
    ${attestation.sections.map(s => `
      <div class="section ${s.status.toLowerCase()}">
        <div class="section-header">
          <span class="section-title">${s.section.replace(/_/g, ' ')}</span>
          <span class="status ${s.status.toLowerCase()}">${s.status}</span>
        </div>
        <p>${escapeHTML(s.message)}</p>
        <small>${s.dataPoints} data points</small>
      </div>
    `).join('')}
    ` : ''}

    ${questionnaire ? `
    <h2>Security Questionnaire</h2>
    <div class="summary-grid">
      <div class="summary-item">
        <div class="summary-value">${questionnaire.summary.total}</div>
        <div class="summary-label">Total Questions</div>
      </div>
      <div class="summary-item">
        <div class="summary-value" style="color: #10b981">${questionnaire.summary.passed}</div>
        <div class="summary-label">Passed</div>
      </div>
      <div class="summary-item">
        <div class="summary-value" style="color: #f59e0b">${questionnaire.summary.warned}</div>
        <div class="summary-label">Warnings</div>
      </div>
    </div>
    ${questionnaire.questions.map((q, i) => {
      const a = questionnaire.answers[i];
      const answer = a.answer === null ? 'N/A' :
        Array.isArray(a.answer) ? a.answer.join(', ') :
        typeof a.answer === 'boolean' ? (a.answer ? 'Yes' : 'No') :
        String(a.answer);
      return `
      <div class="qa-item">
        <div class="qa-question">${escapeHTML(q.question)}</div>
        <div class="qa-answer">${escapeHTML(answer)}</div>
        <div class="qa-meta">
          <span class="status ${a.status.toLowerCase()}">${a.status}</span>
          <span style="margin-left: 0.5rem;">${a.confidence} confidence</span>
          ${a.explanation ? `<br>${escapeHTML(a.explanation)}` : ''}
        </div>
      </div>
    `;}).join('')}
    ` : ''}

    ${whitepaper ? `
    <h2>Security Whitepaper</h2>
    ${Object.values(whitepaper.sections).map(s => `
      <div class="section ${s.status === 'AVAILABLE' ? 'pass' : s.status === 'PARTIAL' ? 'warn' : 'fail'}">
        <div class="section-header">
          <span class="section-title">${escapeHTML(s.title)}</span>
          <span class="status ${s.status.toLowerCase()}">${s.status}</span>
        </div>
        <p style="white-space: pre-wrap;">${escapeHTML(s.content)}</p>
      </div>
    `).join('')}
    ` : ''}

    <h2>Evidence Checksums</h2>
    <table class="checksum-table">
      <thead>
        <tr><th>Artifact</th><th>Checksum (SHA-256)</th></tr>
      </thead>
      <tbody>
        ${Object.entries(manifest.evidenceChecksums).map(([k, v]) => `
          <tr><td>${k}</td><td>${v}</td></tr>
        `).join('')}
        <tr><td><strong>Bundle</strong></td><td><strong>${bundle.checksum}</strong></td></tr>
      </tbody>
    </table>

    <div class="disclaimer">
      <strong>Disclaimer:</strong> This trust bundle was generated from production system evidence.
      All data points are derived from actual system state. No claims are manually authored.
      This document is time-limited and expires on ${new Date(manifest.expiresAt).toLocaleString()}.
    </div>

    <div class="footer">
      <p>Bundle ID: ${manifest.bundleId}</p>
      <p>Generated: ${new Date(manifest.createdAt).toISOString()}</p>
      <p>Bundle Checksum: ${bundle.checksum}</p>
    </div>
  </div>
</body>
</html>`;
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
// GET: Export Bundle
// ============================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const format = (searchParams.get('format') || 'html') as ExportFormat;

  // No token = 404
  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Not found' },
      { status: 404 }
    );
  }

  // Validate format
  if (!['json', 'csv', 'html'].includes(format)) {
    return NextResponse.json(
      { success: false, error: 'Invalid format. Use: json, csv, html' },
      { status: 400 }
    );
  }

  try {
    // Verify token
    const verification = await verifyBundleToken(token);

    if (!verification.valid) {
      return NextResponse.json(
        { success: false, error: 'Not found' },
        { status: 404 }
      );
    }

    // Get bundle contents
    const result = await getBundleContents(token);

    if (!result.success || !result.bundle) {
      return NextResponse.json(
        { success: false, error: 'Not found' },
        { status: 404 }
      );
    }

    const bundle = result.bundle;

    // Format response
    let content: string;
    let contentType: string;
    let filename: string;

    switch (format) {
      case 'csv':
        content = formatQuestionnaireCSV(bundle);
        contentType = 'text/csv';
        filename = `trust-bundle-questionnaire.csv`;
        break;

      case 'json':
        // Remove any internal IDs before export
        const exportBundle = {
          manifest: {
            bundleId: bundle.manifest.bundleId,
            profile: bundle.manifest.profile,
            label: bundle.manifest.label,
            createdAt: bundle.manifest.createdAt,
            expiresAt: bundle.manifest.expiresAt,
            overallStatus: bundle.manifest.overallStatus,
            includedSections: bundle.manifest.includedSections,
            evidenceChecksums: bundle.manifest.evidenceChecksums,
          },
          contents: bundle.contents,
          checksum: bundle.checksum,
          disclaimer: 'This bundle was generated from production system evidence. All data is evidence-derived. No claims are manually authored.',
        };
        content = JSON.stringify(exportBundle, null, 2);
        contentType = 'application/json';
        filename = `trust-bundle.json`;
        break;

      case 'html':
      default:
        content = formatFullHTML(bundle);
        contentType = 'text/html';
        filename = `trust-bundle.html`;
        break;
    }

    // Audit export
    await appendAuditLog({
      context: {
        workspaceId: verification.workspaceId!,
        actorId: 'public',
        actorRole: 'viewer',
      },
      action: 'EXPORT',
      entityType: 'trust_bundle',
      entityId: verification.bundleId!,
      scope: {
        platform: 'system',
        dataset: 'trust_bundles',
      },
      metadata: {
        trustAction: 'TRUST_BUNDLE_EXPORTED',
        profile: verification.profile,
        bundleChecksum: bundle.checksum,
        format,
      },
    });

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Bundle-Checksum': bundle.checksum,
      },
    });
  } catch (error) {
    console.error('D36: Bundle export error:', error);
    return NextResponse.json(
      { success: false, error: 'Not found' },
      { status: 404 }
    );
  }
}
