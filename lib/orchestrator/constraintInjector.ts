// ============================================
// Constraint Injector
// ============================================
// Builds constrained system prompt from locked context.
// Supports NORMAL, STRICT, and RELAXED modes.
// ============================================

import type {
  LockedContext,
  LockedEntity,
  LockMode,
  ConstraintBlock,
  ContentFormat,
} from '@/types/orchestrator';
import { getCriticalEntities } from './lockedContextExtractor';

// ============================================
// Constraint Block Builders
// ============================================

/**
 * Build entities constraint block
 * @param entities - Locked entities
 * @param mode - Lock mode (NORMAL, STRICT, or RELAXED)
 * @returns Entities constraint text
 */
function buildEntitiesBlock(
  entities: LockedEntity[],
  mode: LockMode
): string {
  if (entities.length === 0) return '';

  const criticalEntities = entities.filter((e) => e.critical);
  const nonCriticalEntities = entities.filter((e) => !e.critical);

  // RELAXED mode: Critical entities are STILL REQUIRED (this is the key fix)
  // Only non-critical entities become optional
  if (mode === 'RELAXED') {
    if (criticalEntities.length === 0) return '';

    let block = '## ENTITY ANCHORS (REQUIRED)\n';
    block += 'These entities MUST appear in output (names, brands, numbers):\n';
    for (const entity of criticalEntities.slice(0, 8)) {
      block += `- **${entity.value}** [${entity.type}]\n`;
    }
    block += '\n✅ You may rephrase surrounding text.\n';
    block += '❌ You must NOT omit or change these entities.\n';
    return block;
  }

  let block = '## LOCKED ENTITIES\n';

  if (criticalEntities.length > 0) {
    block += '### CRITICAL (MUST appear exactly in output):\n';
    for (const entity of criticalEntities) {
      block += `- [${entity.type}] ${entity.value}\n`;
    }
  }

  if (nonCriticalEntities.length > 0) {
    block += '### PRESERVE (Should appear if relevant):\n';
    for (const entity of nonCriticalEntities) {
      block += `- [${entity.type}] ${entity.value}\n`;
    }
  }

  if (mode === 'STRICT') {
    block += '\n⚠️ STRICT MODE: Missing any CRITICAL entity will cause rejection.\n';
  }

  return block;
}

/**
 * Build topic constraint block
 * @param context - Locked context
 * @param mode - Lock mode
 * @returns Topic constraint text
 */
function buildTopicBlock(
  context: LockedContext,
  mode: LockMode
): string {
  // RELAXED mode: Topic anchor is REQUIRED but structure is free
  // This is the key fix - RELAXED ≠ FREE, core topic must be preserved
  if (mode === 'RELAXED') {
    let block = '## TOPIC ANCHOR (REQUIRED)\n';
    block += `**Core Topic:** ${context.topic_summary}\n`;
    if (context.topic_keywords.length > 0) {
      block += `**Key Terms:** ${context.topic_keywords.slice(0, 5).join(', ')}\n`;
    }
    block += '\n✅ You may adjust tone, style, and structure per user directive.\n';
    block += '❌ You must NOT change the core topic or subject matter.\n';
    return block;
  }

  let block = '## TOPIC LOCK\n';
  block += `### Summary: ${context.topic_summary}\n`;

  if (context.topic_keywords.length > 0) {
    block += `### Core Keywords: ${context.topic_keywords.slice(0, 10).join(', ')}\n`;
  }

  if (mode === 'STRICT') {
    block += '\n⚠️ STRICT MODE: Output must stay on topic. Topic drift will cause rejection.\n';
  } else {
    block += '\nOutput should maintain the same topic and core message.\n';
  }

  return block;
}

/**
 * Get format description
 * @param format - Content format
 * @returns Human-readable format description
 */
function getFormatDescription(format: ContentFormat): string {
  switch (format) {
    case 'bullet_list':
      return 'Bullet list with - or • markers';
    case 'numbered_list':
      return 'Numbered list with 1. 2. 3. format';
    case 'heading_sections':
      return 'Sections with headings (# or bold text)';
    case 'mixed':
      return 'Mixed format with lists and paragraphs';
    case 'paragraph':
    default:
      return 'Flowing paragraphs';
  }
}

/**
 * Build format constraint block
 * @param format - Required format
 * @param mode - Lock mode
 * @returns Format constraint text
 */
function buildFormatBlock(
  format: ContentFormat | undefined,
  mode: LockMode
): string {
  if (!format) return '';

  // RELAXED mode: No format constraints
  if (mode === 'RELAXED') {
    return '';
  }

  let block = '## FORMAT REQUIREMENT\n';
  block += `Required format: ${getFormatDescription(format)}\n`;

  if (mode === 'STRICT') {
    block += '\n⚠️ STRICT MODE: Output must match the required format.\n';
  } else {
    block += '\nOutput should maintain similar structure unless explicitly asked to change.\n';
  }

  return block;
}

/**
 * Build must-keep constraint block
 * @param mustKeep - Items that must be kept
 * @param mode - Lock mode
 * @returns Must-keep constraint text
 */
