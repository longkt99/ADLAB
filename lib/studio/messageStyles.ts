// ============================================
// Message UI Design System
// ============================================
// Single source of truth for Message UI styles.
// This file defines the visual contract for all message rendering.
//
// DESIGN PRINCIPLES:
// - Editorial / document-like, NOT chat bubbles
// - Notion / Linear aesthetic: calm, professional, tool-like
// - Zinc-based neutral palette with subtle severity accents
// - Typography-first hierarchy (no avatars, no gradients, no shadows)
//
// MESSAGE ROLE HIERARCHY:
// 1. ASSISTANT (primary) → Document-style content block
//    - Full card container with header
//    - Rich typography with optimal reading measure
//    - Primary visual weight
//
// 2. USER (secondary) → Quoted input context
//    - Left border accent (indented quote style)
//    - Muted typography
//    - Secondary visual weight
//
// 3. SYSTEM/META (tertiary) → Editorial annotations
//    - Inline within assistant messages
//    - Minimal chrome, text-only where possible
//    - Tertiary visual weight
//
// ============================================
// ⚠️ INTERACTION & ACCESSIBILITY GUARDRAILS
// ============================================
// ALLOWED:
// - Subtle opacity transitions (150-200ms)
// - Zinc color shifts on hover (one step darker/lighter)
// - focus-visible outlines (2px offset, zinc-400)
// - Underline reveals on interactive text
//
// DO NOT:
// - Use scale transforms on hover (feels playful, not editorial)
// - Use bounce/elastic easing (too casual)
// - Use color blocks on hover (too heavy)
// - Add sound or haptic feedback
// - Over-animate state changes
//
// PHILOSOPHY:
// This is an editorial review tool, not a chat app.
// Interactions should feel: calm, predictable, professional.
// If unsure → DO LESS, not more.
// ============================================
//
// ⚠️ VISUAL GUARDRAILS:
// - Do NOT add chat bubbles, avatars, or profile images
// - Do NOT add gradients, shadows, or decorative elements
// - Do NOT use colorful backgrounds (zinc/neutral only for containers)
// - Do NOT change message role visual hierarchy without design review

// ============================================
// Spacing Rhythm
// ============================================
export const MESSAGE_SPACING = {
  /** Gap between messages in the list */
  listGap: 'space-y-5',
  /** Scroll container max height */
  scrollHeight: 'max-h-[420px]',
  /** Container bottom margin */
  containerMargin: 'mb-6',
} as const;

// ============================================
// User Message Styles (Secondary - Quoted Input)
// ============================================
export const USER_MESSAGE = {
  /** Container: left border accent for "quoted" feel */
  container: 'pl-4 border-l border-zinc-200/70 dark:border-zinc-800/50',
  /** Label: very small, uppercase, muted */
  label: 'text-[9px] font-medium tracking-[0.04em] text-zinc-400/80 dark:text-zinc-600 uppercase mb-1.5',
  /** Content: smaller than assistant, muted color, narrower measure */
  content: 'text-[13px] text-zinc-500 dark:text-zinc-500 leading-[1.6] whitespace-pre-wrap max-w-[60ch]',
} as const;

// ============================================
// Assistant Message Styles (Primary - Document)
// ============================================
export const ASSISTANT_MESSAGE = {
  /** Container base: card with subtle border, no shadow */
  containerBase: 'relative bg-white dark:bg-zinc-900/80 border rounded-lg transition-all',
  /** Container state: default */
  containerDefault: 'border-zinc-200/80 dark:border-zinc-800/60',
  /** Container state: approved or pinned */
  containerActive: 'border-zinc-300 dark:border-zinc-700',

  /** Header bar: attribution + actions */
  header: 'flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800/60',

  /** Draft label: quiet, editorial, uppercase */
  draftLabel: 'text-[10px] font-medium tracking-[0.02em] text-zinc-400 dark:text-zinc-500 uppercase',

  /** Template attribution separator */
  attributionSeparator: 'text-zinc-300 dark:text-zinc-700',
  /** Template attribution text */
  attributionText: 'text-[10px] text-zinc-400 dark:text-zinc-500',

  /** Approved badge: neutral, not celebratory */
  approvedBadge: 'px-1.5 py-0.5 text-[9px] font-medium tracking-wide uppercase rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400',

  /** Content wrapper: semantic article with padding */
  contentWrapper: 'px-5 py-5',
  /** Content measure constraint */
  contentMeasure: 'max-w-[68ch]',
  /** Content typography: document-like reading experience */
  contentTypography: `
    text-[14px] leading-[1.75] tracking-[-0.008em]
    text-zinc-800 dark:text-zinc-200
    font-sans antialiased
    whitespace-pre-wrap
  `.trim().replace(/\s+/g, ' '),
  /** Content inline styles for optimal legibility */
  contentInlineStyle: {
    wordSpacing: '0.02em',
    textRendering: 'optimizeLegibility' as const,
  },

  /** Action buttons container - reveals on hover with calm opacity transition */
  actionsContainer: 'flex items-center gap-0.5 transition-opacity duration-150',
  /** Action buttons: visible on hover */
  actionsVisible: 'opacity-100',
  /** Action buttons: hidden by default */
  actionsHidden: 'opacity-0',
  /** Single action button - subtle hover, visible focus ring for keyboard nav */
  actionButton: 'p-1.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 focus-visible:ring-offset-1',
  /** Action button: disabled state */
  actionButtonDisabled: 'p-1.5 rounded text-zinc-300 dark:text-zinc-700 cursor-not-allowed',
  /** Action button: active/approved state */
  actionButtonActive: 'p-1.5 rounded text-zinc-500 dark:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 focus-visible:ring-offset-1',
} as const;

