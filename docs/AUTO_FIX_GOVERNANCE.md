# Auto Fix Governance

> Internal governance framework for Auto Fix changes.
> This document defines what is allowed, what is forbidden, and how decisions are made.
> It applies to all contributors: human and AI.

---

## Governing Authority

Auto Fix is governed by three documents in order of precedence:

1. **AUTO_FIX_PRODUCT_CONTRACT.md** — Defines what Auto Fix is and is not
2. **AUTO_FIX_KILL_SWITCH.md** — Defines when Auto Fix must retreat or disappear
3. **AUTO_FIX_GOVERNANCE.md** — Defines how changes are evaluated (this document)

No change may contradict a higher-precedence document. Conflicts are resolved by rejection.

---

## Change Classification

All proposed changes to Auto Fix fall into one of four categories:

### Category A: Forbidden

Changes that violate the Product Contract or Kill Switch Protocol. These are rejected without discussion.

Examples:
- Adding auto-apply behavior
- Adding batch operations
- Adding persuasive copy
- Adding celebration UI
- Adding user-facing metrics
- Adding keyboard shortcuts
- Reducing preview-first requirement
- Removing undo capability
- Adding learning or memory
- Adding notifications outside Studio

**Decision: Reject immediately.**

---

### Category B: Restricted

Changes that touch core trust surfaces. These require explicit justification and Product Owner approval.

Surfaces:
- Similarity thresholds
- Prompt construction logic
- Re-evaluation behavior
- Undo timing window
- Kill switch conditions
- Trust metric definition

**Decision: Require written justification. Require Product Owner sign-off. Default to reject if ambiguous.**

---

### Category C: Permitted

Changes that improve internal quality without affecting user experience or trust model.

Examples:
- Code refactoring with no behavioral change
- Performance optimization
- Logging improvements (non-user-facing)
- Test coverage expansion
- Documentation updates (internal)

**Decision: Standard review process. No special approval required.**

---

### Category D: Expansion

Changes that extend Auto Fix to new surfaces, intents, or capabilities. These are frozen until trust is proven.

Examples:
- Supporting new intent types
- Adding Auto Fix to new UI surfaces
- Increasing attempt limits
- Relaxing similarity requirements

**Decision: Blocked by default. Requires trust metric validation (≥90% kept rate, sustained 30+ days) and Product Owner approval.**

---

## Rejection Rules

A change is automatically rejected if any of the following are true:

| Condition | Rationale |
|-----------|-----------|
| Adds user-facing copy that implies system authority | Violates "user decides" principle |
| Increases visibility of Auto Fix without user action | Violates "suggestion, not promotion" |
| Reduces friction to apply changes | Violates "intentional review" requirement |
| Adds feedback loops based on user behavior | Violates "no learning" principle |
| Requires explanation of Auto Fix behavior to user | Violates "silence over persuasion" |
| Creates dependency between Auto Fix and other features | Violates isolation principle |
| Adds configuration or settings for Auto Fix | Violates "no user-adjustable behavior" |
| Changes behavior during kill switch state | Violates retreat protocol |

---

## Decision Logic

```
1. Does change contradict Product Contract?
   → YES: Reject (Category A)
   → NO: Continue

2. Does change touch trust surfaces?
   → YES: Require justification + PO approval (Category B)
   → NO: Continue

3. Does change expand Auto Fix scope?
   → YES: Check trust metrics
     → Metrics not met: Reject (Category D blocked)
     → Metrics met: Require PO approval
   → NO: Continue

4. Is change internal-only with no behavioral impact?
   → YES: Standard review (Category C)
   → NO: Re-evaluate classification
```

---

## Escalation Path

| Situation | Action |
|-----------|--------|
| Unclear classification | Default to Category B (restricted) |
| Disagreement on rejection | Product Owner decides; default is reject |
| Emergency fix needed | Category C rules apply; behavioral changes still require approval |
| Trust metrics disputed | Engineering provides data; Product interprets; default is conservative |

---

## Amendment Process

This document may be amended only under these conditions:

1. Product Owner explicitly requests amendment
2. Amendment does not weaken any protection
3. Amendment is documented with rationale
4. Previous version is preserved in version control

Amendments that weaken protections require executive approval.

---

## Compliance Verification

All Auto Fix changes must pass the **AUTO_FIX_CHANGE_CHECKLIST.md** before merge.

Reviewers are responsible for verifying checklist completion.

Incomplete checklists result in automatic rejection.

---

## Doctrine

**Auto Fix changes are guilty until proven safe.**

The burden of proof is on the change, not the reviewer.
When in doubt, reject.
