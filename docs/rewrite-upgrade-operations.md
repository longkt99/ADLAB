# REWRITE_UPGRADE Operations Runbook

**Document Version:** 1.0
**Last Updated:** 2025-12-27
**Audience:** Product, Support, Operations

---

## 1. System Overview

### What REWRITE_UPGRADE Does

REWRITE_UPGRADE is a content improvement mode that polishes existing posts without changing their meaning, structure, or intent. When a user has an active draft open and requests improvements like "viết lại hay hơn" (rewrite better), the system:

- Improves word choice and sentence flow
- Maintains the original topic and angle
- Preserves paragraph structure
- Keeps the same call-to-action (or lack thereof)

### What REWRITE_UPGRADE Does NOT Do

- Create new content from scratch
- Change the topic or angle of the post
- Add new sections, hooks, or calls-to-action
- Expand content beyond minor phrasing adjustments
- Remove or reorder paragraphs

### System Relationships

| Component | Role |
|-----------|------|
| CREATE | Default mode for generating new content from prompts |
| REWRITE_UPGRADE | Improvement mode for existing drafts only |
| Context Guard | Blocks rewrite attempts when no draft is present |
| Anchor Guard | Validates paragraph structure is preserved |
| Diff Guard | Ensures output stays within change limits |
| Kill-Switch | Disables REWRITE_UPGRADE entirely when needed |

The system detects user intent automatically. When a user has a draft open and uses rewrite language, REWRITE_UPGRADE activates. When no draft exists or the user requests new content, CREATE activates.

---

## 2. Operational States

### Flag ON (Default)

**Environment:** `NEXT_PUBLIC_ENABLE_REWRITE_UPGRADE` is not set or set to `true`

**User Experience:**
- User opens a draft
- User requests rewrite (e.g., "viết lại hay hơn")
- Confirmation dialog appears asking user to confirm intent
- After confirmation, system improves the content
- If guards fail, user sees an error message explaining why

**Telemetry Shows:**
- `taskType: 'REWRITE_UPGRADE'`
- Guard results (`anchorValidationOk`, `diffGuardOk`)
- Latency and retry counts
- Confirmation dialog interactions

### Flag OFF (Kill-Switch Active)

**Environment:** `NEXT_PUBLIC_ENABLE_REWRITE_UPGRADE=false` or `=0`

**User Experience:**
- User opens a draft
- User requests rewrite
- System silently treats request as CREATE
- New content is generated instead of polish
- No error is shown

**Telemetry Shows:**
- `taskType: 'REWRITE_UPGRADE'` (detection still runs)
- In development logs: `Kill-switch active, routing to CREATE`
- No anchor or diff guard results (guards are bypassed)

---

## 3. Failure Classification Quick Reference

| Reason Code | Layer | Retryable | User-Fixable | Explanation |
|-------------|-------|-----------|--------------|-------------|
| `REWRITE_NO_CONTEXT` | Context Guard | No | Yes | User tried to rewrite without opening a draft first. |
| `REWRITE_ANCHOR_MISMATCH` | Structural Anchor Guard | Yes | Yes | Output changed paragraph structure. System will retry automatically. |
| `REWRITE_DIFF_EXCEEDED` | Rewrite Diff Guard | Yes | Yes | Output changed too much content. System will retry with stricter constraints. |
| `BINDING_MISMATCH` | Output Contract | No | No | Internal validation failed. Requires investigation. |
| `EXECUTION_BLOCKED` | Execution Layer | No | No | System prevented execution due to safety constraints. |
| `LLM_RATE_LIMIT` | Provider | Yes | No | API rate limit hit. System retries automatically. |
| `LLM_TIMEOUT` | Provider | Yes | No | API response timed out. System retries automatically. |

---

## 4. When to Toggle Kill-Switch

### Conditions to Disable REWRITE_UPGRADE

Disable immediately if ANY of the following occur:

1. `REWRITE_DIFF_EXCEEDED` failures exceed 30% of rewrite attempts
2. `REWRITE_ANCHOR_MISMATCH` failures exceed 20% of rewrite attempts
3. Any `BINDING_MISMATCH` occurrence (investigate immediately)
4. More than 3 user complaints per day about "content changed too much"
5. Suspected prompt injection or adversarial usage patterns

### What Disabling Does

- Routes all REWRITE_UPGRADE requests to CREATE mode
- Bypasses confirmation dialog, anchor guards, and diff guards
- Continues logging task detection for monitoring
- Takes effect immediately upon environment variable change

