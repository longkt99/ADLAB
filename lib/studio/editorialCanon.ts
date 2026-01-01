// ============================================
// STEP 15: Editorial Canon & Structural Locking
// ============================================
// Introduces "Editorial Canon" - a structural representation
// of the active draft that prevents unintended drift.
//
// CORE PRINCIPLE: EDIT = PATCH (targeted improvements),
// not REWRITE. Locked sections (Hook, CTA, Tone) are
// protected from change unless user explicitly approves.
//
// INVARIANTS:
// - No new LLM calls (pure functions only)
// - No localStorage text storage (session-only)
// - No routing changes (UI enforcement only)
// - SINGLE_LLM_CALL_SITE preserved
// ============================================

// ============================================
// Types
// ============================================

/**
 * Canon section types
 */
export type CanonSection = 'HOOK' | 'BODY' | 'CTA' | 'TONE';

/**
 * Body block types
 */
export type BodyBlockRole = 'paragraph' | 'list' | 'quote' | 'heading' | 'other';

/**
 * A single body block
 */
export interface BodyBlock {
  /** Unique ID for this block */
  id: string;
  /** Block content */
  text: string;
  /** Block role/type */
  role: BodyBlockRole;
  /** Whether this specific block is locked */
  locked: boolean;
}

/**
 * Tone identifier
 */
export type ToneId = 'professional' | 'casual' | 'friendly' | 'formal' | 'neutral' | 'unknown';

/**
 * Canon lock state - which sections are protected
 */
export interface CanonLockState {
  hookLocked: boolean;
  ctaLocked: boolean;
  toneLocked: boolean;
  /** Map of block ID to locked state */
  bodyLockedBlocks: Record<string, boolean>;
}

/**
 * Section with content and lock state
 */
export interface CanonSectionContent {
  text: string;
  locked: boolean;
}

/**
 * Full editorial canon structure
 */
export interface EditorialCanon {
  /** Hook section (opening/headline) */
  hook: CanonSectionContent;
  /** CTA section (call-to-action/closing) */
  cta: CanonSectionContent;
  /** Detected tone */
  tone: {
    id: ToneId;
    locked: boolean;
  };
  /** Body content blocks */
  body: {
    blocks: BodyBlock[];
  };
  /** Metadata */
  meta: {
    activeDraftId: string;
    createdAt: number;
    updatedAt: number;
    revision: number;
  };
}

/**
 * Canon diff result
 */
export interface CanonDiff {
  /** Which sections changed */
  changedSections: CanonSection[];
  /** Detailed diff by section */
  diffsBySection: {
    hook: { changed: boolean; oldText: string; newText: string } | null;
    cta: { changed: boolean; oldText: string; newText: string } | null;
    tone: { changed: boolean; oldTone: ToneId; newTone: ToneId } | null;
    body: { changed: boolean; addedBlocks: number; removedBlocks: number; modifiedBlocks: number } | null;
  };
  /** Whether any locked section changed */
  lockedSectionChanged: boolean;
}

/**
 * Canon constraints for editing
 */
export interface CanonConstraints {
  preserveHook: boolean;
  preserveCTA: boolean;
  preserveTone: boolean;
}

/**
 * Default lock policy
 */
export type LockPolicy = 'default' | 'lock_all' | 'unlock_all' | 'custom';

// ============================================
// Utility Functions
// ============================================

/**
 * Generate a simple hash for block ID (not for security, just uniqueness)
 */
function generateBlockId(text: string, index: number): string {
  let hash = 0;
  const sample = text.slice(0, 50);
  for (let i = 0; i < sample.length; i++) {
    hash = ((hash << 5) - hash) + sample.charCodeAt(i);
    hash = hash & hash;
  }
  return `blk_${Math.abs(hash).toString(16)}_${index}`;
}

/**
 * Normalize text for comparison
 */
function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Check if two texts are similar (within threshold)
 */
function textsAreSimilar(a: string, b: string, threshold = 0.8): boolean {
  const normA = normalizeText(a);
  const normB = normalizeText(b);

  if (normA === normB) return true;
  if (normA.length === 0 || normB.length === 0) return false;

  // Simple Jaccard similarity on words
  const wordsA = new Set(normA.split(' '));
  const wordsB = new Set(normB.split(' '));

  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);

  const similarity = intersection.size / union.size;
  return similarity >= threshold;
}

// ============================================
// Parsing Helpers
// ============================================

