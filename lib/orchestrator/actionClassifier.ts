// ============================================
// Action Classifier
// ============================================
// Classifies user input into action types using
// signal patterns for Vietnamese + English.
// ============================================

import type {
  ActionType,
  ActionCategory,
  ActionClassification,
  TransformMode,
} from '@/types/orchestrator';

// ============================================
// Signal Patterns
// ============================================

interface SignalPattern {
  patterns: RegExp[];
  weight: number; // 0-1, higher = more confident
}

type ActionSignals = {
  [K in ActionType]: SignalPattern;
};

/**
 * Signal patterns for action classification
 * Supports Vietnamese and English
 */
const ACTION_SIGNALS: ActionSignals = {
  // Generation actions
  CREATE_CONTENT: {
    patterns: [
      /^(viết|tạo|soạn|làm)\s+(cho\s+)?(tôi|mình)?\s*(một|1)?\s*(bài|nội dung|post|content)/i,
      /^(write|create|draft|compose)\s+(a|an|the)?\s*(post|content|article)/i,
      /viết\s+(về|cho)/i,
      /tạo\s+nội\s+dung/i,
    ],
    weight: 0.85,
  },
  BRAINSTORM: {
    patterns: [
      /brainstorm/i,
      /ý\s*tưởng/i,
      /(cho|gợi|đề)\s*(ý|xuất)/i,
      /ideas?\s+(for|about)/i,
      /suggest\s+(some|a\s+few)?\s*(ideas?|topics?)/i,
    ],
    weight: 0.8,
  },
  OUTLINE: {
    patterns: [
      /outline/i,
      /dàn\s*(ý|bài)/i,
      /cấu\s*trúc/i,
      /khung\s*(bài|nội\s*dung)/i,
      /structure\s+(for|of)/i,
    ],
    weight: 0.8,
  },

  // Transform actions
  REWRITE: {
    patterns: [
      /viết\s+lại/i,
      /rewrite/i,
      /sửa\s+lại/i,
      /chỉnh\s+lại/i,
      /làm\s+lại/i,
      /revise/i,
      /rephrase/i,
    ],
    weight: 0.9,
  },
  OPTIMIZE: {
    patterns: [
      /tối\s*ưu/i,
      /optimize/i,
      /cải\s*thiện/i,
      /improve/i,
      /enhance/i,
      /nâng\s*cao/i,
      /làm\s+(cho\s+)?(tốt|hay)\s+hơn/i,
    ],
    weight: 0.85,
  },
  SHORTEN: {
    patterns: [
      /rút\s*gọn/i,
      /ngắn\s*(gọn|lại|hơn)/i,
      /shorten/i,
      /shorter/i,
      /concise/i,
      /brief(er)?/i,
      /summarize/i,
      /tóm\s*tắt/i,
      /cô\s*đọng/i,
    ],
    weight: 0.9,
  },
  EXPAND: {
    patterns: [
      /mở\s*rộng/i,
      /expand/i,
      /dài\s*hơn/i,
      /longer/i,
      /elaborate/i,
      /chi\s*tiết\s*hơn/i,
      /thêm\s+(nội\s*dung|chi\s*tiết)/i,
      /add\s+more\s+(detail|content)/i,
    ],
    weight: 0.9,
  },
  CHANGE_TONE: {
    patterns: [
      /đổi\s*giọng/i,
      /thay\s*(đổi\s*)?(giọng|tone)/i,
      /change\s*(the\s*)?tone/i,
      /make\s+it\s+(more\s+)?(formal|casual|friendly|professional)/i,
      /chuyên\s*nghiệp\s*hơn/i,
      /thân\s*thiện\s*hơn/i,
      /trang\s*trọng\s*hơn/i,
    ],
    weight: 0.9,
  },
  TRANSLATE: {
    patterns: [
      /dịch\s*(sang|ra|qua)/i,
      /translate\s+(to|into)/i,
      /chuyển\s*(ngữ|sang)/i,
      /sang\s+(tiếng\s*)?(anh|việt|english|vietnamese)/i,
    ],
    weight: 0.95,
  },
  FORMAT_CONVERT: {
    patterns: [
      /đổi\s*(sang\s*)?(format|định\s*dạng)/i,
      /chuyển\s*(sang|thành)\s*(list|bullet|số|heading)/i,
      /convert\s+(to|into)\s*(list|bullet|numbered|heading)/i,
      /format\s+as/i,
      /make\s+it\s+(a\s+)?(list|bullets?|numbered)/i,
      /thành\s+(danh\s*sách|list)/i,
    ],
    weight: 0.9,
  },

  // Evaluation actions
  EVALUATE: {
    patterns: [
      /đánh\s*giá/i,
      /evaluate/i,
      /review/i,
      /analyze/i,
      /phân\s*tích/i,
      /check\s+(the\s+)?(quality|content)/i,
      /kiểm\s*tra/i,
      /nhận\s*xét/i,
    ],
    weight: 0.85,
  },
  QA_FIX: {
    patterns: [
      /sửa\s*(lỗi|bug|error)/i,
      /fix\s+(the\s+)?(error|issue|problem)/i,
      /correct/i,
      /chỉnh\s*sửa/i,
      /fix\s+it/i,
      /khắc\s*phục/i,
    ],
    weight: 0.85,
  },

  // Meta actions
  SELECT_SOURCE: {
    patterns: [
      /dùng\s+(bài|nội\s*dung)\s+(này|trên|đó)/i,
      /use\s+(this|that)\s+(one|content|post)/i,
      /lấy\s+(cái\s*)?(này|đó)/i,
      /chọn\s+(bài|cái)\s+(này|đó|trên)/i,
    ],
    weight: 0.85,
  },
  CLARIFY: {
    patterns: [
      /\?\s*$/,
      /là\s+gì/i,
      /what\s+(is|are|do)/i,
      /how\s+(do|can|to)/i,
      /có\s+thể\s+không/i,
      /nghĩa\s+là/i,
      /explain/i,
      /giải\s*thích/i,
    ],
    weight: 0.6, // Lower weight - questions could be anything
  },
};

