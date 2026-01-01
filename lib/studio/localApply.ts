// ============================================
// STEP 6.6: Local Apply - Deterministic Transforms
// ============================================
// Pure function for LOCAL content transformations.
// NO LLM call - operates entirely on the client.
//
// SAFETY: All transforms are deterministic and reversible.
// UNDO: Original content is preserved in message.meta.localEdit
// ============================================

/**
 * Result of a local apply operation
 */
export interface LocalApplyResult {
  /** Whether the operation succeeded */
  ok: boolean;
  /** The transformed content (null if !ok) */
  nextContent: string | null;
  /** Human-readable reason for the result */
  reason: string;
  /** List of operations that were applied */
  appliedOps: string[];
}

/**
 * Supported local operations
 */
export type LocalOperation =
  | 'FIX_WHITESPACE'      // Normalize whitespace, trim, fix double spaces
  | 'ADD_BULLETS'         // Convert lines to bullet list
  | 'REMOVE_BULLETS'      // Remove bullet points
  | 'ADD_EMOJI'           // Add contextual emoji (simple pattern-based)
  | 'REMOVE_EMOJI'        // Remove all emoji
  | 'UPPERCASE'           // Convert to uppercase
  | 'LOWERCASE'           // Convert to lowercase
  | 'TITLE_CASE'          // Convert to title case
  | 'ADD_HASHTAGS'        // Add common hashtags
  | 'REMOVE_HASHTAGS'     // Remove hashtags
  | 'TRIM_LINES'          // Remove empty lines
  | 'NUMBER_LINES';       // Number each line

/**
 * Pattern matchers for instruction detection (Vietnamese + English)
 */
const OPERATION_PATTERNS: Record<LocalOperation, RegExp[]> = {
  FIX_WHITESPACE: [
    /\b(sửa\s*(khoảng\s*)?trắng|fix\s*whitespace|chỉnh\s*dấu\s*cách)\b/i,
    /\b(dọn\s*dẹp|clean\s*up|làm\s*sạch)\b/i,
  ],
  ADD_BULLETS: [
    /\b(thêm\s*(dấu\s*)?bullet|thêm\s*gạch\s*đầu\s*dòng|add\s*bullet|bullet\s*point)\b/i,
    /\b(liệt\s*kê|danh\s*sách)\b/i,
  ],
  REMOVE_BULLETS: [
    /\b(bỏ\s*(dấu\s*)?bullet|xóa\s*bullet|remove\s*bullet|xóa\s*gạch\s*đầu\s*dòng)\b/i,
  ],
  ADD_EMOJI: [
    /\b(thêm\s*emoji|add\s*emoji|thêm\s*icon)\b/i,
  ],
  REMOVE_EMOJI: [
    /\b(bỏ\s*emoji|xóa\s*emoji|remove\s*emoji|bỏ\s*icon|xóa\s*icon)\b/i,
    /\b(không\s*emoji|no\s*emoji)\b/i,
  ],
  UPPERCASE: [
    /\b(viết\s*hoa|in\s*hoa|uppercase|chữ\s*hoa|hoa\s*hết)\b/i,
  ],
  LOWERCASE: [
    /\b(viết\s*thường|in\s*thường|lowercase|chữ\s*thường)\b/i,
  ],
  TITLE_CASE: [
    /\b(viết\s*hoa\s*đầu|title\s*case|capitalize)\b/i,
  ],
  ADD_HASHTAGS: [
    /\b(thêm\s*hashtag|add\s*hashtag)\b/i,
  ],
  REMOVE_HASHTAGS: [
    /\b(bỏ\s*hashtag|xóa\s*hashtag|remove\s*hashtag)\b/i,
  ],
  TRIM_LINES: [
    /\b(xóa\s*dòng\s*trống|bỏ\s*dòng\s*thừa|remove\s*empty\s*lines|trim\s*lines)\b/i,
  ],
  NUMBER_LINES: [
    /(đánh\s*số(\s*dòng)?)/i,
    /\b(number\s*lines)\b/i,
  ],
};

/**
 * Detect which operations are requested in the instruction
 */
