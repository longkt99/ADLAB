# AdLab D5.2 Human Override Policy

**Version:** D5.2
**Date:** 2024-12-28
**Status:** FREEZE OVERRIDE GOVERNANCE

---

## 1. Purpose

This document defines when and how humans may break the D4 Product Freeze.

The freeze exists to protect system stability. Overrides are exceptional, documented, and reversible.

---

## 2. What Counts as an Emergency

### 2.1 Valid Emergency Conditions

| Condition | Classification | Override Permitted |
|-----------|----------------|-------------------|
| SCHEMA_CONTRACT_VIOLATION in production | P0 Emergency | YES |
| All AdLab pages returning 500 errors | P0 Emergency | YES |
| Data corruption affecting alerts | P0 Emergency | YES |
| Security vulnerability discovered | P0 Emergency | YES |
| Mutations causing data loss | P0 Emergency | YES |

### 2.2 NOT Emergency Conditions

| Condition | Classification | Override Permitted |
|-----------|----------------|-------------------|
| Feature request | Normal work | NO |
| Performance optimization | Normal work | NO |
| UI preference change | Normal work | NO |
| Single user report of issue | Investigate first | NO |
| Copy/text change request | Normal work | NO |
| New feature urgently needed | Normal work | NO |

### 2.3 Emergency Threshold

An emergency exists when:

1. Production system is DOWN or DEGRADED for users, AND
2. The issue cannot be resolved without breaking freeze, AND
3. Rollback is not possible or would cause greater harm

If ANY of these conditions is false, it is NOT an emergency.

---

## 3. Authority Structure

### 3.1 Who Has Authority

| Role | Authority Level | Can Authorize |
|------|-----------------|---------------|
| Schema Owner | Schema changes only | Schema override |
| Query Owner | Query changes only | Query override |
| UX Owner | UI changes only | UI override |
| Production Lead | All changes | Any override |
| On-call Developer | Emergency only | Emergency override (with documentation) |

### 3.2 Authorization Requirements

| Override Type | Minimum Authority | Second Approval |
|---------------|-------------------|-----------------|
| Schema change | Schema Owner | Production Lead |
| Query signature change | Query Owner | Production Lead |
| Route change | UX Owner | Production Lead |
| Emergency (after hours) | On-call Developer | Document within 4h |

### 3.3 Single-Person Override

Permitted ONLY when:
- It is after-hours emergency
- No second approver reachable within 30 minutes
- Delay would cause continued user harm
- Full documentation completed within 4 hours

---

## 4. Required Documentation BEFORE Override

### 4.1 Pre-Override Checklist

Complete BEFORE making any change:

| Item | Required | Documentation |
|------|----------|---------------|
| Emergency confirmed | YES | Written statement of emergency |
| Rollback impossible | YES | Explanation why rollback won't work |
| Authority obtained | YES | Name of authorizer |
| Change scope defined | YES | Exact change to be made |
| Risk assessment | YES | What could go wrong |
| Rollback plan for change | YES | How to undo the override |

### 4.2 Pre-Override Form

```
## Override Authorization Request

**Date/Time:**
**Requestor:**
**Authorizer:**

### Emergency Description
[What is broken and why is it an emergency]

### Why Rollback Won't Work
[Explanation]

### Proposed Change
- Type: [ ] Schema [ ] Query [ ] Route [ ] UI [ ] Other
- Specific change: [Exact description]
- Files affected: [List files]

### Risk Assessment
[What could go wrong with this change]

### Rollback Plan
[How to undo this change if it fails]

### Authorization
[ ] Approved by: _____________ at _____________
```

---

## 5. Required Documentation AFTER Override

### 5.1 Post-Override Requirements

Complete within 4 hours of override:

| Item | Required | Deadline |
|------|----------|----------|
| Incident report | YES | 4 hours |
| Change log | YES | Immediate |
| Contract update | YES | 24 hours |
| Root cause analysis | YES | 48 hours |
| Prevention plan | YES | 1 week |

### 5.2 Post-Override Form

```
## Override Completion Report

**Date/Time of Override:**
**Override Performed By:**
**Authorization Reference:**

### Change Made
[Exact change that was made]

### Files Modified
- [File 1]
- [File 2]

### Verification
[ ] Change verified working
[ ] No new errors introduced
[ ] Monitoring confirmed stable

### Contract Updates Required
[ ] ADLAB_SCHEMA_CONTRACT.md updated
[ ] ADLAB_FREEZE_D4.md updated
[ ] ADLAB_BEHAVIOR_LOCK.md updated
[ ] Other: _____________

### Root Cause
[What caused the emergency]

### Prevention
[What will prevent this from happening again]

### Follow-Up Actions
- [ ] Action 1
- [ ] Action 2
```