### What Disabling Does NOT Do

- Does not affect CREATE mode in any way
- Does not delete or modify any user content
- Does not require code deployment
- Does not change any stored data or preferences

### Safety Guarantees When Disabled

- Users can still generate new content normally
- No errors are shown for rewrite requests
- System remains fully functional for all other operations
- Telemetry continues recording for analysis

---

## 5. Telemetry Reading Guide

### Key Metrics to Monitor

**Rewrite Attempts**
- Look for `taskType: 'REWRITE_UPGRADE'` in logs
- Compare `ok: true` vs `ok: false` ratio
- Healthy: >90% success rate

**Anchor Failures**
- Look for `reasonCode: 'REWRITE_ANCHOR_MISMATCH'`
- Check `retryCountUsed` to see if retries helped
- Healthy: <5% of attempts after retries

**Diff Guard Failures**
- Look for `reasonCode: 'REWRITE_DIFF_EXCEEDED'`
- Check `diffMetrics.lengthRatioMax` for severity
- Healthy: <10% of attempts

**Confirmation Cancels**
- In development logs: `intentConfirmation.accepted: false`
- High cancel rate may indicate user confusion about mode

### Warning Patterns

| Pattern | Indicates | Action |
|---------|-----------|--------|
| High anchor failures (>20%) | Model output degradation | Consider kill-switch |
| High diff failures (>30%) | Model not following constraints | Consider kill-switch |
| High confirmation cancels (>50%) | Users confused about rewrite vs create | Review UX copy |
| Repeated retries without success | Systemic prompt issue | Investigate prompts |
| Sudden spike in any failure | Regression or model change | Investigate immediately |

---

## 6. Support Playbook

### "AI changed my content too much"

**What Happened:**
The rewrite may have exceeded expected boundaries, or the user expected polish but got more significant changes.

**Support Response:**
- Confirm the user had a draft open before requesting rewrite
- Ask if they saw the confirmation dialog
- If they confirmed rewrite intent, explain that rewrite is for polish only
- If content changed significantly despite guards, log as bug with telemetry timestamp

**Do NOT Say:**
- "That's not possible" (guards can occasionally miss edge cases)
- "Just try again" (without understanding what went wrong)
- "Use CREATE instead" (unless kill-switch is active)

### "Rewrite doesn't work"

**What Happened:**
Several possibilities: no draft open, kill-switch active, guard failure, or network issue.

**Support Response:**
1. Ask if user has a draft open in the editor
2. Ask what exact message they see (error or just new content)
3. If new content appears instead of polish, check if kill-switch is active
4. If error appears, note the error message for engineering

**Do NOT Say:**
- Technical details about guards or anchors
- "The system is broken"

### "Rewrite silently routes to CREATE"

**What Happened:**
Kill-switch is active. This is intentional behavior when REWRITE_UPGRADE is disabled.

**Support Response:**
- Confirm with operations that kill-switch is active
- Explain that the feature is temporarily unavailable
- Advise user to edit manually or wait for feature restoration

**Do NOT Say:**
- "This is a bug"
- Specific details about kill-switch mechanism
- Promises about when feature will return

---

## 7. Release Safety Checklist

### Pre-Deploy Checklist

- [ ] All 92 tests pass (dialog, invariant, telemetry, kill-switch)
- [ ] Build succeeds with no unauthorized LLM calls
- [ ] Kill-switch environment variable documented
- [ ] Telemetry logging verified in staging
- [ ] Support team briefed on new failure codes (if any)
- [ ] Rollback procedure confirmed with operations

### Post-Deploy Checklist

- [ ] Monitor telemetry for first 2 hours
- [ ] Check REWRITE_UPGRADE success rate (target: >90%)
- [ ] Check anchor failure rate (target: <5%)
- [ ] Check diff guard failure rate (target: <10%)
- [ ] Confirm no BINDING_MISMATCH occurrences
- [ ] Verify kill-switch can be toggled if needed

### Rollback Checklist

If issues occur:

1. [ ] Set `NEXT_PUBLIC_ENABLE_REWRITE_UPGRADE=false`
2. [ ] Restart application or wait for environment refresh
3. [ ] Verify telemetry shows kill-switch active
4. [ ] Confirm CREATE mode still works normally
5. [ ] Collect failure samples for engineering
6. [ ] Do NOT modify any code or guards

---

This runbook documents an invariant-locked system.
Behavior described here is guaranteed by tests and kill-switch protection.
