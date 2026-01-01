// ============================================
// Prompt Template Library
// ============================================

import type { TemplateCategory, PromptTemplate } from '@/types/studio';

// ============================================
// Template Categories
// ============================================

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  {
    id: 'seo',
    name: 'SEO & Keywords',
    description: 'Search engine optimization and keyword research templates',
    icon: '🔍',
  },
  {
    id: 'content-strategy',
    name: 'Content Strategy',
    description: 'Strategic planning and content architecture',
    icon: '📊',
  },
  {
    id: 'content-creation',
    name: 'Content Creation',
    description: 'Article writing and social media content generation',
    icon: '✍️',
  },
  {
    id: 'tour',
    name: 'Tour & Travel',
    description: 'Tour planning, itineraries, and travel content',
    icon: '🗺️',
  },
];

// ============================================
// Prompt Templates
// ============================================

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  // ============================================
  // SEO Templates
  // ============================================
  {
    id: 'seo-competitor-analysis',
    name: 'Competitor SEO Analysis',
    description: 'Analyze competitor content strategies and identify gaps in your SEO approach',
    categoryId: 'seo',
    tags: ['competitor analysis', 'seo audit', 'gap analysis'],
    complexity: 'advanced',
    language: 'both',
    systemMessage: `You are an expert SEO strategist and competitive analyst. Your role is to:
1. Analyze competitor content strategies and ranking patterns
2. Identify content gaps and opportunities
3. Recommend actionable SEO improvements
4. Focus on keyword opportunities, content angles, and ranking potential

Provide structured, data-driven insights that prioritize quick wins and high-impact opportunities.`,
    promptKey: 'studio.prompts.seoCompetitorAnalysis.userTemplate',
    userTemplate: `Analyze the SEO strategy of my competitors in the {{niche}} niche.

**My Target Keywords:**
{{keywords}}

**Competitor Websites:**
{{competitorUrls}}

**My Current Content Topics:**
{{currentTopics}}

Please provide:
1. **Competitor Content Analysis**: What topics are they ranking for that I'm missing?
2. **Keyword Gaps**: High-potential keywords they rank for but I don't
3. **Content Quality Assessment**: How does their content depth compare to mine?
4. **Actionable Recommendations**: 5-7 specific content pieces I should create to compete

{{toneHints}}`,
  },
  {
    id: 'seo-keyword-opportunities',
    name: 'Find Keyword Opportunities',
    description: 'Discover untapped keyword opportunities based on your niche and audience',
    categoryId: 'seo',
    tags: ['keywords', 'research', 'opportunities'],
    complexity: 'basic',
    language: 'both',
    systemMessage: `You are a keyword research specialist. Your goal is to:
1. Identify high-potential, low-competition keywords
2. Suggest long-tail keyword variations
3. Organize keywords by search intent (informational, commercial, transactional)
4. Recommend content angles for each keyword cluster

Focus on practical, achievable keyword targets that balance search volume with ranking difficulty.`,
    promptKey: 'studio.prompts.seoKeywordOpportunities.userTemplate',
    userTemplate: `Find keyword opportunities for my content in the {{niche}} niche.

**Target Audience:**
{{audience}}

**Main Topics I Cover:**
{{topics}}

**Current Keywords I Target:**
{{existingKeywords}}

Please suggest:
1. **Primary Keywords** (3-5 high-potential targets)
2. **Long-Tail Variations** (10-15 specific phrases)
3. **Question-Based Keywords** (5-7 "how to", "what is", etc.)
4. **Content Ideas** for each keyword cluster

{{toneHints}}`,
  },
  {
    id: 'seo-strategic-content-ideas',
    name: 'Strategic Content Ideas (Keyword-Focused)',
    description: 'Generate SEO-optimized content ideas aligned with keyword research',
    categoryId: 'seo',
    useCaseId: 'strategic-content',
    tags: ['content planning', 'seo', 'keywords'],
    complexity: 'advanced',
    language: 'both',
    systemMessage: `You are a strategic content planner specializing in SEO. Your mission is to:
1. Create content ideas that balance user value with SEO potential
2. Map content to the buyer's journey (awareness, consideration, decision)
3. Suggest internal linking opportunities
4. Recommend content formats (blog, guide, video, infographic)

Prioritize content that serves both search engines and real user needs.`,
    promptKey: 'studio.prompts.seoStrategicContentIdeas.userTemplate',
    userTemplate: `Create a strategic content plan for {{duration}} focused on SEO growth.

**Niche/Industry:**
{{niche}}

**Target Keywords:**
{{keywords}}

**Audience Pain Points:**
{{painPoints}}

**Business Goals:**
{{goals}}

Please provide:
1. **Pillar Content** (2-3 comprehensive cornerstone pieces)
2. **Cluster Content** (8-10 supporting articles linked to pillars)
3. **Quick Wins** (5 low-competition, high-value topics)
4. **Content Calendar** with publishing schedule and internal linking strategy

{{toneHints}}`,
  },
  {
    id: 'seo-content-refresh',
    name: 'Content Refresh & Optimization',
    description: 'Analyze existing content and suggest improvements for better rankings',
    categoryId: 'seo',
    tags: ['optimization', 'content update', 'rankings'],
    complexity: 'basic',
    language: 'both',
    systemMessage: `You are a content optimization specialist. Your focus is to:
1. Identify content that needs updating or expansion
2. Suggest keyword additions and on-page SEO improvements
3. Recommend structural changes (headings, internal links, multimedia)
4. Prioritize updates based on ranking potential

Provide clear, actionable steps to improve existing content performance.`,
    promptKey: 'studio.prompts.seoContentRefresh.userTemplate',
    userTemplate: `I need to refresh and optimize my existing content on: {{topic}}

**Current URL:**
{{url}}

**Current Rankings/Performance:**
{{currentPerformance}}

**Target Keywords:**
{{targetKeywords}}

**Competitor Content I'm Competing Against:**
{{competitorUrls}}

Please analyze and suggest:
1. **Content Gaps**: What am I missing compared to top-ranking competitors?
2. **Keyword Additions**: New keywords to naturally incorporate
3. **Structural Improvements**: Headings, sections, formatting
4. **Multimedia Recommendations**: Images, videos, infographics to add
5. **Internal Linking**: Which of my other pages should I link to/from?

{{toneHints}}`,
  },

  // ============================================
  // Content Strategy Templates
  // ============================================
  {
    id: 'content-pillar-cluster',
    name: 'Pillar-Cluster Strategy',
    description: 'Design a topic cluster strategy with pillar content and supporting articles',
    categoryId: 'content-strategy',
    tags: ['pillar pages', 'topic clusters', 'seo architecture'],
    complexity: 'advanced',
    language: 'both',
    systemMessage: `You are a content architecture strategist. Your expertise includes:
1. Designing topic cluster models (pillar + cluster content)
2. Creating semantic relationships between content pieces
3. Optimizing internal linking for SEO authority
4. Balancing content depth with user experience

Build comprehensive, hierarchical content strategies that establish topical authority.`,
    promptKey: 'studio.prompts.contentPillarCluster.userTemplate',
    userTemplate: `Design a pillar-cluster content strategy for: {{mainTopic}}

**Target Audience:**
{{audience}}

**Business Objectives:**
{{objectives}}

**Existing Content Assets:**
{{existingContent}}

**Timeframe for Implementation:**
{{timeframe}}

Please create:
1. **Pillar Page Outline**: Comprehensive guide structure (H2s, H3s, key sections)
2. **Cluster Content Topics**: 10-15 supporting articles that link back to pillar
3. **Internal Linking Map**: How all pieces connect
4. **Content Depth Recommendations**: Word counts, multimedia, interactivity
5. **Publishing Schedule**: Optimal order and timing

{{toneHints}}`,
  },
  {
    id: 'content-30day-plan',
    name: '30-Day Content Plan',
    description: 'Create a comprehensive 30-day content calendar with daily posting strategy',
    categoryId: 'content-strategy',
    useCaseId: 'strategic-content',
    tags: ['content calendar', 'planning', 'strategy'],
    complexity: 'basic',
    language: 'both',
    systemMessage: `You are a content calendar strategist. Your mission is to:
1. Create balanced, diverse content mixes across platforms
2. Align content themes with business goals and audience needs
3. Plan for seasonal trends, events, and key dates
4. Optimize posting frequency and timing

Deliver practical, achievable content plans that maintain consistency without burnout.`,
    promptKey: 'studio.prompts.content30DayPlan.userTemplate',
    userTemplate: `Create a 30-day content plan for my {{platform}} presence.

**Target Audience:**
{{audience}}

**Content Goals:**
{{goals}}

**Key Themes/Topics:**
{{themes}}

**Posting Frequency:**
{{frequency}}

**Special Events/Dates This Month:**
{{events}}

Please provide:
1. **Weekly Content Themes** (4 weeks)
2. **Daily Content Ideas** with format (post, story, video, etc.)
3. **Content Mix**: Educational, entertaining, promotional, engagement-focused
4. **Hashtag Strategy**: Relevant hashtags for each theme
5. **Call-to-Action Recommendations**: How to drive engagement

{{toneHints}}`,
  },
  {
    id: 'content-repurposing-strategy',
    name: 'Content Repurposing Strategy',
    description: 'Transform existing content into multiple formats for different platforms',
    categoryId: 'content-strategy',
    tags: ['repurposing', 'multi-platform', 'efficiency'],
    complexity: 'basic',
    language: 'both',
    systemMessage: `You are a content repurposing expert. Your specialization is:
1. Identifying core content assets that can be repurposed
2. Adapting content for different platforms and formats
3. Maintaining brand voice while optimizing for each channel
4. Maximizing content ROI through strategic reuse

Help creators get more mileage from their best content across all channels.`,
    promptKey: 'studio.prompts.contentRepurposingStrategy.userTemplate',
    userTemplate: `I want to repurpose my content: {{originalContent}}

**Original Format:**
{{originalFormat}}

**Target Platforms:**
{{targetPlatforms}}

**Key Messages/Takeaways:**
{{keyMessages}}

Please suggest:
1. **Repurposing Ideas**: 5-7 ways to transform this content
2. **Platform-Specific Adaptations**: How to optimize for each channel
3. **Content Derivatives**: Quotes, snippets, visuals to extract
4. **Distribution Timeline**: When and where to publish each piece
5. **Engagement Hooks**: How to make each version compelling

{{toneHints}}`,
  },

  // ============================================
  // Content Creation Templates
  // ============================================
  {
    id: 'content-article-writer',
    name: 'Custom Article Writer',
    description: 'Generate a full blog article or long-form content piece',
    categoryId: 'content-creation',
    tags: ['blog', 'article', 'writing'],
    complexity: 'basic',
    language: 'both',
    systemMessage: `You are a professional content writer. Your expertise includes:
1. Writing engaging, well-structured long-form content
2. Balancing SEO optimization with readability
3. Incorporating storytelling and data-driven insights
4. Adapting tone and style to audience preferences

Create content that educates, engages, and converts readers.`,
    promptKey: 'studio.prompts.contentArticleWriter.userTemplate',
    userTemplate: `Write a {{wordCount}}-word article on: {{topic}}

**Target Audience:**
{{audience}}

**Key Points to Cover:**
{{keyPoints}}

**SEO Keywords to Include:**
{{keywords}}

**Desired Tone:**
{{tone}}

**Call-to-Action:**
{{cta}}

Please structure the article with:
1. **Compelling Headline** (with 2-3 variations)
2. **Introduction** (hook + overview)
3. **Body Sections** (with H2/H3 subheadings)
4. **Conclusion** (summary + CTA)
5. **Meta Description** (150-160 characters)

{{toneHints}}`,
  },
  {
    id: 'content-social-post-generator',
    name: 'Social Media Post Generator',
    description: 'Create platform-optimized social media posts with hooks and CTAs',
    categoryId: 'content-creation',
    tags: ['social media', 'posts', 'engagement'],
    complexity: 'basic',
    language: 'both',
    systemMessage: `You are a social media content specialist. Your strengths include:
1. Writing scroll-stopping hooks and engaging copy
2. Optimizing content for each platform's best practices
3. Incorporating trending formats and styles
4. Driving engagement through questions, polls, and CTAs

Create posts that stop the scroll and spark conversation.`,
    promptKey: 'studio.prompts.socialPostGenerator.userTemplate',
    userTemplate: `Create {{numberOfPosts}} social media posts for {{platform}} about: {{topic}}

**Target Audience:**
{{audience}}

**Post Goals:**
{{goals}}

**Key Messages:**
{{messages}}

**Hashtags to Include:**
{{hashtags}}

Please generate:
1. **Post Variations** ({{numberOfPosts}} unique posts)
2. **Hook Lines**: Attention-grabbing opening sentences
3. **Visual Suggestions**: Image/video ideas for each post
4. **Engagement Tactics**: Questions, polls, or CTAs
5. **Best Posting Times**: When to schedule for maximum reach

{{toneHints}}`,
  },

  // ============================================
  // Tour & Travel Templates
  // ============================================
  {
    id: 'tour-itinerary-designer',
    name: 'Tour Itinerary Designer',
    description: 'Create detailed tour itineraries with stops, timing, and experiences',
    categoryId: 'tour',
    useCaseId: 'tour-discovery',
    tags: ['itinerary', 'tour planning', 'travel'],
    complexity: 'advanced',
    language: 'both',
    systemMessage: `You are an expert tour designer and travel planner. Your skills include:
1. Creating balanced, engaging itineraries with varied experiences
2. Optimizing routes for logistics and time management
3. Incorporating cultural, historical, and experiential elements
4. Designing for different audience types (families, adventure seekers, luxury travelers)

Craft memorable tour experiences that exceed expectations.`,
    promptKey: 'studio.prompts.tourItineraryDesigner.userTemplate',
    userTemplate: `Design a tour itinerary for: {{destination}}

**Tour Duration:**
{{duration}}

**Target Audience:**
{{audience}}

**Tour Theme/Focus:**
{{theme}}

**Must-See Attractions:**
{{attractions}}

**Budget Level:**
{{budgetLevel}}

Please create:
1. **Day-by-Day Itinerary**: Detailed schedule with timing
2. **Key Stops & Experiences**: What, where, why for each location
3. **Logistics**: Transportation, meals, accommodation recommendations
4. **Storytelling Elements**: Historical context and engaging narratives
5. **Flexibility Options**: Alternative activities for different interests
6. **Practical Tips**: Best times to visit, what to bring, insider advice

{{toneHints}}`,
  },
  {
    id: 'tour-marketing-content',
    name: 'Tour Marketing Content Pack',
    description: 'Generate promotional content for tour packages (descriptions, ads, social posts)',
    categoryId: 'tour',
    tags: ['marketing', 'tour promotion', 'sales'],
    complexity: 'basic',
    language: 'both',
    systemMessage: `You are a travel marketing specialist. Your expertise includes:
1. Writing compelling tour descriptions that sell experiences
2. Creating urgency and FOMO in promotional copy
3. Highlighting unique selling points and differentiators
4. Adapting messaging for different marketing channels

Convert browsers into bookers with persuasive travel content.`,
    promptKey: 'studio.prompts.tourMarketingContent.userTemplate',
    userTemplate: `Create marketing content for my tour: {{tourName}}

**Destination:**
{{destination}}

**Tour Highlights:**
{{highlights}}

**Duration & Price:**
{{durationAndPrice}}

**Unique Selling Points:**
{{usp}}

**Target Audience:**
{{audience}}

Please generate:
1. **Tour Description** (300-400 words for website)
2. **Short Pitch** (50-75 words for ads)
3. **Social Media Posts** (3-5 variations for Instagram/Facebook)
4. **Email Subject Lines** (5 options)
5. **Key Messaging Points**: Why book this tour vs. competitors
6. **Call-to-Action Variations**: Compelling CTAs to drive bookings

{{toneHints}}`,
  },
];