---

## 6. Mandatory Follow-Up Actions

### 6.1 Immediate (Within 4 Hours)

| Action | Owner | Verification |
|--------|-------|--------------|
| Document the override | Override performer | Form completed |
| Notify stakeholders | Override performer | Notification sent |
| Verify system stable | On-call | Monitoring confirms |

### 6.2 Short-Term (Within 48 Hours)

| Action | Owner | Verification |
|--------|-------|--------------|
| Root cause analysis | Developer | Document completed |
| Contract updates | Schema/Query Owner | Documents updated |
| Review with team | Production Lead | Meeting held |

### 6.3 Long-Term (Within 1 Week)

| Action | Owner | Verification |
|--------|-------|--------------|
| Prevention plan | Team | Plan documented |
| Process improvement | Production Lead | Process updated if needed |
| Verification tests | QA | Tests added if applicable |

---

## 7. Scenarios Where Override Is FORBIDDEN

### 7.1 Never Override For

| Scenario | Reason | Alternative |
|----------|--------|-------------|
| New feature request | Not an emergency | Wait for D5+ |
| Performance improvement | Not an emergency | Schedule normally |
| UI redesign | Not an emergency | Schedule normally |
| "Urgent" business request | Not a technical emergency | Prioritize normally |
| Convenience | Not an emergency | Follow process |
| Demo preparation | Not an emergency | Plan ahead |
| Single user complaint | Investigate first | Verify issue |

### 7.2 Absolute Prohibitions

| Action | Status | No Exceptions |
|--------|--------|---------------|
| Drop table | FORBIDDEN | Never |
| Delete user data | FORBIDDEN | Never |
| Disable RLS | FORBIDDEN | Never |
| Remove error handling | FORBIDDEN | Never |
| Skip documentation | FORBIDDEN | Never |

---

## 8. Override Audit Trail

### 8.1 Audit Requirements

All overrides MUST be tracked:

| Tracking Item | Required | Location |
|---------------|----------|----------|
| Pre-override form | YES | Incident documentation |
| Post-override form | YES | Incident documentation |
| Git commit message | YES | Must reference override |
| Contract update | YES | Relevant .md files |

### 8.2 Audit Review

| Review | Frequency | Reviewer |
|--------|-----------|----------|
| Individual override | Within 48h | Production Lead |
| Override patterns | Monthly | Team |
| Process effectiveness | Quarterly | Leadership |

---

## 9. Escalation Path

### 9.1 During Business Hours

```
On-call Developer
       ↓
 Query/Schema Owner (as appropriate)
       ↓
  Production Lead
       ↓
  Leadership (if policy unclear)
```

### 9.2 After Hours

```
On-call Developer (can authorize emergency override)
       ↓
Production Lead (notify within 30 min if possible)
       ↓
Document within 4 hours regardless
```

---

## 10. Override Decision Tree

```
Is production DOWN or DEGRADED?
├── NO → Not an emergency. Follow normal process.
└── YES ↓

Can issue be resolved by ROLLBACK?
├── YES → Rollback. No override needed.
└── NO ↓

Can issue wait until business hours?
├── YES → Wait. No override needed.
└── NO ↓

Is change within your authority?
├── NO → Escalate to appropriate owner.
└── YES ↓

Have you completed pre-override documentation?
├── NO → Complete documentation first.
└── YES ↓

PROCEED WITH OVERRIDE
Document within 4 hours.
```

---

## 11. Examples

### 11.1 Valid Override

**Situation:** Production shows SCHEMA_CONTRACT_VIOLATION. ads.first_seen_at column is missing. All /ads/ads and /ads/ad-sets pages fail.

**Decision:** Emergency. Override permitted.

**Action:**
1. Complete pre-override form
2. Get authorization (Schema Owner or Production Lead)
3. Apply: `ALTER TABLE ads ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT NOW();`
4. Verify fix
5. Complete post-override documentation
6. Update ADLAB_SCHEMA_CONTRACT.md
7. Root cause: why was column missing?

### 11.2 Invalid Override Request

**Situation:** Product manager requests urgent addition of new filter option for alerts page.

**Decision:** NOT an emergency. Production is working. This is a feature request.

**Action:** Decline override. Schedule for normal D5+ work.

### 11.3 Borderline Case

**Situation:** Single user reports they cannot see their alerts. Investigation shows RLS_DENIED.

**Decision:** Investigate first. If user should have access, check RLS policy. If RLS policy is wrong, this may be an emergency affecting multiple users. If user should NOT have access, system working correctly.

**Action:** Investigate before deciding on override.

---

## Document Control

| Version | Date | Change |
|---------|------|--------|
| D5.2 | 2024-12-28 | Initial override policy |
