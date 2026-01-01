# Auto Fix Kill Switch Protocol

> Internal protocol for disabling Auto Fix when trust conditions are not met.
> This document governs retreat behavior. It is not negotiable during incidents.

---

## Governing Principle

When Auto Fix loses trust, it disappears.

It does not explain. It does not apologize. It does not promise improvement.
Silence is the correct response to failure.

---

## 1. Hard Kill Conditions

Auto Fix is completely disabled. The button does not render. No code path executes.

| Condition | Threshold | Detection |
|-----------|-----------|-----------|
| Sustained low trust | `kept: true` rate < 70% over 50+ events | Console log aggregation |
| Repeated undo pattern | Same user undoes 3+ consecutive applies | Session-level tracking |
| Internal reviewer flag | Any team member raises discomfort | Manual flag in config |
| Prompt drift | Fix output consistently fails re-evaluation | API-level monitoring |
| Similarity guardrail bypass | Best result repeatedly below 50% similarity | API logs |
| LLM degradation | Empty or malformed responses > 20% of attempts | API error rate |

**Hard Kill Behavior:**
- `onAutoFix` prop is not passed to QualityLockPanel
- Auto Fix button does not render
- No loading states, no disabled states, no explanations
- Console logs `[AutoFix:Kill] Hard kill active`
- User sees only Quality Lock panel with manual options

---

## 2. Soft Kill Conditions

Auto Fix remains in codebase but retreats to minimal visibility.

| Condition | Threshold | Detection |
|-----------|-----------|-----------|
| Trust caution zone | `kept: true` rate 70–79% over 30+ events | Console log aggregation |
| Elevated undo rate | Undo rate > 15% over 20+ events | Session tracking |
| Single intent degradation | One intent shows < 80% kept rate | Per-intent monitoring |
| Similarity edge cases | > 30% of fixes require retry attempt | API logs |

**Soft Kill Behavior:**
- Auto Fix button remains but moves to collapsed state
- First-time hint is suppressed (no promotion)
- Button appears only when user expands Quality Lock panel
- No visual emphasis, no call-to-action styling
- Console logs `[AutoFix:Kill] Soft kill active`

---

## 3. Recovery Conditions

Auto Fix may return only when all of the following are true:

| Requirement | Verification |
|-------------|--------------|
| Root cause identified | Written post-mortem exists |
| Fix deployed | Code change merged and released |
| Trust metric stable | `kept: true` rate ≥ 85% over 30+ events post-fix |
| No undo anomalies | Undo rate < 10% over 20+ events |
| Internal sign-off | Product owner explicitly approves return |
| Observation period complete | Minimum 7 days in soft-kill or off state |

**Recovery is gradual:**
1. Soft kill → Normal (if metrics stable for 7 days)
2. Hard kill → Soft kill → Normal (minimum 14 days total)

**Recovery is never announced:**
- No "Auto Fix is back" messaging
- No changelog entry
- Button simply reappears when conditions are met

---

## 4. Anti-Patterns

The following responses to a kill event are prohibited:

| Anti-Pattern | Why Prohibited |
|--------------|----------------|
| "Auto Fix is temporarily unavailable" message | Implies promise of return; creates expectation |
| Greyed-out button with tooltip | Draws attention to absence; invites questions |
| "We're improving Auto Fix" banner | Marketing language; violates calm principle |
| Gradual degradation UI (progress bars, percentages) | Exposes internal state; creates anxiety |
| User-facing error messages from kill switch | System failure should be invisible |
| A/B testing during kill period | Confuses metrics; delays recovery |
| Partial kill (some users, not others) | Creates inconsistent experience; complicates debugging |
| "Try again later" prompt | Implies temporary state; sets false expectation |
| Logging kill reason to user-visible analytics | Internal state must remain internal |
| Discussing kill status in UI copy | The feature simply does not exist when killed |

---

## 5. Implementation Notes

**Kill switch config location:** Environment variable or feature flag (not user-facing settings)

**Kill switch check:** Runs before `onAutoFix` is passed to components

**Logging during kill:**
```
[AutoFix:Kill] Hard kill active - reason: {reason}
[AutoFix:Kill] Soft kill active - reason: {reason}
[AutoFix:Kill] Recovery initiated - metrics: {summary}
[AutoFix:Kill] Recovery complete - returning to normal
```

**No user-facing indication of kill state.** The absence of the button is the only signal.

---

## 6. Escalation Path

| Severity | Action | Owner |
|----------|--------|-------|
| Soft kill triggered | Monitor for 48 hours | Engineering |
| Hard kill triggered | Immediate investigation | Engineering + Product |
| Hard kill > 7 days | Root cause review required | Product leadership |
| Recovery blocked | Escalate to product owner | Engineering |

---

## 7. Contract Compliance

This protocol operates under the Auto Fix Product Contract:

- "If trust drops, Auto Fix should become quieter, not louder" → Kill switch enforces silence
- "No UI changes as reaction to metrics" → Kill removes UI entirely, does not modify it
- "Expansion is earned, not rolled out" → Recovery requires proven metrics, not time alone

---

## Doctrine

**When Auto Fix fails, it vanishes. It does not bargain for another chance.**
