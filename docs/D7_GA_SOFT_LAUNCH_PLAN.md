# D7 — GA Soft Launch & Production Rollout Plan

**Version:** 1.0
**Date:** 2024-12-29
**Status:** READY FOR EXECUTION
**Prerequisites:** D6.4 (Schema), D6.5 (Lock), D6.6 (Runtime), D6.7 (Guardrails)

---

## 1. Rollout Phases

### 1.1 Phase Overview

| Phase | Name | Duration | Audience | Traffic |
|-------|------|----------|----------|---------|
| P0 | Internal Testing | 3-5 days | Engineering team only | Synthetic loads |
| P1 | Canary | 5-7 days | 1-2 trusted clients | Real data, monitored |
| P2 | Limited Beta | 7-14 days | 10% of workspaces | Gradual ramp |
| P3 | Expanded Beta | 7-14 days | 50% of workspaces | Steady state |
| P4 | General Availability | Ongoing | 100% of workspaces | Full traffic |

### 1.2 Phase Gates

```
P0 ──▶ P1 ──▶ P2 ──▶ P3 ──▶ P4
 │      │      │      │      │
 ▼      ▼      ▼      ▼      ▼
Gate   Gate   Gate   Gate   GA
 0      1      2      3    Complete
```

**No phase advancement without explicit gate approval.**

---

## 2. Phase Details

### 2.1 P0 — Internal Testing

**Objective:** Validate system behavior under controlled conditions.

| Activity | Description |
|----------|-------------|
| Synthetic uploads | Test files with known data patterns |
| Edge cases | Empty files, max size, malformed CSV |
| State transitions | Verify all D6.6 states reachable |
| Circuit breakers | Force-trigger and verify recovery |
| Kill-switch | Test enable/disable cycle |
| Metrics | Confirm all D6.7 signals emit correctly |

**Entry Criteria:**
- [ ] All D6.6 workers deployed to staging
- [ ] D6.7 guardrails configured
- [ ] Monitoring dashboard live
- [ ] Alert rules active

**Exit Criteria (Gate 0):**
- [ ] 100 synthetic uploads processed successfully
- [ ] All state transitions observed
- [ ] Circuit breaker recovery verified
- [ ] Kill-switch tested
- [ ] Zero P1 bugs open
- [ ] Error rate < 5% on valid inputs

---

### 2.2 P1 — Canary

**Objective:** Validate with real client data in production environment.

| Parameter | Value |
|-----------|-------|
| Workspaces | 1-2 (hand-selected, trusted) |
| Upload limit | 10 uploads/day per workspace |
| File size | ≤ 10 MB (reduced from 50 MB limit) |
| Monitoring | Real-time, dedicated Slack channel |

**Canary Selection Criteria:**
- Known data quality (clean CSV exports)
- Responsive contact for feedback
- Non-critical business dependency
- Willing to accept potential issues

**Entry Criteria:**
- [ ] Gate 0 passed
- [ ] Canary clients identified and notified
- [ ] Support channel established
- [ ] Rollback procedure documented

**Exit Criteria (Gate 1):**
- [ ] 50+ real uploads processed
- [ ] Client feedback collected (no blockers)
- [ ] Error rate < 3%
- [ ] p99 latency < 5 minutes
- [ ] No data integrity issues
- [ ] No manual interventions required

---

### 2.3 P2 — Limited Beta

**Objective:** Validate at 10% traffic with diverse data patterns.

| Parameter | Value |
|-----------|-------|
| Workspaces | 10% (feature flag rollout) |
| Upload limit | Standard (per D6.7) |
| File size | Full 50 MB limit |
| Monitoring | Hourly review first 3 days, then daily |

**Workspace Selection:**
- Random 10% selection via feature flag
- Exclude: enterprise clients, high-volume accounts
- Include: mix of platforms (Meta, Google, TikTok)

**Entry Criteria:**
- [ ] Gate 1 passed
- [ ] Feature flag infrastructure ready
- [ ] On-call rotation briefed
- [ ] Runbook reviewed

**Exit Criteria (Gate 2):**
- [ ] 500+ uploads processed
- [ ] Error rate < 2%
- [ ] No circuit breaker events
- [ ] Staging table < 100K rows steady state
- [ ] No P1/P2 bugs open
- [ ] Support ticket volume normal

---

### 2.4 P3 — Expanded Beta

