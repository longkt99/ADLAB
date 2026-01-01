// ============================================
// Manifest-System Prompt Consistency Validator
// ============================================
// Validates that NORMALIZED_STRUCTURE_RULES in buildSystemPrompt.ts
// matches the corresponding manifest outputSpec sections.
// Detects drift between manifests and hardcoded prompt rules.

import { resolveTemplateManifest, getRegisteredManifestIds } from './resolveManifest';

/**
 * Known section label mappings between manifests and normalized rules
 * Maps manifest section names to their expected labels in normalized rules
 */
const SECTION_LABEL_MAPPINGS: Record<string, string[]> = {
  // Social Caption
  'Hook': ['Hook', '**Hook:**'],
  'Body': ['Body', '**Body:**'],
  'Call-to-Action': ['Call-to-Action', 'CTA', '**Call-to-Action:**', '**CTA:**'],
  'Hashtags': ['Hashtags', '**Hashtags:**'],

  // SEO Blog
  'Title': ['Title', '**Title:**'],
  'Meta Description': ['Meta Description', '**Meta Description:**'],
  'Introduction': ['Introduction', '**Introduction:**'],
  'Main Content Sections': ['Main Content Sections', '**Main Content Sections:**'],
  'Conclusion': ['Conclusion', '**Conclusion:**', 'Kết Luận'],
  'FAQ Section': ['FAQ Section', '**FAQ Section:**', 'FAQ'],

  // Video Script
  'Hook (0–3s)': ['Hook (0-3s)', 'Hook (0–3s)', '**Hook (0-3s):**', '**Hook (0–3s):**'],
  'Main Content': ['Main Content', '**Main Content:**'],

  // Email Marketing
  'Subject': ['Subject', '**Subject:**'],
  'Preview Text': ['Preview Text', '**Preview Text:**'],
  'Email Body': ['Email Body', '**Email Body:**'],

  // Landing Page
  'Hero Headline': ['Hero Headline', '**Hero Headline:**'],
  'Sub-headline': ['Sub-headline', 'Subheadline', '**Sub-headline:**'],
  'Key Benefits': ['Key Benefits', '**Key Benefits:**'],
  'Social Proof': ['Social Proof', '**Social Proof:**'],
  'Offer / CTA': ['Offer / CTA', 'Offer/CTA', '**Offer / CTA:**'],

  // Product Description
  'Product Title': ['Product Title', '**Product Title:**'],
  'Features / Specs': ['Features / Specs', 'Features/Specs', '**Features / Specs:**'],
  'Usage / Who is it for': ['Usage / Who is it for', '**Usage / Who is it for:**'],

  // Reel Caption
  'Hook Line': ['Hook Line', '**Hook Line:**'],
  'Context Line': ['Context Line', '**Context Line:**'],
  'Engagement CTA': ['Engagement CTA', '**Engagement CTA:**'],
};

/**
 * Validation result for a single manifest
 */
export interface ManifestValidationResult {
  templateId: string;
  manifestName: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiredSections: string[];
  optionalSections: string[];
}

/**
 * Overall validation result
 */
export interface ValidationReport {
  timestamp: string;
  totalManifests: number;
  validCount: number;
  invalidCount: number;
  warningCount: number;
  results: ManifestValidationResult[];
}

/**
 * Hardcoded normalized structure rules from buildSystemPrompt.ts
 * This is a reference copy for validation - the source of truth is buildSystemPrompt.ts
 */
const EXPECTED_NORMALIZED_RULES: Record<string, { required: string[]; optional: string[] }> = {
  social_caption_v1: {
    required: ['Hook', 'Body', 'Call-to-Action'],
    optional: ['Hashtags'],
  },
  seo_blog_v1: {
    required: ['Title', 'Meta Description', 'Introduction', 'Main Content Sections', 'Conclusion'],
    optional: ['FAQ Section'],
  },
  video_script_v1: {
    required: ['Hook (0–3s)', 'Main Content', 'Call-to-Action'],
    optional: [],
  },
  email_marketing_v1: {
    required: ['Subject', 'Email Body', 'Call-to-Action'],
    optional: ['Preview Text'],
  },
  landing_page_v1: {
    required: ['Hero Headline', 'Sub-headline', 'Key Benefits', 'Offer / CTA'],
    optional: ['Social Proof'],
  },
  product_description_v1: {
    required: ['Product Title', 'Key Benefits', 'Call-to-Action'],
    optional: ['Features / Specs', 'Usage / Who is it for'],
  },
  reel_caption_v1: {
    required: ['Hook Line', 'Engagement CTA'],
    optional: ['Context Line'],
  },
};

/**
 * Validate a single manifest against expected normalized rules
 */
