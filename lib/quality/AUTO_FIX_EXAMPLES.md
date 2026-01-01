# Auto Fix Prompt Examples

> Examples showing how Quality Lock results map to Auto Fix prompts

---

## Example 1: SOFT Fails (social_body_formatting + social_cta_action_verb)

### Input: Quality Lock Results JSON

```json
{
  "intent": "social_caption_v1",
  "output": "**Hook:** Bạn có biết rằng việc học tiếng Anh mỗi ngày chỉ mất 15 phút nhưng có thể thay đổi cả cuộc đời bạn?\n\n**Body:** Hàng triệu người Việt Nam đang bỏ lỡ cơ hội vàng chỉ vì rào cản ngôn ngữ. Tiếng Anh mở ra cánh cửa đến những công việc lương cao, những chuyến du lịch tự tin, và những mối quan hệ quốc tế. Với phương pháp học thông minh, bạn có thể làm chủ tiếng Anh nhanh hơn bạn nghĩ.\n\n**CTA:** Tìm hiểu thêm về khóa học ngay!",
  "softFails": [
    {
      "id": "social_body_formatting",
      "passed": false,
      "severity": "SOFT",
      "message": "Body should have at least 2 paragraphs for readability",
      "details": { "paragraphCount": 1 }
    },
    {
      "id": "social_cta_action_verb",
      "passed": false,
      "severity": "SOFT",
      "message": "CTA should be exactly 1 sentence with clear action intent",
      "details": { "ctaSentences": 1, "hasActionIntent": false }
    }
  ],
  "hardFails": [],
  "meta": {
    "language": "vi",
    "testMode": false
  }
}
```

### Output: Generated Auto Fix Prompt

```
INTENT: social_caption_v1
LANGUAGE: Vietnamese

EXPECTED OUTPUT STRUCTURE:
---
**Hook:** (1-2 sentences, attention-grabbing)

**Body:** (2+ paragraphs, main content with line breaks)

**CTA:** (exactly 1 sentence with action verb)
---

ORIGINAL CONTENT TO FIX:
---
**Hook:** Bạn có biết rằng việc học tiếng Anh mỗi ngày chỉ mất 15 phút nhưng có thể thay đổi cả cuộc đời bạn?

**Body:** Hàng triệu người Việt Nam đang bỏ lỡ cơ hội vàng chỉ vì rào cản ngôn ngữ. Tiếng Anh mở ra cánh cửa đến những công việc lương cao, những chuyến du lịch tự tin, và những mối quan hệ quốc tế. Với phương pháp học thông minh, bạn có thể làm chủ tiếng Anh nhanh hơn bạn nghĩ.

**CTA:** Tìm hiểu thêm về khóa học ngay!
---

ISSUES TO FIX (2):
[QUALITY] Split Body into at least 2 separate paragraphs using line breaks. Each paragraph should cover one key point.
[QUALITY] Rewrite CTA as exactly 1 sentence with clear action intent. Use verbs like: Bình luận, Chia sẻ, Lưu, Tag, Theo dõi, Đăng ký, Để lại, Hãy, Comment, Share, Save, Follow.

SAFE-EDIT POLICY (MUST FOLLOW):
- Preserve the original topic, message, and emotional tone
- Keep the same language (Vietnamese or English) as the original
- Do NOT add hashtags unless the rule specifically requires them
- Do NOT add extra sections beyond the required structure
- Do NOT add emojis unless the rule specifically requires them
- Fix ONLY the listed issues - leave everything else unchanged
- Do NOT add explanations, notes, or meta-commentary
- Do NOT wrap output in code fences or markdown blocks
- Output ONLY the corrected content, nothing else

Output MUST be in Vietnamese.

OUTPUT THE FIXED CONTENT ONLY:
```

### Expected Fixed Output

```
**Hook:** Bạn có biết rằng việc học tiếng Anh mỗi ngày chỉ mất 15 phút nhưng có thể thay đổi cả cuộc đời bạn?

**Body:** Hàng triệu người Việt Nam đang bỏ lỡ cơ hội vàng chỉ vì rào cản ngôn ngữ. Tiếng Anh mở ra cánh cửa đến những công việc lương cao, những chuyến du lịch tự tin, và những mối quan hệ quốc tế.

Với phương pháp học thông minh, bạn có thể làm chủ tiếng Anh nhanh hơn bạn nghĩ. Chỉ 15 phút mỗi ngày là đủ để bạn tiến bộ vượt bậc.

**CTA:** Hãy đăng ký khóa học ngay hôm nay để bắt đầu hành trình chinh phục tiếng Anh!
```

---

## Example 2: HARD Fails (social_max_sections + social_no_meta_commentary)

### Input: Quality Lock Results JSON

