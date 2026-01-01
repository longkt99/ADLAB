# Auto Fix Guardrails

> Technical specification for Auto Fix prompt constraints and trust protection.
> This document defines what Auto Fix is allowed to change and what is forbidden.

---

## 1. Core Principle

**Auto Fix is a surgical editor, not a rewriter.**

Every edit must be:
- Rule-scoped (only fix what Quality Lock flagged)
- Minimal (smallest change that resolves the issue)
- Voice-preserving (keep the writer's tone and style)

---

## 2. Allowed Changes

Auto Fix MAY:

| Category | Examples |
|----------|----------|
| Structure fixes | Add missing `**Hook:**`, `**Body:**`, `**CTA:**` labels |
| Clarity fixes | Split long sentences, remove redundancy |
| Meta-commentary removal | Delete "Here is...", "Dưới đây là...", AI self-references |
| CTA improvements | Add action verb to generic CTA |
| Format corrections | Add line breaks, fix heading hierarchy |

---

## 3. Forbidden Changes

Auto Fix MUST NOT:

| Forbidden Action | Reason |
|------------------|--------|
| Rewrite unflagged content | Violates rule-scoped principle |
| Change tone or voice | Destroys writer confidence |
| Add emojis (unless `reel_emoji_usage` rule) | Unauthorized expansion |
| Add hashtags (unless `reel_has_hashtags` rule) | Unauthorized expansion |
| Add new ideas or arguments | Creative judgment belongs to writer |
| Explain its changes | No meta-commentary |
| Change language (VI↔EN) | Corrupts content |
| Expand content >30% | Excessive rewrite |

---

## 4. Similarity Thresholds (Locked)

| Threshold | Value | Action |
|-----------|-------|--------|
| Accept | ≥70% | Accept result |
| Retry | ≥75% (stricter) | Required for second attempt |
| Degraded | 60-69% | Use with `usedFallback: true` |
| Fallback | <60% | Return original content |

---

## 5. Guardrail Violation Types

| Type | Severity | Trigger |
|------|----------|---------|
| `META_COMMENTARY` | Block | AI self-references detected |
| `LANGUAGE_CHANGE` | Block | Language switched |
| `UNAUTHORIZED_EMOJI` | Warning | Emoji added without rule |
| `UNAUTHORIZED_HASHTAG` | Warning | Hashtag added without rule |
| `TONE_SHIFT` | Warning | Corporate-speak or AI filler |
| `CONTENT_EXPANSION` | Warning | >30% length increase |

---

## 6. Trust Erosion Signals

| Signal | Severity | Trigger |
|--------|----------|---------|
| `EXCESSIVE_EDIT` | Medium/High | Similarity <70% |
| `REPEATED_FAILURE` | High | 2+ attempts all failed |
| `OSCILLATION` | High | Undo → Apply → Undo pattern |
| `QUICK_UNDO` | Medium | Undo within 2 seconds |
| `FALLBACK_USED` | Medium | System fell back to original |
| `CONSECUTIVE_REJECT` | Medium | 3+ consecutive "keep original" |

---

## 7. Backoff State Machine

```
NORMAL ──────────────────────────────────────────────────────────
   │
   │ Trust score drops below 80
   ▼
CAUTIOUS ─────────────────────────────────────────────────────────
   │  • Stricter prompts used
   │  • 30-second cooldown between attempts
   │
   │ Trust score drops below 40
   ▼
SILENT ───────────────────────────────────────────────────────────
   │  • Auto Fix disabled
   │  • 5-minute cooldown
   │  • No UI indication (button simply doesn't appear)
   │
   │ Cooldown expires + trust score ≥40
   ▼
CAUTIOUS (must go through CAUTIOUS to return to NORMAL)
```

---

## 8. Recovery Conditions

| From | To | Requirements |
|------|----|--------------|
| CAUTIOUS | NORMAL | 3+ consecutive successes AND trust ≥80 |
| SILENT | CAUTIOUS | Cooldown expired AND trust ≥40 |
| SILENT | NORMAL | Not allowed (must go through CAUTIOUS) |

---

## 9. Implementation Files

| File | Purpose |
|------|---------|
| `lib/quality/autoFixGuardrails.ts` | Guardrail checks and policy strings |
| `lib/quality/trustErosion.ts` | Trust signal detection |
| `lib/quality/backoffState.ts` | Backoff state machine |
| `app/api/quality/auto-fix/route.ts` | API integration |
| `lib/quality/__tests__/autoFixGuardrails.test.ts` | Test suite |

---

## 10. Doctrine

**When in doubt, don't change it.**

Auto Fix protects the writer's voice by being conservative.
A missed fix is better than a corrupted draft.

---

*Last updated: 2024-12*
