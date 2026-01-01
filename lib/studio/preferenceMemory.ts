// ============================================
// STEP 5: Lightweight Preference Memory
// ============================================
// Soft, non-intrusive behavioral inference based on user patterns.
// Session-scoped or localStorage only, never persists sensitive data.
//
// DESIGN PRINCIPLES:
// - Infer, never ask
// - Adapt subtly, never dramatically
// - Silence is better than wrong memory
// - User action always overrides inference
// ============================================

const STORAGE_KEY = 'studio_soft_preferences';
const SESSION_KEY = 'studio_session_prefs';

// Memory decay: clear after 7 days of inactivity
const MEMORY_DECAY_MS = 7 * 24 * 60 * 60 * 1000;

// Minimum threshold for inference confidence
const MIN_USAGE_COUNT = 2;

// ============================================
// Types
// ============================================

interface ToneUsage {
  [toneId: string]: number;
}

interface CategoryUsage {
  [category: string]: number;
}

interface LengthBias {
  longerCount: number;
  shorterCount: number;
}

interface WorkflowPattern {
  editThenCreate: number;
  generateThenSave: number;
  generateThenRegenerate: number;
}

interface SoftPreferences {
  toneUsage: ToneUsage;
  categoryUsage: CategoryUsage;
  lengthBias: LengthBias;
  workflowPattern: WorkflowPattern;
  lastActivityAt: number;
}

// ============================================
// Storage Helpers
// ============================================

function getDefaultPreferences(): SoftPreferences {
  return {
    toneUsage: {},
    categoryUsage: {},
    lengthBias: { longerCount: 0, shorterCount: 0 },
    workflowPattern: {
      editThenCreate: 0,
      generateThenSave: 0,
      generateThenRegenerate: 0,
    },
    lastActivityAt: Date.now(),
  };
}

function loadPreferences(): SoftPreferences {
  if (typeof window === 'undefined') return getDefaultPreferences();

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return getDefaultPreferences();

    const prefs: SoftPreferences = JSON.parse(stored);

    // Check for memory decay
    if (Date.now() - prefs.lastActivityAt > MEMORY_DECAY_MS) {
      // Clear stale memory
      localStorage.removeItem(STORAGE_KEY);
      return getDefaultPreferences();
    }

    return prefs;
  } catch {
    return getDefaultPreferences();
  }
}

function savePreferences(prefs: SoftPreferences): void {
  if (typeof window === 'undefined') return;

  try {
    prefs.lastActivityAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Fail silently - memory is non-critical
  }
}

// ============================================
// Tone Preference
// ============================================

/**
 * Record tone usage when user selects a tone.
 * Does NOT record if user sticks with default.
 */
export function recordToneUsage(toneId: string): void {
  if (!toneId) return; // Default selection, don't record

  const prefs = loadPreferences();
  prefs.toneUsage[toneId] = (prefs.toneUsage[toneId] || 0) + 1;
  savePreferences(prefs);
}

/**
 * Get inferred preferred tone if confidence is high enough.
 * Returns undefined if no clear preference.
 */
export function getInferredTone(): string | undefined {
  const prefs = loadPreferences();
  const entries = Object.entries(prefs.toneUsage);

  if (entries.length === 0) return undefined;

  // Find most used tone
  const [topTone, count] = entries.reduce((a, b) => (b[1] > a[1] ? b : a));

  // Only infer if used at least MIN_USAGE_COUNT times
  if (count >= MIN_USAGE_COUNT) {
    return topTone;
  }

  return undefined;
}

/**
 * Clear tone preference (called when user explicitly changes tone).
 * Reduces weight of previous preference, doesn't fully clear.
 */
export function softResetTonePreference(newToneId: string): void {
  const prefs = loadPreferences();

  // Reduce all other tone counts by 1 (decay old preferences)
  for (const key of Object.keys(prefs.toneUsage)) {
    if (key !== newToneId && prefs.toneUsage[key] > 0) {
      prefs.toneUsage[key] = Math.max(0, prefs.toneUsage[key] - 1);
    }
  }

  savePreferences(prefs);
}

// ============================================
// Category Affinity
// ============================================

/**
 * Record category usage when user clicks a prompt card.
 */
export function recordCategoryUsage(category: string): void {
  if (!category) return;

  const prefs = loadPreferences();
  prefs.categoryUsage[category] = (prefs.categoryUsage[category] || 0) + 1;
  savePreferences(prefs);
}

/**
 * Get category ranking based on usage.
 * Returns array of categories sorted by affinity (most used first).
 * Only includes categories with usage >= MIN_USAGE_COUNT.
 */
export function getCategoryAffinity(): string[] {
  const prefs = loadPreferences();
  const entries = Object.entries(prefs.categoryUsage)
    .filter(([_, count]) => count >= MIN_USAGE_COUNT)
    .sort((a, b) => b[1] - a[1]);

  return entries.map(([category]) => category);
}

// ============================================
// Output Length Bias
// ============================================

/**
 * Record when user requests longer output.
 */
export function recordLongerRequest(): void {
  const prefs = loadPreferences();
  prefs.lengthBias.longerCount += 1;
  savePreferences(prefs);
}

/**
 * Record when user requests shorter output.
 */
export function recordShorterRequest(): void {
  const prefs = loadPreferences();
  prefs.lengthBias.shorterCount += 1;
  savePreferences(prefs);
}

/**
 * Get inferred length bias as a multiplier.
 * Returns: 1.0 (no bias), 1.1-1.15 (longer bias), 0.85-0.9 (shorter bias)
 */
