# D9 — Production Roles, Ownership & On-Call Model

**Version:** 1.0
**Date:** 2024-12-29
**Status:** OPERATIONAL
**Prerequisites:** D8 (Runbook)

---

## 1. Role Definitions

### 1.1 Technical Roles

| Role | Responsibility | Authority |
|------|----------------|-----------|
| **Ingestion Owner** | End-to-end ingestion system health | Kill-switch, rollback, GA sign-off |
| **On-Call Primary** | First responder for incidents | Pause, escalate, page secondary |
| **On-Call Secondary** | Backup responder, escalation point | All primary authorities |
| **SRE Lead** | Infrastructure, monitoring, capacity | Circuit breaker reset, infra changes |
| **Database Owner** | Schema, queries, performance | Query optimization, index changes |

### 1.2 Business Roles

| Role | Responsibility | Authority |
|------|----------------|-----------|
| **Product Manager** | Feature prioritization, client comms | GA approval, client escalation |
| **Support Lead** | Client-facing issue triage | Ticket escalation, client updates |
| **Account Manager** | Client relationship | Client communication approval |

### 1.3 Role Assignments

| Role | Primary | Backup |
|------|---------|--------|
| Ingestion Owner | _____________ | _____________ |
| SRE Lead | _____________ | _____________ |
| Database Owner | _____________ | _____________ |
| Product Manager | _____________ | _____________ |
| Support Lead | _____________ | _____________ |

---

## 2. RACI Matrix

### 2.1 Ingestion Lifecycle

| Activity | Ingestion Owner | On-Call | SRE Lead | PM | Support |
|----------|-----------------|---------|----------|-------|---------|
| **Pre-Launch** |
| Day-0 checklist | A | R | C | I | I |
| Go/No-Go decision | A | C | C | R | I |
| Feature flag config | A | R | C | I | I |
| **Launch** |
| Enable kill-switch | A | R | I | I | I |
| Test upload | R | R | I | I | I |
| Launch announcement | A | I | I | R | C |
| **Steady State** |
| Hourly monitoring | I | R | C | I | I |
| Daily health review | A | R | C | I | I |
| Metrics review | A | C | R | I | I |
| **Incidents** |
| Acknowledge alert | I | R | C | I | I |
| Pause decision | A | R | C | I | I |
| Rollback decision | A | R | C | C | I |
| Client communication | C | I | I | A | R |
| Post-incident review | A | R | C | C | I |
| **GA** |
| GA criteria review | A | C | R | R | I |
| GA sign-off | A | I | R | R | I |
| GA announcement | I | I | I | A | R |

**Legend:** R = Responsible, A = Accountable, C = Consulted, I = Informed

### 2.2 Kill-Switch Actions

| Action | Can Execute | Must Approve | Must Notify |
|--------|-------------|--------------|-------------|
| Pause (< 1 hour) | On-Call | — | Ingestion Owner |
| Pause (> 1 hour) | On-Call | Ingestion Owner | PM |
| Resume | On-Call | Ingestion Owner | PM |
| Rollback | On-Call | Ingestion Owner | PM, SRE Lead |
| Global disable | On-Call | Ingestion Owner + SRE Lead | All stakeholders |

---

## 3. On-Call Rotation Model

### 3.1 Rotation Structure

| Tier | Coverage | Response Time | Escalation To |
|------|----------|---------------|---------------|
| Primary | 24/7 | 15 minutes | Secondary |
| Secondary | 24/7 | 30 minutes | Ingestion Owner |
| Ingestion Owner | Business hours + on-call | 1 hour | SRE Lead |

### 3.2 Rotation Schedule

| Week | Primary | Secondary |
|------|---------|-----------|
| Week 1 | _______ | _______ |
| Week 2 | _______ | _______ |
| Week 3 | _______ | _______ |
| Week 4 | _______ | _______ |

**Rotation cadence:** Weekly, handoff Monday 09:00 local time

### 3.3 Handoff Checklist

```
Outgoing On-Call:
□ Update #ingestion-rollout with status summary
□ Document any ongoing issues
□ Confirm incoming on-call is available
□ Transfer pager/alert routing

Incoming On-Call:
□ Review last 24h of alerts
□ Check current system status
□ Verify pager/alert receipt
□ Confirm contact info current
```

