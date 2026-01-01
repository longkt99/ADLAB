// ============================================
// Intent Quality Rules
// ============================================
// Type definitions and rule evaluation for Quality Lock system

/**
 * Intent identifiers for Golden Intents
 */
export type IntentId =
  | 'social_caption_v1'
  | 'seo_blog_v1'
  | 'video_script_v1'
  | 'email_marketing_v1'
  | 'landing_page_v1'
  | 'product_description_v1'
  | 'reel_caption_v1';

/**
 * Valid IntentId values for runtime validation
 */
export const VALID_INTENT_IDS: readonly IntentId[] = [
  'social_caption_v1',
  'seo_blog_v1',
  'video_script_v1',
  'email_marketing_v1',
  'landing_page_v1',
  'product_description_v1',
  'reel_caption_v1',
] as const;

/**
 * Check if a string is a valid IntentId
 */
export function isValidIntentId(id: string | undefined | null): id is IntentId {
  return typeof id === 'string' && VALID_INTENT_IDS.includes(id as IntentId);
}

/**
 * Rule severity levels (uppercase to match quality engine)
 */
export type RuleSeverity = 'HARD' | 'SOFT';

/**
 * Result of evaluating a single quality rule
 */
export interface RuleResult {
  id: string;
  passed: boolean;
  severity: RuleSeverity;
  message: string;
  details?: unknown;
}

/**
 * Context for quality evaluation
 */
export interface QualityContext {
  intent: IntentId;
  output: string;
  templateId?: string;
  language?: 'vi' | 'en';
}

/**
 * Quality Lock evaluation result
 */
export interface QualityLockResult {
  passed: boolean;
  hardFails: RuleResult[];
  softFails: RuleResult[];
  allResults: RuleResult[];
}