export function detectOperations(instruction: string): LocalOperation[] {
  const normalized = instruction.toLowerCase().normalize('NFC');
  const detected: LocalOperation[] = [];

  for (const [op, patterns] of Object.entries(OPERATION_PATTERNS)) {
    if (patterns.some(p => p.test(normalized))) {
      detected.push(op as LocalOperation);
    }
  }

  return detected;
}

/**
 * Check if an instruction can be handled locally (without LLM)
 */
export function canHandleLocally(instruction: string): boolean {
  const ops = detectOperations(instruction);
  return ops.length > 0;
}

// ============================================
// Individual Transform Functions
// ============================================

function fixWhitespace(content: string): string {
  return content
    .split('\n')
    .map(line => line.trim().replace(/\s+/g, ' '))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function addBullets(content: string): string {
  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      const trimmed = line.trim();
      // Skip if already has bullet or number
      if (/^[-•●○▪▸►]/.test(trimmed) || /^\d+[.)]/.test(trimmed)) {
        return line;
      }
      return `• ${trimmed}`;
    })
    .join('\n');
}

function removeBullets(content: string): string {
  return content
    .split('\n')
    .map(line => {
      // Remove bullet characters and leading numbers
      return line.replace(/^[\s]*[-•●○▪▸►]\s*/, '').replace(/^[\s]*\d+[.)]\s*/, '');
    })
    .join('\n');
}

// Emoji patterns for detection
const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]/gu;

function removeEmoji(content: string): string {
  return content.replace(EMOJI_REGEX, '').replace(/\s+/g, ' ').trim();
}

function addEmoji(content: string): string {
  // Simple heuristic: add relevant emoji at start of lines
  const lines = content.split('\n');
  const emojiMap: Record<string, string> = {
    // Vietnamese keywords
    'mới': '🆕',
    'hot': '🔥',
    'sale': '🔥',
    'giảm': '💰',
    'miễn phí': '🎁',
    'free': '🎁',
    'quan trọng': '⚠️',
    'chú ý': '👀',
    'hỏi': '❓',
    'trả lời': '💬',
    'tip': '💡',
    'mẹo': '💡',
    'cảnh báo': '⚠️',
    'thành công': '✅',
    'lỗi': '❌',
    'yêu': '❤️',
    'thích': '👍',
  };

  return lines.map((line, index) => {
    // Only add to first line or lines that don't have emoji
    if (index === 0 || !EMOJI_REGEX.test(line)) {
      const lowerLine = line.toLowerCase();
      for (const [keyword, emoji] of Object.entries(emojiMap)) {
        if (lowerLine.includes(keyword)) {
          return line.startsWith(emoji) ? line : `${emoji} ${line}`;
        }
      }
      // Default emoji for first line if no keyword match
      if (index === 0 && !EMOJI_REGEX.test(line)) {
        return `✨ ${line}`;
      }
    }
    return line;
  }).join('\n');
}

function toUpperCase(content: string): string {
  return content.toUpperCase();
}

function toLowerCase(content: string): string {
  return content.toLowerCase();
}

