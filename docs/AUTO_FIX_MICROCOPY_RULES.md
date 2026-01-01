# Auto Fix Microcopy Rules

> Internal reference for maintaining consistent, calm, editor-grade tone across all Auto Fix UI touchpoints.

---

## Voice Principle

Auto Fix should feel like:

**"A quiet editorial suggestion that appears only when needed — and disappears when ignored."**

The system is a tool, not an assistant. It offers options, not advice.

---

## Frozen Copy (Do Not Change)

The following microcopy is finalized. Do not rephrase without explicit approval.

| Touchpoint | Copy |
|------------|------|
| Button label | Xem gợi ý điều chỉnh |
| Button loading | Đang chuẩn bị... |
| First-time hint | Xem trước bản điều chỉnh — bạn quyết định có dùng hay không. |
| Diff modal intro | Bản gợi ý chỉ điều chỉnh những điểm được đánh dấu. Giọng văn và ý tưởng gốc được giữ nguyên. |
| Apply button | Dùng bản này |
| Keep original button | Giữ bản gốc |
| Post-apply toast | Đã thay bằng bản điều chỉnh. |
| Undo label | Hoàn tác |
| Keep original toast | Giữ nguyên bản gốc. |

---

## DO

- Use neutral, descriptive verbs: **xem**, **giữ**, **dùng**, **điều chỉnh**
- State facts, not outcomes
- Emphasize user choice and control
- Keep sentences short (under 15 words)
- Assume the user is a competent professional
- Describe what happened, not how well it went
- Use "bản gợi ý" or "bản điều chỉnh" — never "bản sửa"

---

## DON'T

| Banned Term | Reason |
|-------------|--------|
| AI | Implies external agent acting on user's work |
| tự động | Suggests lack of user control |
| cải thiện | Implies original was inferior |
| sửa lỗi | Frames original as wrong |
| thành công | Praise; unnecessary validation |
| tốt hơn / kém hơn | Comparative judgment |
| hoàn hảo | Hyperbole |
| chúc mừng | Gamification |
| tuyệt vời | Flattery |

**Also avoid:**
- Emojis in any Auto Fix UI
- Exclamation marks
- Questions that pressure action ("Bạn có muốn áp dụng không?")
- Passive-aggressive phrasing ("Bạn chắc chứ?")
- Any suggestion that the system "knows better"

---

## Tone Calibration

| Scenario | Wrong | Right |
|----------|-------|-------|
| After applying | "Đã sửa thành công!" | "Đã thay bằng bản điều chỉnh." |
| Keeping original | "Đã hủy thay đổi" | "Giữ nguyên bản gốc." |
| Loading state | "Đang sửa lỗi cho bạn..." | "Đang chuẩn bị..." |
| Button label | "Sửa tự động" | "Xem gợi ý điều chỉnh" |
| Intro banner | "Hệ thống đã tạo bản tốt hơn" | "Bản gợi ý chỉ điều chỉnh những điểm được đánh dấu." |

---

## Review Checklist

Before shipping any Auto Fix copy, verify:

1. Does any word imply the original content was wrong?
2. Does any phrase suggest the system is smarter than the user?
3. Is the system "speaking above" the user?
4. Would a professional editor feel patronized by this language?
5. Does anything feel like persuasion rather than description?

If yes to any — rewrite.

---

## File Locations

Copy is implemented in:

- `app/(dashboard)/studio/components/QualityLockPanel.tsx` — button, hint
- `app/(dashboard)/studio/components/DiffPreviewModal.tsx` — intro banner, action buttons
- `lib/studio/studioContext.tsx` — toast messages

---

*Last updated: 2024-12*