```json
{
  "intent": "social_caption_v1",
  "output": "Đây là bài viết tôi đã chuẩn bị cho bạn:\n\n**Hook:** Bạn có muốn tăng gấp đôi năng suất làm việc?\n\n**Problem:** Nhiều người lãng phí thời gian vì không biết cách quản lý.\n\n**Body:** Phương pháp Pomodoro giúp bạn tập trung cao độ trong 25 phút, sau đó nghỉ 5 phút. Đây là cách đơn giản nhưng hiệu quả đã được hàng triệu người áp dụng thành công.\n\n**Solution:** Áp dụng ngay hôm nay!\n\n**CTA:** Chia sẻ bài viết nếu bạn thấy hữu ích!",
  "softFails": [],
  "hardFails": [
    {
      "id": "social_max_sections",
      "passed": false,
      "severity": "HARD",
      "message": "Output must not exceed 4 sections",
      "details": { "sectionCount": 5, "sections": ["**Hook:**", "**Problem:**", "**Body:**", "**Solution:**", "**CTA:**"] }
    },
    {
      "id": "social_no_meta_commentary",
      "passed": false,
      "severity": "HARD",
      "message": "Output must not contain meta commentary (e.g., \"Here is\", \"As an AI\")"
    }
  ],
  "meta": {
    "language": "vi",
    "testMode": false
  }
}
```

### Output: Generated Auto Fix Prompt

```
INTENT: social_caption_v1
LANGUAGE: Vietnamese

EXPECTED OUTPUT STRUCTURE:
---
**Hook:** (1-2 sentences, attention-grabbing)

**Body:** (2+ paragraphs, main content with line breaks)

**CTA:** (exactly 1 sentence with action verb)
---

ORIGINAL CONTENT TO FIX:
---
Đây là bài viết tôi đã chuẩn bị cho bạn:

**Hook:** Bạn có muốn tăng gấp đôi năng suất làm việc?

**Problem:** Nhiều người lãng phí thời gian vì không biết cách quản lý.

**Body:** Phương pháp Pomodoro giúp bạn tập trung cao độ trong 25 phút, sau đó nghỉ 5 phút. Đây là cách đơn giản nhưng hiệu quả đã được hàng triệu người áp dụng thành công.

**Solution:** Áp dụng ngay hôm nay!

**CTA:** Chia sẻ bài viết nếu bạn thấy hữu ích!
---

ISSUES TO FIX (2):
[CRITICAL] Remove extra sections. Keep ONLY: **Hook:**, **Body:**, **CTA:**. Maximum 4 labeled sections allowed.
[CRITICAL] Remove ALL meta-commentary and AI self-references. Delete phrases like: "Here is", "Below is", "As an AI", "I will", "Dưới đây là", "Tôi sẽ", "Đây là". Start directly with content.

SAFE-EDIT POLICY (MUST FOLLOW):
- Preserve the original topic, message, and emotional tone
- Keep the same language (Vietnamese or English) as the original
- Do NOT add hashtags unless the rule specifically requires them
- Do NOT add extra sections beyond the required structure
- Do NOT add emojis unless the rule specifically requires them
- Fix ONLY the listed issues - leave everything else unchanged
- Do NOT add explanations, notes, or meta-commentary
- Do NOT wrap output in code fences or markdown blocks
- Output ONLY the corrected content, nothing else

Output MUST be in Vietnamese.

OUTPUT THE FIXED CONTENT ONLY:
```

### Expected Fixed Output

```
**Hook:** Bạn có muốn tăng gấp đôi năng suất làm việc?

**Body:** Nhiều người lãng phí thời gian vì không biết cách quản lý. Phương pháp Pomodoro giúp bạn tập trung cao độ trong 25 phút, sau đó nghỉ 5 phút.

Đây là cách đơn giản nhưng hiệu quả đã được hàng triệu người áp dụng thành công. Áp dụng ngay hôm nay để thấy sự khác biệt!

**CTA:** Chia sẻ bài viết nếu bạn thấy hữu ích!
```

---

## Example 3: testMode Active (SKIP rules filtered out)

### Input: Quality Lock Results JSON