export function validateManifest(templateId: string): ManifestValidationResult {
  const manifest = resolveTemplateManifest(templateId);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!manifest) {
    return {
      templateId,
      manifestName: 'NOT FOUND',
      isValid: false,
      errors: [`Manifest not found for templateId: ${templateId}`],
      warnings: [],
      requiredSections: [],
      optionalSections: [],
    };
  }

  // Get manifest sections
  const manifestRequired = manifest.outputSpec.sections
    .filter(s => s.required)
    .map(s => s.name);
  const manifestOptional = manifest.outputSpec.sections
    .filter(s => !s.required)
    .map(s => s.name);

  // Get expected sections from normalized rules
  const expectedRules = EXPECTED_NORMALIZED_RULES[templateId];

  if (!expectedRules) {
    warnings.push(`No expected normalized rules defined for ${templateId} - cannot validate sync`);
    return {
      templateId,
      manifestName: manifest.name,
      isValid: true, // Warn but don't fail if no expectations defined
      errors,
      warnings,
      requiredSections: manifestRequired,
      optionalSections: manifestOptional,
    };
  }

  // Check for missing required sections in normalized rules
  for (const manifestSection of manifestRequired) {
    const normalizedName = findNormalizedName(manifestSection, expectedRules.required);
    if (!normalizedName) {
      errors.push(`REQUIRED section "${manifestSection}" from manifest not found in normalized rules`);
    }
  }

  // Check for extra required sections in normalized rules (not in manifest)
  for (const expectedSection of expectedRules.required) {
    const manifestName = findManifestName(expectedSection, manifestRequired);
    if (!manifestName) {
      errors.push(`REQUIRED section "${expectedSection}" in normalized rules but not in manifest`);
    }
  }

  // Check for missing optional sections (warning only)
  for (const manifestSection of manifestOptional) {
    const normalizedName = findNormalizedName(manifestSection, expectedRules.optional);
    if (!normalizedName) {
      warnings.push(`OPTIONAL section "${manifestSection}" from manifest not found in normalized rules`);
    }
  }

  return {
    templateId,
    manifestName: manifest.name,
    isValid: errors.length === 0,
    errors,
    warnings,
    requiredSections: manifestRequired,
    optionalSections: manifestOptional,
  };
}

/**
 * Find matching normalized rule name for a manifest section name
 */
function findNormalizedName(manifestName: string, normalizedList: string[]): string | null {
  // Direct match
  if (normalizedList.includes(manifestName)) {
    return manifestName;
  }

  // Check known mappings
  const mappings = SECTION_LABEL_MAPPINGS[manifestName] || [];
  for (const mapping of mappings) {
    if (normalizedList.includes(mapping)) {
      return mapping;
    }
  }

  // Fuzzy match (case-insensitive, whitespace normalized)
  const normalizedManifestName = manifestName.toLowerCase().replace(/[\s\-_\/]+/g, '');
  for (const ruleName of normalizedList) {
    const normalizedRuleName = ruleName.toLowerCase().replace(/[\s\-_\/]+/g, '');
    if (normalizedManifestName === normalizedRuleName) {
      return ruleName;
    }
  }

  return null;
}

/**
 * Find matching manifest section name for a normalized rule name
 */
function findManifestName(normalizedName: string, manifestList: string[]): string | null {
  // Direct match
  if (manifestList.includes(normalizedName)) {
    return normalizedName;
  }

  // Check reverse mappings
  for (const [manifestName, mappings] of Object.entries(SECTION_LABEL_MAPPINGS)) {
    if (mappings.includes(normalizedName) && manifestList.includes(manifestName)) {
      return manifestName;
    }
  }

  // Fuzzy match
  const normalizedRuleName = normalizedName.toLowerCase().replace(/[\s\-_\/]+/g, '');
  for (const manifestName of manifestList) {
    const normalizedManifestName = manifestName.toLowerCase().replace(/[\s\-_\/]+/g, '');
    if (normalizedRuleName === normalizedManifestName) {
      return manifestName;
    }
  }

  return null;
}

/**
 * Validate all registered manifests against normalized rules
 * Call this at startup or in tests to detect drift
 */
export function validateAllManifests(): ValidationReport {
  const templateIds = getRegisteredManifestIds();
  const results: ManifestValidationResult[] = [];

  for (const templateId of templateIds) {
    // Skip backward compat aliases (old IDs without _v1)
    if (!templateId.includes('_v1')) {
      continue;
    }
    results.push(validateManifest(templateId));
  }

  const validCount = results.filter(r => r.isValid).length;
  const invalidCount = results.filter(r => !r.isValid).length;
  const warningCount = results.filter(r => r.warnings.length > 0).length;

  return {
    timestamp: new Date().toISOString(),
    totalManifests: results.length,
    validCount,
    invalidCount,
    warningCount,
    results,
  };
}

/**
 * Run validation and throw if any manifests are invalid
 * Use this in tests or at startup to fail fast on drift
 */
export function assertManifestPromptSync(): void {
  const report = validateAllManifests();

  if (report.invalidCount > 0) {
    const errorMessages = report.results
      .filter(r => !r.isValid)
      .map(r => `\n  ${r.templateId}: ${r.errors.join(', ')}`)
      .join('');

    throw new Error(
      `[Manifest-Prompt Sync] ${report.invalidCount} manifest(s) out of sync with normalized rules:${errorMessages}\n\n` +
      'Fix: Update NORMALIZED_STRUCTURE_RULES in buildSystemPrompt.ts to match manifest outputSpec sections.'
    );
  }

  if (report.warningCount > 0) {
    const warningMessages = report.results
      .filter(r => r.warnings.length > 0)
      .map(r => `\n  ${r.templateId}: ${r.warnings.join(', ')}`)
      .join('');

    console.warn(
      `[Manifest-Prompt Sync] ${report.warningCount} manifest(s) have warnings:${warningMessages}`
    );
  }
}
