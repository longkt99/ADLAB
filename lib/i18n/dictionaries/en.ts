// ============================================
// English Dictionary
// ============================================
// This dictionary MUST match the exact key structure of vi.ts
// Exception: 'prompts' section can have different keys (flexible)

import type { FlexibleDictionary } from './vi';

export const enDictionary: FlexibleDictionary = {
  // Common UI elements
  common: {
    loading: 'Loading...',
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    view: 'View',
    edit: 'Edit',
    delete: 'Delete',
    search: 'Search',
    filter: 'Filter',
    all: 'All',
    new: 'New',
    create: 'Create',
    update: 'Update',
    previous: 'Previous',
    next: 'Next',
    page: 'Page',
    of: 'of',
    showing: 'Showing',
    event: 'event',
    events: 'events',
    today: 'Today',
    viewFullPost: 'View Full Post',
    clearAllFilters: 'Clear all filters',
    confirm: 'Confirm',
    clear: 'Clear',
    saving: 'Saving...',
    updating: 'Updating...',
    deleting: 'Deleting...',
    variant: 'variant',
    variants: 'variants',
    characters: 'characters',
    chars: 'chars',
  },

  // Navigation items
  navigation: {
    posts: 'Posts',
    calendar: 'Calendar',
    newPost: 'New Post',
    studio: 'AI Studio',
    viewCalendar: 'View Calendar',
    contentMachine: 'Content Machine',
    multiPlatformCMS: 'Multi-platform CMS',
  },

  // User-related strings
  user: {
    defaultName: 'User',
    defaultEmail: 'user@contentmachine.app',
  },

  // Accessibility labels
  accessibility: {
    toggleLanguage: 'Toggle language',
    toggleTheme: 'Toggle theme',
    removeImage: 'Remove image',
    openSidebar: 'Open sidebar',
    closeSidebar: 'Close sidebar',
  },

  // Post-related strings
  posts: {
    title: 'Posts',
    description: 'Manage your content across',
    post: 'post',
    postPlural: 'posts',
    actions: {
      newPost: 'New Post',
      viewCalendar: 'View Calendar',
      view: 'View',
    },
    table: {
      title: 'Title',
      status: 'Status',
      platforms: 'Platforms',
      created: 'Created',
      scheduled: 'Scheduled',
      actions: 'Actions',
    },
    filters: {
      searchPlaceholder: 'Search posts...',
      allStatuses: 'All statuses',
      allPlatforms: 'All platforms',
      noResultsTitle: 'No posts found',
      noResultsDescription: 'Try adjusting your filters or search query',
    },
    empty: {
      title: 'No posts yet',
      description: 'Create your first post to start managing multi-platform content with AI-powered variations',
      cta: 'Create Your First Post',
    },
    platformPills: {
      noPlatforms: 'No platforms',
    },
    toast: {
      deleteSuccess: 'Post deleted successfully',
      deleteFailed: 'Failed to delete post',
    },
  },

  // Calendar-related strings
  calendar: {
    title: 'Calendar',
    subtitle: 'View and manage your scheduled and published content',

    toolbar: {
      today: 'Today',
      thisWeek: 'This Week',
      previousMonth: 'Previous month',
      nextMonth: 'Next month',
      previousPeriod: 'Previous period',
      nextPeriod: 'Next period',
      clearDateRange: 'Clear date range',
    },

    search: {
      placeholder: 'Search by title or content...',
    },

    filters: {
      platformLabel: 'Platform',
      statusLabel: 'Status',
      allPlatforms: 'All Platforms',
      allStatuses: 'All Statuses',
    },

    viewMode: {
      label: 'View:',
      month: 'Month',
      week: 'Week',
      agenda: 'Agenda',
    },

    weekdays: {
      sun: 'Sun',
      mon: 'Mon',
      tue: 'Tue',
      wed: 'Wed',
      thu: 'Thu',
      fri: 'Fri',
      sat: 'Sat',
    },

    stats: {
      showing: 'Showing',
      eventSingular: 'event',
      eventPlural: 'events',
      in: 'in',
      filteredFrom: '(filtered from',
      total: 'total)',
      clearAllFilters: 'Clear all filters',
    },

    loading: {
      message: 'Loading calendar...',
    },

    legend: {
      title: 'Legend',
      scheduled: 'Scheduled',
      published: 'Published',
      today: 'Today',
    },

    dayCell: {
      more: 'more',
    },

    weekView: {
      title: 'Week View',
    },

    agendaView: {
      title: 'Agenda View',
      noEvents: 'No events found',
    },

    dayEventsModal: {
      events: 'events',
      close: 'Close',
      previous: 'Previous',
      next: 'Next',
      page: 'Page',
      of: 'of',
    },

    eventModal: {
      title: 'Event Details',
      postTitle: 'Post Title',
      content: 'Content',
      scheduledFor: 'Scheduled For',
      publishedAt: 'Published At',
      viewFullPost: 'View Full Post',
      close: 'Close',
    },
  },

  // Status labels
  status: {
    draft: 'Draft',
    scheduled: 'Scheduled',
    published: 'Published',
    failed: 'Failed',
    approved: 'Approved',
  },

  // Platform labels (keeping English names as per requirements)
  platforms: {
    // Platform names remain in English
  },

  // Post Editor (Create/Edit Form)
  postEditor: {
    // Labels
    titleLabel: 'Title *',
    contentLabel: 'Content *',
    targetPlatformsLabel: 'Target Platforms',
    statusLabel: 'Status',
    scheduledTimeLabel: 'Scheduled Time',

    // Placeholders
    titlePlaceholder: 'Enter post title',
    contentPlaceholder: 'Enter your base content here. You can generate platform-specific variants later.',

    // Helper text
    characterCount: 'Character count:',

    // Buttons
    cancel: 'Cancel',
    saving: 'Saving...',
    create: 'Create Post',
    update: 'Update Post',

    // Page headers
    newTitle: 'Create New Post',
    newSubtitle: 'Create your base content. You can generate platform-specific variants after saving.',
    editTitle: 'Edit Post',
    editSubtitle: 'Update your post content and settings',
  },

  // PostForm Component
  postForm: {
    error: {
      failedToSave: 'Failed to save post',
    },

    preview: {
      userName: 'User Name',
      username: 'username',
      justNow: 'Just now',
      world: '🌎',
      seeMore: 'See more',
      more: 'more',
      like: 'Like',
      comment: 'Comment',
      share: 'Share',
      reply: 'Reply',
      repost: 'Repost',
      view: 'View',
      professionalTitle: 'Professional Title',
      seeMoreLinkedIn: '...see more',
      targetPlatforms: 'Target Platforms:',
      status: 'Status:',
      scheduled: 'Scheduled:',
      characters: 'Characters:',
    },

    toolbar: {
      newPost: 'New Post',
      editPost: 'Edit Post',
      charactersCount: 'characters',
      autoSaved: 'Auto-saved',
      hidePreview: 'Hide Preview',
      showPreview: 'Show Preview',
      cancel: 'Cancel',
      saved: '✓ Saved',
      saving: 'Saving...',
      createPost: 'Create Post',
      saveChanges: 'Save Changes',
    },

    sections: {
      content: 'Content',
      media: 'Media',
      addMedia: 'Add media',
      cover: 'Cover',
      multiImageHelp: 'Select multiple images. First image will be used as cover.',
      targetPlatforms: 'Target Platforms',
      targetPlatformsDescription: 'Select which platforms this post is intended for',
      publishingSettings: 'Publishing Settings',
      publishingSettingsDescription: 'Configure status and schedule',
      livePreview: 'Live Preview',
      realTime: 'Real-time',
    },

    empty: {
      tip: '💡 Tip: Use the "Generate Variants" button above to create platform-optimized content',
    },
  },

  // Post Detail Page
  postDetail: {
    backToPosts: '← Back to Posts',
    createdAt: 'Created:',
    scheduledFor: '📅 Scheduled:',
    content: 'Content',
    characterCount: 'Character count:',
    targetPlatforms: 'Target Platforms',
    editPost: 'Edit Post',
    generatedVariants: 'Generated Variants',

    error: {
      notFound: 'Post not found',
      notFoundDescription: "The post you're looking for doesn't exist or has been deleted.",
    },

    variantCount: 'variant generated',
    variantCountPlural: 'variants generated',

    stats: {
      title: 'Variant Statistics',
      totalVariants: 'Total Variants',
      draft: 'Draft',
      approved: 'Approved',
      scheduled: 'Scheduled',
      published: 'Published',
      completionRate: 'Completion Rate',
      variantsPublished: 'of {total} variants published',
    },

    actions: {
      backToPosts: '← Back to Posts',
      editPost: '✏️ Edit Post',
    },
  },

  // Variants (VariantList Component)
  variants: {
    item: {
      copy: 'Copy',
      copied: '✓ Copied',
      markApproved: 'Mark as Approved',
      schedulePublish: 'Schedule Publish',
      markPublished: 'Mark as Published',
      updating: 'Updating...',
      publishing: 'Publishing...',
      scheduling: 'Scheduling...',
      chars: 'chars',
      deleting: 'Deleting...',
      delete: '🗑️ Delete',
      updated: '✓ Updated!',
    },

    bulk: {
      selectAll: 'Select All',
      deselectAll: 'Deselect All',
      selected: 'selected',
      approveSelected: 'Approve Selected',
      scheduleSelected: 'Schedule Selected',
      publishSelected: 'Publish Selected',
      clear: 'Clear',
      noSelection: 'No variants selected',
      deleteSelected: '🗑️ Delete Selected',
      confirmDelete: 'Are you sure you want to delete {count} variant(s)? This action cannot be undone.',
      deleteSuccess: 'Successfully deleted {count} variant(s)',
      deleteFailed: 'Failed to delete variants',
    },

    scheduleModal: {
      title: 'Schedule Publish',
      singleDescription: 'Select when you want this variant to be automatically published.',
      bulkDescription: 'Select when you want these variants to be automatically published.',
      bulkTitle: 'Schedule {count} Variant(s)',
      dateTimeLabel: 'Date & Time',
      schedule: 'Schedule',
      scheduleAll: 'Schedule All',
      cancel: 'Cancel',
    },

    empty: {
      title: 'No variants generated yet',
      description: 'Click "Generate Variants" to create platform-specific versions',
    },

    status: {
      scheduledLabel: '📅 Scheduled:',
      publishedLabel: '✓ Published:',
      createdLabel: 'Created:',
      viewOnPlatform: 'View on platform →',
      charLimitWarning: '⚠️ Content exceeds platform character limit',
    },

    alerts: {
      selectAtLeastOne: 'Please select at least one variant',
      selectDateTime: 'Please select a date and time',
      confirmApprove: 'Approve {count} selected variant(s)?',
      confirmPublish: 'Publish {count} selected variant(s) immediately?',
      confirmDeleteSingle: 'Are you sure you want to delete this variant? This action cannot be undone.',
      approveSuccess: '✅ Successfully approved {count} variant(s)',
      publishSuccess: '✅ Successfully published {count} variant(s)',
      scheduleSuccess: '✅ Successfully scheduled {count} variant(s)',
      updateStatusFailed: 'Failed to update status',
      scheduleFailed: 'Failed to schedule variant',
      bulkActionFailed: 'Failed to perform bulk action',
      deleteFailed: 'Failed to delete variant',
    },
  },

  // Generate Variants Dialog
  generateVariants: {
    button: '✨ Generate Variants',
    generating: '⚙️ Generating Variants...',
    title: 'Generate Platform Variants',
    subtitle: 'Select platforms and language for AI-powered content adaptation',

    language: {
      label: 'Language',
      vi: 'Vietnamese',
      en: 'English',
      both: 'Both (Bilingual)',
      bothDescription: 'Vietnamese + English with separator',
    },

    platforms: {
      label: 'Target Platforms',
      selected: 'selected',
      selectAll: 'Select All',
      clear: 'Clear',
      noSelectionHint: 'No platforms selected - will generate for all platforms',
    },

    cancel: 'Cancel',
    submit: '✨ Generate Variants',
    success: '✅ Successfully generated {count} variants!',
    error: 'Failed to generate variants',
  },

  // Delete Post Dialog
  deletePost: {
    button: 'Delete Post',
    confirmButton: 'Confirm Delete',
    deleting: 'Deleting...',
    cancel: 'Cancel',
    error: 'Failed to delete post',
  },

  // Studio (AI Content Creation)
  studio: {
    // Hero section
    hero: {
      title: 'AI Content Studio',
      subtitle: 'Strategic content creation powered by AI.',
      subtitleCta: 'Choose a scenario below to begin.',
    },

    // Scenario selection
    scenarios: {
      title: 'Choose Your Scenario',
    },

    // Chat workspace
    workspace: {
      title: 'AI Writing Workspace',
      subtitle: 'Generate, refine, and approve your content',
      selectTone: 'Select Tone',
      templatesButton: 'Templates',
      you: 'You',
      aiDraft: 'AI Draft v',
      approved: 'Approved',
      aiThinking: 'AI is thinking...',
      clearInput: 'Clear',
      clearConversation: 'Clear conversation',
      sendButton: 'Send',
      keyboardHint: '⏎ to send, ⇧⏎ for new line',
      emptyState: 'Start by selecting a tone and use case, then describe what you\'d like to create',
      tooltipApprove: 'Approve',
      tooltipCopy: 'Copy',
      tooltipSaveToLibrary: 'Save to Library',
      savedToLibrary: 'Saved to library',
      saveFailed: 'Failed to save',
    },

    // Library
    library: {
      title: 'AI Library',
      loading: 'Loading...',
      empty: 'No saved posts',
      loaded: 'Loaded from library',
    },

    // Content Machine Engine Templates
    engineTemplates: {
      title: 'Template Engine',
      clearTemplate: 'Clear script',
      useDefault: 'Use Default',
      defaultEngine: 'Default Engine',
      helperText: 'Scripts enforce the 5-step Content Machine pipeline with specific formatting rules.',
    },

    // Script Library Modal
    scriptLibrary: {
      title: 'Script Library',
    },

    // Template Metadata (Localized Names & Descriptions)
    templateMeta: {
      social_caption: {
        name: 'Social Media Caption',
        description: 'Create engaging captions for Instagram, Facebook, and TikTok with hooks, storytelling, and CTAs',
      },
      idea_list_advanced: {
        name: 'Content Ideas (Advanced)',
        description: 'Generate high-quality content ideas with insight, angle clarity, emotional hook, and audience-fit reasoning',
      },
      strategic_content_ideas: {
        name: 'Strategic Content Ideas',
        description: 'Generate strategic content ideas including content pillars, series concepts, and narrative territories for long-term planning',
      },
      storytelling: {
        name: 'Storytelling Content',
        description: 'Create compelling narrative-driven content with clear story arc, emotional resonance, and meaningful takeaway',
      },
      ad_copy: {
        name: 'Ad Copy (Conversion-Focused)',
        description: 'Create high-converting ad copy with clear value proposition, urgency, and strong CTA',
      },
      categories: {
        ideation: 'Strategic Ideas',
        content_creation: 'Content Creation',
        analytical: 'Analysis',
        optimization: 'Content Optimization',
      },
      categoryDescriptions: {
        ideation: 'Explore topics and develop long-term content strategies',
        content_creation: 'Write captions, stories, and ads with optimized formats for each platform',
        analytical: 'Evaluate and analyze existing content to improve effectiveness',
        optimization: 'Improve SEO, reach, and engagement of your content',
      },
      complexity: {
        beginner: 'Beginner',
        intermediate: 'Intermediate',
        advanced: 'Advanced',
      },
      actions: {
        viewAll: 'View all',
        useScript: 'Use this script',
        viewDetails: 'View details',
        useDefault: 'Default',
        clearDefault: 'Clear',
        scriptLabel: 'Script:',
      },
      modes: {
        abstract: 'Abstract - No assumptions about format, platform, or specific structure',
        structured: 'Structured - Uses format and platform specified by the user',
        generic: 'Generic - Describes progression without being tied to a specific platform',
      },
      labels: {
        defaultMode: 'Default:',
        supportedPlatforms: 'Supported Platforms',
        executionModes: 'Execution Modes',
        engineInfo: 'Ultra Precision Engine v2.3.1 · 3 modes A/B/C (Abstract · Structured · Generic)',
        viewAllScripts: 'View all scripts →',
      },
    },

    // Prompt Templates (User-facing prompt content)
    prompts: {
      socialPostGenerator: {
        userTemplate: `Create {{numberOfPosts}} engaging social media posts for {{platform}} about: {{topic}}

Context (use what's provided, infer intelligently for what's missing):
- Target Audience: {{audience}}
- Post Goals: {{goals}}
- Key Messages: {{messages}}
- Hashtags: {{hashtags}}

Generate creative, scroll-stopping content with:
1. **{{numberOfPosts}} Post Variations** - Each unique and platform-optimized
2. **Hook Lines** - Attention-grabbing opening sentences
3. **Visual Suggestions** - Image/video ideas for each post
4. **Engagement Tactics** - Questions, polls, or CTAs
5. **Best Posting Times** - When to schedule for maximum reach

Important: If any context above is missing or minimal, intelligently infer reasonable defaults based on the topic and platform. Proceed confidently without requesting additional information.

{{toneHints}}`,
      },
    },

    // Approved panel
    approvedPanel: {
      title: 'Approved Version',
      emptyMessage: 'No approved content yet. Click the checkmark on any AI response to set it as final.',
      useInEditor: 'Use in Post Editor',
      copy: 'Copy',
      clear: 'Clear',
      approvedAt: 'Approved at',
    },

    // Tone names
    tones: {
      conversational: {
        name: 'Conversational',
        description: 'Friendly, approachable, like talking to a friend',
      },
      professional: {
        name: 'Professional',
        description: 'Polished, credible, business-appropriate',
      },
      storytelling: {
        name: 'Storytelling',
        description: 'Narrative-driven, emotionally engaging',
      },
      academic: {
        name: 'Academic',
        description: 'Research-based, analytical, educational',
      },
      playful: {
        name: 'Playful',
        description: 'Fun, lighthearted, entertaining',
      },
      inspirational: {
        name: 'Inspirational',
        description: 'Motivating, uplifting, aspirational',
      },
      journalistic: {
        name: 'Journalistic',
        description: 'Objective, factual, news-worthy',
      },
      minimal: {
        name: 'Minimal & Clean',
        description: 'Concise, direct, no-frills communication',
      },
    },

    // Use cases
    useCases: {
      content_ideas: {
        title: 'Content Ideas',
        description: 'Generate a list of content ideas for your brand or topic.',
      },
      brand_tone_rewrite: {
        title: 'Brand Tone Rewrite',
        description: 'Paste text and AI will rewrite it to match your selected brand tone.',
      },
      social_caption_optimize: {
        title: 'Social Caption Optimizer',
        description: 'Optimize captions for Facebook / Instagram / TikTok with hooks & CTAs.',
      },
      hashtag_strategy: {
        title: 'Hashtag Strategy',
        description: 'Get hashtag suggestions tailored for each social media platform.',
      },
    },

    // Workflow steps
    workflow: {
      brief: {
        label: 'Brief',
        description: 'User provides input, target audience, context, insights',
        placeholder: 'Describe the product / content / goal you want to create…',
      },
      suggest: {
        label: 'Suggest',
        description: 'AI proposes angles, outlines, directions',
        placeholder: 'Ask AI to suggest outlines / angles / approaches…',
      },
      create: {
        label: 'Create',
        description: 'AI generates full content draft using tone + use case',
        placeholder: 'Ask AI to create complete content based on the brief…',
      },
      optimize: {
        label: 'Optimize',
        description: 'AI optimizes content for platform, length, CTA, formatting',
        placeholder: 'E.g.: Optimize this for TikTok / Facebook with the right length…',
      },
      approve: {
        label: 'Approve',
        description: 'Final review, clean formatting, allow export/copy',
        placeholder: 'Ask AI to finalize the last version…',
      },
    },

    // Onboarding & In-Product Hints
    onboarding: {
      // Template Engine (Quick Picker / Script Selection)
      templateEngine: {
        tooltip: 'Scripts provide specialized AI behavior with pre-built formatting rules',
        firstUseHint: 'Select a script to unlock advanced content structures',
        emptyStateTitle: 'No script selected',
        emptyStateMessage: 'Using default AI engine. Choose a script above for specialized formats.',
        viewAllTooltip: 'Browse all available scripts organized by category',
      },

      // Workspace (Main Chat Area)
      workspace: {
        firstPromptPlaceholder: 'Describe what you want to create, or ask AI to suggest ideas...',
        emptyConversationTitle: 'Start creating with AI',
        emptyConversationMessage: 'Choose a tone and script above, then describe your content goal',
        toneSelectionHint: 'Select a tone to set the writing style for all AI responses',
        scriptBadgeTooltip: 'Currently using this script. Click to view details or change.',
      },

      // Prompt Kit Panel (Tactical Helper - Right Side)
      promptKit: {
        panelTitle: '🧩 Prompt Kit',
        panelDescription: 'Quick tactical prompts for common content edits',
        emptyState: 'No prompt kits available',
        categoryHint: 'Organized by task type for quick access',
        usageHint: 'Click any prompt to apply it instantly to your conversation',
      },

      // Approved Panel
      approvedPanel: {
        firstUseHint: 'Click ✓ on any AI response to approve it as your final version',
        actionHintCopy: 'Copy approved content to clipboard',
        actionHintUseInEditor: 'Send this content directly to the Post Editor',
        actionHintClear: 'Clear approved content and start fresh',
      },

      // Tone Selector
      toneSelector: {
        tooltip: 'Set the writing style for all AI-generated content',
        firstUseHint: 'Choose a tone that matches your brand voice',
      },

      // General First-Use
      firstSession: {
        welcomeTitle: 'Welcome to AI Studio',
        welcomeMessage: '1. Choose a tone · 2. Select a script (optional) · 3. Describe your content goal',
        keyboardShortcutHint: 'Press ⏎ to send, ⇧⏎ for new line',
      },
    },

    // Error States & Recovery Guidance
    errorStates: {
      // API & Network Errors
      api: {
        timeout: {
          title: 'Request timed out',
          message: 'The AI took too long to respond. This usually happens with complex requests.',
          action: 'Try simplifying your prompt or try again',
        },
        networkError: {
          title: 'Connection issue',
          message: 'Unable to reach the AI service. Check your internet connection.',
          action: 'Retry when connection is restored',
        },
        serverError: {
          title: 'Service temporarily unavailable',
          message: 'The AI service encountered an error. Your content is safe.',
          action: 'Wait a moment and try again',
        },
        rateLimitExceeded: {
          title: 'Too many requests',
          message: "You've reached the request limit. Take a short break.",
          action: 'Try again in a few minutes',
        },
      },

      // Content & Template Errors
      content: {
        noResults: {
          title: 'No content generated',
          message: "AI couldn't generate content for this request. Try rephrasing.",
          action: 'Adjust your prompt and try again',
        },
        templateLoadFailed: {
          title: 'Script unavailable',
          message: "This script couldn't be loaded. You can still use the default engine.",
          action: 'Select a different script or continue with default',
        },
        templateNotFound: {
          title: 'Script not found',
          message: 'This script no longer exists or has been moved.',
          action: 'Browse available scripts',
        },
        approvalFailed: {
          title: "Couldn't approve content",
          message: 'There was an issue saving your approved version.',
          action: 'Try copying the content manually',
        },
      },

      // Input Validation Errors
      input: {
        tooLong: {
          message: 'Prompt is too long ({current} characters). Maximum is {max} characters.',
          action: 'Shorten your prompt and try again',
        },
        emptyPrompt: {
          message: 'Please enter a prompt to send to AI',
        },
        invalidFormat: {
          message: "This input format isn't supported",
          action: 'Check your input and try again',
        },
      },

      // Library & Storage Errors
      library: {
        saveFailed: {
          title: "Couldn't save to library",
          message: 'There was an issue saving this content.',
          action: 'Copy content manually as backup',
        },
        loadFailed: {
          title: "Couldn't load library",
          message: 'Unable to access saved content right now.',
          action: 'Try refreshing the page',
        },
        deleteFailed: {
          title: "Couldn't delete item",
          message: 'There was an issue removing this from your library.',
          action: 'Refresh and try again',
        },
      },

      // General Fallback
      general: {
        unknownError: {
          title: 'Something went wrong',
          message: 'An unexpected error occurred. Your work is safe.',
          action: 'Refresh the page if the issue persists',
        },
      },
    },

    // Template Browser
    templates: {
      title: 'Prompt Templates',
      subtitle: 'Choose a template to get started with structured prompts',
      searchPlaceholder: 'Search templates...',
      empty: {
        title: 'No templates found',
        description: 'Try adjusting your search or selecting a different category',
      },
      complexity: {
        basic: 'Basic',
        advanced: 'Advanced',
      },
      language: {
        both: 'VI + EN',
        vi: 'VI',
        en: 'EN',
      },
      actions: {
        use: 'Use Template',
        close: 'Close',
      },

      // Template Categories
      categories: {
        seo: {
          name: 'SEO & Keywords',
          description: 'Search engine optimization and keyword research templates',
        },
        'content-strategy': {
          name: 'Content Strategy',
          description: 'Strategic planning and content architecture',
        },
        'content-creation': {
          name: 'Content Creation',
          description: 'Article writing and social media content generation',
        },
        tour: {
          name: 'Tour & Travel',
          description: 'Tour planning, itineraries, and travel content',
        },
      },

      // Individual Templates
      items: {
        'seo-competitor-analysis': {
          name: 'Competitor SEO Analysis',
          description: 'Analyze competitor content strategies and identify gaps in your SEO approach',
        },
        'seo-keyword-opportunities': {
          name: 'Find Keyword Opportunities',
          description: 'Discover untapped keyword opportunities based on your niche and audience',
        },
        'seo-strategic-content-ideas': {
          name: 'Strategic Content Ideas (Keyword-Focused)',
          description: 'Generate SEO-optimized content ideas aligned with keyword research',
        },
        'seo-content-refresh': {
          name: 'Content Refresh & Optimization',
          description: 'Analyze existing content and suggest improvements for better rankings',
        },
        'content-pillar-cluster': {
          name: 'Pillar-Cluster Strategy',
          description: 'Design a topic cluster strategy with pillar content and supporting articles',
        },
        'content-30day-plan': {
          name: '30-Day Content Plan',
          description: 'Create a comprehensive 30-day content calendar with daily posting strategy',
        },
        'content-repurposing-strategy': {
          name: 'Content Repurposing Strategy',
          description: 'Transform existing content into multiple formats for different platforms',
        },
        'content-article-writer': {
          name: 'Custom Article Writer',
          description: 'Generate a full blog article or long-form content piece',
        },
        'content-social-post-generator': {
          name: 'Social Media Post Generator',
          description: 'Create platform-optimized social media posts with hooks and CTAs',
        },
        'tour-itinerary-designer': {
          name: 'Tour Itinerary Designer',
          description: 'Create detailed tour itineraries with stops, timing, and experiences',
        },
        'tour-marketing-content': {
          name: 'Tour Marketing Content Pack',
          description: 'Generate promotional content for tour packages (descriptions, ads, social posts)',
        },
      },
    },
  },
};
