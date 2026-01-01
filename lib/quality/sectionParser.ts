// ============================================
// Section Parser - Robust Content Structure Detection
// ============================================
// Single source of truth for detecting Hook/Body/CTA sections
// in AI-generated content. Handles:
// - Markdown formatting (**bold**, *italic*, ## headings)
// - Vietnamese and English labels
// - Various punctuation styles (: - — etc.)
// - Emojis and whitespace variations
// ============================================

/**
 * Canonical section names
 */
export type SectionType = 'HOOK' | 'BODY' | 'CTA' | 'HASHTAGS' | 'OTHER';

/**
 * Parsed section with content
 */
export interface ParsedSection {
  type: SectionType;
  label: string;        // Original label as found (for debugging)
  content: string;      // Content under this section
  lineNumber: number;   // Line number where section starts
}

/**
 * Result of normalizing sections from content
 */
export interface NormalizedSections {
  hook: string | null;
  body: string | null;
  cta: string | null;
  hashtags: string | null;
  extras: Record<string, string>;  // Other sections not in the above
  raw: ParsedSection[];            // All parsed sections for debugging
}

/**
 * Result of structure validation
 */
export interface StructureValidation {
  ok: boolean;
  missing: SectionType[];
  warnings: string[];
  detected: SectionType[];
}

// ============================================
// Label Mappings (Vietnamese + English + Variants)
// ============================================

/**
 * Maps various label variations to canonical section types
 * Case-insensitive matching
 */
const LABEL_TO_SECTION: Record<string, SectionType> = {
  // HOOK variants (English)
  'hook': 'HOOK',
  'opening': 'HOOK',
  'hook line': 'HOOK',
  'intro': 'HOOK',
  'introduction': 'HOOK',
  'attention': 'HOOK',
  'lead': 'HOOK',
  'teaser': 'HOOK',

  // HOOK variants (Vietnamese with diacritics)
  'mở bài': 'HOOK',
  'điểm chạm': 'HOOK',
  'câu mở đầu': 'HOOK',
  'mở đầu': 'HOOK',
  'câu hook': 'HOOK',
  'dẫn nhập': 'HOOK',
  'lời mở đầu': 'HOOK',

  // HOOK variants (Vietnamese without diacritics - for robustness)
  'mo bai': 'HOOK',
  'diem cham': 'HOOK',
  'cau mo dau': 'HOOK',
  'mo dau': 'HOOK',
  'cau hook': 'HOOK',
  'dan nhap': 'HOOK',
  'loi mo dau': 'HOOK',

  // BODY variants (English)
  'body': 'BODY',
  'main content': 'BODY',
  'main': 'BODY',
  'content': 'BODY',
  'details': 'BODY',
  'description': 'BODY',

  // BODY variants (Vietnamese with diacritics)
  'nội dung': 'BODY',
  'thân bài': 'BODY',
  'nội dung chính': 'BODY',
  'phần thân': 'BODY',
  'chi tiết': 'BODY',

  // BODY variants (Vietnamese without diacritics)
  'noi dung': 'BODY',
  'than bai': 'BODY',
  'noi dung chinh': 'BODY',
  'phan than': 'BODY',
  'chi tiet': 'BODY',

  // CTA variants (English)
  'cta': 'CTA',
  'call-to-action': 'CTA',
  'call to action': 'CTA',
  'engagement cta': 'CTA',
  'action': 'CTA',
  'next step': 'CTA',
  'call': 'CTA',

  // CTA variants (Vietnamese with diacritics)
  'kêu gọi hành động': 'CTA',
  'hành động': 'CTA',
  'lời kêu gọi': 'CTA',
  'kết thúc': 'CTA',
  'kêu gọi': 'CTA',
  'hành động tiếp theo': 'CTA',

  // CTA variants (Vietnamese without diacritics)
  'keu goi hanh dong': 'CTA',
  'hanh dong': 'CTA',
  'loi keu goi': 'CTA',
  'ket thuc': 'CTA',
  'keu goi': 'CTA',
  'hanh dong tiep theo': 'CTA',

  // HASHTAGS variants
  'hashtags': 'HASHTAGS',
  'hashtag': 'HASHTAGS',
  'tags': 'HASHTAGS',
  'thẻ': 'HASHTAGS',
  'the': 'HASHTAGS',
  'thẻ tag': 'HASHTAGS',
  'the tag': 'HASHTAGS',
};