/**
 * Implicit reference patterns (indicates transform on previous content)
 */
const IMPLICIT_REFERENCE_PATTERNS: RegExp[] = [
  /bài\s+(trên|này|đó|vừa\s*rồi)/i,
  /nội\s*dung\s+(trên|này|đó|vừa)/i,
  /cái\s+(này|đó|trên)/i,
  /vừa\s*(rồi|nãy)/i,
  /ở\s+trên/i,
  /the\s+(above|previous)\s+(one|content|post)/i,
  /that\s+one/i,
  /this\s+(one|content)/i,
];

/**
 * Map action types to categories
 */
const ACTION_CATEGORIES: Record<ActionType, ActionCategory> = {
  CREATE_CONTENT: 'generation',
  BRAINSTORM: 'generation',
  OUTLINE: 'generation',
  REWRITE: 'transform',
  OPTIMIZE: 'transform',
  SHORTEN: 'transform',
  EXPAND: 'transform',
  CHANGE_TONE: 'transform',
  TRANSLATE: 'transform',
  FORMAT_CONVERT: 'transform',
  EVALUATE: 'evaluation',
  QA_FIX: 'evaluation',
  SELECT_SOURCE: 'meta',
  CLARIFY: 'meta',
};

/**
 * Actions that require source text
 */
const SOURCE_REQUIRED_ACTIONS: ActionType[] = [
  'REWRITE',
  'OPTIMIZE',
  'SHORTEN',
  'EXPAND',
  'CHANGE_TONE',
  'TRANSLATE',
  'FORMAT_CONVERT',
  'EVALUATE',
  'QA_FIX',
];

// ============================================
// New Create Detection (Intent Memory)
// ============================================

/**
 * Explicit NEW-CREATE signals - user wants to start fresh, not transform
 * These patterns override the intent memory to force CREATE mode
 */
