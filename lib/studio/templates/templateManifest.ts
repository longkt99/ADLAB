// ============================================
// Template Manifest Schema
// ============================================
// Stable JSON schema for template definitions
// Types only - prompt building logic is in buildSystemPrompt.ts

/**
 * Template Manifest Type
 * Defines all metadata and rules for a content generation template
 */
export interface TemplateManifest {
  /** Unique template identifier (e.g., "social_caption_v1") */
  id: string;

  /** Human-readable template name */
  name: string;

  /** Semantic version (e.g., "1.0.0", "2.3.1") */
  version: string;

  /** Brief description of template purpose */
  description: string;

  /** What this template is designed to achieve */
  objective: string;

  /** Output structure requirements */
  outputSpec: {
    /** Sections that must appear in output */
    sections: Array<{
      /** Section name/label */
      name: string;
      /** Whether this section is required */
      required: boolean;
      /** Description of what this section should contain */
      description: string;
    }>;
    /** Overall structure format (e.g., "labeled sections", "markdown", "json") */
    format: string;
  };

  /** Hard constraints and rules */
  constraints: {
    /** Things AI must do */
    must: string[];
    /** Things AI must avoid */
    avoid: string[];
    /** Maximum length guidance (if applicable) */
    maxLength?: string;
  };

  /** Style guidance (tone-independent formatting rules) */
  style: {
    /** Writing style description */
    description: string;
    /** Formatting preferences */
    formatting: string[];
  };

  /** Optional input variables that can be used in prompts */
  variables?: Array<{
    /** Variable name (e.g., "platform", "audience") */
    name: string;
    /** Variable description */
    description: string;
    /** Whether variable is required */
    required: boolean;
  }>;

  /** Optional example outputs */
  examples?: Array<{
    /** Example scenario description */
    scenario: string;
    /** Example output */
    output: string;
  }>;

  /** Attribution configuration */
  attribution?: {
    /** Should attribution be shown in UI? */
    showInUI: boolean;
    /** Custom attribution label (if different from template name) */
    customLabel?: string;
  };
}

/**
 * Options for buildSystemPrompt()
 */
export interface BuildSystemPromptOptions {
  /** Optional tone reinforcement string */
  toneReinforcement?: string;
  /** Optional workflow step guidance */
  workflowGuidance?: string;
  /** Optional platform-specific hint */
  platformHint?: string;
  /** Optional user-provided variables */
  variables?: Record<string, string>;
  /** Optional user input for context */
  userInput?: string;
}

/**
 * Validate Template Manifest Structure
 *
 * Checks if a manifest conforms to the schema.
 *
 * @param manifest - Manifest to validate
 * @returns Validation result with errors if any
 */
export function validateManifest(manifest: unknown): {
  isValid: boolean;
  errors: string[];
} {
  const m = manifest as Record<string, unknown>;
  const errors: string[] = [];

  // Required fields
  if (!m.id) errors.push('Missing required field: id');
  if (!m.name) errors.push('Missing required field: name');
  if (!m.version) errors.push('Missing required field: version');
  if (!m.objective) errors.push('Missing required field: objective');

  // outputSpec validation
  const outputSpec = m.outputSpec as Record<string, unknown> | undefined;
  if (!outputSpec) {
    errors.push('Missing required field: outputSpec');
  } else {
    if (!Array.isArray(outputSpec.sections)) {
      errors.push('outputSpec.sections must be an array');
    }
    if (!outputSpec.format) {
      errors.push('Missing required field: outputSpec.format');
    }
  }

  // constraints validation
  const constraints = m.constraints as Record<string, unknown> | undefined;
  if (!constraints) {
    errors.push('Missing required field: constraints');
  } else {
    if (!Array.isArray(constraints.must)) {
      errors.push('constraints.must must be an array');
    }
    if (!Array.isArray(constraints.avoid)) {
      errors.push('constraints.avoid must be an array');
    }
  }

  // style validation
  const style = m.style as Record<string, unknown> | undefined;
  if (!style) {
    errors.push('Missing required field: style');
  } else {
    if (!style.description) {
      errors.push('Missing required field: style.description');
    }
    if (!Array.isArray(style.formatting)) {
      errors.push('style.formatting must be an array');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
