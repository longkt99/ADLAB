// ============================================
// Conversation Orchestrator Types
// ============================================
// Types for action classification, source resolution,
// locked context extraction, and topic lock validation.
// ============================================

// ============================================
// Action Types
// ============================================

/**
 * Action categories for classification
 */
export type ActionCategory = 'generation' | 'transform' | 'evaluation' | 'meta';

/**
 * Transform mode - distinguishes between pure rewrites and directed transforms
 * - PURE_TRANSFORM: Same content rewritten/shortened/optimized without new direction
 * - DIRECTED_TRANSFORM: Transform with NEW constraints/direction in the request
 */
export type TransformMode = 'PURE_TRANSFORM' | 'DIRECTED_TRANSFORM';

/**
 * All possible action types the orchestrator can classify
 */
export type ActionType =
  // Generation actions (create new content)
  | 'CREATE_CONTENT'
  | 'BRAINSTORM'
  | 'OUTLINE'
  // Transform actions (modify existing content)
  | 'REWRITE'
  | 'OPTIMIZE'
  | 'SHORTEN'
  | 'EXPAND'
  | 'CHANGE_TONE'
  | 'TRANSLATE'
  | 'FORMAT_CONVERT'
  // Evaluation actions (analyze content)
  | 'EVALUATE'
  | 'QA_FIX'
  // Meta actions (conversation control)
  | 'SELECT_SOURCE'
  | 'CLARIFY';

/**
 * Classification result from action classifier
 */
export interface ActionClassification {
  type: ActionType;
  category: ActionCategory;
  confidence: number; // 0-1
  signals: string[]; // Matched patterns/keywords
  requiresSource: boolean; // Whether this action needs source text
  /** Transform mode (only for transform actions) */
  transformMode?: TransformMode;
  /** Directive signals detected (for DIRECTED_TRANSFORM) */
  directiveSignals?: string[];
}

// ============================================
// Entity Types (for Locked Context)
// ============================================

/**
 * Entity types that can be locked
 */
export type LockedEntityType =
  | 'BRAND'
  | 'PERSON'
  | 'ORGANIZATION'
  | 'NUMBER'
  | 'PERCENTAGE'
  | 'DATE'
  | 'PRICE'
  | 'LOCATION'
  | 'PRODUCT'
  | 'KEYWORD';

/**
 * A single locked entity
 */
export interface LockedEntity {
  type: LockedEntityType;
  value: string;
  critical: boolean; // Must appear in output
  context?: string; // Surrounding context for disambiguation
}

// ============================================
// Format Types (for Locked Context)
// ============================================

/**
 * Detected content format/structure
 */
export type ContentFormat =
  | 'paragraph'
  | 'bullet_list'
  | 'numbered_list'
  | 'heading_sections'
  | 'mixed';

// ============================================
// Locked Context
// ============================================

/**
 * Context that must be preserved during transforms
 */
export interface LockedContext {
  /** Entities that must appear in output */
  locked_entities: LockedEntity[];
  /** Topic summary (first sentence or 150 chars) */
  topic_summary: string;
  /** Keywords extracted from source */
  topic_keywords: string[];
  /** Detected content format */
  required_format?: ContentFormat;
  /** Key facts/sections that must be kept */
  must_keep: string[];
  /** Source message ID this context was extracted from */
  source_message_id: string;
  /** Timestamp of extraction */
  extracted_at: number;
}

// ============================================
// Source Resolution
// ============================================

/**
 * Reference to a previous output
 */
export interface OutputReference {
  message_id: string;
  content_preview: string; // First 100 chars
  timestamp: number;
  template_id?: string;
}

/**
 * Source resolution status
 */
export type SourceResolutionStatus =
  | 'explicit' // UI-selected source
  | 'quoted' // Quoted text in input
  | 'implicit' // Implicit reference → last output
  | 'ambiguous' // Multiple candidates, need picker
  | 'none'; // No source needed or found

/**
 * Result of source resolution
 */
export interface SourceResolution {
  status: SourceResolutionStatus;
  source_message_id: string | null;
  source_content: string | null;
  candidates?: OutputReference[]; // For ambiguous cases
  confidence: number; // 0-1
}

// ============================================
// Constraint Injection
// ============================================

/**
 * Lock mode for constraint injection
 * NORMAL: Standard constraints with entity preservation
 * STRICT: Strict constraints with mandatory entity checking
 * RELAXED: Light constraints for directed transforms (user explicitly requested changes)
 */
export type LockMode = 'NORMAL' | 'STRICT' | 'RELAXED';

/**
 * Constraint block to inject into system prompt
 */
