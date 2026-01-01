# AdLab D5.2 Incident Response Guide

**Version:** D5.2
**Date:** 2024-12-28
**Status:** PRODUCTION INCIDENT HANDLING

---

## 1. Incident Response Matrix

This matrix maps directly from the D5.1 Error Taxonomy. Every error has a defined response.

### 1.1 Complete Error Response Table

| Error Code | Trigger Condition | User Visibility | Logging | Human Action | Role | SLA | Escalation |
|------------|-------------------|-----------------|---------|--------------|------|-----|------------|
| DATA_ABSENT_EXPECTED | Query returns empty where empty is valid | AdLabEmptyState shown | DEBUG | NO | - | - | - |
| DATA_ABSENT_UNEXPECTED | Query returns empty where data expected | AdLabEmptyState + hint | INFO | MONITOR | Operator | 24h review | If pattern persists |
| QUERY_FAILURE | Supabase returns error | AdLabErrorBox shown | ERROR | YES | Developer | 1h | If unresolved in 2h |
| RLS_DENIED | Permission denied error | AdLabErrorBox + hint | WARN | INVESTIGATE | Developer | 4h | If affects multiple users |
| SCHEMA_CONTRACT_VIOLATION | Table/column does not exist | AdLabErrorBox shown | CRITICAL | IMMEDIATE | Developer | 15min | Immediate escalation |
| ORDER_BY_SAFETY_RISK | NULL in ORDER BY column | Silent (degraded sort) | ERROR | YES | Developer | 4h | If data integrity risk |
| REFERENCE_ORPHANED | FK points to deleted entity | "—" displayed | INFO | MONITOR | Operator | 24h review | If frequent |
| UNKNOWN_RUNTIME_ERROR | Unclassified exception | Generic error shown | ERROR | YES | Developer | 1h | If unresolved in 2h |

---

## 2. Error Class Details

### 2.1 DATA_ABSENT_EXPECTED

**Definition:** System correctly shows empty state for legitimately empty data.

| Aspect | Specification |
|--------|---------------|
| Trigger | Query returns `{ data: [], count: 0, error: null }` in valid context |
| Examples | New workspace with no alerts, filtered view with no matches |
| User sees | AdLabEmptyState with contextual explanation |
| Log level | DEBUG |
| Human action | NONE |
| Response | No action required |

### 2.2 DATA_ABSENT_UNEXPECTED

**Definition:** Empty data where context suggests data should exist.

| Aspect | Specification |
|--------|---------------|
| Trigger | Empty result after known data ingestion, all counts zero unexpectedly |
| Examples | Alert trace missing all entities, overview shows 0 after import |
| User sees | AdLabEmptyState or "—" indicators |
| Log level | INFO |
| Human action | MONITOR for patterns |
| Response | Review logs within 24h, investigate if pattern emerges |
| Escalation | If >10 occurrences in 1h, escalate to Developer |

### 2.3 QUERY_FAILURE

**Definition:** Supabase query returned an error.

| Aspect | Specification |
|--------|---------------|
| Trigger | Supabase returns `{ error: { message: '...' } }` |
| Examples | Network timeout, database unavailable, syntax error |
| User sees | AdLabErrorBox: "Unable to load data. Please try again." |
| Log level | ERROR |
| Human action | YES - investigate root cause |
| Response | Check Supabase status, verify connectivity, review query |
| SLA | Acknowledge within 1h |
| Escalation | If unresolved in 2h, escalate to senior developer |

**Response Steps:**
1. Check Supabase dashboard for outages
2. Verify database connectivity
3. Check error logs for specific query failure
4. If transient, monitor for recurrence
5. If persistent, investigate query or schema issue

### 2.4 RLS_DENIED

**Definition:** Row Level Security blocked data access.