const NEW_CREATE_SIGNALS: RegExp[] = [
  // Vietnamese - Explicit new creation
  /viết\s+(một\s+)?bài\s+mới/i,           // "viết bài mới", "viết một bài mới"
  /tạo\s+(một\s+)?bài\s+(mới|khác)/i,     // "tạo bài mới", "tạo một bài khác"
  /chủ\s+đề\s+(khác|mới)/i,               // "chủ đề khác", "chủ đề mới"
  /một\s+bài\s+(khác|mới)\s+(về|cho)/i,   // "một bài khác về...", "một bài mới cho..."
  /nội\s+dung\s+(mới|khác)/i,             // "nội dung mới", "nội dung khác"
  /làm\s+(bài|cái)\s+(mới|khác)/i,        // "làm bài mới", "làm cái khác"
  /bắt\s+đầu\s+(lại|mới)/i,               // "bắt đầu lại", "bắt đầu mới"
  /topic\s+(mới|khác)/i,                  // "topic mới", "topic khác"
  /về\s+chủ\s+đề\s+(khác|mới)/i,          // "về chủ đề khác"
  /chuyển\s+sang\s+(chủ\s+đề|topic)\s+(khác|mới)/i, // "chuyển sang chủ đề khác"

  // English - Explicit new creation
  /new\s+(post|content|article)/i,        // "new post", "new content"
  /different\s+(topic|subject)/i,         // "different topic"
  /start\s+(fresh|over|anew)/i,           // "start fresh", "start over"
  /write\s+(about\s+)?(something|a)\s+(different|else|new)/i, // "write something different"
  /create\s+(a\s+)?(new|different)/i,     // "create a new...", "create different"
  /another\s+(post|article|piece)\s+(about|on)/i, // "another post about..."
  /change\s+(the\s+)?topic/i,             // "change topic", "change the topic"
  /switch\s+to\s+(a\s+)?(new|different)/i, // "switch to a new..."
];

/**
 * Detect if user is explicitly requesting new content creation
 * This overrides intent memory and forces CREATE mode
 * @param input - User input text
 * @returns True if explicit new-create signal detected
 */
export function detectNewCreate(input: string): boolean {
  const normalizedInput = input.trim();
  return NEW_CREATE_SIGNALS.some((pattern) => pattern.test(normalizedInput));
}

/**
 * Get matched new-create signals for debugging/logging
 * @param input - User input text
 * @returns Array of matched signal strings
 */
export function getNewCreateSignals(input: string): string[] {
  const normalizedInput = input.trim();
  const signals: string[] = [];

  for (const pattern of NEW_CREATE_SIGNALS) {
    const match = normalizedInput.match(pattern);
    if (match) {
      signals.push(match[0]);
    }
  }

  return signals;
}

// ============================================
// Topic Drift Detection (GAP B)
// ============================================

/**
 * Signals that user wants to KEEP the current source content
 * When these are detected, do NOT trigger topic drift reset
 */
const KEEP_SOURCE_SIGNALS: RegExp[] = [
  /giữ\s+(nguyên\s+)?(nội\s+dung|bài|ý)/i,
  /dựa\s+trên\s+(bài|nội\s+dung)\s+(trên|này|cũ)/i,
  /từ\s+(bài|nội\s+dung)\s+(trên|này|cũ)/i,
  /keep\s+(the\s+)?(content|same|original)/i,
  /based\s+on\s+(this|the\s+above)/i,
];

/**
 * Extract topic anchors from text (brand names, project names, key entities)
 * Uses simple heuristics: capitalized words, Vietnamese proper nouns, quoted names
 * @param text - Source text or user input
 * @returns Set of lowercase topic anchors
 */