```json
{
  "intent": "social_caption_v1",
  "output": "**Hook:** Bạn có biết rằng việc thiền định mỗi ngày chỉ mất 10 phút nhưng có thể giúp bạn giảm stress đáng kể và cải thiện sức khỏe tinh thần một cách toàn diện?\n\n**Body:** Thiền định là phương pháp đã được khoa học chứng minh hiệu quả.\n\n**CTA:** Hãy bắt đầu thiền ngay hôm nay!",
  "softFails": [
    {
      "id": "social_hook_length",
      "passed": false,
      "severity": "SOFT",
      "message": "Hook should be 1-2 sentences for maximum impact",
      "details": { "hookSentences": 3, "threshold": 2 }
    },
    {
      "id": "social_sentence_length",
      "passed": false,
      "severity": "SOFT",
      "message": "Sentences should not exceed 25 words for mobile readability",
      "details": { "longSentenceCount": 1, "examples": ["Bạn có biết rằng việc thiền định mỗi ngày chỉ mất 10 phút nhưng có thể giúp bạn giảm stress đáng kể và cải thiện sức khỏe tinh thần một cách toàn diện?"] }
    },
    {
      "id": "social_body_formatting",
      "passed": false,
      "severity": "SOFT",
      "message": "Body should have at least 2 paragraphs for readability",
      "details": { "paragraphCount": 1 }
    }
  ],
  "hardFails": [],
  "meta": {
    "language": "vi",
    "testMode": true
  }
}
```

### Output: Generated Auto Fix Prompt (testMode active)

Note: `social_hook_length` and `social_sentence_length` are SKIPPED in testMode, so only `social_body_formatting` is included.

```
INTENT: social_caption_v1
LANGUAGE: Vietnamese
MODE: testMode (relaxed thresholds apply)

EXPECTED OUTPUT STRUCTURE:
---
**Hook:** (1-2 sentences, attention-grabbing)

**Body:** (2+ paragraphs, main content with line breaks)

**CTA:** (exactly 1 sentence with action verb)
---

ORIGINAL CONTENT TO FIX:
---
**Hook:** Bạn có biết rằng việc thiền định mỗi ngày chỉ mất 10 phút nhưng có thể giúp bạn giảm stress đáng kể và cải thiện sức khỏe tinh thần một cách toàn diện?

**Body:** Thiền định là phương pháp đã được khoa học chứng minh hiệu quả.

**CTA:** Hãy bắt đầu thiền ngay hôm nay!
---

ISSUES TO FIX (1):
[QUALITY] Split Body into at least 2 separate paragraphs using line breaks. Each paragraph should cover one key point.

SAFE-EDIT POLICY (MUST FOLLOW):
- Preserve the original topic, message, and emotional tone
- Keep the same language (Vietnamese or English) as the original
- Do NOT add hashtags unless the rule specifically requires them
- Do NOT add extra sections beyond the required structure
- Do NOT add emojis unless the rule specifically requires them
- Fix ONLY the listed issues - leave everything else unchanged
- Do NOT add explanations, notes, or meta-commentary
- Do NOT wrap output in code fences or markdown blocks
- Output ONLY the corrected content, nothing else

Output MUST be in Vietnamese.

OUTPUT THE FIXED CONTENT ONLY:
```

---

## Rule-ID → Fix Instruction Reference

| Rule ID | Severity | Fix Instruction |
|---------|----------|-----------------|
| social_structure_lock | HARD | Add missing section labels. Required format: **Hook:** (attention grabber), **Body:** (main content), **CTA:** (call-to-action). |
| social_max_sections | HARD | Remove extra sections. Keep ONLY: **Hook:**, **Body:**, **CTA:**. Maximum 4 sections allowed. |
| social_no_meta_commentary | HARD | Remove ALL meta-commentary. Delete: "Here is", "Below is", "Đây là", "Tôi sẽ". Start directly with content. |
| social_cta_not_generic | HARD | Replace generic CTA. Avoid: "Tìm hiểu thêm", "Xem thêm", "Click here", "Learn more". |
| social_hook_length | SOFT | Shorten Hook to 1-2 punchy sentences. (SKIP in testMode) |
| social_body_formatting | SOFT | Split Body into 2+ paragraphs with line breaks. |
| social_sentence_length | SOFT | Break long sentences (>25 words) into shorter ones. (SKIP in testMode) |
| social_topic_keyword | SOFT | Incorporate topic keyword naturally in Hook or Body. |
| social_cta_action_verb | SOFT | Rewrite CTA as 1 sentence with action verb: Chia sẻ, Bình luận, Lưu, Tag, Hãy, etc. |

---

## testMode Behavior Summary

| testMode Value | Behavior |
|----------------|----------|
| **SAME** | Rule is evaluated and fixed normally |
| **SKIP** | Rule is filtered out - not included in Auto Fix prompt |
| **RELAX** | Rule uses relaxed thresholds (handled at evaluation time, not in Auto Fix) |

### Rules SKIPPED in testMode (social_caption_v1):
- `social_hook_length`
- `social_sentence_length`

### Rules with SAME behavior in testMode (social_caption_v1):
- `social_structure_lock` (HARD)
- `social_max_sections` (HARD)
- `social_no_meta_commentary` (HARD)
- `social_cta_not_generic` (HARD)
- `social_body_formatting` (SOFT)
- `social_topic_keyword` (SOFT)
- `social_cta_action_verb` (SOFT)
