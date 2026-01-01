// ============================================
// Locked Context Extractor
// ============================================
// Extracts entities, topic, format, and key facts
// from source text to create locked context.
// ============================================

import type {
  LockedContext,
  LockedEntity,
  LockedEntityType,
  ContentFormat,
} from '@/types/orchestrator';

// ============================================
// Entity Extraction Patterns
// ============================================

interface EntityPattern {
  type: LockedEntityType;
  patterns: RegExp[];
  critical: boolean; // If true, must appear in output
}

const ENTITY_PATTERNS: EntityPattern[] = [
  // Percentages (critical)
  {
    type: 'PERCENTAGE',
    patterns: [
      /\d+(?:\.\d+)?%/g,
      /\d+(?:\.\d+)?\s*phần\s*trăm/gi,
      /\d+(?:\.\d+)?\s*percent/gi,
    ],
    critical: true,
  },
  // Numbers with context (critical)
  {
    type: 'NUMBER',
    patterns: [
      /\b\d{1,3}(?:[,.\s]\d{3})+(?:\.\d+)?\s*(VND|USD|đồng|triệu|tỷ|nghìn|k|K|M|B)?\b/g,
      /\b\d+(?:\.\d+)?\s*(triệu|tỷ|nghìn|million|billion|thousand)\b/gi,
    ],
    critical: true,
  },
  // Prices (critical)
  {
    type: 'PRICE',
    patterns: [
      /\$\d+(?:[,.\s]\d{3})*(?:\.\d{2})?/g,
      /\d+(?:[,.\s]\d{3})*\s*(?:VND|vnđ|đ|đồng)/gi,
      /giá\s*(?:chỉ|từ|còn)?\s*\d+/gi,
    ],
    critical: true,
  },
  // Dates (critical)
  {
    type: 'DATE',
    patterns: [
      /\d{1,2}\/\d{1,2}\/\d{2,4}/g,
      /\d{1,2}-\d{1,2}-\d{2,4}/g,
      /(?:ngày|tháng|năm)\s*\d+/gi,
      /\d{1,2}\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/gi,
      /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s*\d{1,2}/gi,
    ],
    critical: true,
  },
  // Brand names (patterns for common Vietnamese brands + ALL CAPS words)
  {
    type: 'BRAND',
    patterns: [
      /\b[A-Z][A-Z0-9]{2,}(?:\s+[A-Z][A-Z0-9]+)?\b/g, // ALL CAPS words (likely brands)
      /\b(?:MIK|GẠO VINA|VINAMILK|VIETTEL|FPT|VNG|VNPay|Momo|Grab|Shopee|Lazada|Tiki)\b/gi,
    ],
    critical: true,
  },
  // Person names (Vietnamese name pattern)
  {
    type: 'PERSON',
    patterns: [
      /(?:ông|bà|anh|chị|em|cô|chú|bác)\s+[A-ZÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴ][a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]+(?:\s+[A-ZÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴ][a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]+)*/g,
    ],
    critical: false,
  },
  // Locations
  {
    type: 'LOCATION',
    patterns: [
      /(?:tại|ở|từ)\s+[A-ZÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴ][a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]+(?:\s+[A-ZÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴ][a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]+)*/g,
      /(?:Hà Nội|Sài Gòn|TP\.?\s*HCM|Đà Nẵng|Huế|Cần Thơ|Hải Phòng)/gi,
    ],
    critical: false,
  },
];

// ============================================
// Format Detection
// ============================================

/**
 * Detect content format/structure
 * @param content - Source content
 * @returns Detected format
 */
function detectFormat(content: string): ContentFormat {
  const lines = content.split('\n').filter((l) => l.trim());

  // Check for bullet lists
  const bulletLines = lines.filter((l) => /^\s*[-•*]\s+/.test(l));
  if (bulletLines.length >= 3 && bulletLines.length / lines.length > 0.5) {
    return 'bullet_list';
  }

  // Check for numbered lists
  const numberedLines = lines.filter((l) => /^\s*\d+[.)]\s+/.test(l));
  if (numberedLines.length >= 3 && numberedLines.length / lines.length > 0.5) {
    return 'numbered_list';
  }

  // Check for heading sections
  const headingLines = lines.filter(
    (l) => /^#{1,6}\s+/.test(l) || /^[A-Z][^.!?]*:$/.test(l.trim())
  );
  if (headingLines.length >= 2) {
    return 'heading_sections';
  }

  // Check for mixed content
  if (bulletLines.length > 0 || numberedLines.length > 0 || headingLines.length > 0) {
    return 'mixed';
  }

  return 'paragraph';
}

// ============================================
// Keyword Extraction
// ============================================

/**
 * Extract important keywords from content
 * @param content - Source content
 * @param maxKeywords - Max keywords to extract
 * @returns Array of keywords
 */