**Objective:** Validate at 50% traffic, stress-test concurrency.

| Parameter | Value |
|-----------|-------|
| Workspaces | 50% (feature flag) |
| Upload limit | Standard |
| File size | Full limit |
| Monitoring | Daily review |

**Entry Criteria:**
- [ ] Gate 2 passed
- [ ] Database capacity reviewed
- [ ] Storage capacity confirmed
- [ ] Support team trained

**Exit Criteria (Gate 3):**
- [ ] 2,000+ uploads processed
- [ ] Error rate < 1.5%
- [ ] p99 latency stable (< 10 min)
- [ ] Concurrency limits not breached
- [ ] No scaling issues observed
- [ ] Client complaints < 0.1% of uploads

---

### 2.5 P4 — General Availability

**Objective:** Full production rollout.

| Parameter | Value |
|-----------|-------|
| Workspaces | 100% |
| Upload limit | Standard |
| File size | Full limit |
| Monitoring | Standard SRE cadence |

**Entry Criteria:**
- [ ] Gate 3 passed
- [ ] GA announcement prepared
- [ ] Documentation published
- [ ] Support FAQ updated

**GA Declaration:**
- [ ] 7 consecutive days at 100% traffic
- [ ] Error rate < 1%
- [ ] No P1/P2 incidents
- [ ] Success criteria met (Section 6)

---

## 3. Traffic Ramp-Up Strategy

### 3.1 Ramp Schedule

```
Traffic %
100 ─────────────────────────────────────────── ████████████
 90                                         ████
 80                                     ████
 70                                 ████
 60                             ████
 50 ────────────────────────████████████████
 40                     ████
 30                 ████
 20             ████
 10 ────────████████████████
  0 ████████
    P0   P1      P2           P3              P4
   (3d) (7d)   (14d)        (14d)           (GA)
```

### 3.2 Ramp Rules

| Rule | Specification |
|------|---------------|
| Minimum phase duration | As specified per phase |
| Ramp increment | Max 2x previous traffic |
| Ramp-down trigger | Any rollback criteria met |
| Ramp-down speed | Immediate (not gradual) |
| Re-ramp after rollback | Restart from previous stable phase |

### 3.3 Feature Flag Configuration

```
Feature Flag: ingestion_v2_enabled
─────────────────────────────────

P0: { "enabled": false, "allowlist": ["internal-test-workspace"] }
P1: { "enabled": false, "allowlist": ["canary-ws-1", "canary-ws-2"] }
P2: { "enabled": true, "percentage": 10, "denylist": ["enterprise-*"] }
P3: { "enabled": true, "percentage": 50 }
P4: { "enabled": true, "percentage": 100 }
```

---

## 4. Monitoring During Rollout

### 4.1 Key Metrics (Per D6.7)

| Metric | P0-P1 Threshold | P2-P3 Threshold | GA Threshold |
|--------|-----------------|-----------------|--------------|
| Error rate | < 5% | < 2% | < 1% |
| p99 latency | < 5 min | < 10 min | < 10 min |
| Circuit breaker events | 0 | 0 | < 1/week |
| Staging backlog | < 10K | < 50K | < 100K |
| Manual interventions | 0 | < 1/week | < 1/month |

### 4.2 Monitoring Cadence

| Phase | Review Frequency | Attendees |
|-------|------------------|-----------|
| P0 | Continuous | Engineering |
| P1 | Every 4 hours | Engineering + PM |
| P2 | Daily (first 3 days), then every 2 days | Engineering |
| P3 | Daily | Engineering |
| P4 | Standard SRE cadence | On-call |

### 4.3 Signals to Watch

| Signal | Concern | Action |
|--------|---------|--------|
| Error rate spike | Bug or bad data pattern | Investigate, consider pause |
| Latency increase | Performance regression | Profile, optimize |
| Staging growth | Cleanup not running | Check CleanupWorker |
| Support tickets | User experience issue | Prioritize feedback |
| DB CPU spike | Query inefficiency | Review query plans |

---

## 5. Rollback & Pause Criteria

### 5.1 Immediate Pause Triggers

| Trigger | Action | Resume Criteria |
|---------|--------|-----------------|
| Error rate > 10% (15 min window) | Pause phase, investigate | Root cause fixed |
| Circuit breaker OPEN > 5 min | Global pause (per D6.7) | Breaker recovers |
| Data integrity issue confirmed | Global pause | Fix deployed + verified |
| P1 incident declared | Pause phase | Incident resolved |

