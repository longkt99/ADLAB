// ============================================
// Responsive UI Utilities
// ============================================
// Production-grade responsive helpers for Content Studio

/**
 * Container spacing classes by breakpoint
 * Mobile-first approach with progressive enhancement
 */
export const containerSpacing = {
  // Padding
  padding: 'px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-12',
  paddingX: 'px-4 sm:px-6 lg:px-8',
  paddingY: 'py-6 sm:py-8 lg:py-12',

  // Section spacing
  sectionGap: 'space-y-6 sm:space-y-8 lg:space-y-12',
  cardGap: 'gap-4 sm:gap-6',
} as const;

/**
 * Typography scale by breakpoint
 * Follows modern SaaS design system
 */
export const typography = {
  hero: {
    title: 'text-3xl sm:text-4xl lg:text-5xl font-bold',
    subtitle: 'text-base sm:text-lg lg:text-xl',
  },
  section: {
    title: 'text-xl sm:text-2xl lg:text-3xl font-semibold',
    subtitle: 'text-sm sm:text-base lg:text-lg',
  },
  card: {
    title: 'text-lg sm:text-xl font-semibold',
    description: 'text-sm sm:text-base',
  },
  button: {
    primary: 'text-sm sm:text-base',
    secondary: 'text-xs sm:text-sm',
  },
} as const;

/**
 * Grid layout configurations
 * Adaptive grid patterns for different breakpoints
 */
export const gridLayouts = {
  // Use case cards: 1 col mobile → 2 col desktop
  useCaseCards: 'grid grid-cols-1 lg:grid-cols-2',

  // Template cards: 1 col mobile → 2 col tablet → 3 col desktop
  templateCards: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3',

  // Auto-fit grid for flexible content
  autoFit: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
} as const;

/**
 * Flexbox button groups
 * Stack on mobile, inline on desktop
 */
export const buttonGroups = {
  stack: 'flex flex-col sm:flex-row',
  inline: 'flex flex-row flex-wrap',
  gap: 'gap-2 sm:gap-3',
} as const;

/**
 * Container max-width by breakpoint
 * Follows content hierarchy
 */
export const containers = {
  // Main content container
  main: 'max-w-7xl mx-auto',

  // Chat/form container (narrower for readability)
  chat: 'max-w-4xl mx-auto',

  // Modal/dialog container
  modal: 'max-w-6xl mx-auto',

  // Section container
  section: 'max-w-5xl mx-auto',
} as const;

/**
 * Responsive visibility utilities
 * Show/hide elements based on breakpoint
 */
export const visibility = {
  mobileOnly: 'block sm:hidden',
  tabletUp: 'hidden sm:block',
  desktopOnly: 'hidden lg:block',
  mobileHidden: 'hidden sm:block',
} as const;

/**
 * Animation duration by interaction type
 * Smooth transitions for responsive behavior
 */
export const transitions = {
  fast: 'transition-all duration-150',
  normal: 'transition-all duration-300',
  slow: 'transition-all duration-500',
} as const;

/**
 * Interactive states
 * Consistent hover/active/focus states
 */
export const interactiveStates = {
  card: 'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200',
  button: 'hover:shadow-md active:scale-95 transition-all duration-150',
  link: 'hover:opacity-80 transition-opacity duration-150',
} as const;

/**
 * Z-index scale for layering
 * Prevents z-index conflicts
 */
export const zIndex = {
  base: 'z-0',
  dropdown: 'z-10',
  sticky: 'z-20',
  modal: 'z-40',
  overlay: 'z-30',
  toast: 'z-50',
  fallingL: 'z-[9999]', // Highest for celebration animation
} as const;
