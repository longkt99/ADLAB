// ============================================
// RFP Response Pack Generator
// ============================================
// PHASE D44: Procurement & Security Response Layer.
//
// PURPOSE:
// Generates procurement-ready response packs from
// security answers and evidence context. Supports
// multiple output formats for different review workflows.
//
// SUPPORTED FORMATS:
// - JSON: Machine-readable for automated review
// - Markdown: Human-readable for security teams
// - CSV: Procurement checklists and spreadsheets
//
// INVARIANTS:
// - Evidence-derived only
// - No PII in outputs
// - Legal disclaimer required on all packs
// - Timestamp all responses
// - Include confidence indicators
// ============================================

import {
  resolveAllSecurityAnswers,
  
  type SecurityAnswer,
  type AnswerResolutionResult,
  type EvidenceContext,
  type SecurityQuestionCategory,
  type AnswerStatus,
  
  getStatusLabel,
} from './securityAnswerEngine';

// ============================================
// Types
// ============================================

/**
 * Supported export formats for RFP response packs.
 */
export type RFPExportFormat = 'json' | 'markdown' | 'csv';

/**
 * Response pack metadata.
 */
export interface ResponsePackMetadata {
  /** Unique pack identifier */
  packId: string;
  /** Workspace that generated the pack */
  workspaceId: string;
  /** Bundle ID if applicable */
  bundleId: string | null;
  /** Generation timestamp (ISO 8601) */
  generatedAt: string;
  /** Export format */
  format: RFPExportFormat;
  /** Total questions answered */
  totalQuestions: number;
  /** Questions with complete answers */
  answeredCount: number;
  /** Questions with partial answers */
  partialCount: number;
  /** Questions unavailable */
  unavailableCount: number;
  /** Overall completion percentage */
  completionPercentage: number;
}

/**
 * Individual response item in a pack.
 */
export interface ResponseItem {
  /** Question ID */
  questionId: string;
  /** Question category */
  category: SecurityQuestionCategory;
  /** Original question text */
  question: string;
  /** Final answer */
  answer: string;
  /** Answer status */
  status: AnswerStatus;
  /** Evidence references */
  evidenceReferences: string[];
  /** Response timestamp */
  timestamp: string;
  /** Confidence indicator (0-100) */
  confidence: number;
}

/**
 * Complete RFP response pack.
 */
export interface RFPResponsePack {
  /** Pack metadata */
  metadata: ResponsePackMetadata;
  /** Legal disclaimer */
  legalDisclaimer: string;
  /** Response items */
  responses: ResponseItem[];
  /** Category summaries */
  categorySummaries: CategorySummary[];
}

/**
 * Summary for a question category.
 */
export interface CategorySummary {
  category: SecurityQuestionCategory;
  categoryLabel: string;
  totalQuestions: number;
  answered: number;
  partial: number;
  unavailable: number;
  completionRate: number;
}

/**
 * Generated pack result.
 */
export interface GeneratedPack {
  /** Format-specific content */
  content: string;
  /** Content type for HTTP response */
  contentType: string;
  /** Suggested filename */
  filename: string;
  /** Pack metadata */
  metadata: ResponsePackMetadata;
}

// ============================================
// Constants
// ============================================

/**
 * Standard legal disclaimer for all response packs.
 */
const LEGAL_DISCLAIMER = `LEGAL DISCLAIMER

This response pack is generated from evidence-derived security controls and attestations. All answers reflect the current documented state of the system as of the generation timestamp.

IMPORTANT NOTICES:
1. This document is provided for informational purposes during procurement evaluation.
2. Answers are derived from aggregate system evidence, not individual behavioral data.
3. "PARTIAL" answers indicate areas where documentation is incomplete or controls are in progress.
4. "UNAVAILABLE" answers indicate areas outside current system scope or documentation.
5. This pack does not constitute a legal commitment or contractual obligation.
6. For binding commitments, please request formal attestations through your account representative.
7. All timestamps are in ISO 8601 format (UTC).

VERIFICATION:
Recipients may verify the authenticity of this pack by contacting the issuing organization with the Pack ID shown in the metadata.

NO WARRANTY:
This information is provided "AS IS" without warranty of any kind, express or implied.`;