export function extractTopicAnchors(text: string): Set<string> {
  const anchors = new Set<string>();

  // Pattern 1: Capitalized words/phrases (brand names, project names)
  // e.g., "MIK Group", "The Coffee House", "Vinhomes"
  const capitalizedPattern = /\b([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*)\b/g;
  let match;
  while ((match = capitalizedPattern.exec(text)) !== null) {
    const anchor = match[1].toLowerCase();
    // Skip common English words that are often capitalized
    if (anchor.length >= 3 && !COMMON_CAPITALIZED_WORDS.has(anchor)) {
      anchors.add(anchor);
    }
  }

  // Pattern 2: Quoted names (Vietnamese or English)
  // e.g., "dự án ABC", 'quán XYZ'
  const quotedPattern = /["'「『«]([^"'」』»]+)["'」』»]/g;
  while ((match = quotedPattern.exec(text)) !== null) {
    const anchor = match[1].toLowerCase().trim();
    if (anchor.length >= 2 && anchor.length <= 50) {
      anchors.add(anchor);
    }
  }

  // Pattern 3: Vietnamese project/brand indicators
  // e.g., "dự án Sunrise", "quán Cà Phê ABC", "thương hiệu XYZ"
  const vnBrandPattern = /(?:dự\s*án|quán|thương\s*hiệu|brand|công\s*ty|shop)\s+([A-Za-zÀ-ỹ][A-Za-zÀ-ỹ\s]*)/gi;
  while ((match = vnBrandPattern.exec(text)) !== null) {
    const anchor = match[1].toLowerCase().trim();
    if (anchor.length >= 2) {
      anchors.add(anchor);
    }
  }

  return anchors;
}

/**
 * Common capitalized words to ignore (not topic anchors)
 */
const COMMON_CAPITALIZED_WORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'your', 'our',
  'new', 'best', 'top', 'all', 'any', 'get', 'now', 'how', 'why',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december',
]);

/**
 * Detect if user input indicates a topic drift from source content
 * Returns true if user is switching to a DIFFERENT topic/brand/project
 *
 * @param userInput - Current user input
 * @param sourceContent - Content of the source message being transformed
 * @returns true if topic drift detected (should force CREATE mode)
 */
export function detectTopicDrift(userInput: string, sourceContent: string): boolean {
  // Check if user explicitly wants to keep source content
  if (KEEP_SOURCE_SIGNALS.some(p => p.test(userInput))) {
    return false;
  }

  // Extract anchors from both
  const sourceAnchors = extractTopicAnchors(sourceContent);
  const inputAnchors = extractTopicAnchors(userInput);

  // No anchors in input → no drift (user is just giving generic instruction)
  if (inputAnchors.size === 0) {
    return false;
  }

  // No anchors in source → can't detect drift
  if (sourceAnchors.size === 0) {
    return false;
  }

  // Check if input introduces NEW anchors not in source
  // This indicates user is switching to a different topic/brand
  let newAnchorsCount = 0;
  let sharedAnchorsCount = 0;

  for (const anchor of inputAnchors) {
    if (sourceAnchors.has(anchor)) {
      sharedAnchorsCount++;
    } else {
      newAnchorsCount++;
    }
  }

  // Topic drift if:
  // - Input has new anchors AND no shared anchors
  // - This means user is referencing a completely different entity
  if (newAnchorsCount > 0 && sharedAnchorsCount === 0) {
    return true;
  }

  return false;
}

// ============================================
// Transform Mode Detection
// ============================================

/**
 * Strong directive signals - single match = DIRECTED_TRANSFORM
 */
