# REWRITE_UPGRADE Failure Model & Debug Playbook

This document explains the REWRITE_UPGRADE pipeline, its guard layers, and how to debug failures.

> **IMPORTANT**: This is documentation only. It does NOT affect runtime behavior.

---

## Pipeline Overview

When a user requests a rewrite (e.g., "viết lại hay hơn", "make it better"), the system executes the following pipeline:

```
User Request
    │
    ▼
┌─────────────────────────┐
│   1. Context Guard      │  ← Does user have content to rewrite?
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│   2. Request Binding    │  ← Is the request properly formed?
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│   3. LLM Execution      │  ← Call AI with anchored source
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│   4. Anchor Guard       │  ← Did LLM preserve paragraph structure?
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│   5. Diff Guard         │  ← Is the rewrite conservative enough?
└─────────────────────────┘
    │
    ▼
✅ Success: Display rewritten content
```

---

## Guard Layers in Execution Order

### 1. Context Guard

**Purpose**: Ensures user has selected content to rewrite.

**When it fails**: User requests rewrite without an active draft.

| Reason Code | `REWRITE_NO_CONTEXT` |
|-------------|----------------------|
| Retryable | No |
| User Fixable | Yes |
| Action | User must select a draft/message before requesting rewrite |

**Debug Steps**:
1. Check if `hasActiveDraft` is `true` in `answerEngineContext`
2. Check if user has assistant messages in conversation
3. Verify `selectedSourceId` is set

---

### 2. Request Binding

**Purpose**: Validates that the request reaching the executor matches what the UI sent.

**When it fails**: Hash mismatch between UI request metadata and executor request.

| Reason Code | `BINDING_MISMATCH` |
|-------------|-------------------|
| Retryable | No |
| User Fixable | No |
| Action | Developer investigation required |

**Debug Steps**:
1. Check `uiInputHash` vs computed hash in executor
2. Look for race conditions (rapid user actions)
3. Check if request was modified between UI send and executor receive
4. Verify `safeHash` function consistency

---

### 3. Input Validation

**Purpose**: Ensures request has required fields.

| Reason Code | Layer | Retryable | User Fixable | Action |
|-------------|-------|-----------|--------------|--------|
| `EMPTY_USER_PROMPT` | Input Validation | No | Yes | User must enter content |
| `MISSING_SYSTEM` | Input Validation | No | No | Check template config |
| `INVALID_META` | Input Validation | No | No | Check request construction |

---

### 4. Structural Anchor Guard

**Purpose**: Ensures LLM output preserves paragraph structure from source.

**How it works**:
1. Source content is injected with anchors: `<<P1>>`, `<<P2>>`, etc.
2. LLM is instructed to preserve these anchors
3. Output is validated: all anchors must be present, in order, with no extras

**When it fails**: LLM merged paragraphs, added sections, or reordered content.

| Reason Code | `REWRITE_ANCHOR_MISMATCH` |
|-------------|--------------------------|
| Retryable | Yes |
| User Fixable | No |
| Action | System will auto-retry with stricter prompt |

**Debug Steps**:
1. Check `[Transform] Anchor validation failed` logs
2. Compare `injected.anchorIds` vs `extractAnchors(output)`
3. Look for `missing`, `extra`, or `orderPreserved: false` in validation result
4. Review LLM output for structural changes

**Common Causes**:
- LLM merged two short paragraphs into one
- LLM added a new conclusion paragraph
- LLM reordered content for "better flow"

---

### 5. Rewrite Diff Guard

**Purpose**: Ensures LLM made conservative edits without topic/intent drift.

**What it checks** (per paragraph):
- Length ratio: output length vs source length (max 1.5x)
- Keyword preservation: >60% of source keywords retained
- Sentence replacement: <50% of sentences completely replaced
- CTA addition: no new CTAs if source had none

**When it fails**: LLM rewrote content too aggressively.

| Reason Code | `REWRITE_DIFF_EXCEEDED` |
|-------------|------------------------|
| Retryable | Yes |
| User Fixable | Yes |
| Action | User can try lighter edit request |

**Debug Steps**:
1. Check `[Transform] Diff guard failed` logs
2. Look for specific failure reason:
   - `LENGTH_EXCEEDED`: output too long
   - `KEYWORDS_LOST`: topic drift
   - `SENTENCE_REPLACEMENT_EXCEEDED`: too much rewriting
   - `CTA_ADDED`: marketing pressure added
3. Review `paragraphAnalysis` array for per-paragraph metrics

**Common Causes**:
- User said "viết lại" but LLM created new content
- LLM added sales pitch to informational content
- LLM changed product/brand references

---

## Failure Classification Log Format

In development mode, failures emit structured logs:

```
[FAILURE_CLASS] {
  reasonCode: 'REWRITE_DIFF_EXCEEDED',
  layer: 'Rewrite Diff Guard',
  retryable: true,
  userFixable: true,
  debugHint: 'LLM changed too much. User can try lighter edit request.'
}
```

Use this to quickly identify:
- **Which guard failed** (`layer`)
- **Whether to implement retry logic** (`retryable`)
- **Whether to surface user guidance** (`userFixable`)

---

## Quick Reference: All Reason Codes

| Reason Code | Guard Layer | Retryable | User Fixable |
|-------------|-------------|-----------|--------------|
| `REWRITE_NO_CONTEXT` | Context Guard | No | Yes |
| `REWRITE_ANCHOR_MISMATCH` | Structural Anchor Guard | Yes | No |
| `REWRITE_DIFF_EXCEEDED` | Rewrite Diff Guard | Yes | No |
| `BINDING_MISMATCH` | Request Binding | No | No |
| `EMPTY_USER_PROMPT` | Input Validation | No | Yes |
| `MISSING_SYSTEM` | Input Validation | No | No |
| `INVALID_META` | Input Validation | No | No |
| `EDIT_SCOPE_REQUIRED` | Execution Gate | No | Yes |
| `EXECUTION_BLOCKED` | Execution Gate | No | No |
| `UNKNOWN` | Unknown | Yes | No |

---

## Debugging Checklist

When investigating a REWRITE_UPGRADE failure:

1. **Find the failure log**
   - Search for `[FAILURE_CLASS]` in console
   - Note the `reasonCode` and `layer`

2. **Check guard-specific logs**
   - `[LLMExecutor] Decision:` - normalization result
   - `[Transform] Anchor validation failed` - structure issues
   - `[Transform] Diff guard failed` - edit intensity issues

3. **Verify request context**
   - Was `hasActiveDraft` true?
   - Was `answerEngineTaskType` correctly detected as `REWRITE_UPGRADE`?
   - Were anchors injected into source content?

4. **Review LLM output**
   - Did output contain expected anchors?
   - Was output structurally similar to source?
   - Did output preserve topic and intent?

5. **Check retry behavior**
   - If `retryable: true`, did system retry?
   - Did retry succeed or fail again?
   - How many attempts before final failure?

---

## Related Files

| File | Purpose |
|------|---------|
| `lib/studio/failureTaxonomy.ts` | Static failure metadata mapping |
| `lib/studio/errorMessages.ts` | User-facing error messages |
| `lib/studio/rewriteAnchors.ts` | Anchor injection/validation |
| `lib/studio/rewriteDiffGuard.ts` | Conservative edit validation |
| `lib/studio/answerEngine.ts` | Task type detection & contracts |
| `lib/orchestrator/llmExecutor.ts` | Single LLM call site |
| `lib/studio/studioContext.tsx` | UI integration |

---

*Last updated: Step 24 - Failure Classification & Debug Playbook*