// ============================================
// Regex Patterns for Section Detection
// ============================================

/**
 * Result of trying to extract a section heading from a line
 */
interface HeadingMatch {
  label: string;
  inlineContent: string | null;  // Content on same line after heading (if any)
}

/**
 * Optional prefix pattern that matches:
 * - Emojis (various unicode ranges)
 * - Numbers with punctuation: "1." "1)" "(1)" "1:"
 * - Bullets: "•" "-" "*" ">"
 * - Whitespace
 */
const OPTIONAL_PREFIX = `(?:[\\u{1F300}-\\u{1F9FF}\\u{2600}-\\u{26FF}\\u{2700}-\\u{27BF}\\u{1F600}-\\u{1F64F}\\u{1F680}-\\u{1F6FF}\\u{2300}-\\u{23FF}\\u{2B50}\\u{2B55}\\u{25AA}-\\u{25AB}\\u{25B6}\\u{25C0}\\u{23E9}-\\u{23F3}]|\\d+[.):]|\\(\\d+\\)|[•\\-*>])*\\s*`;

/**
 * Patterns to detect section headings (heading-only lines, no content)
 * Each pattern captures: (1) the label text
 * All patterns allow optional emoji/number prefix
 */
const HEADING_ONLY_PATTERNS: RegExp[] = [
  // Pattern 1: **Label:** (bold with colon inside)
  new RegExp(`^\\s*${OPTIONAL_PREFIX}\\*\\*([^*:]+?):\\s*\\*\\*\\s*$`, 'u'),

  // Pattern 2: **Label:**: (bold with colon inside AND outside)
  new RegExp(`^\\s*${OPTIONAL_PREFIX}\\*\\*([^*:]+?):\\s*\\*\\*:\\s*$`, 'u'),

  // Pattern 3: **Label**: (bold then colon outside)
  new RegExp(`^\\s*${OPTIONAL_PREFIX}\\*\\*([^*:]+?)\\*\\*:\\s*$`, 'u'),

  // Pattern 4: **Label** (bold only, no colon - standalone line)
  new RegExp(`^\\s*${OPTIONAL_PREFIX}\\*\\*([^*:]+?)\\*\\*\\s*$`, 'u'),

  // Pattern 5: *Label:* (italic with colon inside)
  new RegExp(`^\\s*${OPTIONAL_PREFIX}\\*([^*:]+?):\\s*\\*\\s*$`, 'u'),

  // Pattern 6: ## Label or ### Label (markdown headings)
  new RegExp(`^\\s*#{1,3}\\s+${OPTIONAL_PREFIX}([^:\\-—]+?)\\s*$`, 'u'),

  // Pattern 7: Label: at start of line (plain text heading only)
  // Allows Vietnamese chars, extended Latin, and common punctuation
  new RegExp(`^\\s*${OPTIONAL_PREFIX}([A-Za-zÀ-ỹ][A-Za-zÀ-ỹ\\s\\-()]*?):\\s*$`, 'u'),

  // Pattern 8: **Label** — or **Label** - (separator style)
  new RegExp(`^\\s*${OPTIONAL_PREFIX}\\*\\*([^*]+?)\\*\\*\\s*[—\\-]\\s*$`, 'u'),

  // Pattern 9: [Label] bracket style
  new RegExp(`^\\s*${OPTIONAL_PREFIX}\\[([^\\]]+?)\\]\\s*[:\\s—\\-]*$`, 'u'),

  // Pattern 10: LABEL (all caps) on its own line
  new RegExp(`^\\s*${OPTIONAL_PREFIX}([A-Z][A-Z\\s\\-]{2,})\\s*[:\\s—\\-]*$`, 'u'),

  // Pattern 11: 🔥 Label: (emoji then label with colon, no bold)
  new RegExp(`^\\s*[\\u{1F300}-\\u{1F9FF}\\u{2600}-\\u{26FF}\\u{2700}-\\u{27BF}\\u{1F600}-\\u{1F64F}]+\\s*([A-Za-zÀ-ỹ][A-Za-zÀ-ỹ\\s\\-()]*?):\\s*$`, 'u'),
];

/**
 * Patterns to detect inline headings (heading + content on same line)
 * Each pattern captures: (1) the label text, (2) the inline content
 * All patterns allow optional emoji/number prefix
 */