function buildMustKeepBlock(
  mustKeep: string[],
  mode: LockMode
): string {
  if (mustKeep.length === 0) return '';

  // RELAXED mode: No must-keep constraints
  if (mode === 'RELAXED') {
    return '';
  }

  let block = '## MUST KEEP\n';
  block += 'The following key points must be preserved:\n';

  for (const item of mustKeep) {
    block += `- ${item}\n`;
  }

  if (mode === 'STRICT') {
    block += '\n⚠️ STRICT MODE: Missing any must-keep item will cause rejection.\n';
  }

  return block;
}

// ============================================
// Transform Contract (SOURCE-FIRST enforcement)
// ============================================

/**
 * Build transform contract header
 * Ensures AI transforms source instead of creating new content
 * @param mode - Lock mode
 * @returns Contract header string
 */
function buildTransformContract(mode: LockMode): string {
  // CRITICAL: This contract applies to ALL transform modes
  // Even RELAXED mode must transform the source, not create new content
  let contract = '# 🔒 TRANSFORM CONTRACT (MANDATORY)\n\n';
  contract += '**YOU MUST:**\n';
  contract += '- Transform the provided SOURCE_TEXT below\n';
  contract += '- Keep the SAME topic and core subject matter\n';
  contract += '- Preserve brand names, project names, and key entities\n';
  contract += '- Output content that is clearly derived from the source\n\n';
  contract += '**YOU MUST NOT:**\n';
  contract += '- Create new unrelated content\n';
  contract += '- Switch to a different topic\n';
  contract += '- Invent new facts, names, or numbers not in source\n';
  contract += '- Output a refusal or explanation instead of transformed content\n\n';

  if (mode === 'STRICT') {
    contract += '⚠️ **STRICT MODE**: Any deviation from source topic will be rejected.\n\n';
  } else if (mode === 'RELAXED') {
    contract += '💡 **DIRECTED MODE**: You may adjust tone, style, and framing per user directive, but MUST keep core topic and entities.\n\n';
  }

  contract += '---\n\n';
  return contract;
}

// ============================================
// Main Injector
// ============================================

/**
 * Build constraint block from locked context
 * @param context - Locked context
 * @param mode - Lock mode (NORMAL, STRICT, or RELAXED)
 * @returns Constraint block with all parts
 */
export function buildConstraintBlock(
  context: LockedContext,
  mode: LockMode = 'NORMAL'
): ConstraintBlock {
  const entitiesBlock = buildEntitiesBlock(context.locked_entities, mode);
  const topicBlock = buildTopicBlock(context, mode);
  const formatBlock = buildFormatBlock(context.required_format, mode);
  const mustKeepBlock = buildMustKeepBlock(context.must_keep, mode);

  // Start with TRANSFORM CONTRACT (applies to ALL modes)
  let fullConstraint = buildTransformContract(mode);

  // Add mode-specific header
  if (mode === 'RELAXED') {
    // RELAXED mode: Light constraints header, but contract still enforced
    fullConstraint += '# CORE ANCHORS (Must Preserve)\n\n';
  } else {
    fullConstraint += '# LOCKED CONTEXT CONSTRAINTS\n\n';
    if (mode === 'STRICT') {
      fullConstraint += '🔒 **STRICT MODE ACTIVE** - Any deviation will be rejected.\n\n';
    }
  }

  if (entitiesBlock) fullConstraint += entitiesBlock + '\n';
  if (topicBlock) fullConstraint += topicBlock + '\n';
  if (formatBlock) fullConstraint += formatBlock + '\n';
  if (mustKeepBlock) fullConstraint += mustKeepBlock + '\n';

  fullConstraint += '---\n\n';

  return {
    mode,
    entities_block: entitiesBlock,
    topic_block: topicBlock,
    format_block: formatBlock,
    must_keep_block: mustKeepBlock,
    full_constraint: fullConstraint,
  };
}

/**
 * Inject constraints into system prompt
 * @param systemPrompt - Original system prompt
 * @param context - Locked context
 * @param mode - Lock mode
 * @returns Modified system prompt with constraints
 */
export function injectConstraints(
  systemPrompt: string,
  context: LockedContext,
  mode: LockMode = 'NORMAL'
): string {
  const constraintBlock = buildConstraintBlock(context, mode);

  // Inject at the beginning of system prompt
  return constraintBlock.full_constraint + systemPrompt;
}

/**
 * Build source reference for user message
 * @param sourceContent - Source content to reference
 * @returns Formatted source reference
 */
export function buildSourceReference(sourceContent: string): string {
  return `\n\n---\n**SOURCE CONTENT TO TRANSFORM:**\n\`\`\`\n${sourceContent}\n\`\`\`\n---\n`;
}

/**
 * Check if context has critical entities
 * @param context - Locked context
 * @returns True if has critical entities
 */
export function hasCriticalEntities(context: LockedContext): boolean {
  return getCriticalEntities(context).length > 0;
}

/**
 * Get constraint summary for UI display
 * @param context - Locked context
 * @returns Human-readable summary
 */
export function getConstraintSummary(context: LockedContext): string {
  const parts: string[] = [];

  const criticalCount = getCriticalEntities(context).length;
  if (criticalCount > 0) {
    parts.push(`${criticalCount} critical entities`);
  }

  if (context.required_format) {
    parts.push(getFormatDescription(context.required_format));
  }

  if (context.must_keep.length > 0) {
    parts.push(`${context.must_keep.length} key points`);
  }

  if (parts.length === 0) {
    return 'Topic lock active';
  }

  return 'Locked: ' + parts.join(', ');
}