// ============================================
// Helper Functions
// ============================================

/**
 * Get all templates for a specific category
 */
export function getTemplatesByCategory(categoryId: string): PromptTemplate[] {
  return PROMPT_TEMPLATES.filter((t) => t.categoryId === categoryId);
}

/**
 * Search templates by query (searches name, description, tags)
 */
export function searchTemplates(query: string): PromptTemplate[] {
  if (!query.trim()) {
    return PROMPT_TEMPLATES;
  }

  const lowerQuery = query.toLowerCase();

  return PROMPT_TEMPLATES.filter((template) => {
    const matchesName = template.name.toLowerCase().includes(lowerQuery);
    const matchesDescription = template.description
      .toLowerCase()
      .includes(lowerQuery);
    const matchesTags = template.tags?.some((tag) =>
      tag.toLowerCase().includes(lowerQuery)
    );

    return matchesName || matchesDescription || matchesTags;
  });
}

/**
 * Get a specific template by ID
 */
export function getTemplateById(id: string): PromptTemplate | undefined {
  return PROMPT_TEMPLATES.find((t) => t.id === id);
}

/**
 * Get templates filtered by category and search query
 */
export function getFilteredTemplates(
  categoryId: string,
  searchQuery: string
): PromptTemplate[] {
  let templates = PROMPT_TEMPLATES;

  // Apply category filter
  if (categoryId) {
    templates = templates.filter((t) => t.categoryId === categoryId);
  }

  // Apply search filter
  if (searchQuery.trim()) {
    const lowerQuery = searchQuery.toLowerCase();
    templates = templates.filter((template) => {
      const matchesName = template.name.toLowerCase().includes(lowerQuery);
      const matchesDescription = template.description
        .toLowerCase()
        .includes(lowerQuery);
      const matchesTags = template.tags?.some((tag) =>
        tag.toLowerCase().includes(lowerQuery)
      );

      return matchesName || matchesDescription || matchesTags;
    });
  }

  return templates;
}
