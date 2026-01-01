# Auto Fix Product Contract

> Internal constitution for Auto Fix behavior, boundaries, and guarantees.
> This document is frozen unless explicitly revised by product leadership.

---

## 1. Product Definition

### What Auto Fix IS

- A suggestion tool that offers one alternative version of flagged content
- A preview-first system — user sees changes before any modification occurs
- A minimal editor that fixes only what Quality Lock flagged, nothing more
- A reversible action — undo is always available immediately after apply
- A silent re-evaluator — after apply, Quality Lock runs again without announcement
- A fallback-safe system — when uncertain, it preserves the original
- An optional feature — it never activates without explicit user action

### What Auto Fix IS NOT

- Not an auto-correct — it does not modify content without user consent
- Not a rewriter — it does not rephrase, improve, or enhance unflagged content
- Not a quality guarantor — it offers a suggestion, not a promise
- Not a replacement for human judgment — user decides what to keep
- Not a learning system — it does not remember preferences or adapt over time
- Not a gate — it never blocks publishing or workflow progression
- Not visible when unnecessary — if Quality Lock passes, Auto Fix does not appear

---

## 2. UX Boundaries

### Where Auto Fix May Appear

| Surface | Allowed | Notes |
|---------|---------|-------|
| QualityLockPanel (DRAFT/FAIL) | Yes | Primary entry point |
| DiffPreviewModal | Yes | Preview and decision surface |
| Toast (post-apply) | Yes | Confirmation with undo |
| Toast (keep original) | Yes | Neutral acknowledgment |

### Where Auto Fix Must NEVER Appear

| Surface | Reason |
|---------|--------|
| Toolbar or header | Implies always-available, promotes overuse |
| Keyboard shortcut | Reduces friction below intentional threshold |
| Context menu | Feels like correction, not suggestion |
| Inline within content | Violates preview-first principle |
| Notification/badge outside Studio | Creates urgency, implies obligation |
| Settings panel | Auto Fix has no user-configurable options |

### Re-run Rules

| Scenario | Allowed | Behavior |
|----------|---------|----------|
| After user applies fix | Yes (automatic) | Silent re-evaluation via Quality Lock |
| After user keeps original | No | State unchanged, no re-evaluation |
| After user manually edits | No | User took control, Auto Fix resets |
| Same message, second attempt | Yes (max 2) | Stricter prompt, higher similarity threshold |
| Third+ attempt on same message | No | Button hidden, hint shown: "Bạn có thể chỉnh tay nếu cần." |

---

## 3. Behavioral Guarantees

### Guarantees to the User

1. **Preview before change** — No content is modified until user clicks "Dùng bản này"
2. **Undo always available** — For 5 seconds after apply, undo restores original exactly
3. **Original preserved in memory** — Until undo window closes, original is recoverable
4. **No silent changes** — Every modification is visible in diff view before apply
5. **No judgment language** — UI never implies original was wrong or inferior
6. **No persistence** — Auto Fix does not remember, track, or profile user behavior
7. **Fallback to original** — If system is uncertain, it returns original content unchanged

### Guarantees to the Product Team

1. **No scope creep** — Auto Fix fixes Quality Lock issues only, nothing else
2. **No new surfaces** — Auto Fix appears only in documented locations above
3. **No automation escalation** — No "auto-apply", "apply all", or batch operations
4. **No gamification** — No streaks, scores, badges, or progress indicators
5. **No analytics in UI** — Metrics are silent, never shown to user
6. **No A/B testing on core flow** — Preview-first and undo are non-negotiable
7. **No integration dependencies** — Auto Fix works offline-first, no external services required

---

## 4. Anti-patterns

### Prohibited Future Changes

| Proposed Change | Violation | Harm |
|-----------------|-----------|------|
| "Auto-apply if similarity > 90%" | Removes preview-first | User loses control, trust erodes |
| "Apply to all messages" button | Batch operation | Reduces intentionality, increases mistakes |
| "Smart suggestions" based on history | Learning system | Creates unpredictability, privacy concern |
| Success animation after apply | Celebration | Implies system achievement, not user choice |
| "Auto Fix improved your content" toast | Judgment language | Frames original as inferior |
| Keyboard shortcut (Cmd+Shift+F) | Reduces friction | Promotes reflexive use over intentional review |
| "Auto Fix available" badge in sidebar | Notification outside Studio | Creates urgency, implies obligation |
| "Would you like to auto-fix?" prompt | Persuasion | Pressures user, violates calm UX |
| Analytics dashboard for fix rate | Visible metrics | Gamifies behavior, creates performance anxiety |
| "Recommended" label on Auto Fix button | Recommendation | System claims authority over user judgment |

### Why These Matter

Each anti-pattern shifts Auto Fix from **tool** to **agent** — from something the user controls to something that controls the user. The moment Auto Fix feels like it has opinions, preferences, or goals, trust breaks. A senior editor does not celebrate when you accept their suggestion. They nod, and move on.

---

## 5. Contract Status

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Status | Frozen |
| Last Updated | 2024-12 |
| Owner | Product |
| Requires Approval to Modify | Yes |

---

## 6. Reference Files

Implementation governed by this contract:

- `lib/quality/autoFixPrompt.ts` — Prompt construction
- `lib/quality/similarityCheck.ts` — Similarity guardrails
- `lib/studio/studioContext.tsx` — State management, apply/undo logic
- `app/api/quality/auto-fix/route.ts` — API endpoint
- `app/(dashboard)/studio/components/QualityLockPanel.tsx` — Entry point UI
- `app/(dashboard)/studio/components/DiffPreviewModal.tsx` — Preview UI
- `docs/AUTO_FIX_MICROCOPY_RULES.md` — Frozen microcopy

---

*This document defines what Auto Fix is allowed to become. Anything not explicitly permitted is implicitly prohibited.*