const STRONG_DIRECTIVE_SIGNALS: RegExp[] = [
  // Vietnamese - Target audience
  /dành\s+cho\s+\w+/i, // "dành cho GenZ", "dành cho doanh nhân"
  /cho\s+(đối\s+tượng|nhóm|khách\s+hàng)/i,
  /hướng\s+(đến|tới)\s+\w+/i,

  // Vietnamese - Style/tone directives
  /theo\s+(phong\s+cách|kiểu|style)/i,
  /theo\s+hướng/i,
  // ✅ STEP 2: Added "tự nhiên" to catch "giọng tự nhiên hơn"
  /giọng\s+(văn\s+)?(chuyên\s+nghiệp|thân\s+thiện|hài\s+hước|nghiêm\s+túc|trẻ\s+trung|tự\s*nhiên)/i,
  /phong\s+cách\s+\w+/i,

  // Vietnamese - Emphasis/focus
  /nhấn\s+mạnh\s+(vào\s+)?/i,
  /tập\s+trung\s+(vào\s+)?/i,
  /làm\s+nổi\s+bật/i,
  /highlight/i,

  // Vietnamese - Add/remove
  /thêm\s+(phần|mục|chi\s+tiết|ví\s+dụ|số\s+liệu)/i,
  /bổ\s+sung/i,
  /bỏ\s+(phần|đoạn|câu)/i,
  /loại\s+bỏ/i,

  // Vietnamese - Specific modifications
  /giữ\s+(nguyên\s+)?(ý|nội\s+dung|cấu\s+trúc)/i,
  /không\s+(đổi|thay\s+đổi)\s+(ý|nghĩa)/i,

  // English - Target audience
  /for\s+(GenZ|millennials|professionals|executives|teenagers)/i,
  /targeting\s+\w+/i,

  // English - Style directives
  /in\s+(a|the)\s+(style|tone|voice)\s+of/i,
  /make\s+it\s+(sound\s+)?(more\s+)?(professional|casual|friendly|formal)/i,
  /with\s+(a\s+)?(professional|casual|humorous|serious)\s+tone/i,

  // English - Emphasis
  /emphasize\s+(the\s+)?/i,
  /focus\s+on\s+(the\s+)?/i,
  /highlight\s+(the\s+)?/i,

  // English - Add/remove
  /add\s+(more\s+)?(examples?|details?|statistics?|data)/i,
  /include\s+(more\s+)?/i,
  /remove\s+(the\s+)?/i,
  /keep\s+(the\s+)?(meaning|structure|format)/i,

  // ✅ STEP 2: Vietnamese pattern "giọng X hơn" / "viết X hơn" indicates direction
  // e.g., "giọng tự nhiên hơn", "viết ngắn hơn", "câu dễ hiểu hơn"
  /giọng\s+\w+\s+hơn/i,
  /viết\s+\w+\s+hơn/i,
  /câu\s+\w+\s+hơn/i,
];

/**
 * Weak directive signals - need 2+ for DIRECTED_TRANSFORM
 */
const WEAK_DIRECTIVE_SIGNALS: RegExp[] = [
  // Vietnamese
  /chuyên\s+nghiệp/i,
  /thân\s+thiện/i,
  /ngắn\s+gọn/i,
  /súc\s+tích/i,
  /dễ\s+hiểu/i,
  /hấp\s+dẫn/i,
  /cuốn\s+hút/i,
  /mạnh\s+mẽ/i,
  /nhẹ\s+nhàng/i,
  /trẻ\s+trung/i,
  /hiện\s+đại/i,
  /tự\s*nhiên/i, // ✅ STEP 2: "tự nhiên" (natural)

  // Vietnamese - General modifiers
  /hơn\s*$/i, // "...hơn" (more...)
  /hơn\s+nữa/i,
  /nhiều\s+hơn/i,
  /ít\s+hơn/i,

  // English
  /professional/i,
  /friendly/i,
  /concise/i,
  /engaging/i,
  /compelling/i,
  /punchy/i,
  /modern/i,
  /casual/i,
  /formal/i,

  // English - General modifiers
  /more\s+\w+/i,
  /less\s+\w+/i,
  /better/i,
];

/**
 * Detect transform mode based on user text
 * @param userText - User input text
 * @returns TransformMode - PURE_TRANSFORM or DIRECTED_TRANSFORM
 */
export function detectTransformMode(userText: string): TransformMode {
  const normalizedText = userText.trim();

  // Check strong signals first - single match = DIRECTED
  const strongMatches: string[] = [];
  for (const pattern of STRONG_DIRECTIVE_SIGNALS) {
    const match = normalizedText.match(pattern);
    if (match) {
      strongMatches.push(match[0]);
    }
  }

  if (strongMatches.length >= 1) {
    return 'DIRECTED_TRANSFORM';
  }

  // Check weak signals - need 2+ for DIRECTED
  const weakMatches: string[] = [];
  for (const pattern of WEAK_DIRECTIVE_SIGNALS) {
    const match = normalizedText.match(pattern);
    if (match) {
      weakMatches.push(match[0]);
    }
  }

  if (weakMatches.length >= 2) {
    return 'DIRECTED_TRANSFORM';
  }

  // Default: pure transform (just the verb)
  return 'PURE_TRANSFORM';
}