/**
 * Category labels for human-readable output.
 */
const CATEGORY_LABELS: Record<SecurityQuestionCategory, string> = {
  ACCESS_CONTROL: 'Access Control & Authentication',
  AUDIT_LOGGING: 'Audit & Logging',
  INCIDENT_RESPONSE: 'Incident Response',
  DATA_PROTECTION: 'Data Protection & Encryption',
  AVAILABILITY: 'Availability & Business Continuity',
  COMPLIANCE: 'Compliance & Certifications',
  CHANGE_MANAGEMENT: 'Change Management',
  PRIVACY: 'Privacy & Data Handling',
};

// ============================================
// Helper Functions
// ============================================

/**
 * Generates a unique pack ID.
 */
function generatePackId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `RFP-${timestamp}-${random}`.toUpperCase();
}

/**
 * Calculates confidence score based on answer status and evidence count.
 */
function calculateConfidence(answer: SecurityAnswer): number {
  const statusBase: Record<AnswerStatus, number> = {
    ANSWERED: 80,
    PARTIAL: 50,
    UNAVAILABLE: 0,
  };

  let confidence = statusBase[answer.status];

  // Boost for evidence references
  if (answer.evidenceReferences.length > 0) {
    confidence += Math.min(answer.evidenceReferences.length * 5, 20);
  }

  return Math.min(confidence, 100);
}

/**
 * Converts answer resolution result to response items.
 */
function convertToResponseItems(
  result: AnswerResolutionResult
): ResponseItem[] {
  const timestamp = new Date().toISOString();

  return result.answers.map((answer) => ({
    questionId: answer.questionId,
    category: answer.category,
    question: answer.question,
    answer: answer.answer,
    status: answer.status,
    // Convert EvidenceReference objects to string descriptions
    evidenceReferences: answer.evidenceReferences.map(
      (ref) => `${ref.sourceType}: ${ref.description}`
    ),
    timestamp,
    confidence: calculateConfidence(answer),
  }));
}

/**
 * Generates category summaries from response items.
 */
function generateCategorySummaries(
  responses: ResponseItem[]
): CategorySummary[] {
  const categories = new Map<SecurityQuestionCategory, CategorySummary>();

  // Initialize all categories
  for (const category of Object.keys(CATEGORY_LABELS) as SecurityQuestionCategory[]) {
    categories.set(category, {
      category,
      categoryLabel: CATEGORY_LABELS[category],
      totalQuestions: 0,
      answered: 0,
      partial: 0,
      unavailable: 0,
      completionRate: 0,
    });
  }

  // Count responses by category
  for (const response of responses) {
    const summary = categories.get(response.category);
    if (summary) {
      summary.totalQuestions++;
      if (response.status === 'ANSWERED') summary.answered++;
      else if (response.status === 'PARTIAL') summary.partial++;
      else summary.unavailable++;
    }
  }

  // Calculate completion rates
  for (const summary of categories.values()) {
    if (summary.totalQuestions > 0) {
      summary.completionRate = Math.round(
        ((summary.answered + summary.partial * 0.5) / summary.totalQuestions) * 100
      );
    }
  }

  return Array.from(categories.values()).filter((s) => s.totalQuestions > 0);
}

/**
 * Creates pack metadata.
 */
function createPackMetadata(
  workspaceId: string,
  bundleId: string | null,
  format: RFPExportFormat,
  responses: ResponseItem[]
): ResponsePackMetadata {
  const answered = responses.filter((r) => r.status === 'ANSWERED').length;
  const partial = responses.filter((r) => r.status === 'PARTIAL').length;
  const unavailable = responses.filter((r) => r.status === 'UNAVAILABLE').length;

  return {
    packId: generatePackId(),
    workspaceId,
    bundleId,
    generatedAt: new Date().toISOString(),
    format,
    totalQuestions: responses.length,
    answeredCount: answered,
    partialCount: partial,
    unavailableCount: unavailable,
    completionPercentage: Math.round(
      ((answered + partial * 0.5) / responses.length) * 100
    ),
  };
}