| Aspect | Specification |
|--------|---------------|
| Trigger | Error contains "permission denied" or RLS indicator |
| Examples | User accessing data outside their workspace |
| User sees | AdLabErrorBox: "You don't have access to this content." |
| Log level | WARN |
| Human action | INVESTIGATE if unexpected |
| Response | Verify RLS policies, check user workspace assignment |
| SLA | Review within 4h |
| Escalation | If affects multiple users, escalate immediately |

**Response Steps:**
1. Verify user should have access to requested data
2. If user should have access, check RLS policy configuration
3. If user should NOT have access, no action (working as intended)
4. Document false positives for policy review

### 2.5 SCHEMA_CONTRACT_VIOLATION

**Definition:** Query referenced non-existent table or column. HIGHEST SEVERITY.

| Aspect | Specification |
|--------|---------------|
| Trigger | Error contains "relation does not exist" or "column does not exist" |
| Examples | Migration not applied, schema drift, table dropped |
| User sees | AdLabErrorBox: "Unable to load data." |
| Log level | CRITICAL |
| Human action | IMMEDIATE response required |
| Response | Stop all deployments, verify schema, apply missing migration |
| SLA | Acknowledge within 15 minutes |
| Escalation | Immediate escalation to schema owner |

**Response Steps:**
1. STOP any ongoing deployments
2. Run schema verification queries from Deployment Playbook
3. Identify missing table/column
4. Apply 007_adlab_full_schema.sql if tables missing
5. Verify fix with schema verification queries
6. Resume normal operations
7. Document root cause

**This is a P0 incident. All other work stops.**

### 2.6 ORDER_BY_SAFETY_RISK

**Definition:** ORDER BY column contains NULL values, causing unpredictable sort.

| Aspect | Specification |
|--------|---------------|
| Trigger | NULL detected in first_seen_at, created_at, or date columns |
| Examples | Data inserted without defaults, migration incomplete |
| User sees | Results may appear in wrong order (silent degradation) |
| Log level | ERROR |
| Human action | YES - data cleanup required |
| Response | Identify NULL records, apply default values |
| SLA | Fix within 4h |
| Escalation | If affects data integrity, escalate immediately |

**Response Steps:**
1. Query for NULL values in ORDER BY columns
2. Apply default values (NOW() for timestamps)
3. Verify sort order restored
4. Investigate how NULLs were inserted
5. Add data validation if source identified

### 2.7 REFERENCE_ORPHANED

**Definition:** Foreign key points to deleted entity.

| Aspect | Specification |
|--------|---------------|
| Trigger | FK lookup returns null for non-null ID |
| Examples | Alert references deleted campaign, ad_set, or ad |
| User sees | "—" displayed in place of entity name |
| Log level | INFO |
| Human action | MONITOR for frequency |
| Response | Log occurrence, review if pattern emerges |
| SLA | Review within 24h |
| Escalation | If >50 occurrences per day, investigate cascade policies |

**Response Steps:**
1. Log orphaned reference (source_id, target_table, target_id)
2. No immediate action required (graceful degradation working)
3. Review daily for patterns
4. If frequent, investigate why entities are deleted without cascade

### 2.8 UNKNOWN_RUNTIME_ERROR

**Definition:** Exception that doesn't match any known pattern.

| Aspect | Specification |
|--------|---------------|
| Trigger | Caught exception without known error pattern |
| Examples | Unexpected code path, edge case, third-party failure |
| User sees | "Something went wrong. Please refresh the page." |
| Log level | ERROR |
| Human action | YES - classify and add to taxonomy |
| Response | Investigate, classify error, update taxonomy if new pattern |
| SLA | Acknowledge within 1h |
| Escalation | If unresolved in 2h, escalate to senior developer |

**Response Steps:**
1. Review error logs for stack trace and context
2. Attempt to reproduce
3. Classify error (is it a known type with wrong pattern matching?)
4. If new error type, add to taxonomy
5. Fix root cause or add specific handling

---

## 3. Silent Errors

These errors are logged but not shown to users.