/**
 * Get detected directive signals from user text
 * @param userText - User input text
 * @returns Array of matched directive signals
 */
export function getDirectiveSignals(userText: string): string[] {
  const normalizedText = userText.trim();
  const signals: string[] = [];

  for (const pattern of STRONG_DIRECTIVE_SIGNALS) {
    const match = normalizedText.match(pattern);
    if (match) {
      signals.push(match[0]);
    }
  }

  for (const pattern of WEAK_DIRECTIVE_SIGNALS) {
    const match = normalizedText.match(pattern);
    if (match && !signals.includes(match[0])) {
      signals.push(match[0]);
    }
  }

  return signals;
}

// ============================================
// Main Classifier
// ============================================

/**
 * Classify user input into an action type
 * @param input - User input text
 * @returns Classification result with type, category, confidence, and signals
 */
export function classifyAction(input: string): ActionClassification {
  const normalizedInput = input.trim().toLowerCase();

  // Track all matches
  const matches: Array<{
    type: ActionType;
    signals: string[];
    weight: number;
  }> = [];

  // Check each action type
  for (const [actionType, signalPattern] of Object.entries(ACTION_SIGNALS)) {
    const matchedSignals: string[] = [];

    for (const pattern of signalPattern.patterns) {
      const match = normalizedInput.match(pattern);
      if (match) {
        matchedSignals.push(match[0]);
      }
    }

    if (matchedSignals.length > 0) {
      matches.push({
        type: actionType as ActionType,
        signals: matchedSignals,
        weight: signalPattern.weight,
      });
    }
  }

  // Check for implicit references (boosts transform actions)
  const hasImplicitReference = IMPLICIT_REFERENCE_PATTERNS.some((p) =>
    p.test(normalizedInput)
  );

  // Sort by weight (and number of signals as tiebreaker)
  matches.sort((a, b) => {
    const weightDiff = b.weight - a.weight;
    if (Math.abs(weightDiff) > 0.05) return weightDiff;
    return b.signals.length - a.signals.length;
  });

  // Default to CREATE_CONTENT if no matches
  if (matches.length === 0) {
    return {
      type: 'CREATE_CONTENT',
      category: 'generation',
      confidence: 0.5,
      signals: [],
      requiresSource: false,
    };
  }

  const bestMatch = matches[0];

  // Boost confidence if implicit reference matches transform action
  let confidence = bestMatch.weight;
  if (hasImplicitReference && ACTION_CATEGORIES[bestMatch.type] === 'transform') {
    confidence = Math.min(1, confidence + 0.1);
  }

  const result: ActionClassification = {
    type: bestMatch.type,
    category: ACTION_CATEGORIES[bestMatch.type],
    confidence,
    signals: bestMatch.signals,
    requiresSource: SOURCE_REQUIRED_ACTIONS.includes(bestMatch.type),
  };

  // Add transform mode for transform actions
  if (ACTION_CATEGORIES[bestMatch.type] === 'transform') {
    result.transformMode = detectTransformMode(input);
    const directiveSignals = getDirectiveSignals(input);
    if (directiveSignals.length > 0) {
      result.directiveSignals = directiveSignals;
    }
  }

  return result;
}

/**
 * Check if input has implicit reference to previous content
 * @param input - User input text
 * @returns True if implicit reference detected
 */
export function hasImplicitReference(input: string): boolean {
  const normalizedInput = input.trim().toLowerCase();
  return IMPLICIT_REFERENCE_PATTERNS.some((p) => p.test(normalizedInput));
}

/**
 * Check if action type requires source text
 * @param actionType - Action type to check
 * @returns True if source is required
 */
export function requiresSource(actionType: ActionType): boolean {
  return SOURCE_REQUIRED_ACTIONS.includes(actionType);
}

/**
 * Get category for an action type
 * @param actionType - Action type
 * @returns Action category
 */
export function getActionCategory(actionType: ActionType): ActionCategory {
  return ACTION_CATEGORIES[actionType];
}
