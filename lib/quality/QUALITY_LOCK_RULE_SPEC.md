# Quality Lock Rule Spec

> Single source of truth for all Quality Lock rules across 7 Golden Intents.

## Rule Specification Table

| Intent | Layer | Rule ID | Severity | What it enforces | Pass heuristic | testMode |
|--------|-------|---------|----------|------------------|----------------|----------|
| social_caption_v1 | STRUCTURE | social_structure_lock | HARD | Output must contain Hook, Body, CTA sections | `/\*\*Hook:\*\*/i` AND `/\*\*Body:\*\*/i` AND `/\*\*CTA:\*\*/i` | SAME |
| social_caption_v1 | STRUCTURE | social_max_sections | HARD | Output must not exceed 4 labeled sections | `sectionCount <= 4` | SAME |
| social_caption_v1 | RED_FLAG | social_no_meta_commentary | HARD | No AI self-reference or meta text | No match for: `/here is/i`, `/below is/i`, `/as an ai/i`, `/i('ve\|'ll\| will)/i`, `/dưới đây là/i`, `/tôi sẽ/i` | SAME |
| social_caption_v1 | RED_FLAG | social_cta_not_generic | HARD | CTA must be specific, not generic | CTA exists AND length >= 5 AND no match for `/tìm hiểu thêm/i`, `/xem thêm/i`, `/click here/i`, `/learn more/i` | SAME |
| social_caption_v1 | QUALITY | social_hook_length | SOFT | Hook should be concise for impact | `hookSentences <= 2` | SKIP |
| social_caption_v1 | QUALITY | social_body_formatting | SOFT | Body should have multiple paragraphs | `paragraphCount >= 2` (split on `/\n+/`, trim, filter empty) OR bodySection.length < 100 | SAME |
| social_caption_v1 | QUALITY | social_sentence_length | SOFT | Sentences should be mobile-friendly | No sentence exceeds 25 words | SKIP |
| social_caption_v1 | QUALITY | social_topic_keyword | SOFT | Topic keyword appears in content | `topicKeyword.toLowerCase()` found in Hook + Body text | SAME |
| social_caption_v1 | QUALITY | social_cta_action_verb | SOFT | CTA has clear action intent | `ctaSentences === 1 && actionIntentPatterns.some(p => p.test(cta))` | SAME |
| seo_blog_v1 | STRUCTURE | seo_title_present | HARD | Must have H1 title | Output contains `# ` or `<h1>` at start of line | SAME |
| seo_blog_v1 | STRUCTURE | seo_headings_hierarchy | HARD | Proper heading structure | H1 count === 1, H2s appear before any H3s | SAME |
| seo_blog_v1 | RED_FLAG | seo_no_meta_commentary | HARD | No AI self-reference | Same patterns as social_no_meta_commentary | SAME |
| seo_blog_v1 | QUALITY | seo_intro_present | SOFT | Has introduction before first H2 | Text length >= 50 chars between H1 and first H2 | SAME |
| seo_blog_v1 | QUALITY | seo_keyword_density | SOFT | Primary keyword appears appropriately | `2 <= keywordCount <= 5` | RELAX (1-8) |
| seo_blog_v1 | QUALITY | seo_meta_description | SOFT | Meta description optimal length | `120 <= metaLength <= 160` if meta section exists | SAME |
| seo_blog_v1 | QUALITY | seo_paragraph_length | SOFT | Paragraphs not too long | Each paragraph <= 150 words | SKIP |
| seo_blog_v1 | QUALITY | seo_has_conclusion | SOFT | Has conclusion section | H2 contains `/kết luận\|conclusion\|tổng kết/i` | SAME |
| video_script_v1 | STRUCTURE | video_hook_present | HARD | Must have Hook/Opening section | Contains `**Hook:**` or `**Opening:**` or `[HOOK]` | SAME |
| video_script_v1 | STRUCTURE | video_sections_present | HARD | Must have content sections | Contains >= 2 of: `**Main:**`, `**Body:**`, `[SCENE]` | SAME |
| video_script_v1 | RED_FLAG | video_no_meta_commentary | HARD | No AI self-reference | Same patterns as social_no_meta_commentary | SAME |
| video_script_v1 | QUALITY | video_hook_duration | SOFT | Hook should be brief | Hook section word count <= 30 | SKIP |
| video_script_v1 | QUALITY | video_has_cta | SOFT | Has call-to-action | Contains CTA section or action keywords in final section | SAME |
| video_script_v1 | QUALITY | video_conversational | SOFT | Uses conversational tone | Contains `?` or direct address (`bạn`, `you`) | SAME |
| video_script_v1 | QUALITY | video_timing_hints | SOFT | Has pacing markers | Contains `[0:00]`, `giây`, `seconds` | RELAX |
| email_marketing_v1 | STRUCTURE | email_subject_present | HARD | Must have Subject line | Contains `**Subject:**` or starts with `Subject:` | SAME |
| email_marketing_v1 | STRUCTURE | email_body_present | HARD | Must have email body | Body text length >= 100 chars after subject | SAME |
| email_marketing_v1 | RED_FLAG | email_no_meta_commentary | HARD | No AI self-reference | Same patterns as social_no_meta_commentary | SAME |
| email_marketing_v1 | RED_FLAG | email_no_spam_words | HARD | No spam triggers | No match for `/free!!!/i`, `/act now/i`, `/100% free/i` | SAME |
| email_marketing_v1 | QUALITY | email_subject_length | SOFT | Subject optimal length | `30 <= subjectLength <= 60` | RELAX (20-80) |
| email_marketing_v1 | QUALITY | email_has_cta | SOFT | Has clear CTA | Contains action button text or CTA section | SAME |
| email_marketing_v1 | QUALITY | email_personalization | SOFT | Uses personalization | Contains `{{name}}`, `{{firstName}}`, `[NAME]` | SKIP |
| email_marketing_v1 | QUALITY | email_preview_text | SOFT | Has preview/preheader | Contains `**Preview:**` or `**Preheader:**` | SAME |
| landing_page_v1 | STRUCTURE | landing_headline_present | HARD | Must have main headline | Contains `**Headline:**` or H1 tag | SAME |
| landing_page_v1 | STRUCTURE | landing_cta_present | HARD | Must have CTA section | Contains `**CTA:**` or `[Button:]` | SAME |
| landing_page_v1 | RED_FLAG | landing_no_meta_commentary | HARD | No AI self-reference | Same patterns as social_no_meta_commentary | SAME |
| landing_page_v1 | QUALITY | landing_headline_length | SOFT | Headline is punchy | Headline word count <= 15 | SAME |
| landing_page_v1 | QUALITY | landing_benefits_list | SOFT | Has benefits list | Contains bullet points with >= 3 items | SAME |
| landing_page_v1 | QUALITY | landing_social_proof | SOFT | Has social proof | Contains `/testimonial\|đánh giá\|review/i` | SKIP |
| landing_page_v1 | QUALITY | landing_urgency | SOFT | Has urgency element | Contains time-limited or scarcity language | SKIP |
| landing_page_v1 | QUALITY | landing_subheadline | SOFT | Has subheadline | Contains `**Subheadline:**` or text after headline | SAME |
| product_description_v1 | STRUCTURE | product_name_present | HARD | Must have product name | Contains `**Product:**` or `**Name:**` | SAME |
| product_description_v1 | STRUCTURE | product_desc_present | HARD | Must have description | Body text length >= 100 chars | SAME |
| product_description_v1 | RED_FLAG | product_no_meta_commentary | HARD | No AI self-reference | Same patterns as social_no_meta_commentary | SAME |
| product_description_v1 | QUALITY | product_features_list | SOFT | Has features list | Contains bullet points with >= 3 items | SAME |
| product_description_v1 | QUALITY | product_benefits | SOFT | Mentions benefits | Contains `/giúp\|helps\|benefit\|lợi ích/i` | SAME |
| product_description_v1 | QUALITY | product_specs_format | SOFT | Specs well-formatted | Specs in bullets or table format | SKIP |
| product_description_v1 | QUALITY | product_cta | SOFT | Has purchase CTA | Contains `/mua ngay\|order\|đặt hàng\|add to cart/i` | SAME |
| reel_caption_v1 | STRUCTURE | reel_hook_present | HARD | Must have attention hook | First line < 10 words or contains hook marker | SAME |
| reel_caption_v1 | STRUCTURE | reel_length_limit | HARD | Caption not too long | Total length <= 300 chars | SAME |
| reel_caption_v1 | RED_FLAG | reel_no_meta_commentary | HARD | No AI self-reference | Same patterns as social_no_meta_commentary | SAME |
| reel_caption_v1 | QUALITY | reel_has_hashtags | SOFT | Has relevant hashtags | Contains 3-10 hashtags (`#\w+`) | RELAX (1-15) |
| reel_caption_v1 | QUALITY | reel_emoji_usage | SOFT | Uses emojis appropriately | Contains 1-5 emojis | SKIP |
| reel_caption_v1 | QUALITY | reel_cta_present | SOFT | Has engagement CTA | Contains action intent patterns | SAME |
| reel_caption_v1 | QUALITY | reel_line_breaks | SOFT | Has visual breaks | Contains `\n` for mobile readability | SAME |

---

## Legend

| testMode Value | Meaning |
|----------------|---------|
| **SAME** | Rule behaves identically in testMode and production |
| **SKIP** | Rule is not evaluated when testMode is enabled |
| **RELAX** | Rule uses relaxed thresholds in testMode (relaxed values shown in parentheses) |

---

## Implementation Status

| Status | Intents |
|--------|---------|
| **FULLY IMPLEMENTED** | `social_caption_v1` |
| **SPEC ONLY** | `seo_blog_v1`, `video_script_v1`, `email_marketing_v1`, `landing_page_v1`, `product_description_v1`, `reel_caption_v1` |

> **Note:** SPEC ONLY intents currently return `{ passed: true, hardFails: [], softFails: [], allResults: [] }` in the switch statement stub. Rules defined above serve as the implementation spec for future development.

---

## Changelog

- **2024-12-16**: Fixed `social_body_formatting` to use semantic paragraph counting (split on `\n+`, trim, filter empty, require >= 2)
- **2024-12-16**: Fixed `social_cta_action_verb` to use regex-based action intent patterns (broader Vietnamese/English coverage)
- **2024-12-16**: Changed CTA requirement from `ctaSentences <= 1` to `ctaSentences === 1` for stricter validation