### 3.4 On-Call Expectations

| Expectation | Requirement |
|-------------|-------------|
| Availability | Reachable within 15 min |
| Laptop access | Required during on-call |
| VPN/access | Pre-verified before shift |
| Runbook familiarity | D8 reviewed before first shift |
| Escalation comfort | Escalate early, not late |

---

## 4. Incident Escalation Ladder

### 4.1 Severity Definitions

| Severity | Criteria | Examples |
|----------|----------|----------|
| **P1** | System down, data at risk, all clients affected | Circuit breaker OPEN > 5 min, data corruption, global failure |
| **P2** | Major degradation, multiple clients affected | Error rate > 20%, workspace-wide failures |
| **P3** | Minor issue, single client or limited impact | Single upload stuck, isolated errors |

### 4.2 Escalation Timeline

| Severity | 0-15 min | 15-30 min | 30-60 min | 60+ min |
|----------|----------|-----------|-----------|---------|
| **P1** | Primary acks | Secondary joins | Ingestion Owner joins | SRE Lead + PM |
| **P2** | Primary acks | Primary investigates | Secondary notified | Ingestion Owner if unresolved |
| **P3** | Primary acks | Primary resolves | — | Ticket if unresolved |

### 4.3 Escalation Paths

```
P1 ESCALATION PATH
──────────────────

Alert fires
    │
    ▼
Primary On-Call (15 min)
    │
    ├── Cannot resolve ──▶ Page Secondary
    │                          │
    │                          ▼
    │                     Secondary joins (15 min)
    │                          │
    │                          ├── Cannot resolve ──▶ Page Ingestion Owner
    │                          │                          │
    │                          │                          ▼
    │                          │                     Owner joins (30 min)
    │                          │                          │
    │                          │                          └── SRE Lead + PM (60 min)
    │                          │
    │                          └── Resolved ──▶ Post-incident
    │
    └── Resolved ──▶ Document + close


P2/P3 ESCALATION PATH
─────────────────────

Alert fires
    │
    ▼
Primary On-Call
    │
    ├── P2: Notify Secondary, continue investigating
    │       └── Escalate to Owner if unresolved > 1 hour
    │
    └── P3: Resolve or ticket
            └── No escalation unless client-facing
```

### 4.4 Escalation Contacts

| Role | Primary Contact | Backup Contact |
|------|-----------------|----------------|
| On-Call Primary | Pager: _______ | Phone: _______ |
| On-Call Secondary | Pager: _______ | Phone: _______ |
| Ingestion Owner | Phone: _______ | Slack DM |
| SRE Lead | Phone: _______ | Slack DM |
| PM | Slack: _______ | Email: _______ |

---

## 5. Kill-Switch Ownership & Approval

### 5.1 Kill-Switch Authority Matrix

| Scenario | Who Can Activate | Approval Required | Notification |
|----------|------------------|-------------------|--------------|
| Suspected data corruption | Anyone | None (activate first) | Immediate: All |
| Error rate > 20% | On-Call | None (activate first) | Within 5 min: Owner |
| Error rate > 10% | On-Call | Owner (within 15 min) | Within 15 min: PM |
| Planned maintenance | Owner | PM (24h advance) | 24h advance: All |
| Client request | Owner | PM | Immediate: Support |

### 5.2 Kill-Switch Activation Log

| Field | Required |
|-------|----------|
| Timestamp | Yes |
| Activated by | Yes |
| Reason | Yes |
| Severity | Yes |
| Scope (global/workspace) | Yes |
| Approval (if required) | Yes |
| Notification sent to | Yes |

**Log location:** #ingestion-rollout + incident doc

### 5.3 Kill-Switch Resume Authority

| Deactivation Scope | Resume Authority | Verification Required |
|--------------------|------------------|----------------------|
| < 1 hour pause | On-Call | Test upload passes |
| > 1 hour pause | Ingestion Owner | Test upload + metrics check |
| Rollback | Ingestion Owner + PM | Full P0 revalidation |
| Data integrity event | Ingestion Owner + SRE Lead + PM | Investigation complete |

---

