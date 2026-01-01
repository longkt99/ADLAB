// ============================================
// Transform Output Contract
// ============================================
// Extracts immutable output requirements from user input
// and validates AI output against them.
// ============================================

import type {
  TransformOutputContract,
  ContractValidationResult,
  ContractViolation,
  StructureElement,
} from '@/types/orchestrator';

// ============================================
// Word Count Extraction Patterns
// ============================================

/**
 * Patterns for detecting word count requirements in Vietnamese
 */
const WORD_COUNT_PATTERNS_VI: Array<{
  pattern: RegExp;
  extract: (match: RegExpMatchArray) => { min: number; max: number };
}> = [
  // "dài X từ" / "X từ" / "khoảng X từ"
  {
    pattern: /(?:dài|khoảng|tầm|chừng|độ)?\s*(\d+)\s*(?:từ|chữ|word)/i,
    extract: (match) => {
      const count = parseInt(match[1], 10);
      return { min: Math.floor(count * 0.95), max: Math.ceil(count * 1.05) };
    },
  },
  // "từ X đến Y từ" / "X-Y từ"
  {
    pattern: /(?:từ\s+)?(\d+)\s*(?:đến|-)\s*(\d+)\s*(?:từ|chữ|word)/i,
    extract: (match) => ({
      min: parseInt(match[1], 10),
      max: parseInt(match[2], 10),
    }),
  },
  // "ít nhất X từ"
  {
    pattern: /ít\s+nhất\s+(\d+)\s*(?:từ|chữ|word)/i,
    extract: (match) => ({
      min: parseInt(match[1], 10),
      max: Infinity,
    }),
  },
  // "tối đa X từ" / "không quá X từ"
  {
    pattern: /(?:tối\s+đa|không\s+quá|dưới)\s+(\d+)\s*(?:từ|chữ|word)/i,
    extract: (match) => ({
      min: 0,
      max: parseInt(match[1], 10),
    }),
  },
  // "ngắn hơn" / "dài hơn" with multiplier
  {
    pattern: /dài\s+(?:hơn|gấp)\s*(\d+(?:\.\d+)?)\s*(?:lần)?/i,
    extract: (match) => ({
      min: 0, // Will be calculated relative to source
      max: Infinity,
      multiplier: parseFloat(match[1]),
    } as any),
  },
];

/**
 * Patterns for detecting word count requirements in English
 */
const WORD_COUNT_PATTERNS_EN: Array<{
  pattern: RegExp;
  extract: (match: RegExpMatchArray) => { min: number; max: number };
}> = [
  // "X words" / "about X words"
  {
    pattern: /(?:about|around|approximately)?\s*(\d+)\s*words?/i,
    extract: (match) => {
      const count = parseInt(match[1], 10);
      return { min: Math.floor(count * 0.95), max: Math.ceil(count * 1.05) };
    },
  },
  // "X to Y words" / "X-Y words"
  {
    pattern: /(\d+)\s*(?:to|-)\s*(\d+)\s*words?/i,
    extract: (match) => ({
      min: parseInt(match[1], 10),
      max: parseInt(match[2], 10),
    }),
  },
  // "at least X words" / "minimum X words"
  {
    pattern: /(?:at\s+least|minimum)\s+(\d+)\s*words?/i,
    extract: (match) => ({
      min: parseInt(match[1], 10),
      max: Infinity,
    }),
  },
  // "at most X words" / "maximum X words" / "no more than X words"
  {
    pattern: /(?:at\s+most|maximum|no\s+more\s+than|under)\s+(\d+)\s*words?/i,
    extract: (match) => ({
      min: 0,
      max: parseInt(match[1], 10),
    }),
  },
];

// ============================================
// Tone Extraction Patterns
// ============================================