// ============================================
// Quality Badge Styles (Editorial Annotation)
// ============================================
export const QUALITY_BADGE = {
  /** Base badge styling - includes focus-visible for keyboard navigation */
  base: 'px-1.5 py-0.5 text-[9px] font-medium rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',

  /** PASS: neutral, not celebratory */
  pass: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 focus-visible:ring-zinc-400/50',
  /** WARNING: subtle amber accent */
  warning: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 focus-visible:ring-amber-400/50',
  /** FAIL: subtle red accent */
  fail: 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 focus-visible:ring-red-400/50',

  /** Legacy badge (no feedback object): PASS */
  legacyPass: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 focus-visible:ring-zinc-400/50',
  /** Legacy badge: DRAFT (maps to WARNING) */
  legacyDraft: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 focus-visible:ring-amber-400/50',
  /** Legacy badge: FAIL */
  legacyFail: 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 focus-visible:ring-red-400/50',
} as const;

// ============================================
// Loading Indicator Styles
// ============================================
export const LOADING_INDICATOR = {
  /** Container */
  container: 'py-3 animate-fade-in',
  /** Inner flex layout */
  inner: 'flex items-center gap-2',
  /** Dots container */
  dotsContainer: 'flex gap-0.5',
  /** Single dot */
  dot: 'w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-pulse',
  /** Label text */
  label: 'text-[11px] text-zinc-400 dark:text-zinc-500',
} as const;

// ============================================
// Error Box Styles
// ============================================
// STEP 2.5: Softened severity - calm assistance tone
// Reads as "AI can help you retry" not "System failure"
export const ERROR_BOX = {
  /** Container: neutral base with soft amber-tinted accent, not alarming red */
  container: 'mb-4 py-3 px-4 border-l-2 border-amber-400/70 dark:border-red-500 bg-zinc-50 dark:bg-zinc-900/50 rounded-r',
  /** Text: warm neutral in light mode, softer red in dark */
  text: 'text-[12px] text-zinc-600 dark:text-red-400 leading-relaxed',
} as const;

// ============================================
// Helper: Get quality badge class by status
// ============================================
export function getQualityBadgeClass(
  status: 'PASS' | 'WARNING' | 'FAIL',
  hasHover = true
): string {
  const baseClass = QUALITY_BADGE.base;
  const statusClass = hasHover
    ? QUALITY_BADGE[status.toLowerCase() as 'pass' | 'warning' | 'fail']
    : QUALITY_BADGE[`legacy${status === 'WARNING' ? 'Draft' : status.charAt(0) + status.slice(1).toLowerCase()}` as keyof typeof QUALITY_BADGE];

  return `${baseClass} ${statusClass}`;
}

// ============================================
// Helper: Get legacy quality badge class by decision
// ============================================
export function getLegacyQualityBadgeClass(
  decision: 'PASS' | 'DRAFT' | 'FAIL'
): string {
  const map = {
    PASS: QUALITY_BADGE.legacyPass,
    DRAFT: QUALITY_BADGE.legacyDraft,
    FAIL: QUALITY_BADGE.legacyFail,
  };
  return `${QUALITY_BADGE.base} ${map[decision]}`;
}

// ============================================
// Helper: Get assistant container class by state
// ============================================
export function getAssistantContainerClass(
  isApproved: boolean,
  isPinned: boolean
): string {
  const stateClass = isApproved || isPinned
    ? ASSISTANT_MESSAGE.containerActive
    : ASSISTANT_MESSAGE.containerDefault;

  return `${ASSISTANT_MESSAGE.containerBase} ${stateClass}`;
}

// ============================================
// Helper: Get action button class by state
// ============================================
export function getActionButtonClass(
  isApproved: boolean,
  isDisabled: boolean
): string {
  if (isApproved) return ASSISTANT_MESSAGE.actionButtonActive;
  if (isDisabled) return ASSISTANT_MESSAGE.actionButtonDisabled;
  return ASSISTANT_MESSAGE.actionButton;
}