function extractKeywords(content: string, maxKeywords: number = 20): string[] {
  // Remove common Vietnamese stop words
  const stopWords = new Set([
    'và', 'hoặc', 'nhưng', 'mà', 'nên', 'vì', 'để', 'khi', 'nếu', 'thì',
    'của', 'cho', 'với', 'trong', 'ngoài', 'trên', 'dưới', 'sau', 'trước',
    'là', 'có', 'được', 'không', 'này', 'đó', 'những', 'các', 'một', 'hai',
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  ]);

  // Tokenize and filter
  const words = content
    .toLowerCase()
    .replace(/[^\w\sàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w));

  // Count frequency
  const freq: Record<string, number> = {};
  for (const word of words) {
    freq[word] = (freq[word] || 0) + 1;
  }

  // Sort by frequency and return top N
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);
}

// ============================================
// Topic Summary Extraction
// ============================================

/**
 * Extract topic summary from content
 * @param content - Source content
 * @param maxLength - Max length of summary
 * @returns Topic summary string
 */
function extractTopicSummary(content: string, maxLength: number = 150): string {
  // Get first non-empty paragraph
  const paragraphs = content.split(/\n\n+/).filter((p) => p.trim());

  if (paragraphs.length === 0) {
    return content.slice(0, maxLength);
  }

  const firstPara = paragraphs[0].trim();

  // Find first sentence
  const sentenceMatch = firstPara.match(/^[^.!?]+[.!?]/);
  if (sentenceMatch && sentenceMatch[0].length <= maxLength) {
    return sentenceMatch[0];
  }

  // Truncate at maxLength
  if (firstPara.length <= maxLength) {
    return firstPara;
  }

  return firstPara.slice(0, maxLength - 3) + '...';
}

// ============================================
// Must Keep Extraction
// ============================================

/**
 * Extract key facts/sections that must be kept
 * @param content - Source content
 * @param maxItems - Max items to extract
 * @returns Array of must-keep strings
 */
function extractMustKeep(content: string, maxItems: number = 5): string[] {
  const mustKeep: string[] = [];

  // Extract headings
  const headings = content.match(/^#+\s+.+$/gm) || [];
  for (const h of headings.slice(0, 3)) {
    mustKeep.push(h.replace(/^#+\s+/, '').trim());
  }

  // Extract key sentences (with important indicators)
  const keyIndicators = [
    /quan\s*trọng/i,
    /chú\s*ý/i,
    /lưu\s*ý/i,
    /đặc\s*biệt/i,
    /important/i,
    /note/i,
    /key/i,
    /critical/i,
  ];

  const sentences = content.split(/[.!?]\s+/);
  for (const sentence of sentences) {
    if (mustKeep.length >= maxItems) break;
    if (keyIndicators.some((p) => p.test(sentence))) {
      mustKeep.push(sentence.slice(0, 100));
    }
  }

  return mustKeep.slice(0, maxItems);
}

// ============================================
// Main Extractor
// ============================================

/**
 * Extract locked context from source content
 * @param sourceContent - Source text to extract from
 * @param sourceMessageId - ID of source message
 * @returns Locked context
 */
export function extractLockedContext(
  sourceContent: string,
  sourceMessageId: string
): LockedContext {
  const entities: LockedEntity[] = [];

  // Extract entities using patterns
  for (const entityPattern of ENTITY_PATTERNS) {
    for (const pattern of entityPattern.patterns) {
      // Reset lastIndex for global patterns
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(sourceContent)) !== null) {
        // Avoid duplicates
        const value = match[0].trim();
        if (value && !entities.some((e) => e.value === value)) {
          entities.push({
            type: entityPattern.type,
            value,
            critical: entityPattern.critical,
            context: sourceContent.slice(
              Math.max(0, match.index - 30),
              match.index + value.length + 30
            ),
          });
        }
      }
    }
  }

  return {
    locked_entities: entities,
    topic_summary: extractTopicSummary(sourceContent),
    topic_keywords: extractKeywords(sourceContent),
    required_format: detectFormat(sourceContent),
    must_keep: extractMustKeep(sourceContent),
    source_message_id: sourceMessageId,
    extracted_at: Date.now(),
  };
}

/**
 * Get critical entities from locked context
 * @param context - Locked context
 * @returns Array of critical entities
 */
export function getCriticalEntities(context: LockedContext): LockedEntity[] {
  return context.locked_entities.filter((e) => e.critical);
}

/**
 * Get entity values by type
 * @param context - Locked context
 * @param type - Entity type to filter
 * @returns Array of entity values
 */
export function getEntitiesByType(
  context: LockedContext,
  type: LockedEntityType
): string[] {
  return context.locked_entities
    .filter((e) => e.type === type)
    .map((e) => e.value);
}