const INLINE_HEADING_PATTERNS: RegExp[] = [
  // Pattern 1: **Label:** content
  new RegExp(`^\\s*${OPTIONAL_PREFIX}\\*\\*([^*:]+?):\\s*\\*\\*:?\\s*(.+)$`, 'u'),

  // Pattern 2: **Label**: content (colon outside bold)
  new RegExp(`^\\s*${OPTIONAL_PREFIX}\\*\\*([^*:]+?)\\*\\*:\\s*(.+)$`, 'u'),

  // Pattern 3: *Label:* content
  new RegExp(`^\\s*${OPTIONAL_PREFIX}\\*([^*:]+?):\\s*\\*:?\\s*(.+)$`, 'u'),

  // Pattern 4: ## Label: content or ## Label - content
  new RegExp(`^\\s*#{1,3}\\s+${OPTIONAL_PREFIX}([^:\\-—]+?)\\s*[:\\-—]\\s*(.+)$`, 'u'),

  // Pattern 5: Label: content (plain text)
  new RegExp(`^\\s*${OPTIONAL_PREFIX}([A-Za-zÀ-ỹ][A-Za-zÀ-ỹ\\s\\-()]{1,30}):\\s+(.+)$`, 'u'),

  // Pattern 6: 🔥 Label: content (emoji prefix inline)
  new RegExp(`^\\s*[\\u{1F300}-\\u{1F9FF}\\u{2600}-\\u{26FF}\\u{2700}-\\u{27BF}\\u{1F600}-\\u{1F64F}]+\\s*([A-Za-zÀ-ỹ][A-Za-zÀ-ỹ\\s\\-()]*?):\\s+(.+)$`, 'u'),
];

// ============================================
// Core Parsing Functions
// ============================================

/**
 * Normalize a label string to lowercase, remove diacritics for matching
 */
function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .trim()
    // Remove emojis
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
    .trim();
}

/**
 * Map a raw label to a canonical section type
 */
function mapLabelToSection(label: string): SectionType {
  const normalized = normalizeLabel(label);
  return LABEL_TO_SECTION[normalized] || 'OTHER';
}

/**
 * Check if a line is a section heading and extract the label + optional inline content
 */
function extractSectionHeading(line: string): HeadingMatch | null {
  // First try heading-only patterns (more specific)
  for (const pattern of HEADING_ONLY_PATTERNS) {
    const match = line.match(pattern);
    if (match && match[1]) {
      return {
        label: match[1].trim(),
        inlineContent: null,
      };
    }
  }

  // Then try inline heading patterns (heading + content on same line)
  for (const pattern of INLINE_HEADING_PATTERNS) {
    const match = line.match(pattern);
    if (match && match[1] && match[2]) {
      return {
        label: match[1].trim(),
        inlineContent: match[2].trim(),
      };
    }
  }

  return null;
}

/**
 * Parse content into sections
 * @param content - Raw AI output content
 * @returns Array of parsed sections with their content
 */