function toTitleCase(content: string): string {
  return content
    .split('\n')
    .map(line => {
      return line
        .split(' ')
        .map(word => {
          if (word.length === 0) return word;
          return word[0].toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ');
    })
    .join('\n');
}

function removeHashtags(content: string): string {
  return content.replace(/#\w+/g, '').replace(/\s+/g, ' ').trim();
}

function addHashtags(content: string): string {
  // Simple heuristic: add common Vietnamese social media hashtags
  const existingHashtags = content.match(/#\w+/g) || [];
  if (existingHashtags.length >= 3) {
    return content; // Already has hashtags
  }

  const commonHashtags = ['#ContentMarketing', '#DigitalMarketing', '#SocialMedia'];
  const hashtagsToAdd = commonHashtags.slice(0, 3 - existingHashtags.length);

  return `${content.trim()}\n\n${hashtagsToAdd.join(' ')}`;
}

function trimLines(content: string): string {
  return content
    .split('\n')
    .filter(line => line.trim())
    .join('\n');
}

function numberLines(content: string): string {
  return content
    .split('\n')
    .filter(line => line.trim())
    .map((line, index) => {
      // Skip if already numbered
      if (/^\d+[.)]/.test(line.trim())) {
        return line;
      }
      return `${index + 1}. ${line.trim()}`;
    })
    .join('\n');
}

// ============================================
// Operation Executor
// ============================================

function executeOperation(content: string, op: LocalOperation): string {
  switch (op) {
    case 'FIX_WHITESPACE':
      return fixWhitespace(content);
    case 'ADD_BULLETS':
      return addBullets(content);
    case 'REMOVE_BULLETS':
      return removeBullets(content);
    case 'ADD_EMOJI':
      return addEmoji(content);
    case 'REMOVE_EMOJI':
      return removeEmoji(content);
    case 'UPPERCASE':
      return toUpperCase(content);
    case 'LOWERCASE':
      return toLowerCase(content);
    case 'TITLE_CASE':
      return toTitleCase(content);
    case 'ADD_HASHTAGS':
      return addHashtags(content);
    case 'REMOVE_HASHTAGS':
      return removeHashtags(content);
    case 'TRIM_LINES':
      return trimLines(content);
    case 'NUMBER_LINES':
      return numberLines(content);
    default:
      return content;
  }
}

// ============================================
// Main Entry Point
// ============================================

/**
 * Apply local transformations to content based on instruction.
 *
 * This is a PURE function - no side effects, no LLM calls.
 * Returns the transformed content or an error reason.
 *
 * @param content - The content to transform
 * @param instruction - The user's instruction (Vietnamese or English)
 * @returns LocalApplyResult with the transformation result
 */
export function localApply(content: string, instruction: string): LocalApplyResult {
  // Validate inputs
  if (!content || !content.trim()) {
    return {
      ok: false,
      nextContent: null,
      reason: 'Nội dung trống',
      appliedOps: [],
    };
  }

  if (!instruction || !instruction.trim()) {
    return {
      ok: false,
      nextContent: null,
      reason: 'Chưa có hướng dẫn',
      appliedOps: [],
    };
  }

  // Detect operations
  const operations = detectOperations(instruction);

  if (operations.length === 0) {
    return {
      ok: false,
      nextContent: null,
      reason: 'Không nhận diện được thao tác cục bộ',
      appliedOps: [],
    };
  }

  // Apply operations sequentially
  let result = content;
  const appliedOps: string[] = [];

  for (const op of operations) {
    try {
      const before = result;
      result = executeOperation(result, op);

      // Only mark as applied if content changed
      if (result !== before) {
        appliedOps.push(op);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error(`[localApply] Error executing ${op}:`, error);
      }
      // Continue with other operations
    }
  }

  // Check if anything actually changed
  if (result === content) {
    return {
      ok: false,
      nextContent: null,
      reason: 'Không có thay đổi (nội dung đã đúng định dạng)',
      appliedOps: [],
    };
  }

  return {
    ok: true,
    nextContent: result,
    reason: `Đã áp dụng: ${appliedOps.join(', ')}`,
    appliedOps,
  };
}

/**
 * Get human-readable description of an operation
 */
export function getOperationLabel(op: LocalOperation): string {
  const labels: Record<LocalOperation, string> = {
    FIX_WHITESPACE: 'Sửa khoảng trắng',
    ADD_BULLETS: 'Thêm bullet',
    REMOVE_BULLETS: 'Bỏ bullet',
    ADD_EMOJI: 'Thêm emoji',
    REMOVE_EMOJI: 'Bỏ emoji',
    UPPERCASE: 'Viết hoa',
    LOWERCASE: 'Viết thường',
    TITLE_CASE: 'Viết hoa đầu',
    ADD_HASHTAGS: 'Thêm hashtag',
    REMOVE_HASHTAGS: 'Bỏ hashtag',
    TRIM_LINES: 'Xóa dòng trống',
    NUMBER_LINES: 'Đánh số dòng',
  };
  return labels[op] || op;
}
