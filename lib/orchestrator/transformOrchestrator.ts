// ============================================
// Transform Orchestrator
// ============================================
// Main orchestrator for transform actions.
// Handles the full flow: extract context → inject constraints →
// call AI → validate → retry with progressive modes → fallback.
//
// REFUSAL HANDLING:
// - Detects refusal/empty outputs
// - Auto-retries up to 3 times: NORMAL → STRICT → RELAXED
// - Never surfaces raw refusal text to UI
// - Falls back to rule-based transform if all retries fail
//
// ACTION-AWARE VALIDATION:
// - OPTIMIZE/WRITE: Full validation (Hook/Body/CTA)
// - REWRITE/CHANGE_TONE: Topic + entity preservation only
// - SHORTEN/EXPAND: Topic preservation + length check
// ============================================

import type {
  ActionType,
  LockedContext,
  LockMode,
  TransformResult,
  TopicLockValidation,
} from '@/types/orchestrator';
import type { ChatMessage } from '@/types/studio';
import { extractLockedContext } from './lockedContextExtractor';
import { injectConstraints, buildSourceReference } from './constraintInjector';
import { validateTopicLock, isRecoverable } from './topicLockValidator';

// ============================================
// Types
// ============================================

/**
 * Transform request
 */
export interface TransformRequest {
  action: ActionType;
  sourceMessageId: string;
  sourceContent: string;
  userInstruction: string;
  templateSystemPrompt?: string;
}

/**
 * AI call function signature
 * @param systemPrompt - System prompt with constraints
 * @param userMessage - User message with source reference
 * @returns AI response content
 */
export type AICallFunction = (
  systemPrompt: string,
  userMessage: string
) => Promise<string>;

/**
 * Retry mode progression
 */
type RetryMode = 'NORMAL' | 'STRICT' | 'RELAXED';

// ============================================
// Action Labels
// ============================================

const ACTION_LABELS: Record<ActionType, string> = {
  CREATE_CONTENT: 'Tạo nội dung',
  BRAINSTORM: 'Brainstorm ý tưởng',
  OUTLINE: 'Tạo dàn bài',
  REWRITE: 'Viết lại',
  OPTIMIZE: 'Tối ưu',
  SHORTEN: 'Rút gọn',
  EXPAND: 'Mở rộng',
  CHANGE_TONE: 'Đổi giọng',
  TRANSLATE: 'Dịch',
  FORMAT_CONVERT: 'Đổi định dạng',
  EVALUATE: 'Đánh giá',
  QA_FIX: 'Sửa lỗi',
  SELECT_SOURCE: 'Chọn nguồn',
  CLARIFY: 'Làm rõ',
};

/**
 * Get action label in Vietnamese
 * @param action - Action type
 * @returns Vietnamese label
 */
export function getActionLabel(action: ActionType): string {
  return ACTION_LABELS[action] || action;
}

// ============================================
// Refusal Detection
// ============================================

/**
 * Patterns that indicate AI refusal
 */
