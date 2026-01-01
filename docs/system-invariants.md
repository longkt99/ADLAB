# System Invariants

This document defines the immutable behavioral contracts of the Content Machine AI system.

> **WARNING**: These invariants are locked. Any change requires explicit approval and must update both this document AND the corresponding regression tests.

---

## 1. REWRITE_UPGRADE Mode Invariants

### 1.1 Content Preservation

- **MUST NEVER** change the topic of the source content
- **MUST NEVER** change the angle/perspective of the source content
- **MUST NEVER** change the intent of the source content
- **MUST NEVER** switch brand, product, or service references
- **MUST NEVER** add fabricated information (addresses, hotlines, prices not in source)

### 1.2 Structural Preservation

- **MUST ALWAYS** preserve the same number of paragraphs as source
- **MUST ALWAYS** preserve the order of paragraphs
- **MUST NEVER** merge two source paragraphs into one
- **MUST NEVER** split one source paragraph into multiple
- **MUST NEVER** add new sections not present in source

### 1.3 CTA Rules

- **MUST NEVER** add a CTA if the source content has no CTA
- **MUST NEVER** increase marketing pressure beyond source
- **MUST NEVER** add urgency language if source has none

### 1.4 Output Format

- **IF** task type is REWRITE_UPGRADE **THEN** output must be the same post, written better
- **IF** task type is REWRITE_UPGRADE **THEN** output is NOT a new post
- **MUST ALWAYS** preserve paragraph structure from source
- **MUST ALWAYS** preserve idea order from source

---

## 2. Context Guard Invariants

### 2.1 Draft Requirement

- **IF** user requests rewrite **AND** no active draft exists **THEN** MUST fail with `REWRITE_NO_CONTEXT`
- **MUST NEVER** proceed with rewrite when `hasActiveDraft` is false
- **MUST NEVER** silently fallback to CREATE mode when rewrite context is missing

### 2.2 Context Detection

- **MUST ALWAYS** check `answerEngineContext.hasActiveDraft` before REWRITE_UPGRADE
- **MUST ALWAYS** check `answerEngineContext.hasPreviousMessages` for context awareness

---

## 3. Structural Anchor Guard Invariants

### 3.1 Anchor Injection

- **IF** content has 2+ substantial paragraphs **THEN** anchors MUST be injected
- **MUST ALWAYS** use format `<<P1>>`, `<<P2>>`, etc.
- **MUST NEVER** anchor paragraphs with fewer than 10 characters

### 3.2 Anchor Validation

- **IF** LLM output is missing any expected anchor **THEN** validation MUST fail
- **IF** LLM output has extra anchors not in source **THEN** validation MUST fail
- **IF** LLM output has anchors in wrong order **THEN** validation MUST fail
- **MUST ALWAYS** return `valid: false` when anchor contract is violated

### 3.3 Anchor Stripping

- **MUST ALWAYS** strip anchors from final output before display
- **MUST NEVER** expose anchor markers to end users

---

## 4. Rewrite Diff Guard Invariants

### 4.1 Length Constraints

- **IF** output paragraph length > 1.5x source paragraph length **THEN** MUST fail with `LENGTH_EXCEEDED`
- **MUST NEVER** allow unbounded length expansion

### 4.2 Keyword Preservation

- **IF** keyword preservation ratio < 60% **THEN** MUST fail with `KEYWORDS_LOST`
- **MUST NEVER** allow topic drift through keyword replacement

### 4.3 Sentence Replacement

- **IF** sentence replacement ratio > 40% **THEN** MUST fail with `SENTENCE_REPLACEMENT_EXCEEDED`
- **MUST NEVER** allow complete paragraph rewrites

### 4.4 CTA Detection

- **IF** CTA is added AND source had no CTA **THEN** MUST fail with `CTA_ADDED`
- **MUST NEVER** allow marketing pressure injection

### 4.5 Guard Thresholds (LOCKED)

| Metric | Threshold | Locked Value |
|--------|-----------|--------------|
| MAX_LENGTH_RATIO | Maximum output/source length | 1.5 |
| MIN_KEYWORD_PRESERVATION_RATIO | Minimum keywords retained | 0.6 |
| MAX_SENTENCE_REPLACEMENT_RATIO | Maximum sentences replaced | 0.4 |

> **WARNING**: These thresholds are locked. Do NOT modify without explicit approval.

---

## 5. Failure Handling Invariants

### 5.1 Error Surfacing

- **MUST ALWAYS** return a `reasonCode` when execution fails
- **MUST NEVER** return success when any guard fails
- **MUST NEVER** swallow errors silently

### 5.2 User-Facing Messages

- **IF** failure has known reasonCode **THEN** MUST display mapped user message
- **MUST ALWAYS** provide both Vietnamese and English error messages
- **MUST NEVER** expose technical error details to end users

### 5.3 Retry Behavior

- **IF** failure is `retryable: true` **THEN** system MAY retry automatically
- **IF** failure is `retryable: false` **THEN** system MUST NOT retry
- **MUST NEVER** retry indefinitely (max attempts enforced)

### 5.4 Failure Classification

- **MUST ALWAYS** classify failures via `failureTaxonomy`
- **MUST ALWAYS** log `[FAILURE_CLASS]` in development mode
- **MUST NEVER** change failure classification without updating taxonomy

---

## 6. Request Binding Invariants

### 6.1 Hash Validation

- **IF** `uiInputHash` does not match computed hash **THEN** MUST fail with `BINDING_MISMATCH`
- **MUST NEVER** execute requests with mismatched binding

### 6.2 Single Call Site

- **MUST ALWAYS** route all LLM calls through `llmExecutor.ts`
- **MUST NEVER** call LLM API from any other location
- **MUST ALWAYS** require valid `AuthorizationToken` for execution

---

## 7. Answer Engine Detection Invariants

### 7.1 Task Type Detection

- **IF** user has active draft AND requests rewrite **THEN** task type MUST be `REWRITE_UPGRADE`
- **IF** user has no draft AND requests creation **THEN** task type MUST be `CREATE`
- **IF** user asks question about content **THEN** task type MUST be `QA`
- **IF** user requests partial edit with scope **THEN** task type MUST be `EDIT_PATCH`

### 7.2 Detection Consistency

- **MUST ALWAYS** detect task type before execution
- **MUST NEVER** change task type mid-execution
- **MUST ALWAYS** format contract appropriate to detected task type

---

## 8. Observability Invariants

### 8.1 DEV Logging

- **MUST ALWAYS** log `[LLMExecutor] Decision:` in development mode
- **MUST ALWAYS** log `[FAILURE_CLASS]` for failures in development mode
- **MUST NEVER** log sensitive content (only metadata/lengths)

### 8.2 Log Format Stability

- **MUST NEVER** change log format without updating debug playbook
- **MUST ALWAYS** include `reasonCode` in failure logs

---

## Invariant Change Protocol

To modify any invariant:

1. **Document** the proposed change in a PR description
2. **Update** this document with the new invariant
3. **Update** corresponding regression tests
4. **Update** failure taxonomy if failure codes change
5. **Update** debug playbook if debugging steps change
6. **Get explicit approval** from system owner

---

*Last updated: Step 25 - System Invariants & Regression Lock*
