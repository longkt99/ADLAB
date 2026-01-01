# D10 — Production Pre-Mortem & Failure Scenarios

**Version:** 1.0
**Date:** 2024-12-29
**Status:** PRE-LAUNCH RISK LOCK
**Scope:** Ingestion system only
**Prerequisites:** D6.6 (Runtime), D7 (Launch), D8 (Runbook), D9 (Ownership)

**Constraints:**
- NO schema changes
- NO new workers
- NO new features
- Must align strictly with D6.6 Runtime, D7 Launch, D8 Runbook, D9 Ownership

---

## 1. Purpose

This document assumes **the system has already failed in production**.

The goal is to:
- Enumerate realistic failure scenarios
- Identify *early detection signals*
- Define *first 15–30 minute actions*
- Confirm ownership and kill-switch authority
- Ensure failures degrade safely, not silently

This document does NOT propose fixes or architecture changes.

---

## 2. Failure Classification

Failures are grouped into 5 categories:

1. Data Integrity Failures
2. Silent Partial Failures
3. Operational & Human Errors
4. Scaling & Load Failures
5. Control Plane Failures

Each scenario includes:
- Trigger
- Blast radius
- Detection signal
- First response
- Hard stop condition

---

## 3. Data Integrity Failures

### D10-01 — Silent Metric Corruption

**Scenario:**
Spend / impressions ingested successfully but values are shifted or duplicated.

**Detection Signals:**
- Sudden metric deltas > ±30% day-over-day
- Client reports mismatch vs source platform

**First 15 Minutes:**
- Freeze promotion worker
- Identify affected `data_upload_id`
- Validate staging vs promoted row counts

**Hard Stop:**
- Kill-switch: INGESTION_ENABLED = false (global)

**Owner:** Ingestion Owner

---

### D10-02 — Partial Promotion (Split State)

**Scenario:**
Rows promoted for some campaigns but not others within same upload.

**Detection Signals:**
- promoted_rows < parsed_rows
- ingestion status = partial

**First 15 Minutes:**
- Block re-runs for same upload
- Notify Support Lead
- Preserve staging rows

**Hard Stop:**
- Do NOT auto-retry promotion

**Owner:** On-Call Primary

---

## 4. Silent Partial Failures

### D10-03 — Worker Appears Healthy but Skips Rows

**Scenario:**
ParseWorker runs but silently skips malformed rows.

**Detection Signals:**
- processed_rows < total_rows without errors
- mismatch between file row_count and staging inserts

**First Response:**
- Pause worker
- Audit logs for skipped rows
- Treat as DATA LOSS incident

**Hard Stop:**
- No further uploads accepted until resolved

**Owner:** Ingestion Owner

---

### D10-04 — Alert Rules Misfire (False Negatives)

**Scenario:**
Alerts fail to trigger due to missing demographic dimensions.

**Detection Signals:**
- Zero alerts over extended abnormal period

**First Response:**
- Acknowledge as ACCEPTED UNKNOWN
- Document impact
- No runtime change

**Hard Stop:**
- NONE (non-blocking by D6.5)

**Owner:** Product Manager (awareness only)

---

## 5. Operational & Human Errors

### D10-05 — Manual Kill-Switch Abuse

**Scenario:**
Kill-switch toggled without incident justification.

**Detection Signals:**
- Kill-switch change without incident ID

**First Response:**
- Immediate rollback
- Escalate to SRE Lead

**Hard Stop:**
- Suspend kill-switch privileges temporarily

**Owner:** SRE Lead

---

### D10-06 — On-Call Misses Incident

**Scenario:**
Alert fires but no response within SLA.

**Detection Signals:**
- Alert unacknowledged > 15 minutes

**First Response:**
- Escalate to Secondary
- Notify PM

**Hard Stop:**
- Auto-pause ingestion if error rate rising

**Owner:** Secondary On-Call → Ingestion Owner

---

## 6. Scaling & Load Failures

### D10-07 — Upload Spike Overwhelms System

**Scenario:**
Multiple clients upload near simultaneously.

**Detection Signals:**
- Queue depth > concurrency limit
- Parse latency > 5 minutes

**First Response:**
- Throttle new uploads
- Allow in-flight jobs to complete

**Hard Stop:**
- Reject new uploads with retry guidance

**Owner:** On-Call Primary

---

### D10-08 — Staging Table Bloat

**Scenario:**
Staging rows not cleaned due to partial failures.

**Detection Signals:**
- Staging row count > 500K
- Staging row age > 7 days

**First Response:**
- Pause ingestion
- Manual cleanup using D8 procedure

**Hard Stop:**
- No automatic deletes without review

**Owner:** SRE Lead

---

## 7. Control Plane Failures

### D10-09 — Kill-Switch Fails to Apply

**Scenario:**
Kill-switch set but workers continue processing.

**Detection Signals:**
- State transitions continue after pause

**First Response:**
- Manual worker shutdown
- Database-level locks

**Hard Stop:**
- Incident P1, all ingestion halted

**Owner:** SRE Lead + Ingestion Owner

---

### D10-10 — State Machine Stuck

**Scenario:**
Upload stuck in `processing` > SLA.

**Detection Signals:**
- State unchanged > 30 minutes

**First Response:**
- Manual state inspection
- Decide resume vs abort

**Hard Stop:**
- Never force promote

**Owner:** On-Call Primary

---

## 8. Decision Matrix (First 30 Minutes)

| Condition | Action | Authority |
|-----------|--------|-----------|
| Data incorrect | PAUSE | On-Call |
| Data missing | PAUSE | On-Call |
| Data duplicated | PAUSE | On-Call |
| Alert noisy | MONITOR | On-Call |
| Alert silent | DOCUMENT | PM |
| Worker unhealthy | STOP | On-Call |
| Ownership unclear | STOP | Escalate to Owner |

---

## 9. Failure Response Checklist

```
□ Identify failure category (Section 2)
□ Locate specific scenario (D10-01 through D10-10)
□ Confirm detection signal matches
□ Execute first response actions
□ Determine if hard stop required
□ Notify owner per D9 escalation
□ Document in #ingestion-rollout
□ Update incident timeline
```

---

## 10. Pre-Mortem Conclusion

Assuming failure is not pessimism — it is operational maturity.

This system is allowed to:
- Fail loudly
- Fail early
- Fail safely

It is NOT allowed to:
- Fail silently
- Corrupt data
- Guess correctness

All scenarios above are considered **accepted operational risks** with defined responses.

---

## 11. Document Control

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2024-12-29 | Initial pre-mortem |

---

## 12. Sign-Off

| Role | Approval | Date |
|------|----------|------|
| Ingestion Owner | | |
| SRE Lead | | |
| Product Manager | | |

D10 confirms the system is **production-ready with eyes open**.