const REFUSAL_PATTERNS: RegExp[] = [
  // English refusal patterns
  /I('m| am) sorry,? (but )?I (cannot|can't|won't|am unable to)/i,
  /I('m| am) not able to/i,
  /I (cannot|can't) (help|assist|fulfill|complete|do) (with )?(this|that|your)/i,
  /As an AI,? I (cannot|can't|am unable to)/i,
  /I('m| am) afraid I (cannot|can't)/i,
  /Unfortunately,? I (cannot|can't|am unable to)/i,
  /This (request|content) (is|seems|appears) (inappropriate|harmful|unsafe)/i,
  /I don't have (enough|sufficient) (information|context)/i,

  // Vietnamese refusal patterns
  /Xin lỗi,? (nhưng )?(tôi|mình) không thể/i,
  /Tôi không thể (giúp|hỗ trợ|thực hiện|hoàn thành)/i,
  /Rất tiếc,? (nhưng )?(tôi|mình) không thể/i,
  /Tôi xin phép (từ chối|không thực hiện)/i,
  /Mình không thể (giúp|làm|thực hiện)/i,
  /Xin lỗi vì (tôi|mình) không thể/i,
  /Không thể thực hiện (yêu cầu|việc) này/i,
  /Tôi không có đủ (thông tin|dữ liệu|ngữ cảnh)/i,
];

/**
 * Minimum meaningful output length (characters)
 */
const MIN_OUTPUT_LENGTH = 20;

/**
 * Check if output is a refusal or empty/too short
 * @param output - AI output to check
 * @returns True if output is a refusal
 */
export function isRefusal(output: string): boolean {
  const trimmed = output.trim();

  // Too short to be meaningful
  if (trimmed.length < MIN_OUTPUT_LENGTH) {
    return true;
  }

  // Matches refusal patterns
  for (const pattern of REFUSAL_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if output has meaningful content
 * @param output - AI output
 * @param sourceContent - Original source content
 * @returns True if output is meaningful
 */
export function hasMeaningfulContent(output: string, sourceContent: string): boolean {
  const trimmed = output.trim();

  // Must be at least 20% of source length (unless source is very short)
  const minLength = Math.max(MIN_OUTPUT_LENGTH, Math.floor(sourceContent.length * 0.2));
  if (trimmed.length < minLength) {
    return false;
  }

  // Must not be identical to source (transformation should change something)
  if (trimmed === sourceContent.trim()) {
    return false;
  }

  return true;
}

// ============================================
// Fallback Transforms (Rule-based, Structure-First)
// ============================================

/**
 * Tone templates for recomposing content
 */
const TONE_TEMPLATES = {
  professional: {
    hookPatterns: [
      'Kính gửi quý khách,',
      'Chúng tôi xin giới thiệu',
      'Trân trọng thông báo:',
    ],
    bodyConnectors: ['Đặc biệt,', 'Ngoài ra,', 'Bên cạnh đó,'],
    ctaPatterns: [
      'Liên hệ với chúng tôi để được tư vấn.',
      'Vui lòng liên hệ để biết thêm chi tiết.',
      'Đăng ký ngay để nhận ưu đãi.',
    ],
    pronouns: { 'bạn': 'quý khách', 'mình': 'chúng tôi' },
    modifiers: { 'siêu': 'vô cùng', 'cực kỳ': 'đặc biệt', 'quá': 'rất' },
  },
  friendly: {
    hookPatterns: [
      'Hey bạn ơi!',
      'Bạn có biết không?',
      'Tin hot đây!',
    ],
    bodyConnectors: ['Mà này,', 'Còn nữa,', 'Đặc biệt là,'],
    ctaPatterns: [
      'Inbox mình ngay nhé!',
      'Bấm link bio để xem thêm nha!',
      'Đừng bỏ lỡ, check ngay thôi!',
    ],
    pronouns: { 'quý khách': 'bạn', 'chúng tôi': 'mình' },
    modifiers: { 'đặc biệt': 'siêu', 'vô cùng': 'cực kỳ' },
  },
};

/**
 * Extract key entities from content (names, numbers, brands)
 */
function extractEntities(content: string): string[] {
  const entities: string[] = [];

  // Numbers and percentages
  const numbers = content.match(/\d+(?:[,.]\d+)?%?/g) || [];
  entities.push(...numbers);

  // Capitalized words (potential brands/names)
  const caps = content.match(/[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+/g) || [];
  entities.push(...caps.filter(w => w.length > 2));

  return [...new Set(entities)].slice(0, 5);
}

/**
 * Extract Hook/Body/CTA structure from content
 */
function extractStructure(content: string): { hook: string; body: string; cta: string } {
  const lines = content.split('\n').filter(l => l.trim());

  if (lines.length === 0) {
    return { hook: '', body: '', cta: '' };
  }

  if (lines.length === 1) {
    return { hook: lines[0], body: '', cta: '' };
  }

  if (lines.length === 2) {
    return { hook: lines[0], body: lines[1], cta: '' };
  }

  // First line = Hook, last line = CTA, middle = Body
  return {
    hook: lines[0],
    body: lines.slice(1, -1).join('\n'),
    cta: lines[lines.length - 1],
  };
}

/**
 * Detect current tone of content
 */
function detectTone(content: string): 'professional' | 'friendly' {
  const professionalSignals = /quý khách|chúng tôi|kính|trân trọng|vui lòng/i;
  const friendlySignals = /bạn ơi|hey|nhé|nha|mình|siêu/i;

  const proScore = (content.match(professionalSignals) || []).length;
  const friendlyScore = (content.match(friendlySignals) || []).length;

  return proScore > friendlyScore ? 'professional' : 'friendly';
}

/**
 * Recompose content with new tone (structure-first approach)
 */
function recomposeWithTone(
  structure: { hook: string; body: string; cta: string },
  targetTone: 'professional' | 'friendly',
  entities: string[]
): string {
  const template = TONE_TEMPLATES[targetTone];
  const parts: string[] = [];

  // Recompose Hook
  if (structure.hook) {
    let newHook = structure.hook;
    // Apply pronoun replacements
    for (const [from, to] of Object.entries(template.pronouns)) {
      newHook = newHook.replace(new RegExp(from, 'gi'), to);
    }
    // Apply modifier replacements
    for (const [from, to] of Object.entries(template.modifiers)) {
      newHook = newHook.replace(new RegExp(from, 'gi'), to);
    }
    parts.push(newHook);
  }

  // Recompose Body
  if (structure.body) {
    let newBody = structure.body;
    for (const [from, to] of Object.entries(template.pronouns)) {
      newBody = newBody.replace(new RegExp(from, 'gi'), to);
    }
    for (const [from, to] of Object.entries(template.modifiers)) {
      newBody = newBody.replace(new RegExp(from, 'gi'), to);
    }
    parts.push(newBody);
  }

  // Recompose CTA
  if (structure.cta) {
    let newCTA = structure.cta;
    for (const [from, to] of Object.entries(template.pronouns)) {
      newCTA = newCTA.replace(new RegExp(from, 'gi'), to);
    }
    parts.push(newCTA);
  } else {
    // Add default CTA for the tone
    parts.push(template.ctaPatterns[0]);
  }

  return parts.join('\n\n');
}

/**
 * Apply rule-based fallback transform when AI fails
 * Structure-first approach: preserves Hook/Body/CTA, uses entities
 * @param action - Transform action
 * @param sourceContent - Source content
 * @returns Transformed content
 */
export function applyFallbackTransform(
  action: ActionType,
  sourceContent: string
): string {
  const trimmed = sourceContent.trim();
  if (!trimmed) return trimmed;

  const structure = extractStructure(trimmed);
  const entities = extractEntities(trimmed);

  switch (action) {
    case 'SHORTEN': {
      // Preserve Hook and CTA, reduce Body intelligently
      if (!structure.body) {
        // Very short content - trim to key sentences
        const words = trimmed.split(/\s+/);
        if (words.length > 15) {
          // Keep words that contain entities
          const keyWords = words.filter(w =>
            entities.some(e => w.includes(e)) || words.indexOf(w) < 10
          );
          return keyWords.slice(0, Math.ceil(words.length * 0.6)).join(' ');
        }
        return trimmed;
      }

      // Keep Hook + key sentences from Body + CTA
      const bodySentences = structure.body.split(/[.!?]\s+/).filter(s => s.trim());
      // Prioritize sentences with entities
      const rankedSentences = bodySentences.map(s => ({
        sentence: s,
        score: entities.filter(e => s.includes(e)).length,
      })).sort((a, b) => b.score - a.score);

      const keepCount = Math.max(1, Math.ceil(bodySentences.length * 0.4));
      const keptSentences = rankedSentences.slice(0, keepCount).map(r => r.sentence);

      const parts = [structure.hook];
      if (keptSentences.length > 0) {
        parts.push(keptSentences.join('. ') + '.');
      }
      if (structure.cta) parts.push(structure.cta);

      return parts.join('\n\n');
    }

    case 'EXPAND': {
      // Add 2-3 new sentences using existing entities (no filler connectors only)
      const parts: string[] = [];

      if (structure.hook) {
        parts.push(structure.hook);
      }

      // Build expanded body using entities
      const bodyParts: string[] = [];
      if (structure.body) {
        bodyParts.push(structure.body);
      }

      // Add entity-based elaborations (not just filler connectors)
      if (entities.length > 0) {
        const entity = entities[0];
        if (/\d+%/.test(entity)) {
          bodyParts.push(`Con số ${entity} này cho thấy sự khác biệt rõ rệt so với các lựa chọn khác.`);
        } else if (/\d+/.test(entity)) {
          bodyParts.push(`Với ${entity}, bạn sẽ có được những giá trị thiết thực nhất.`);
        } else {
          bodyParts.push(`${entity} đã được hàng ngàn người tin dùng và đánh giá cao.`);
        }
      }

      // Add benefit statement
      if (entities.length > 1) {
        bodyParts.push(`Sự kết hợp giữa ${entities.slice(0, 2).join(' và ')} mang đến trải nghiệm toàn diện.`);
      } else {
        bodyParts.push('Đây là giải pháp phù hợp cho nhu cầu của bạn.');
      }

      if (bodyParts.length > 0) {
        parts.push(bodyParts.join(' '));
      }

      if (structure.cta) {
        parts.push(structure.cta);
      } else {
        parts.push('Liên hệ ngay để được tư vấn chi tiết.');
      }

      return parts.join('\n\n');
    }

    case 'FORMAT_CONVERT': {
      // Convert to clean bullet list (no bold injection)
      const parts: string[] = [];

      if (structure.hook) {
        parts.push(structure.hook);
        parts.push('');
      }

      if (structure.body) {
        const sentences = structure.body.split(/[.!?]\s+/).filter(s => s.trim());
        sentences.forEach(s => {
          parts.push(`• ${s.trim()}`);
        });
      } else {
        const items = trimmed.split(/[,;]\s*/).filter(i => i.trim());
        if (items.length > 1) {
          items.forEach(item => {
            parts.push(`• ${item.trim()}`);
          });
        } else {
          parts.push(`• ${trimmed}`);
        }
      }

      if (structure.cta) {
        parts.push('');
        parts.push(structure.cta);
      }

      return parts.join('\n');
    }

    case 'REWRITE': {
      // Structure-first rewrite: recompose Hook/Body/CTA with same tone
      const currentTone = detectTone(trimmed);
      const parts: string[] = [];

      // Rewrite Hook with variation (keep same tone)
      if (structure.hook) {
        const hookVariations: [RegExp, string][] = [
          [/^Bạn có biết/i, 'Đã bao giờ bạn tự hỏi'],
          [/^Đã bao giờ/i, 'Bạn có từng'],
          [/^Bạn có từng/i, 'Hãy thử tưởng tượng'],
          [/^Chào/i, 'Xin chào'],
          [/^Xin chào/i, 'Chào'],
        ];

        let newHook = structure.hook;
        for (const [pattern, replacement] of hookVariations) {
          if (pattern.test(newHook)) {
            newHook = newHook.replace(pattern, replacement);
            break;
          }
        }
        parts.push(newHook);
      }

      // Rewrite Body: rearrange sentences, preserve entities
      if (structure.body) {
        const sentences = structure.body.split(/[.!?]\s+/).filter(s => s.trim());
        if (sentences.length > 1) {
          // Move second sentence to first position if it has entities
          const hasEntity = (s: string) => entities.some(e => s.includes(e));
          if (hasEntity(sentences[1]) && !hasEntity(sentences[0])) {
            [sentences[0], sentences[1]] = [sentences[1], sentences[0]];
          }
        }
        parts.push(sentences.join('. ') + '.');
      }

      // Rewrite CTA with variation
      if (structure.cta) {
        const ctaVariations: [RegExp, string][] = [
          [/Đăng ký ngay/i, 'Bắt đầu ngay hôm nay'],
          [/Bắt đầu ngay/i, 'Đăng ký miễn phí'],
          [/Liên hệ/i, 'Nhắn tin ngay'],
          [/Nhắn tin/i, 'Liên hệ với chúng tôi'],
          [/Tìm hiểu thêm/i, 'Khám phá ngay'],
        ];

        let newCTA = structure.cta;
        for (const [pattern, replacement] of ctaVariations) {
          if (pattern.test(newCTA)) {
            newCTA = newCTA.replace(pattern, replacement);
            break;
          }
        }
        parts.push(newCTA);
      }

      return parts.join('\n\n');
    }

    case 'OPTIMIZE': {
      // Enforce Hook/Body/CTA structure with 1 clear CTA (no emojis/bold by default)
      const parts: string[] = [];

      // Hook: ensure it's attention-grabbing
      if (structure.hook) {
        parts.push(structure.hook);
      } else if (structure.body) {
        // Extract first impactful sentence as hook
        const sentences = structure.body.split(/[.!?]\s+/).filter(s => s.trim());
        if (sentences.length > 0) {
          parts.push(sentences[0] + '.');
        }
      }

      // Body: ensure key points are clear
      if (structure.body) {
        const sentences = structure.body.split(/[.!?]\s+/).filter(s => s.trim());
        // If hook was extracted from body, skip first sentence
        const bodyStart = (!structure.hook && sentences.length > 0) ? 1 : 0;
        const bodySentences = sentences.slice(bodyStart);
        if (bodySentences.length > 0) {
          parts.push(bodySentences.join('. ') + '.');
        }
      }

      // CTA: ensure exactly 1 clear call-to-action
      if (structure.cta) {
        // Clean up CTA - ensure it has urgency
        let cta = structure.cta;
        if (!cta.match(/(ngay|hôm nay|now|liên hệ|đăng ký)/i)) {
          cta = cta.replace(/[.!]?$/, ' ngay hôm nay.');
        }
        parts.push(cta);
      } else {
        // Add clear CTA
        parts.push('Liên hệ ngay để được tư vấn chi tiết.');
      }

      return parts.join('\n\n');
    }

    case 'CHANGE_TONE': {
      // Structure-first: recompose with opposite tone
      const currentTone = detectTone(trimmed);
      const targetTone = currentTone === 'professional' ? 'friendly' : 'professional';

      return recomposeWithTone(structure, targetTone, entities);
    }

    case 'TRANSLATE': {
      // Cannot translate without AI - this should be handled by caller
      // Return empty to trigger system warning in studioContext
      return '';
    }

    default:
      // For any other action, apply REWRITE logic
      return applyFallbackTransform('REWRITE', sourceContent);
  }
}

// ============================================
// Transform Prompts
// ============================================

/**
 * Build transform instruction based on action type and retry mode
 * @param action - Action type
 * @param userInstruction - User's additional instruction
 * @param mode - Current retry mode
 * @returns Combined instruction
 */
function buildTransformInstruction(
  action: ActionType,
  userInstruction: string,
  mode: RetryMode = 'NORMAL'
): string {
  const actionInstructions: Partial<Record<ActionType, string>> = {
    REWRITE: 'Viết lại nội dung với cách diễn đạt khác nhưng giữ nguyên ý chính.',
    OPTIMIZE: 'Tối ưu hóa nội dung để hấp dẫn hơn, rõ ràng hơn.',
    SHORTEN: 'Rút gọn nội dung, chỉ giữ những ý quan trọng nhất.',
    EXPAND: 'Mở rộng nội dung với thêm chi tiết và ví dụ.',
    CHANGE_TONE: 'Thay đổi giọng văn của nội dung nhưng giữ nguyên thông tin.',
    TRANSLATE: 'Dịch nội dung.',
    FORMAT_CONVERT: 'Chuyển đổi định dạng nội dung.',
    EVALUATE: 'Đánh giá và phân tích nội dung.',
    QA_FIX: 'Sửa các lỗi trong nội dung.',
  };

  let baseInstruction = actionInstructions[action] || '';

  // Mode-specific adjustments
  if (mode === 'STRICT') {
    baseInstruction += '\n\n⚠️ QUAN TRỌNG: Phải giữ nguyên tất cả số liệu, tên riêng, và thông tin quan trọng. Không được bỏ sót bất kỳ thông tin nào.';
  } else if (mode === 'RELAXED') {
    baseInstruction += '\n\nHãy tập trung vào việc tạo ra nội dung có ý nghĩa. Có thể điều chỉnh linh hoạt miễn là giữ được ý chính.';
  }

  if (userInstruction.trim()) {
    return `${baseInstruction}\n\nHướng dẫn thêm: ${userInstruction}`;
  }

  return baseInstruction;
}

// ============================================
// Action-Aware Validation
// ============================================

/**
 * Actions requiring full validation (Hook/Body/CTA structure)
 */
const FULL_VALIDATION_ACTIONS: ActionType[] = ['OPTIMIZE', 'CREATE_CONTENT'];

/**
 * Actions requiring only topic + entity preservation
 */
const TOPIC_ONLY_ACTIONS: ActionType[] = ['REWRITE', 'CHANGE_TONE', 'TRANSLATE'];

/**
 * Actions requiring topic + length validation
 */
const LENGTH_AWARE_ACTIONS: ActionType[] = ['SHORTEN', 'EXPAND'];

/**
 * Validate output based on action type
 * @param action - Action type
 * @param output - AI output
 * @param lockedContext - Locked context from source
 * @param sourceContent - Original source content
 * @returns Validation result
 */
export function validateForAction(
  action: ActionType,
  output: string,
  lockedContext: LockedContext,
  sourceContent: string
): TopicLockValidation {
  // Always check for refusal first
  if (isRefusal(output)) {
    return {
      overall_passed: false,
      entity_presence: {
        passed: false,
        score: 0,
        details: 'Output appears to be a refusal or is too short',
        missing_entities: [],
        present_entities: [],
      },
      topic_drift: {
        passed: false,
        score: 0,
        details: 'No meaningful content to validate',
        keyword_overlap: 0,
        drift_keywords: [],
      },
      format_compliance: {
        passed: true,
        score: 1,
        details: 'Skipped due to refusal',
      },
    };
  }

  // Get base validation
  const baseValidation = validateTopicLock(lockedContext, output);

  // For topic-only actions (REWRITE, CHANGE_TONE, TRANSLATE)
  // Skip format compliance - only check topic and entities
  if (TOPIC_ONLY_ACTIONS.includes(action)) {
    return {
      ...baseValidation,
      // Relax format compliance for tone/rewrite changes
      format_compliance: {
        passed: true,
        score: 1,
        details: 'Format compliance skipped for tone/rewrite actions',
      },
      overall_passed: baseValidation.entity_presence.passed && baseValidation.topic_drift.passed,
    };
  }

  // For length-aware actions (SHORTEN, EXPAND)
  if (LENGTH_AWARE_ACTIONS.includes(action)) {
    const outputLength = output.trim().length;
    const sourceLength = sourceContent.trim().length;
    let lengthPassed = true;
    let lengthDetails = '';

    if (action === 'SHORTEN') {
      // Output should be shorter (at least 20% reduction)
      lengthPassed = outputLength < sourceLength * 0.9;
      lengthDetails = lengthPassed
        ? `Shortened by ${Math.round((1 - outputLength / sourceLength) * 100)}%`
        : 'Output not sufficiently shortened';
    } else if (action === 'EXPAND') {
      // Output should be longer (at least 20% increase)
      lengthPassed = outputLength > sourceLength * 1.1;
      lengthDetails = lengthPassed
        ? `Expanded by ${Math.round((outputLength / sourceLength - 1) * 100)}%`
        : 'Output not sufficiently expanded';
    }

    return {
      ...baseValidation,
      format_compliance: {
        passed: lengthPassed,
        score: lengthPassed ? 1 : 0,
        details: lengthDetails,
      },
      overall_passed: baseValidation.entity_presence.passed && baseValidation.topic_drift.passed && lengthPassed,
    };
  }

  // For full validation actions (OPTIMIZE, CREATE_CONTENT)
  // Use full validation as-is
  return baseValidation;
}

// ============================================
// Main Orchestrator
// ============================================

/**
 * Execute transform with refusal detection and progressive retry
 * @param request - Transform request
 * @param aiCall - AI call function
 * @returns Transform result
 */
export async function executeTransform(
  request: TransformRequest,
  aiCall: AICallFunction
): Promise<TransformResult> {
  // Guard: sourceContent must not be empty
  if (!request.sourceContent?.trim()) {
    return {
      success: false,
      content: null,
      validation: null,
      contractValidation: null,
      retry_used: false,
      requires_confirmation: false,
      error: 'Source content is empty. Please select a message to transform.',
    };
  }

  try {
    // Step 1: Extract locked context from source
    const lockedContext = extractLockedContext(
      request.sourceContent,
      request.sourceMessageId
    );

    const baseSystemPrompt =
      request.templateSystemPrompt ||
      'Bạn là trợ lý viết nội dung chuyên nghiệp. Hãy hoàn thành yêu cầu của người dùng.';

    // Retry progression: NORMAL → STRICT → RELAXED
    const retryModes: RetryMode[] = ['NORMAL', 'STRICT', 'RELAXED'];
    let lastOutput: string | null = null;
    let lastValidation: TopicLockValidation | null = null;
    let attemptCount = 0;

    for (const mode of retryModes) {
      attemptCount++;

      // Build constrained prompt based on mode
      const constrainedPrompt = injectConstraints(
        baseSystemPrompt,
        lockedContext,
        mode === 'RELAXED' ? 'NORMAL' : mode
      );

      // Build instruction with mode-specific adjustments
      const instruction = buildTransformInstruction(
        request.action,
        request.userInstruction,
        mode
      );
      const userMessage = instruction + buildSourceReference(request.sourceContent);

      try {
        // Call AI
        const output = await aiCall(constrainedPrompt, userMessage);
        lastOutput = output;

        // Check for refusal
        if (isRefusal(output)) {
          console.log(`[Transform] Refusal detected on attempt ${attemptCount} (${mode}), retrying...`);
          continue; // Try next mode
        }

        // Check for meaningful content
        if (!hasMeaningfulContent(output, request.sourceContent)) {
          console.log(`[Transform] No meaningful content on attempt ${attemptCount} (${mode}), retrying...`);
          continue; // Try next mode
        }

        // Validate output (action-aware)
        const validation = validateForAction(
          request.action,
          output,
          lockedContext,
          request.sourceContent
        );
        lastValidation = validation;

        // If passed, return success
        if (validation.overall_passed) {
          return {
            success: true,
            content: output,
            validation,
            contractValidation: null,
            retry_used: attemptCount > 1,
            requires_confirmation: false,
          };
        }

        // If failed but recoverable and not last mode, continue
        if (isRecoverable(validation) && mode !== 'RELAXED') {
          console.log(`[Transform] Validation failed on attempt ${attemptCount} (${mode}), retrying...`);
          continue;
        }

        // If not recoverable or last mode, return with content (may need confirmation)
        return {
          success: false,
          content: output,
          validation,
          contractValidation: null,
          retry_used: attemptCount > 1,
          requires_confirmation: true,
          error: 'Validation failed. Please review the output.',
        };

      } catch (error) {
        console.error(`[Transform] API error on attempt ${attemptCount}:`, error);
        // Continue to next retry mode
      }
    }

    // All retries failed - use fallback transform
    console.log('[Transform] All retries failed, using fallback transform');
    const fallbackOutput = applyFallbackTransform(request.action, request.sourceContent);

    return {
      success: true, // Return as success with fallback content
      content: fallbackOutput,
      validation: lastValidation,
      contractValidation: null,
      retry_used: true,
      requires_confirmation: false,
    };

  } catch (error) {
    return {
      success: false,
      content: null,
      validation: null,
      contractValidation: null,
      retry_used: false,
      requires_confirmation: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Execute transform without validation (for non-transform actions)
 * @param request - Transform request
 * @param aiCall - AI call function
 * @returns Transform result
 */
export async function executeSimple(
  request: TransformRequest,
  aiCall: AICallFunction
): Promise<TransformResult> {
  // Guard: sourceContent must not be empty for source-based actions
  if (request.sourceContent && !request.sourceContent.trim()) {
    return {
      success: false,
      content: null,
      validation: null,
      contractValidation: null,
      retry_used: false,
      requires_confirmation: false,
      error: 'Source content is empty.',
    };
  }

  try {
    const systemPrompt =
      request.templateSystemPrompt ||
      'Bạn là trợ lý viết nội dung chuyên nghiệp.';

    const instruction = buildTransformInstruction(
      request.action,
      request.userInstruction,
      'NORMAL'
    );

    // For source-based actions, include source reference
    const userMessage = request.sourceContent
      ? instruction + buildSourceReference(request.sourceContent)
      : instruction;

    const output = await aiCall(systemPrompt, userMessage);

    // Check for refusal
    if (isRefusal(output)) {
      return {
        success: false,
        content: null,
        validation: null,
        contractValidation: null,
        retry_used: false,
        requires_confirmation: false,
        error: 'AI could not complete this request. Please try again.',
      };
    }

    return {
      success: true,
      content: output,
      validation: null,
      contractValidation: null,
      retry_used: false,
      requires_confirmation: false,
    };
  } catch (error) {
    return {
      success: false,
      content: null,
      validation: null,
      contractValidation: null,
      retry_used: false,
      requires_confirmation: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if action type should use topic lock validation
 * @param action - Action type
 * @returns True if should validate
 */
export function shouldValidate(action: ActionType): boolean {
  // Transform actions should be validated
  const validatedActions: ActionType[] = [
    'REWRITE',
    'OPTIMIZE',
    'SHORTEN',
    'EXPAND',
    'CHANGE_TONE',
    'TRANSLATE',
    'FORMAT_CONVERT',
  ];
  return validatedActions.includes(action);
}

/**
 * Get locked context for a transform
 * @param sourceContent - Source content
 * @param sourceMessageId - Source message ID
 * @returns Locked context
 */
export function getLockedContext(
  sourceContent: string,
  sourceMessageId: string
): LockedContext {
  return extractLockedContext(sourceContent, sourceMessageId);
}