// ============================================
// Format Generators
// ============================================

/**
 * Generates JSON format response pack.
 */
function generateJSONPack(pack: RFPResponsePack): string {
  return JSON.stringify(pack, null, 2);
}

/**
 * Generates Markdown format response pack.
 */
function generateMarkdownPack(pack: RFPResponsePack): string {
  const lines: string[] = [];

  // Header
  lines.push('# Security & Compliance Response Pack');
  lines.push('');
  lines.push('---');
  lines.push('');

  // Metadata
  lines.push('## Pack Information');
  lines.push('');
  lines.push(`| Field | Value |`);
  lines.push(`|-------|-------|`);
  lines.push(`| Pack ID | ${pack.metadata.packId} |`);
  lines.push(`| Generated | ${pack.metadata.generatedAt} |`);
  lines.push(`| Total Questions | ${pack.metadata.totalQuestions} |`);
  lines.push(`| Answered | ${pack.metadata.answeredCount} |`);
  lines.push(`| Partial | ${pack.metadata.partialCount} |`);
  lines.push(`| Unavailable | ${pack.metadata.unavailableCount} |`);
  lines.push(`| Completion | ${pack.metadata.completionPercentage}% |`);
  lines.push('');

  // Category Summary
  lines.push('## Category Summary');
  lines.push('');
  lines.push('| Category | Questions | Answered | Partial | Unavailable | Completion |');
  lines.push('|----------|-----------|----------|---------|-------------|------------|');
  for (const summary of pack.categorySummaries) {
    lines.push(
      `| ${summary.categoryLabel} | ${summary.totalQuestions} | ${summary.answered} | ${summary.partial} | ${summary.unavailable} | ${summary.completionRate}% |`
    );
  }
  lines.push('');

  // Responses by Category
  lines.push('## Detailed Responses');
  lines.push('');

  const responsesByCategory = new Map<SecurityQuestionCategory, ResponseItem[]>();
  for (const response of pack.responses) {
    const existing = responsesByCategory.get(response.category) || [];
    existing.push(response);
    responsesByCategory.set(response.category, existing);
  }

  for (const [category, responses] of responsesByCategory) {
    lines.push(`### ${CATEGORY_LABELS[category]}`);
    lines.push('');

    for (const response of responses) {
      const statusEmoji =
        response.status === 'ANSWERED'
          ? '✅'
          : response.status === 'PARTIAL'
          ? '⚠️'
          : '❌';

      lines.push(`#### ${statusEmoji} ${response.question}`);
      lines.push('');
      lines.push(`**Status:** ${getStatusLabel(response.status)}`);
      lines.push('');
      lines.push(`**Answer:**`);
      lines.push('');
      lines.push(`> ${response.answer}`);
      lines.push('');

      if (response.evidenceReferences.length > 0) {
        lines.push('**Evidence References:**');
        for (const ref of response.evidenceReferences) {
          lines.push(`- ${ref}`);
        }
        lines.push('');
      }

      lines.push(`**Confidence:** ${response.confidence}%`);
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }

  // Legal Disclaimer
  lines.push('## Legal Disclaimer');
  lines.push('');
  lines.push('```');
  lines.push(pack.legalDisclaimer);
  lines.push('```');
  lines.push('');

  // Footer
  lines.push('---');
  lines.push('');
  lines.push(`*Generated: ${pack.metadata.generatedAt}*`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Generates CSV format response pack.
 */
function generateCSVPack(pack: RFPResponsePack): string {
  const lines: string[] = [];

  // Header row
  lines.push(
    'Question ID,Category,Question,Answer,Status,Confidence,Evidence References,Timestamp'
  );

  // Data rows
  for (const response of pack.responses) {
    const escapedQuestion = `"${response.question.replace(/"/g, '""')}"`;
    const escapedAnswer = `"${response.answer.replace(/"/g, '""')}"`;
    const escapedEvidence = `"${response.evidenceReferences.join('; ').replace(/"/g, '""')}"`;

    lines.push(
      [
        response.questionId,
        response.category,
        escapedQuestion,
        escapedAnswer,
        response.status,
        response.confidence,
        escapedEvidence,
        response.timestamp,
      ].join(',')
    );
  }

  // Add metadata as comments at the end
  lines.push('');
  lines.push(`# Pack ID: ${pack.metadata.packId}`);
  lines.push(`# Generated: ${pack.metadata.generatedAt}`);
  lines.push(`# Total Questions: ${pack.metadata.totalQuestions}`);
  lines.push(`# Completion: ${pack.metadata.completionPercentage}%`);

  return lines.join('\n');
}

// ============================================
// Public API
// ============================================

/**
 * Generates an RFP response pack from evidence context.
 *
 * @param workspaceId - Workspace generating the pack
 * @param bundleId - Optional bundle ID for context
 * @param context - Evidence context for answer resolution
 * @param format - Desired export format
 * @returns Generated pack with content and metadata
 */
export function generateRFPResponsePack(
  workspaceId: string,
  bundleId: string | null,
  context: EvidenceContext,
  format: RFPExportFormat
): GeneratedPack {
  // Resolve all security answers
  const answerResult = resolveAllSecurityAnswers(context);

  // Convert to response items
  const responses = convertToResponseItems(answerResult);

  // Generate category summaries
  const categorySummaries = generateCategorySummaries(responses);

  // Create metadata
  const metadata = createPackMetadata(workspaceId, bundleId, format, responses);

  // Build pack
  const pack: RFPResponsePack = {
    metadata,
    legalDisclaimer: LEGAL_DISCLAIMER,
    responses,
    categorySummaries,
  };

  // Generate format-specific content
  let content: string;
  let contentType: string;
  let extension: string;

  switch (format) {
    case 'json':
      content = generateJSONPack(pack);
      contentType = 'application/json';
      extension = 'json';
      break;
    case 'markdown':
      content = generateMarkdownPack(pack);
      contentType = 'text/markdown';
      extension = 'md';
      break;
    case 'csv':
      content = generateCSVPack(pack);
      contentType = 'text/csv';
      extension = 'csv';
      break;
  }

  const filename = `security-response-${metadata.packId}.${extension}`;

  return {
    content,
    contentType,
    filename,
    metadata,
  };
}

/**
 * Generates response packs in all supported formats.
 *
 * @param workspaceId - Workspace generating the packs
 * @param bundleId - Optional bundle ID for context
 * @param context - Evidence context for answer resolution
 * @returns Array of generated packs in all formats
 */
export function generateAllFormatPacks(
  workspaceId: string,
  bundleId: string | null,
  context: EvidenceContext
): GeneratedPack[] {
  const formats: RFPExportFormat[] = ['json', 'markdown', 'csv'];
  return formats.map((format) =>
    generateRFPResponsePack(workspaceId, bundleId, context, format)
  );
}

/**
 * Gets supported export formats with descriptions.
 */
export function getSupportedFormats(): Array<{
  format: RFPExportFormat;
  label: string;
  description: string;
  contentType: string;
}> {
  return [
    {
      format: 'json',
      label: 'JSON',
      description: 'Machine-readable format for automated review systems',
      contentType: 'application/json',
    },
    {
      format: 'markdown',
      label: 'Markdown',
      description: 'Human-readable format for security team review',
      contentType: 'text/markdown',
    },
    {
      format: 'csv',
      label: 'CSV',
      description: 'Spreadsheet format for procurement checklists',
      contentType: 'text/csv',
    },
  ];
}

/**
 * Validates a format string.
 */
export function isValidFormat(format: string): format is RFPExportFormat {
  return ['json', 'markdown', 'csv'].includes(format);
}

// ============================================
// Re-exports for convenience
// ============================================

export { LEGAL_DISCLAIMER, CATEGORY_LABELS };