### 5.2 Rollback Triggers

| Trigger | Action |
|---------|--------|
| Error rate > 20% sustained | Rollback to previous phase |
| Multiple circuit breaker events in 24h | Rollback to previous phase |
| Data corruption detected | Rollback to P0, full investigation |
| Client-reported data loss | Rollback to P0, full investigation |

### 5.3 Rollback Procedure

```
Rollback Checklist:
───────────────────

1. [ ] Activate kill-switch (INGESTION_ENABLED=false)
2. [ ] Notify affected clients
3. [ ] Capture current state (logs, metrics, staging)
4. [ ] Document incident timeline
5. [ ] Roll back feature flag to previous phase
6. [ ] Investigate root cause
7. [ ] Fix and verify in P0
8. [ ] Re-ramp from stable phase
```

### 5.4 Pause vs Rollback Decision Matrix

| Condition | Duration | Action |
|-----------|----------|--------|
| Known issue, fix < 4 hours | Short | Pause |
| Unknown issue, investigation needed | Unknown | Pause |
| Fix requires code change | > 1 day | Rollback |
| Data integrity at risk | Any | Rollback |
| Client impact confirmed | Any | Rollback |

---

## 6. Success Criteria for GA Complete

### 6.1 Quantitative Criteria

| Metric | Target | Measurement Period |
|--------|--------|-------------------|
| Error rate | < 1% | 7-day rolling average |
| p99 latency | < 10 minutes | 7-day rolling |
| Availability | > 99.5% | 7-day rolling |
| Successful uploads | > 99% | 7-day rolling |
| Circuit breaker events | 0 | 7-day window |
| Manual interventions | 0 | 7-day window |

### 6.2 Qualitative Criteria

| Criterion | Validation |
|-----------|------------|
| Client feedback positive | No blocking complaints |
| Support ticket volume normal | No spike vs baseline |
| On-call burden acceptable | < 1 page/week related to ingestion |
| Documentation complete | User guide published |
| Runbook validated | Used successfully in P1-P3 |

### 6.3 GA Declaration Checklist

- [ ] All quantitative criteria met for 7 consecutive days
- [ ] All qualitative criteria confirmed
- [ ] No open P1/P2 bugs
- [ ] Stakeholder sign-off obtained
- [ ] GA announcement published
- [ ] Feature flag set to 100%
- [ ] Kill-switch remains available (never removed)

---

## 7. Communication Plan

### 7.1 Internal Communication

| Event | Channel | Audience |
|-------|---------|----------|
| Phase start | Slack #engineering | Engineering |
| Gate review | Meeting | Engineering + PM |
| Incident | Slack #incidents | Engineering + Support |
| GA declaration | Email + Slack | All teams |

### 7.2 External Communication

| Event | Channel | Audience |
|-------|---------|----------|
| Canary invitation | Direct email | Selected clients |
| Beta announcement | In-app banner | Beta workspaces |
| GA announcement | Blog + email | All clients |
| Incident (if client-facing) | Status page | Affected clients |

---

## 8. Post-GA Considerations

### 8.1 Immediate Post-GA (Week 1-2)

- Monitor metrics closely (daily review)
- Collect client feedback actively
- Address any edge cases discovered
- Document lessons learned

### 8.2 Stabilization (Week 3-4)

- Reduce monitoring cadence to standard
- Close out rollout documentation
- Archive rollout Slack channel
- Transition to BAU support model

### 8.3 Future Enhancements (Post-GA)

| Enhancement | Prerequisite | Target |
|-------------|--------------|--------|
| demographic_metrics ingestion | Schema export complete | D8+ |
| API pull (Meta/Google/TikTok) | D6.7.2 impl | D8+ |
| Scheduled ingestion | API pull complete | D9+ |
| Alert evaluation integration | D6.6 (original) impl | D8+ |

---

## 9. Reference Documents

| Document | Purpose |
|----------|---------|
| D6.4 | Schema contracts |
| D6.5 | Execution readiness |
| D6.6 | Runtime specification |
| D6.7 | Operational guardrails |

---

## 10. Document Control

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2024-12-29 | Initial plan |

---

| Role | Approval | Date |
|------|----------|------|
| Engineering Lead | | |
| Product Manager | | |
| SRE Lead | | |
