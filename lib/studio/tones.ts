// ============================================
// Tone Engine Definitions
// ============================================

export interface BrandTone {
  id: string;
  name: string;
  description: string;
  systemReinforcement: string;
  icon?: string;
  antiDriftRules?: string; // Additional reinforcement for edge cases
}

/**
 * Available brand voice tones for content generation
 * Each tone has specific reinforcement instructions to guide AI output
 */
export const BRAND_TONES: BrandTone[] = [
  {
    id: 'conversational',
    name: 'Thân mật',
    description: 'Gần gũi, trò chuyện tự nhiên, như nói chuyện với bạn',
    systemReinforcement: `TONE: Conversational & Friendly

Write as if texting a friend who asked for travel advice. Requirements:
- Use contractions and casual grammar naturally
- Include personal phrases like "I'm telling you," "Trust me on this," "Here's the thing"
- Ask rhetorical questions that expect mental responses
- Make relatable comparisons to everyday experiences
- Focus on "you/your" with occasional "I/we" perspective sharing
- Add occasional self-aware humor about being enthusiastic

STRICT PROHIBITIONS:
- NO emojis (those are reserved for Playful tone only)
- NO bullet-point lists (use conversational paragraphs)
- NO formal business language or jargon`,
    antiDriftRules: `ANTI-DRIFT: If user requests "casual but professional" or "friendly business tone" - stay CONVERSATIONAL. If they want business language, they should select Professional tone explicitly. Do not compromise conversational warmth for formality.`,
    icon: '💬',
  },
  {
    id: 'professional',
    name: 'Chuyên nghiệp',
    description: 'Trang trọng, chuẩn mực, rõ ràng và mạch lạc',
    systemReinforcement: `TONE: Professional & Polished

Write for business decision-makers and industry professionals. Requirements:
- Use industry-standard terminology (ROI, strategic positioning, value proposition, market analysis)
- Structure with clear headers, sections, or executive summary style
- Include data points, metrics, and quantifiable benefits when relevant
- Use third-person or formal first-person plural ("we," "our organization")
- Frame benefits as business outcomes and strategic advantages
- Include credibility indicators (research, partnerships, industry standards)

STRICT PROHIBITIONS:
- NO casual language, slang, or colloquialisms
- NO emojis or playful punctuation
- NO personal anecdotes or emotional appeals
- Maintain professional distance throughout`,
    icon: '💼',
  },
  {
    id: 'storytelling',
    name: 'Kể chuyện',
    description: 'Kể chuyện theo dòng cảm xúc, có nhịp điệu, giàu hình ảnh',
    systemReinforcement: `TONE: Storytelling & Narrative

Create narrative-driven content with characters and scenes. MANDATORY ELEMENTS (all required):
- MUST include at least one named character with age, occupation, or background detail
- MUST include at least 3 sensory details (what they saw, heard, felt, smelled, touched)
- MUST build narrative arc: setup → tension/challenge → resolution or transformation
- MUST set specific scene with time ("dawn," "3:47 AM") and place ("wooden homestay," "ridge edge")
- MUST include either dialogue ("He said...") or internal monologue (He wondered if...)
- MUST show emotional journey through character's changing feelings

CHARACTER TEST: Can the reader picture a specific person? If no, add more detail.
SCENE TEST: Could a film director use this to set up a shot? If no, add specifics.

STRICT PROHIBITIONS:
- NO bullet-point lists or data dumps
- NO generic advice without character experiencing it
- NO direct instructions ("you should do X")
- Story must drive the message, not just decorate it`,
    icon: '📖',
  },
  {
    id: 'academic',
    name: 'Học thuật',
    description: 'Dựa trên nghiên cứu, phân tích, mang tính học thuật',
    systemReinforcement: `TONE: Academic & Analytical (Consumer-Accessible)

Write educational content with academic rigor but accessible language. Requirements:
- Start with clear thesis statements and supporting evidence
- Use logical structure with cause-effect relationships
- Include technical terms with brief explanations in parentheses
- Reference research, studies, or expert perspectives (can be general: "studies show," "research indicates")
- Present objective analysis with multiple viewpoints when relevant
- Use formal but readable sentence structures

ACCESSIBILITY CHECK: Could this appear in National Geographic or Smithsonian Magazine?

STRICT PROHIBITIONS:
- NO marketing language or persuasive sales techniques
- NO first-person casual voice
- NO unsubstantiated claims without logical support`,
    icon: '🎓',
  },
  {
    id: 'playful',
    name: 'Vui tươi',
    description: 'Vui tươi, hài hước, linh hoạt',
    systemReinforcement: `TONE: Playful & Fun

Create entertaining, joyful content that makes readers smile. MANDATORY ELEMENTS (must include):
- At least 2-3 emojis integrated naturally (not just decorative)
- One unexpected comparison or pop culture reference
- Wordplay, puns, or creative expressions
- Enthusiastic punctuation (exclamation points, but don't overdo it!)
- Conversational asides in parentheses (like this!)
- Self-aware humor about being excited

Requirements:
- Make readers feel like they're having fun, not just reading information
- Use universal references people will recognize
- Be willing to be silly or playful with language

STRICT PROHIBITIONS:
- NO dry facts without entertainment value
- NO serious or overly formal tone
- Content must spark joy, not just inform`,
    icon: '🎉',
  },
  {
    id: 'inspirational',
    name: 'Truyền cảm hứng',
    description: 'Truyền động lực, cảm hứng tích cực',
    systemReinforcement: `TONE: Inspirational & Motivating

Write content that motivates immediate action and elevates mindset. MANDATORY ELEMENTS (must include ALL):
- MUST include at least one "you will" or "you can" statement per post idea
- MUST include explicit transformation language: "from [limitation] to [possibility]"
  * Examples: "from tourist to participant," "from doubt to courage," "from ordinary to extraordinary"
- MUST frame at least one challenge as an opportunity using empowering language
- MUST use at least 3 power verbs: discover, unlock, transform, rise, breakthrough, elevate, unleash, awaken, ignite
- MUST address reader's potential directly in second person ("you")
- MUST end with a question or challenge that prompts reflection

TRANSFORMATION TEST: Can the reader see a clear before/after journey? If no, add explicit transformation.
EMPOWERMENT TEST: Does this make the reader feel capable? If no, strengthen language.

Requirements:
- Balance aspiration with authenticity (avoid toxic positivity)
- Every sentence should motivate or empower
- Future-focused perspective throughout

STRICT PROHIBITIONS:
- NO passive voice or weak verbs (is, was, has been)
- NO past-focused or limitation-focused language
- NO cynicism or negative framing
- NO statements that don't inspire action`,
    icon: '⭐',
  },
  {
    id: 'journalistic',
    name: 'Báo chí',
    description: 'Khách quan, trung tính, mang phong cách báo chí',
    systemReinforcement: `TONE: Journalistic & Factual

Present objective information exactly as news reporting. STRICT REQUIREMENTS:
- Use inverted pyramid structure: most important information first
- MANDATORY: Attribute EVERY factual claim with source phrases:
  * "according to [source]"
  * "officials report"
  * "data shows"
  * "sources indicate"
  * "[entity] states"
  * "reports indicate"
  (Every fact needs attribution - no exceptions)
- Include specific numbers, dates, locations, and names when relevant
- Answer: Who, What, When, Where, Why, How
- Use third-person ONLY - absolutely no "you" or "we"
- Use neutral verbs: reports, indicates, shows, states (NOT: amazing, incredible, revolutionary)

ATTRIBUTION TEST: Can you identify the source of every claim? If no, add attribution.
PUBLICATION TEST: Could this run in Associated Press or Reuters without any edits? If no, revise.

STRICT PROHIBITIONS:
- ZERO editorial opinion or persuasive language
- NO unattributed claims or statistics
- NO marketing or promotional tone
- NO emotional appeals or subjective descriptions
- Maintain complete neutrality throughout`,
    icon: '📰',
  },
  {
    id: 'minimal',
    name: 'Tối giản & Sạch sẽ',
    description: 'Ngắn gọn, súc tích, tinh gọn và rõ ràng',
    systemReinforcement: `TONE: Minimal & Clean

Convey maximum information with minimum words. STRICT RULES:
- Bullet points and short phrases preferred over paragraphs
- Remove ALL adjectives - no exceptions unless absolutely essential for clarity
  * Remove: "beautiful," "amazing," "great," "stunning," "incredible"
  * Remove: "high," "low," "big," "small" unless they're measurements
  * Keep only: technical descriptors, measurements, quantities
- One idea per line or sentence maximum
- Use numbers and data over descriptions
- Active voice only, no passive constructions
- Zero repetition of concepts
- White space is a feature, not a bug

ADJECTIVE TEST: Count adjectives. If more than 1 per 20 words, remove more.
EDITING TEST: Can you remove any word without losing meaning? If yes, remove it.
WORD COUNT TEST: Could you say this in fewer words? If yes, do it.

Requirements:
- Prioritize clarity and speed of comprehension
- Still provide value - efficient, not cold
- Use structure (bullets, numbers, headers) for organization

STRICT PROHIBITIONS:
- NO flowery language or embellishment
- NO adjectives (beautiful, stunning, amazing, incredible, etc.)
- NO redundant phrases or repetition
- NO complex sentence structures`,
    icon: '✨',
  },
];

/**
 * Get a tone by its ID
 */
export function getToneById(id: string): BrandTone | undefined {
  return BRAND_TONES.find((tone) => tone.id === id);
}

/**
 * Get the default tone (conversational)
 */
export function getDefaultTone(): BrandTone {
  return BRAND_TONES[0];
}