const TONE_PATTERNS: Array<{ pattern: RegExp; tone: string }> = [
  // Vietnamese tones
  { pattern: /chuyên\s*nghiệp/i, tone: 'professional' },
  { pattern: /thân\s*thiện/i, tone: 'friendly' },
  { pattern: /hài\s*hước/i, tone: 'humorous' },
  { pattern: /nghiêm\s*túc/i, tone: 'serious' },
  { pattern: /trẻ\s*trung/i, tone: 'youthful' },
  { pattern: /trang\s*trọng/i, tone: 'formal' },
  { pattern: /giọng\s+(GenZ|gen\s*z)/i, tone: 'genz' },
  // English tones
  { pattern: /\bprofessional\b/i, tone: 'professional' },
  { pattern: /\bfriendly\b/i, tone: 'friendly' },
  { pattern: /\bhumorous\b/i, tone: 'humorous' },
  { pattern: /\bserious\b/i, tone: 'serious' },
  { pattern: /\bformal\b/i, tone: 'formal' },
  { pattern: /\bcasual\b/i, tone: 'casual' },
];

// ============================================
// Structure Detection
// ============================================

/**
 * Detect structural elements in content
 */
export function detectStructure(content: string): StructureElement[] {
  const elements: StructureElement[] = [];

  // Detect HOOK (compelling first sentence/paragraph)
  const firstParagraph = content.split(/\n\n/)[0] || '';
  if (
    firstParagraph.length > 20 &&
    firstParagraph.length < 300 &&
    (firstParagraph.includes('?') ||
      /^[🎯🔥💡✨⚡️👉🚀]/.test(firstParagraph) ||
      /bạn\s+(có|đã|từng)/i.test(firstParagraph))
  ) {
    elements.push('HOOK');
  }

  // Detect BODY (substantial content)
  if (content.length > 200) {
    elements.push('BODY');
  }

  // Detect CTA (call to action)
  if (
    /(?:liên\s*hệ|đăng\s*ký|mua\s*ngay|click|inbox|comment|share|follow|subscribe)/i.test(
      content
    ) ||
    /(?:hotline|sdt|điện\s*thoại|zalo|facebook|website)[\s:]+/i.test(content)
  ) {
    elements.push('CTA');
  }

  // Detect HEADING (markdown or caps headings)
  if (/^#{1,3}\s+/m.test(content) || /^[A-Z][A-Z\s]+:?\n/m.test(content)) {
    elements.push('HEADING');
  }

  // Detect LIST (bullet or numbered)
  if (/^[\-\*•]\s+/m.test(content) || /^\d+[.\)]\s+/m.test(content)) {
    elements.push('LIST');
  }

  return elements;
}

/**
 * Count words in content (handles Vietnamese)
 */
export function countWords(content: string): number {
  // Remove markdown formatting
  const cleaned = content
    .replace(/```[\s\S]*?```/g, '') // Code blocks
    .replace(/`[^`]+`/g, '') // Inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
    .replace(/[#*_~`]/g, '') // Markdown symbols
    .trim();

  // Split by whitespace and filter empty
  const words = cleaned.split(/\s+/).filter((w) => w.length > 0);
  return words.length;
}

// ============================================
// Contract Extraction
// ============================================

/**
 * Extract transform output contract from user input
 * @param userInput - User's transform instruction
 * @param sourceContent - Original source content (for relative calculations)
 * @returns Immutable output contract
 */
export function extractOutputContract(
  userInput: string,
  sourceContent: string
): TransformOutputContract {
  let requiredMinWords: number | null = null;
  let requiredMaxWords: number | null = null;
  let requiredTone: string | null = null;
  const requiredStructure: StructureElement[] = [];

  // Extract word count requirements (Vietnamese first, then English)
  const allPatterns = [...WORD_COUNT_PATTERNS_VI, ...WORD_COUNT_PATTERNS_EN];
  for (const { pattern, extract } of allPatterns) {
    const match = userInput.match(pattern);
    if (match) {
      const { min, max } = extract(match);
      requiredMinWords = min > 0 ? min : null;
      requiredMaxWords = max < Infinity ? max : null;
      break; // Use first match only
    }
  }

  // Extract tone requirements
  for (const { pattern, tone } of TONE_PATTERNS) {
    if (pattern.test(userInput)) {
      requiredTone = tone;
      break;
    }
  }

  // Detect source structure (for preservation)
  const sourceStructure = detectStructure(sourceContent);
  // Only require structure preservation for PURE transforms (no new directives)
  // For now, we don't enforce structure unless explicitly requested

  // Determine if this is a strict contract
  const isStrict = requiredMinWords !== null || requiredMaxWords !== null;

  return {
    requiredMinWords,
    requiredMaxWords,
    requiredStructure,
    requiredTone,
    derivedFrom: userInput.substring(0, 100),
    isStrict,
  };
}