/**
 * Detect if a line is a Hook marker (header-style markers only)
 */
function isHookMarker(line: string): boolean {
  const normalized = line.toLowerCase().trim();
  const patterns = [
    /^#+\s*hook\s*$/i,         // ## Hook (heading)
    /^hook:\s*$/i,             // Hook: (label only)
    /^\*\*hook\*\*\s*$/i,      // **Hook** (bold marker)
    /^#+\s*mở\s*đầu\s*$/i,     // ## Mở đầu (heading)
    /^#+\s*dòng\s*mở\s*$/i,    // ## Dòng mở (heading)
    /^#+\s*headline\s*$/i,     // ## Headline (heading)
  ];
  return patterns.some(p => p.test(normalized));
}

/**
 * Detect if a line is a CTA marker (header-style markers only)
 */
function isCTAMarker(line: string): boolean {
  const normalized = line.toLowerCase().trim();
  const patterns = [
    /^#+\s*cta\s*$/i,           // ## CTA (heading)
    /^cta:\s*$/i,               // CTA: (label only)
    /^\*\*cta\*\*\s*$/i,        // **CTA** (bold marker)
    /^call\s*to\s*action\s*$/i, // Call to Action (standalone)
    /^#+\s*kết\s*luận\s*$/i,    // ## Kết luận (heading)
    /^#+\s*kêu\s*gọi\s*$/i,     // ## Kêu gọi (heading)
  ];
  return patterns.some(p => p.test(normalized));
}

/**
 * Detect if a line is a Body marker (header-style markers only)
 */
function isBodyMarker(line: string): boolean {
  const normalized = line.toLowerCase().trim();
  const patterns = [
    /^#+\s*body\s*$/i,         // ## Body (heading)
    /^body:\s*$/i,             // Body: (label only)
    /^\*\*body\*\*\s*$/i,      // **Body** (bold marker)
    /^#+\s*nội\s*dung\s*$/i,   // ## Nội dung (heading)
    /^#+\s*content\s*$/i,      // ## Content (heading)
  ];
  return patterns.some(p => p.test(normalized));
}

/**
 * Detect if a line looks like a CTA line (even without marker)
 */
function looksLikeCTA(line: string): boolean {
  const normalized = line.toLowerCase().trim();
  const patterns = [
    /liên\s*hệ/i,
    /đặt\s*hàng/i,
    /mua\s*ngay/i,
    /gọi\s*ngay/i,
    /inbox/i,
    /dm\s*ngay/i,
    /link\s*in\s*bio/i,
    /comment/i,
    /bình\s*luận/i,
    /nhắn\s*tin/i,
    /đăng\s*ký/i,
    /tham\s*gia/i,
    /click/i,
    /👇|⬇️|📩|📞|💬/,
  ];
  return patterns.some(p => p.test(normalized));
}

/**
 * Detect block role from content
 */