export function parseSections(content: string): ParsedSection[] {
  const lines = content.split('\n');
  const sections: ParsedSection[] = [];

  let currentSection: ParsedSection | null = null;
  let contentLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const heading = extractSectionHeading(line);

    if (heading) {
      // Save previous section if exists
      if (currentSection) {
        currentSection.content = contentLines.join('\n').trim();
        sections.push(currentSection);
      }

      // Start new section
      currentSection = {
        type: mapLabelToSection(heading.label),
        label: heading.label,
        content: '',
        lineNumber: i + 1,
      };

      // If heading has inline content, start with it
      if (heading.inlineContent) {
        contentLines = [heading.inlineContent];
      } else {
        contentLines = [];
      }
    } else if (currentSection) {
      // Add line to current section content
      contentLines.push(line);
    }
    // Lines before any section heading are ignored (usually empty)
  }

  // Save last section
  if (currentSection) {
    currentSection.content = contentLines.join('\n').trim();
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Normalize content into structured sections
 * @param content - Raw AI output content
 * @returns Normalized sections with hook, body, cta, etc.
 */
export function normalizeSections(content: string): NormalizedSections {
  const parsed = parseSections(content);

  const result: NormalizedSections = {
    hook: null,
    body: null,
    cta: null,
    hashtags: null,
    extras: {},
    raw: parsed,
  };

  for (const section of parsed) {
    switch (section.type) {
      case 'HOOK':
        // Merge if multiple hooks (shouldn't happen but be safe)
        result.hook = result.hook
          ? result.hook + '\n\n' + section.content
          : section.content;
        break;
      case 'BODY':
        result.body = result.body
          ? result.body + '\n\n' + section.content
          : section.content;
        break;
      case 'CTA':
        result.cta = result.cta
          ? result.cta + '\n\n' + section.content
          : section.content;
        break;
      case 'HASHTAGS':
        result.hashtags = result.hashtags
          ? result.hashtags + ' ' + section.content
          : section.content;
        break;
      case 'OTHER':
        // Store in extras with original label as key
        result.extras[section.label] = section.content;
        break;
    }
  }

  return result;
}

/**
 * Validate that required sections are present and non-empty
 * @param sections - Normalized sections
 * @param required - List of required section types (default: Hook, Body, CTA)
 * @returns Validation result with missing sections and warnings
 */
export function validateStructure(
  sections: NormalizedSections,
  required: SectionType[] = ['HOOK', 'BODY', 'CTA']
): StructureValidation {
  const missing: SectionType[] = [];
  const warnings: string[] = [];
  const detected: SectionType[] = [];

  // Check each required section
  for (const sectionType of required) {
    let content: string | null = null;

    switch (sectionType) {
      case 'HOOK':
        content = sections.hook;
        break;
      case 'BODY':
        content = sections.body;
        break;
      case 'CTA':
        content = sections.cta;
        break;
      case 'HASHTAGS':
        content = sections.hashtags;
        break;
    }

    if (content && content.trim().length > 0) {
      detected.push(sectionType);

      // Check for suspiciously short content (warning, not failure)
      if (content.trim().length < 10) {
        warnings.push(`${sectionType} section exists but is very short (${content.trim().length} chars)`);
      }
    } else {
      missing.push(sectionType);
    }
  }

  return {
    ok: missing.length === 0,
    missing,
    warnings,
    detected,
  };
}

/**
 * Check if content has a section (quick check without full parsing)
 * @param content - Raw content
 * @param sectionType - Section type to check for
 * @returns true if section is detected
 */
export function hasSection(content: string, sectionType: SectionType): boolean {
  const sections = normalizeSections(content);

  switch (sectionType) {
    case 'HOOK':
      return !!sections.hook && sections.hook.trim().length > 0;
    case 'BODY':
      return !!sections.body && sections.body.trim().length > 0;
    case 'CTA':
      return !!sections.cta && sections.cta.trim().length > 0;
    case 'HASHTAGS':
      return !!sections.hashtags && sections.hashtags.trim().length > 0;
    default:
      return false;
  }
}

/**
 * Get section content by type
 * @param content - Raw content
 * @param sectionType - Section type to extract
 * @returns Section content or null if not found
 */
export function getSectionContent(content: string, sectionType: SectionType): string | null {
  const sections = normalizeSections(content);

  switch (sectionType) {
    case 'HOOK':
      return sections.hook;
    case 'BODY':
      return sections.body;
    case 'CTA':
      return sections.cta;
    case 'HASHTAGS':
      return sections.hashtags;
    default:
      return null;
  }
}

// ============================================
// Debug Helpers
// ============================================

/**
 * Log section detection details (for development debugging)
 */
export function debugSectionDetection(content: string): void {
  const sections = normalizeSections(content);
  const validation = validateStructure(sections);

  console.log('[SectionParser] Detection Results:');
  console.log('  Hook:', sections.hook ? `Found (${sections.hook.length} chars)` : 'NOT FOUND');
  console.log('  Body:', sections.body ? `Found (${sections.body.length} chars)` : 'NOT FOUND');
  console.log('  CTA:', sections.cta ? `Found (${sections.cta.length} chars)` : 'NOT FOUND');
  console.log('  Hashtags:', sections.hashtags ? `Found (${sections.hashtags.length} chars)` : 'NOT FOUND');
  console.log('  Extras:', Object.keys(sections.extras).length > 0 ? Object.keys(sections.extras).join(', ') : 'None');
  console.log('  Validation:', validation.ok ? 'PASS' : `FAIL (missing: ${validation.missing.join(', ')})`);
  if (validation.warnings.length > 0) {
    console.log('  Warnings:', validation.warnings.join('; '));
  }
  console.log('  Raw sections:', sections.raw.map(s => `${s.type}:${s.label}`).join(', '));
}