| Error | Why Silent | Logging Requirement | Monitoring |
|-------|------------|---------------------|------------|
| ORDER_BY_SAFETY_RISK | Graceful degradation preferred | ERROR level, always | Alert if >10/hour |
| REFERENCE_ORPHANED (low frequency) | Expected in normal operation | INFO level | Review daily |

**Rule:** Silent does not mean ignored. All silent errors must be logged and reviewed.

---

## 4. Blocking Errors

These errors stop user progression and require attention.

| Error | Why Blocking | User Message | Required Action |
|-------|--------------|--------------|-----------------|
| QUERY_FAILURE | Cannot display data | "Unable to load data. Please try again." | Investigate within 1h |
| SCHEMA_CONTRACT_VIOLATION | System integrity compromised | "Unable to load data." | Immediate fix required |
| UNKNOWN_RUNTIME_ERROR | Unknown failure mode | "Something went wrong." | Investigate within 1h |

**Rule:** Blocking errors always show AdLabErrorBox. User is never left with blank screen.

---

## 5. Schema Contract Violations

Special handling for highest severity errors.

### 5.1 Immediate Actions

| Step | Action | Owner | Timeframe |
|------|--------|-------|-----------|
| 1 | Log CRITICAL error with full context | Automatic | Immediate |
| 2 | Alert on-call developer | Automatic/Manual | Within 5 min |
| 3 | Stop any ongoing deployments | Operator | Within 10 min |
| 4 | Run schema verification queries | Developer | Within 15 min |
| 5 | Apply corrective migration | Developer | Within 30 min |
| 6 | Verify fix | Developer | Within 45 min |
| 7 | Resume operations | Operator | After verification |

### 5.2 Root Cause Categories

| Cause | Likelihood | Prevention |
|-------|------------|------------|
| Migration not applied | HIGH | Pre-deployment verification |
| Migration partially applied | MEDIUM | Idempotent migrations |
| Manual schema change | LOW | Freeze contract enforcement |
| Database restore to old state | LOW | Backup verification |

---

## 6. Unknown Runtime Errors

Fail-loud strategy for unclassified exceptions.

### 6.1 Handling Rules

| Rule | Specification |
|------|---------------|
| Always log | Full error with stack trace (server-side only) |
| Always show error UI | Never silent fail |
| Always investigate | Every unknown error gets reviewed |
| Always classify | Add to taxonomy after investigation |

### 6.2 Classification Process

| Step | Action |
|------|--------|
| 1 | Review error message and stack trace |
| 2 | Identify component and operation |
| 3 | Determine if matches existing taxonomy |
| 4 | If match, fix pattern matching |
| 5 | If new, add to taxonomy with proper handling |
| 6 | Update D5.1 Observability document |

---

## 7. Incident Severity Levels

| Level | Definition | Examples | Response Time |
|-------|------------|----------|---------------|
| P0 | System unusable | SCHEMA_CONTRACT_VIOLATION | 15 min |
| P1 | Major feature broken | QUERY_FAILURE on all pages | 1 hour |
| P2 | Feature degraded | Single page failing | 4 hours |
| P3 | Minor issue | Orphaned references | 24 hours |
| P4 | Cosmetic/monitoring | Logging gaps | Next sprint |

---

## 8. Incident Documentation Template

Use this template for all P0-P2 incidents.

```
## Incident Report

**Date/Time:**
**Severity:** P0 / P1 / P2
**Error Code:**
**Duration:**
**Affected Pages:**

### Summary
[One sentence description]

### Timeline
- [Time] - Issue detected
- [Time] - Investigation started
- [Time] - Root cause identified
- [Time] - Fix applied
- [Time] - Verification complete
- [Time] - Incident closed

### Root Cause
[Technical explanation]

### Resolution
[What was done to fix]

### Prevention
[What will prevent recurrence]

### Action Items
- [ ] Item 1
- [ ] Item 2
```

---

## Document Control

| Version | Date | Change |
|---------|------|--------|
| D5.2 | 2024-12-28 | Initial incident response guide |