function detectBlockRole(text: string): BodyBlockRole {
  const trimmed = text.trim();

  if (/^#+\s/.test(trimmed)) return 'heading';
  if (/^[-*]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) return 'list';
  if (/^>/.test(trimmed) || /^"/.test(trimmed)) return 'quote';
  if (trimmed.length > 0) return 'paragraph';

  return 'other';
}

/**
 * Detect tone from text
 */
function detectTone(text: string): ToneId {
  const normalized = text.toLowerCase();

  // Professional indicators (check first)
  const professionalPatterns = [
    /kính\s*gửi/i,
    /trân\s*trọng/i,
    /xin\s*chào/i,
    /quý\s*khách/i,
    /chuyên\s*nghiệp/i,
  ];
  if (professionalPatterns.some(p => p.test(normalized))) return 'professional';

  // Formal (check before casual to prioritize formal tone)
  const formalPatterns = [
    /thưa\b/i,
    /\bngài\b/i,
    /quý\s*vị/i,
  ];
  if (formalPatterns.some(p => p.test(normalized))) return 'formal';

  // Casual/friendly indicators (word boundaries to avoid false matches)
  const casualPatterns = [
    /\bnè\b|\bnha\b|\bhen\b|\bnhé\b/i,  // Casual particles as whole words
    /bạn\s*ơi/i,
    /\bchill\b/i,
    /\bvibe\b/i,
    /✨|🔥|💪|😊|🎉/,
  ];
  if (casualPatterns.some(p => p.test(normalized))) return 'casual';

  // Friendly but not too casual
  const friendlyPatterns = [
    /bạn\s*thân\s*mến/i,
    /chào\s*bạn/i,
    /cảm\s*ơn\s*bạn/i,
  ];
  if (friendlyPatterns.some(p => p.test(normalized))) return 'friendly';

  return 'neutral';
}

// ============================================
// Core Functions
// ============================================

/**
 * Extract editorial canon from draft text.
 * Robust to multiple formats: markdown headings, Hook/Body/CTA markers,
 * or plain paragraphs.
 *
 * @param messageText - The draft content
 * @param draftId - ID of the draft message
 * @returns EditorialCanon structure
 */
export function extractCanonFromDraft(messageText: string, draftId: string): EditorialCanon {
  const now = Date.now();
  const lines = messageText.split('\n');

  // Default empty canon
  const emptyCanon: EditorialCanon = {
    hook: { text: '', locked: false },
    cta: { text: '', locked: false },
    tone: { id: 'neutral', locked: false },
    body: { blocks: [] },
    meta: {
      activeDraftId: draftId,
      createdAt: now,
      updatedAt: now,
      revision: 1,
    },
  };

  if (!messageText.trim()) {
    return emptyCanon;
  }

  // Try to parse with markers first
  let hookLines: string[] = [];
  let bodyLines: string[] = [];
  let ctaLines: string[] = [];
  let currentSection: 'hook' | 'body' | 'cta' | 'unknown' = 'unknown';
  let hasMarkers = false;

  for (const line of lines) {
    if (isHookMarker(line)) {
      currentSection = 'hook';
      hasMarkers = true;
      continue;
    }
    if (isBodyMarker(line)) {
      currentSection = 'body';
      hasMarkers = true;
      continue;
    }
    if (isCTAMarker(line)) {
      currentSection = 'cta';
      hasMarkers = true;
      continue;
    }

    switch (currentSection) {
      case 'hook':
        hookLines.push(line);
        break;
      case 'body':
        bodyLines.push(line);
        break;
      case 'cta':
        ctaLines.push(line);
        break;
      case 'unknown':
        // Will be processed below
        bodyLines.push(line);
        break;
    }
  }

  // If no markers found, use heuristic parsing
  if (!hasMarkers) {
    const paragraphs = messageText.split(/\n\s*\n/).filter(p => p.trim());

    if (paragraphs.length === 0) {
      return emptyCanon;
    }

    if (paragraphs.length === 1) {
      // Single paragraph - treat as body
      bodyLines = [paragraphs[0]];
    } else {
      // First paragraph = hook
      hookLines = [paragraphs[0]];

      // Check last paragraph for CTA
      const lastPara = paragraphs[paragraphs.length - 1];
      if (looksLikeCTA(lastPara)) {
        ctaLines = [lastPara];
        bodyLines = paragraphs.slice(1, -1).flatMap(p => p.split('\n'));
      } else {
        // No explicit CTA, everything else is body
        bodyLines = paragraphs.slice(1).flatMap(p => p.split('\n'));
      }
    }
  }

  // Build body blocks
  const bodyBlocks: BodyBlock[] = [];
  let currentBlock: string[] = [];

  for (const line of bodyLines) {
    if (line.trim() === '') {
      if (currentBlock.length > 0) {
        const blockText = currentBlock.join('\n').trim();
        if (blockText) {
          bodyBlocks.push({
            id: generateBlockId(blockText, bodyBlocks.length),
            text: blockText,
            role: detectBlockRole(blockText),
            locked: false,
          });
        }
        currentBlock = [];
      }
    } else {
      currentBlock.push(line);
    }
  }

  // Don't forget the last block
  if (currentBlock.length > 0) {
    const blockText = currentBlock.join('\n').trim();
    if (blockText) {
      bodyBlocks.push({
        id: generateBlockId(blockText, bodyBlocks.length),
        text: blockText,
        role: detectBlockRole(blockText),
        locked: false,
      });
    }
  }

  // Detect tone from full text
  const detectedTone = detectTone(messageText);

  return {
    hook: { text: hookLines.join('\n').trim(), locked: false },
    cta: { text: ctaLines.join('\n').trim(), locked: false },
    tone: { id: detectedTone, locked: false },
    body: { blocks: bodyBlocks },
    meta: {
      activeDraftId: draftId,
      createdAt: now,
      updatedAt: now,
      revision: 1,
    },
  };
}

/**
 * Compute diff between previous canon and new text candidate.
 *
 * @param prevCanon - Previous canon state
 * @param newTextCandidate - New text to compare
 * @returns CanonDiff describing what changed
 */
export function computeCanonDiff(prevCanon: EditorialCanon, newTextCandidate: string): CanonDiff {
  // Extract canon from new text (using same draft ID for comparison)
  const newCanon = extractCanonFromDraft(newTextCandidate, prevCanon.meta.activeDraftId);

  const changedSections: CanonSection[] = [];
  let lockedSectionChanged = false;

  // Compare hook
  const hookChanged = !textsAreSimilar(prevCanon.hook.text, newCanon.hook.text);
  if (hookChanged) {
    changedSections.push('HOOK');
    if (prevCanon.hook.locked) lockedSectionChanged = true;
  }

  // Compare CTA
  const ctaChanged = !textsAreSimilar(prevCanon.cta.text, newCanon.cta.text);
  if (ctaChanged) {
    changedSections.push('CTA');
    if (prevCanon.cta.locked) lockedSectionChanged = true;
  }

  // Compare tone
  const toneChanged = prevCanon.tone.id !== newCanon.tone.id;
  if (toneChanged) {
    changedSections.push('TONE');
    if (prevCanon.tone.locked) lockedSectionChanged = true;
  }

  // Compare body blocks
  const prevBlockTexts = prevCanon.body.blocks.map(b => normalizeText(b.text));
  const newBlockTexts = newCanon.body.blocks.map(b => normalizeText(b.text));

  let addedBlocks = 0;
  let removedBlocks = 0;
  let modifiedBlocks = 0;

  // Simple comparison - count differences
  const maxLen = Math.max(prevBlockTexts.length, newBlockTexts.length);
  for (let i = 0; i < maxLen; i++) {
    if (i >= prevBlockTexts.length) {
      addedBlocks++;
    } else if (i >= newBlockTexts.length) {
      removedBlocks++;
    } else if (prevBlockTexts[i] !== newBlockTexts[i]) {
      modifiedBlocks++;
    }
  }

  const bodyChanged = addedBlocks > 0 || removedBlocks > 0 || modifiedBlocks > 0;
  if (bodyChanged) {
    changedSections.push('BODY');
  }

  return {
    changedSections,
    diffsBySection: {
      hook: hookChanged ? {
        changed: true,
        oldText: prevCanon.hook.text,
        newText: newCanon.hook.text,
      } : null,
      cta: ctaChanged ? {
        changed: true,
        oldText: prevCanon.cta.text,
        newText: newCanon.cta.text,
      } : null,
      tone: toneChanged ? {
        changed: true,
        oldTone: prevCanon.tone.id,
        newTone: newCanon.tone.id,
      } : null,
      body: bodyChanged ? {
        changed: true,
        addedBlocks,
        removedBlocks,
        modifiedBlocks,
      } : null,
    },
    lockedSectionChanged,
  };
}

/**
 * Get canon constraints based on current lock state.
 *
 * @param canon - Current canon
 * @returns CanonConstraints
 */
export function getCanonConstraints(canon: EditorialCanon): CanonConstraints {
  return {
    preserveHook: canon.hook.locked,
    preserveCTA: canon.cta.locked,
    preserveTone: canon.tone.locked,
  };
}

/**
 * Determine if an edit should require canon approval.
 *
 * @param params - Parameters for decision
 * @returns true if approval is needed
 */
export function shouldRequireCanonApproval(params: {
  canon: EditorialCanon;
  diff: CanonDiff;
  instructionText?: string;
}): boolean {
  const { canon, diff, instructionText } = params;

  // If any locked section changed, require approval
  if (diff.lockedSectionChanged) {
    return true;
  }

  // Check if instruction explicitly mentions locked sections
  if (instructionText) {
    const normalized = instructionText.toLowerCase();

    // Explicit hook mentions
    const hookMentions = /hook|mở đầu|dòng mở|headline|tiêu đề/i;
    if (canon.hook.locked && hookMentions.test(normalized) && diff.changedSections.includes('HOOK')) {
      return true;
    }

    // Explicit CTA mentions
    const ctaMentions = /cta|call to action|kêu gọi|liên hệ|kết luận/i;
    if (canon.cta.locked && ctaMentions.test(normalized) && diff.changedSections.includes('CTA')) {
      return true;
    }

    // Explicit tone mentions
    const toneMentions = /tone|giọng|phong cách|style/i;
    if (canon.tone.locked && toneMentions.test(normalized) && diff.changedSections.includes('TONE')) {
      return true;
    }
  }

  return false;
}

/**
 * Apply lock policy to canon.
 *
 * @param canon - Current canon
 * @param policy - Lock policy to apply
 * @returns Updated canon with locks applied
 */
export function applyCanonLocks(
  canon: EditorialCanon,
  policy: LockPolicy = 'default'
): EditorialCanon {
  const updated = { ...canon };

  switch (policy) {
    case 'default':
      // Default: lock HOOK + CTA + TONE, leave BODY unlocked
      updated.hook = { ...canon.hook, locked: true };
      updated.cta = { ...canon.cta, locked: true };
      updated.tone = { ...canon.tone, locked: true };
      updated.body = {
        blocks: canon.body.blocks.map(b => ({ ...b, locked: false })),
      };
      break;

    case 'lock_all':
      updated.hook = { ...canon.hook, locked: true };
      updated.cta = { ...canon.cta, locked: true };
      updated.tone = { ...canon.tone, locked: true };
      updated.body = {
        blocks: canon.body.blocks.map(b => ({ ...b, locked: true })),
      };
      break;

    case 'unlock_all':
      updated.hook = { ...canon.hook, locked: false };
      updated.cta = { ...canon.cta, locked: false };
      updated.tone = { ...canon.tone, locked: false };
      updated.body = {
        blocks: canon.body.blocks.map(b => ({ ...b, locked: false })),
      };
      break;

    case 'custom':
      // No changes - keep existing lock state
      break;
  }

  updated.meta = {
    ...canon.meta,
    updatedAt: Date.now(),
  };

  return updated;
}

/**
 * Update individual section lock state.
 *
 * @param canon - Current canon
 * @param section - Section to update
 * @param locked - New lock state
 * @returns Updated canon
 */
export function updateSectionLock(
  canon: EditorialCanon,
  section: CanonSection,
  locked: boolean
): EditorialCanon {
  const updated = { ...canon };

  switch (section) {
    case 'HOOK':
      updated.hook = { ...canon.hook, locked };
      break;
    case 'CTA':
      updated.cta = { ...canon.cta, locked };
      break;
    case 'TONE':
      updated.tone = { ...canon.tone, locked };
      break;
    case 'BODY':
      // For BODY, lock/unlock all blocks
      updated.body = {
        blocks: canon.body.blocks.map(b => ({ ...b, locked })),
      };
      break;
  }

  updated.meta = {
    ...canon.meta,
    updatedAt: Date.now(),
  };

  return updated;
}

/**
 * Reapply locked sections from canon to new text.
 * This is the "local revert" mechanism - no LLM calls.
 *
 * @param canon - Canon with locked sections
 * @param newText - New text that may have changed locked sections
 * @returns Merged text preserving locked sections
 */
export function reapplyLockedSections(
  canon: EditorialCanon,
  newText: string
): string {
  // Extract new canon to understand structure
  const newCanon = extractCanonFromDraft(newText, canon.meta.activeDraftId);

  const parts: string[] = [];

  // Hook
  if (canon.hook.locked && canon.hook.text) {
    parts.push(canon.hook.text);
  } else if (newCanon.hook.text) {
    parts.push(newCanon.hook.text);
  }

  // Body - always use new body (body is typically unlocked)
  const bodyText = newCanon.body.blocks.map(b => b.text).join('\n\n');
  if (bodyText) {
    parts.push(bodyText);
  }

  // CTA
  if (canon.cta.locked && canon.cta.text) {
    parts.push(canon.cta.text);
  } else if (newCanon.cta.text) {
    parts.push(newCanon.cta.text);
  }

  return parts.filter(p => p.trim()).join('\n\n');
}

/**
 * Update canon after accepted edit.
 *
 * @param canon - Current canon
 * @param newText - New accepted text
 * @returns Updated canon with new content
 */
export function updateCanonFromText(
  canon: EditorialCanon,
  newText: string
): EditorialCanon {
  const newCanon = extractCanonFromDraft(newText, canon.meta.activeDraftId);

  return {
    hook: {
      text: newCanon.hook.text,
      locked: canon.hook.locked, // Preserve lock state
    },
    cta: {
      text: newCanon.cta.text,
      locked: canon.cta.locked,
    },
    tone: {
      id: newCanon.tone.id,
      locked: canon.tone.locked,
    },
    body: {
      blocks: newCanon.body.blocks.map((b, i) => ({
        ...b,
        locked: canon.body.blocks[i]?.locked ?? false,
      })),
    },
    meta: {
      ...canon.meta,
      updatedAt: Date.now(),
      revision: canon.meta.revision + 1,
    },
  };
}

/**
 * Get current lock state from canon.
 */
export function getCanonLockState(canon: EditorialCanon): CanonLockState {
  const bodyLockedBlocks: Record<string, boolean> = {};
  for (const block of canon.body.blocks) {
    bodyLockedBlocks[block.id] = block.locked;
  }

  return {
    hookLocked: canon.hook.locked,
    ctaLocked: canon.cta.locked,
    toneLocked: canon.tone.locked,
    bodyLockedBlocks,
  };
}

/**
 * Check if instruction is an ambiguous edit that should preserve structure.
 */
export function isAmbiguousEditInstruction(instructionText: string): boolean {
  const normalized = instructionText.toLowerCase().normalize('NFC').trim();

  // Short instructions that typically mean "improve body only"
  const ambiguousPatterns = [
    /^viết\s*(lại|hay\s*hơn|tốt\s*hơn)$/i,
    /^ngắn\s*(hơn|lại|gọn)$/i,
    /^dài\s*hơn$/i,
    /^tối\s*ưu$/i,
    /^improve$/i,
    /^rewrite$/i,
    /^shorter$/i,
    /^longer$/i,
    /^better$/i,
    /^optimize$/i,
    /^cải\s*thiện$/i,
    /^chỉnh\s*sửa$/i,
    /^sửa\s*lại$/i,
    /^hay\s*hơn$/i,
    /^tốt\s*hơn$/i,
  ];

  // If it's a short instruction and matches ambiguous patterns
  if (instructionText.length <= 30 && ambiguousPatterns.some(p => p.test(normalized))) {
    return true;
  }

  return false;
}

/**
 * Check if instruction explicitly mentions a section.
 */
export function instructionMentionsSection(
  instructionText: string,
  section: CanonSection
): boolean {
  const normalized = instructionText.toLowerCase().normalize('NFC');

  switch (section) {
    case 'HOOK':
      return /hook|mở đầu|dòng mở|headline|tiêu đề|câu mở/i.test(normalized);
    case 'CTA':
      return /cta|call to action|kêu gọi|liên hệ|kết luận|đoạn cuối/i.test(normalized);
    case 'TONE':
      return /tone|giọng|phong cách|style|văn phong/i.test(normalized);
    case 'BODY':
      return /body|nội dung|thân bài|content|đoạn giữa/i.test(normalized);
    default:
      return false;
  }
}

// ============================================
// UI Copy Helpers
// ============================================

/**
 * Get localized section name
 */
export function getSectionLabel(section: CanonSection, language: 'vi' | 'en' = 'vi'): string {
  const labels: Record<CanonSection, { vi: string; en: string }> = {
    HOOK: { vi: 'Mở đầu', en: 'Hook' },
    BODY: { vi: 'Nội dung', en: 'Body' },
    CTA: { vi: 'Kêu gọi', en: 'CTA' },
    TONE: { vi: 'Giọng văn', en: 'Tone' },
  };
  return labels[section][language];
}

/**
 * Get tone label
 */
export function getToneLabel(tone: ToneId, language: 'vi' | 'en' = 'vi'): string {
  const labels: Record<ToneId, { vi: string; en: string }> = {
    professional: { vi: 'Chuyên nghiệp', en: 'Professional' },
    casual: { vi: 'Thoải mái', en: 'Casual' },
    friendly: { vi: 'Thân thiện', en: 'Friendly' },
    formal: { vi: 'Trang trọng', en: 'Formal' },
    neutral: { vi: 'Trung lập', en: 'Neutral' },
    unknown: { vi: 'Chưa xác định', en: 'Unknown' },
  };
  return labels[tone][language];
}

// ============================================
// Debug Helpers
// ============================================

/**
 * Get debug summary of canon state
 */
export function getCanonDebugSummary(canon: EditorialCanon): string {
  const locks = [
    canon.hook.locked ? 'Hook🔒' : 'Hook',
    canon.cta.locked ? 'CTA🔒' : 'CTA',
    canon.tone.locked ? 'Tone🔒' : 'Tone',
    `Body(${canon.body.blocks.length})`,
  ];
  return `Canon: ${locks.join(' | ')} | Rev ${canon.meta.revision}`;
}