export interface ConstraintBlock {
  mode: LockMode;
  entities_block: string;
  topic_block: string;
  format_block: string;
  must_keep_block: string;
  full_constraint: string; // Combined constraint text
}

// ============================================
// Topic Lock Validation
// ============================================

/**
 * Validation check result
 */
export interface ValidationCheck {
  passed: boolean;
  score: number; // 0-1
  details: string;
}

/**
 * Full topic lock validation result
 */
export interface TopicLockValidation {
  overall_passed: boolean;
  entity_presence: ValidationCheck & {
    missing_entities: string[];
    present_entities: string[];
  };
  topic_drift: ValidationCheck & {
    keyword_overlap: number;
    drift_keywords: string[];
  };
  format_compliance: ValidationCheck & {
    expected_format?: ContentFormat;
    detected_format?: ContentFormat;
  };
}

// ============================================
// Transform Output Contract (Immutable Validation)
// ============================================

/**
 * Required structure elements for transform output
 */
export type StructureElement = 'HOOK' | 'BODY' | 'CTA' | 'HEADING' | 'LIST';

/**
 * Contract validation failure reason
 */
export interface ContractViolation {
  type: 'LENGTH' | 'STRUCTURE' | 'TONE' | 'TOPIC';
  expected: string;
  actual: string;
  severity: 'HARD' | 'SOFT';
}

/**
 * Immutable output contract derived from user request
 * Defines quantitative requirements that MUST be met
 */
export interface TransformOutputContract {
  /** Minimum word count (null = no constraint) */
  requiredMinWords: number | null;
  /** Maximum word count (null = no constraint) */
  requiredMaxWords: number | null;
  /** Required structural elements */
  requiredStructure: StructureElement[];
  /** Required tone (if specified) */
  requiredTone: string | null;
  /** Source for deriving the contract (for debugging) */
  derivedFrom: string;
  /** Whether this is a strict contract (quantitative requirements present) */
  isStrict: boolean;
}

/**
 * Result of contract validation
 */
export interface ContractValidationResult {
  passed: boolean;
  violations: ContractViolation[];
  wordCount: number;
  structureDetected: StructureElement[];
  canRetry: boolean;
}

// ============================================
// Transform Result
// ============================================

/**
 * Result of a transform operation
 */
export interface TransformResult {
  success: boolean;
  content: string | null;
  validation: TopicLockValidation | null;
  contractValidation: ContractValidationResult | null;
  retry_used: boolean; // Was STRICT mode retry used?
  requires_confirmation: boolean; // User must confirm (2nd failure)
  error?: string;
}

// ============================================
// Conversation State
// ============================================

/**
 * Full conversation state for orchestrator
 */
export interface ConversationState {
  /** Last 5 assistant messages for source resolution */
  last_outputs: OutputReference[];
  /** Currently active source message ID */
  active_source_id: string | null;
  /** Currently active template ID */
  active_template_id: string | null;
  /** Current locked context (if in transform flow) */
  locked_context: LockedContext | null;
  /** State version for migration */
  version: number;
  /** Last updated timestamp */
  updated_at: number;
}

// ============================================
// State Storage
// ============================================

/**
 * State storage config
 */
export interface StateStorageConfig {
  localStorage_key: string;
  indexedDB_name: string;
  indexedDB_version: number;
  max_outputs: number;
}

/**
 * Default storage config
 */
export const DEFAULT_STORAGE_CONFIG: StateStorageConfig = {
  localStorage_key: 'orchestrator_state_v1',
  indexedDB_name: 'OrchestratorDB',
  indexedDB_version: 1,
  max_outputs: 5,
};

// ============================================
// UI Action Types
// ============================================

/**
 * Quick action for message action bar
 */
export interface QuickAction {
  id: ActionType;
  label: string;
  icon: string;
  tooltip?: string;
}

/**
 * Default quick actions for message action bar
 * Icons must match available IconName values from components/ui/Icon
 */
export const QUICK_ACTIONS: QuickAction[] = [
  { id: 'OPTIMIZE', label: 'Tối ưu', icon: 'sparkles', tooltip: 'Tối ưu hóa nội dung' },
  { id: 'REWRITE', label: 'Viết lại', icon: 'refresh', tooltip: 'Viết lại với phong cách khác' },
  { id: 'SHORTEN', label: 'Rút gọn', icon: 'arrowDown', tooltip: 'Rút gọn nội dung' },
  { id: 'CHANGE_TONE', label: 'Đổi giọng', icon: 'edit', tooltip: 'Thay đổi giọng văn' },
  { id: 'FORMAT_CONVERT', label: 'Đổi format', icon: 'grid', tooltip: 'Chuyển đổi định dạng' },
];