## 6. GA and Rollback Sign-Off Authority

### 6.1 Phase Gate Approvers

| Gate | Required Approvers | Veto Power |
|------|-------------------|------------|
| P0 → P1 | Ingestion Owner | Any approver |
| P1 → P2 | Ingestion Owner, PM | Any approver |
| P2 → P3 | Ingestion Owner, PM | Any approver |
| P3 → P4 (GA) | Ingestion Owner, PM, SRE Lead | Any approver |

### 6.2 GA Sign-Off Requirements

```
GA APPROVAL REQUIRES ALL:

□ Ingestion Owner sign-off
  └── Confirms: Technical criteria met, system stable

□ Product Manager sign-off
  └── Confirms: Client feedback acceptable, no blockers

□ SRE Lead sign-off
  └── Confirms: Infra stable, monitoring adequate, on-call trained

ANY SINGLE VETO BLOCKS GA
```

### 6.3 Rollback Authority

| Rollback Type | Decision Maker | Consultation |
|---------------|----------------|--------------|
| Emergency (data at risk) | On-Call (immediate) | Notify all after |
| P1 incident | On-Call + Owner | PM informed |
| Planned (bug found) | Owner | PM approval |
| Client request | Owner + PM | Support informed |

### 6.4 Rollback Sign-Off

```
ROLLBACK SIGN-OFF FORM
──────────────────────

Date: ____________
Time: ____________

Rolled back from: P___
Rolled back to: P___

Reason:
□ Error rate exceeded threshold
□ Data integrity concern
□ Client-reported issue
□ Infrastructure issue
□ Other: _____________

Authorized by: _____________ (Role: _________)
Approved by: _____________ (Role: _________)

Next steps:
□ Investigation assigned to: _____________
□ Re-ramp target date: _____________
□ Client communication: □ Required □ Not required
```

---

## 7. Communication Responsibilities

### 7.1 Internal Communication

| Event | Owner | Channel | Timing |
|-------|-------|---------|--------|
| Phase start | Ingestion Owner | #ingestion-rollout | At start |
| Phase gate review | Ingestion Owner | Meeting | Scheduled |
| Incident start | On-Call | #ingestion-rollout | Immediate |
| Incident update | On-Call | #ingestion-rollout | Every 30 min |
| Incident resolved | On-Call | #ingestion-rollout | At resolution |
| GA declaration | PM | #general + email | At approval |

### 7.2 External Communication

| Event | Owner | Approval | Channel |
|-------|-------|----------|---------|
| Canary invitation | PM | — | Direct email |
| Beta announcement | PM | — | In-app |
| Incident (client-facing) | Support | PM | Status page + email |
| GA announcement | PM | — | Blog + email |
| Outage communication | Support | PM + Owner | Status page |

### 7.3 Communication Templates

**Incident Start:**
```
🔴 INCIDENT: Ingestion [P1/P2/P3]
Time: [timestamp]
Impact: [brief description]
Status: Investigating
On-Call: [name]
Next update: [time]
```

**Incident Update:**
```
🟡 UPDATE: Ingestion [P1/P2/P3]
Time: [timestamp]
Status: [investigating/mitigating/resolved]
Findings: [brief]
Next steps: [action]
Next update: [time]
```

**Incident Resolved:**
```
🟢 RESOLVED: Ingestion [P1/P2/P3]
Time: [timestamp]
Duration: [X hours Y minutes]
Root cause: [brief]
Resolution: [what fixed it]
Follow-up: [post-incident scheduled Y/N]
```

---

## 8. Decision Authority Summary

| Decision | Primary Authority | Escalation |
|----------|-------------------|------------|
| Pause ingestion | On-Call | Owner |
| Resume ingestion | Owner | — |
| Rollback phase | Owner | PM (consult) |
| Advance phase | Owner + PM | — |
| GA declaration | Owner + PM + SRE | — |
| Client communication | PM | — |
| Schema change | Database Owner | Owner (consult) |
| Infra change | SRE Lead | Owner (consult) |

---

## 9. Document Control

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2024-12-29 | Initial model |

---

| Role | Approval | Date |
|------|----------|------|
| Ingestion Owner | | |
| SRE Lead | | |
| Product Manager | | |