// ============================================
// Contract Validation
// ============================================

/**
 * Validate AI output against the contract
 * @param output - AI-generated output
 * @param contract - Output contract to validate against
 * @returns Validation result with violations
 */
export function validateOutputContract(
  output: string,
  contract: TransformOutputContract
): ContractValidationResult {
  const violations: ContractViolation[] = [];
  const wordCount = countWords(output);
  const structureDetected = detectStructure(output);

  // Validate word count
  if (contract.requiredMinWords !== null && wordCount < contract.requiredMinWords) {
    violations.push({
      type: 'LENGTH',
      expected: `≥ ${contract.requiredMinWords} từ`,
      actual: `${wordCount} từ`,
      severity: 'HARD', // Length violations are always HARD
    });
  }

  if (contract.requiredMaxWords !== null && wordCount > contract.requiredMaxWords) {
    violations.push({
      type: 'LENGTH',
      expected: `≤ ${contract.requiredMaxWords} từ`,
      actual: `${wordCount} từ`,
      severity: 'HARD',
    });
  }

  // Validate structure (if required)
  for (const required of contract.requiredStructure) {
    if (!structureDetected.includes(required)) {
      violations.push({
        type: 'STRUCTURE',
        expected: required,
        actual: structureDetected.join(', ') || 'none',
        severity: 'SOFT', // Structure violations are SOFT
      });
    }
  }

  // Check for HARD violations
  const hasHardViolations = violations.some((v) => v.severity === 'HARD');

  return {
    passed: !hasHardViolations,
    violations,
    wordCount,
    structureDetected,
    canRetry: hasHardViolations, // Can retry if there are hard violations
  };
}

/**
 * Build enforcement instruction for retry
 * @param violations - Contract violations from previous attempt
 * @returns Enforcement instruction to prepend to system prompt
 */
export function buildEnforcementInstruction(violations: ContractViolation[]): string {
  const reasons = violations
    .filter((v) => v.severity === 'HARD')
    .map((v) => {
      switch (v.type) {
        case 'LENGTH':
          return `Output length was ${v.actual} but MUST be ${v.expected}`;
        case 'STRUCTURE':
          return `Missing required structure: ${v.expected}`;
        case 'TONE':
          return `Tone was ${v.actual} but MUST be ${v.expected}`;
        case 'TOPIC':
          return `Topic drifted: ${v.actual}`;
        default:
          return `Violation: ${v.expected} vs ${v.actual}`;
      }
    });

  return `
⚠️ CRITICAL: Your previous output was INVALID.

VIOLATIONS:
${reasons.map((r) => `- ${r}`).join('\n')}

YOU MUST:
- Fix ALL violations listed above
- Meet the EXACT requirements
- Do NOT provide a shorter/different version
- Do NOT explain or apologize - just output the correct content

This is your FINAL attempt. Failure will result in rejection.
`;
}

/**
 * Build contract instruction for system prompt
 * @param contract - Output contract
 * @returns Instruction to include in system prompt
 */
export function buildContractInstruction(contract: TransformOutputContract): string {
  if (!contract.isStrict) {
    return ''; // No strict requirements
  }

  const requirements: string[] = [];

  if (contract.requiredMinWords !== null) {
    requirements.push(`Minimum ${contract.requiredMinWords} words`);
  }
  if (contract.requiredMaxWords !== null) {
    requirements.push(`Maximum ${contract.requiredMaxWords} words`);
  }
  if (contract.requiredTone) {
    requirements.push(`Tone: ${contract.requiredTone}`);
  }
  if (contract.requiredStructure.length > 0) {
    requirements.push(`Must include: ${contract.requiredStructure.join(', ')}`);
  }

  return `
# 📏 OUTPUT CONTRACT (MANDATORY)

Your output MUST meet these EXACT requirements:
${requirements.map((r) => `- ${r}`).join('\n')}

⚠️ Outputs that do not meet these requirements will be REJECTED.
Do NOT provide a shorter version. Do NOT summarize.
`;
}