export function getLengthBias(): number {
  const prefs = loadPreferences();
  const { longerCount, shorterCount } = prefs.lengthBias;

  const total = longerCount + shorterCount;
  if (total < MIN_USAGE_COUNT) return 1.0; // No bias yet

  const longerRatio = longerCount / total;

  if (longerRatio > 0.7) {
    // Strong preference for longer - up to 15% bias
    return 1.0 + (longerRatio - 0.5) * 0.3; // Max 1.15
  } else if (longerRatio < 0.3) {
    // Strong preference for shorter - up to 15% reduction
    return 1.0 - (0.5 - longerRatio) * 0.3; // Min 0.85
  }

  return 1.0; // Balanced, no bias
}

// ============================================
// Workflow Pattern
// ============================================

/**
 * Record workflow pattern: Edit → Create
 */
export function recordEditThenCreate(): void {
  const prefs = loadPreferences();
  prefs.workflowPattern.editThenCreate += 1;
  savePreferences(prefs);
}

/**
 * Record workflow pattern: Generate → Save
 */
export function recordGenerateThenSave(): void {
  const prefs = loadPreferences();
  prefs.workflowPattern.generateThenSave += 1;
  savePreferences(prefs);
}

/**
 * Record workflow pattern: Generate → Regenerate
 */
export function recordGenerateThenRegenerate(): void {
  const prefs = loadPreferences();
  prefs.workflowPattern.generateThenRegenerate += 1;
  savePreferences(prefs);
}

/**
 * Get dominant workflow pattern.
 * Returns undefined if no clear pattern.
 */
export function getDominantWorkflow(): 'edit-create' | 'generate-save' | 'generate-regenerate' | undefined {
  const prefs = loadPreferences();
  const { editThenCreate, generateThenSave, generateThenRegenerate } = prefs.workflowPattern;

  const total = editThenCreate + generateThenSave + generateThenRegenerate;
  if (total < MIN_USAGE_COUNT * 2) return undefined; // Need more data

  const patterns = [
    { name: 'edit-create' as const, count: editThenCreate },
    { name: 'generate-save' as const, count: generateThenSave },
    { name: 'generate-regenerate' as const, count: generateThenRegenerate },
  ];

  const dominant = patterns.reduce((a, b) => (b.count > a.count ? b : a));

  // Only return if clearly dominant (>40% of total)
  if (dominant.count / total > 0.4) {
    return dominant.name;
  }

  return undefined;
}

/**
 * Check if save action is rarely used (for reducing visual weight).
 */
export function isSaveRarelyUsed(): boolean {
  const prefs = loadPreferences();
  const { generateThenSave, editThenCreate, generateThenRegenerate } = prefs.workflowPattern;

  const total = generateThenSave + editThenCreate + generateThenRegenerate;
  if (total < MIN_USAGE_COUNT * 2) return false; // Not enough data

  // Save is rarely used if <20% of actions
  return generateThenSave / total < 0.2;
}

// ============================================
// Session-Level Memory (for current session only)
// ============================================

interface SessionMemory {
  lastAction: 'generate' | 'edit' | 'save' | 'create' | null;
  hasGeneratedThisSession: boolean;
  hasSavedThisSession: boolean;
  hasCreatedThisSession: boolean;
  // STEP 9(B): Navigation click tracking for adaptive density
  navClickCount: number;
  studioVisitCount: number;
}

let sessionMemory: SessionMemory = {
  lastAction: null,
  hasGeneratedThisSession: false,
  hasSavedThisSession: false,
  hasCreatedThisSession: false,
  navClickCount: 0,
  studioVisitCount: 0,
};

export function recordSessionAction(action: 'generate' | 'edit' | 'save' | 'create'): void {
  // Record workflow transition for persistent memory
  if (sessionMemory.lastAction === 'edit' && action === 'create') {
    recordEditThenCreate();
  } else if (sessionMemory.lastAction === 'generate' && action === 'save') {
    recordGenerateThenSave();
  } else if (sessionMemory.lastAction === 'generate' && action === 'generate') {
    recordGenerateThenRegenerate();
  }

  // Update session state
  sessionMemory.lastAction = action;
  if (action === 'generate') sessionMemory.hasGeneratedThisSession = true;
  if (action === 'save') sessionMemory.hasSavedThisSession = true;
  if (action === 'create') sessionMemory.hasCreatedThisSession = true;
}

export function getSessionMemory(): SessionMemory {
  return { ...sessionMemory };
}

// ============================================
// STEP 9(B): Navigation Click Tracking
// ============================================
// Track navigation clicks within session for adaptive density

/**
 * Record a navigation click (sidebar link clicked).
 */
export function recordNavClick(): void {
  sessionMemory.navClickCount += 1;
}

/**
 * Record a Studio page visit.
 */
export function recordStudioVisit(): void {
  sessionMemory.studioVisitCount += 1;
}

/**
 * Check if user is comfortable with navigation (3+ clicks this session).
 * Used to reduce visual weight of navigation helper elements.
 */
export function isNavComfortable(): boolean {
  return sessionMemory.navClickCount >= 3;
}

/**
 * Check if user is a returning Studio user (2+ visits this session).
 * Used to reduce helper density in Studio.
 */
export function isReturningStudioUser(): boolean {
  return sessionMemory.studioVisitCount >= 2;
}

/**
 * Get nav click count for adaptive density calculations.
 */
export function getNavClickCount(): number {
  return sessionMemory.navClickCount;
}

// ============================================
// Reset / Clear
// ============================================

/**
 * Full reset of all preferences (for testing or user request).
 */
export function clearAllPreferences(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionMemory = {
      lastAction: null,
      hasGeneratedThisSession: false,
      hasSavedThisSession: false,
      hasCreatedThisSession: false,
      navClickCount: 0,
      studioVisitCount: 0,
    };
  } catch {
    // Fail silently
  }
}
