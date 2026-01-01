# Auto Fix Change Checklist

> Mandatory pre-merge checklist for all Auto Fix changes.
> If any item is unchecked, the change is rejected by default.
> No exceptions. No "we'll fix it later." No partial passes.

---

## Instructions

1. Complete this checklist before requesting review
2. Reviewer must independently verify each item
3. Any "No" answer blocks the merge
4. Any "Unclear" answer blocks the merge
5. Checklist must be included in PR description

---

## Section 1: User Ownership

These items protect the principle that the user controls Auto Fix, not the reverse.

| # | Check | Question |
|---|-------|----------|
| 1.1 | ☐ | Does the user still see a full preview before any content is modified? |
| 1.2 | ☐ | Is the undo option still available for 5 seconds after apply? |
| 1.3 | ☐ | Does the user still make the final decision to apply or reject? |
| 1.4 | ☐ | Is Auto Fix still triggered only by explicit user action (button click)? |
| 1.5 | ☐ | Are there zero new ways for Auto Fix to activate without user intent? |
| 1.6 | ☐ | Does the change avoid creating keyboard shortcuts for Auto Fix? |
| 1.7 | ☐ | Does the change avoid batch operations ("apply all", "fix all")? |

**If any item is unchecked:** REJECT — User ownership is non-negotiable.

---

## Section 2: Silence Over Persuasion

These items protect the principle that Auto Fix suggests without arguing.

| # | Check | Question |
|---|-------|----------|
| 2.1 | ☐ | Does Auto Fix remain silent when the user chooses to keep the original? |
| 2.2 | ☐ | Is there zero new copy that implies the original was wrong or inferior? |
| 2.3 | ☐ | Is there zero new copy that celebrates when the user applies a fix? |
| 2.4 | ☐ | Is there zero new copy that recommends, encourages, or nudges toward Auto Fix? |
| 2.5 | ☐ | Does the change avoid adding "Would you like to..." or "Try Auto Fix" prompts? |
| 2.6 | ☐ | Does the change avoid adding explanations of why Auto Fix exists or works? |
| 2.7 | ☐ | Does the change avoid adding success metrics visible to the user? |
| 2.8 | ☐ | Does the change avoid adding animations, badges, or visual rewards? |

**If any item is unchecked:** REJECT — Silence is the product.

---

## Section 3: Retreat Over Explanation

These items protect the principle that Auto Fix disappears when trust fails.

| # | Check | Question |
|---|-------|----------|
| 3.1 | ☐ | If the change affects kill switch behavior, does it make retreat stricter, not looser? |
| 3.2 | ☐ | Does the change avoid adding "temporarily unavailable" or similar messaging? |
| 3.3 | ☐ | Does the change avoid adding tooltips or hints when Auto Fix is disabled? |
| 3.4 | ☐ | Does the change avoid logging kill state to user-visible surfaces? |
| 3.5 | ☐ | If Auto Fix fails, does it still simply disappear without apology? |
| 3.6 | ☐ | Does the change avoid adding "try again later" or retry prompts? |
| 3.7 | ☐ | Does the change avoid A/B testing during kill periods? |

**If any item is unchecked:** REJECT — Failure must be invisible.

---

## Section 4: Invisibility Over Adoption

These items protect the principle that Auto Fix earns trust through absence.

| # | Check | Question |
|---|-------|----------|
| 4.1 | ☐ | Does the change avoid adding Auto Fix to new UI surfaces? |
| 4.2 | ☐ | Does the change avoid adding notifications about Auto Fix availability? |
| 4.3 | ☐ | Does the change avoid adding onboarding, tutorials, or feature tours for Auto Fix? |
| 4.4 | ☐ | Does the change avoid adding settings, preferences, or configuration for Auto Fix? |
| 4.5 | ☐ | Does the change avoid tracking or displaying usage statistics to users? |
| 4.6 | ☐ | Does the change avoid changelog entries that promote Auto Fix? |
| 4.7 | ☐ | If Auto Fix is mentioned in UI, is it purely functional (button label only)? |
| 4.8 | ☐ | Does the change avoid creating dependencies between Auto Fix and other features? |

**If any item is unchecked:** REJECT — Invisibility builds trust.

---

## Section 5: Scope Discipline

These items protect the principle that Auto Fix fixes only what Quality Lock flags.

| # | Check | Question |
|---|-------|----------|
| 5.1 | ☐ | Does Auto Fix still modify only the flagged content? |
| 5.2 | ☐ | Does the change avoid adding "improvement" or "enhancement" behavior? |
| 5.3 | ☐ | Does the change avoid adding rewriting, rephrasing, or style changes? |
| 5.4 | ☐ | Does the change avoid adding suggestions for unflagged content? |
| 5.5 | ☐ | Does the change avoid learning from user behavior or preferences? |
| 5.6 | ☐ | Does the change avoid memory or personalization? |

**If any item is unchecked:** REJECT — Scope creep destroys trust.

---

## Section 6: Classification Verification

Before merge, confirm the change category per AUTO_FIX_GOVERNANCE.md:

| # | Check | Verification |
|---|-------|--------------|
| 6.1 | ☐ | I have read AUTO_FIX_GOVERNANCE.md |
| 6.2 | ☐ | I have classified this change as: ______ (A/B/C/D) |
| 6.3 | ☐ | If Category B or D: Product Owner approval obtained (link: ______) |
| 6.4 | ☐ | If Category D: Trust metrics verified (≥90% kept rate, 30+ days) |
| 6.5 | ☐ | This change does not contradict AUTO_FIX_PRODUCT_CONTRACT.md |
| 6.6 | ☐ | This change does not contradict AUTO_FIX_KILL_SWITCH.md |

**If any item is unchecked:** REJECT — Governance is mandatory.

---

## Reviewer Attestation

```
Reviewer: _______________________
Date: _______________________

I have independently verified each item in this checklist.
I confirm that all items are checked YES.
I understand that approving an incomplete checklist is a governance violation.

☐ APPROVED FOR MERGE
☐ REJECTED (reason: _______________________)
```

---

## Rejection Log

If rejected, document the reason:

| Date | Reviewer | Failed Item(s) | Resolution |
|------|----------|----------------|------------|
| | | | |

---

## Doctrine

**When in doubt, reject.**

The burden of proof is on the change. The reviewer's job is to protect the user. A rejected change can be revised. A merged violation cannot be undone from users' minds.

---

## Reference

- [AUTO_FIX_PRODUCT_CONTRACT.md](./AUTO_FIX_PRODUCT_CONTRACT.md) — What Auto Fix is
- [AUTO_FIX_KILL_SWITCH.md](./AUTO_FIX_KILL_SWITCH.md) — When Auto Fix retreats
- [AUTO_FIX_GOVERNANCE.md](./AUTO_FIX_GOVERNANCE.md) — How changes are classified
- [AUTO_FIX_MICROCOPY_RULES.md](./AUTO_FIX_MICROCOPY_RULES.md) — Frozen UI copy

