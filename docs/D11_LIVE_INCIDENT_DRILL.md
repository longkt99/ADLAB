# D11 — Live Incident Drill (Tabletop Simulation)

**Version:** 1.0
**Date:** 2024-12-29
**Status:** PRE-GA OPERATIONAL DRILL
**Scope:** Ingestion system only
**Prerequisites:** D6.6 (Runtime), D7 (Launch), D8 (Runbook), D9 (Ownership), D10 (Pre-Mortem)

**Objective:** Validate human decision-making, escalation flow, and system guardrails under real incident pressure.

**Constraints:**
- NO schema changes
- NO new workers
- NO new features
- Strictly aligned with D6.6 Runtime, D7 Launch, D8 Runbook, D9 Ownership, D10 Pre-Mortem

---

## 1. Drill Format

| Attribute | Value |
|-----------|-------|
| Type | Tabletop (no production data mutation) |
| Duration | ~60 minutes |
| Frequency | Pre-GA required, quarterly thereafter |

**Participants:**
| Role | Responsibility |
|------|----------------|
| Ingestion Owner | Decision Authority |
| On-Call Primary | First responder |
| On-Call Secondary | Observer until escalation |
| SRE Lead | Infrastructure authority |
| PM | Business observer (no veto) |

**Rule:** No hypothetical fixes — only actions already allowed by D6–D10

---

## 2. Scenario Selection

| Scenario | D10 Reference | Category | Risk | Hard Stop Rule |
|----------|---------------|----------|------|----------------|
| A | D10-01 | Data Integrity | Numbers look valid but are wrong | Global kill-switch |
| B | D10-06 | Human Error | Delay compounds damage | Auto-pause ingestion |

---

## 3. Scenario A — Silent Metric Corruption

### T+0 min — Trigger

**SRE Dashboard Shows:**
```
┌─────────────────────────────────────┐
│ METRICS ANOMALY                     │
├─────────────────────────────────────┤
│ Spend:        ↑ 18% (unexpected)    │
│ Conversions:  — flat                │
│ Validation:   0 errors              │
│ Alerts:       0 fired               │
└─────────────────────────────────────┘
```

**Expected Recognition:**
- SRE flags **metric anomaly without alert**
- On-call does NOT dismiss as noise

---

### T+5 min — First Decision Point

**Question:** Is this a data issue or business fluctuation?

**Allowed Actions:**
```
□ Compare staging vs promoted row counts
□ Check ingestion_complete_event counts
□ Read last promotion batch metadata
□ Query daily_metrics for affected date range
```

**Correct Decision:**
- Treat as **data integrity suspicion**
- Escalate to Ingestion Owner

**❌ Forbidden:**
- Re-running ingestion
- Manual DB edits
- Ignoring due to lack of alerts
- "Let's wait and see"

---

### T+15 min — Escalation

**Ingestion Owner joins and confirms:**
- Mismatch between raw upload totals and daily_metrics aggregates
- Staging rows show different values than promoted rows

**Mandatory Action:**
```
ACTIVATE GLOBAL INGESTION KILL-SWITCH
export INGESTION_ENABLED=false
```

**Reasoning Recorded:**
> "Silent corruption > availability. Fail closed."

**Notification Required:**
- PM informed
- SRE Lead informed
- #ingestion-rollout updated

---

### T+30 min — Stabilization

**State:**
```
□ Ingestion paused globally
□ No further promotions allowed
□ Incident declared P1
□ Affected upload_ids identified
□ Staging rows preserved for analysis
```

**Success Criteria:**
- [ ] No additional bad data written
- [ ] Clear decision owner identified
- [ ] Audit log contains kill-switch activation
- [ ] Timeline documented

---

## 4. Scenario B — On-Call Miss

### T+0 min — Trigger

**System State:**
```
┌─────────────────────────────────────┐
│ TRAFFIC SPIKE                       │
├─────────────────────────────────────┤
│ Upload volume:  ↑ 4× normal         │
│ Parse latency:  ↑ increasing        │
│ Alerts:         0 (below threshold) │
│ Errors:         0                   │
└─────────────────────────────────────┘
```

---

### T+5 min — Missed Signal

**On-Call Action:** Assumes traffic burst, no action taken

**Intentional Failure:** This miss is allowed to happen in drill.

**Learning Point:** Early signals without alerts still require investigation.

---

### T+15 min — Auto-Guardrail Activates

**System Behavior:**
```
┌─────────────────────────────────────┐
│ CIRCUIT BREAKER: OPEN               │
├─────────────────────────────────────┤
│ Trigger:        DB connection fails │
│ Action:         Auto-pause          │
│ Human approval: NOT required        │
│ Notification:   Secondary on-call   │
└─────────────────────────────────────┘
```

**Expected System Behavior:**
- [ ] No human approval required for auto-pause
- [ ] Pause event logged
- [ ] Secondary on-call notified automatically

---

### T+20 min — Human Recovery

**Secondary On-Call Actions:**
```
□ Joins incident channel
□ Confirms auto-pause active
□ Notifies Ingestion Owner
□ Does NOT attempt immediate resume
```

**Correct Response:**
- Do NOT resume immediately
- Investigate staging backlog size
- Check for partial promotions

---

### T+30 min — Decision Point

**Question:** Resume or hold?

**Investigation Required:**
```sql
-- Check staging backlog
SELECT COUNT(*) FROM staging_rows
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Check for stuck uploads
SELECT id, status, created_at
FROM data_uploads
WHERE status IN ('processing', 'promoting');
```

**Correct Decision:**
- Hold ingestion
- Clear backlog manually (D8 procedure)
- Resume only after metrics normalize

---

## 5. Evaluation Checklist

### Decision Quality
```
□ Correct owner made final call
□ No unauthorized action taken
□ Kill-switch / pause used correctly
□ Escalation path followed (D9)
□ No guessing or assumptions
```

### Timing
```
□ Escalation < 15 minutes
□ No prolonged indecision
□ No silent continuation
□ Updates posted every 15 minutes
```

### Rule Adherence
```
□ No schema edits
□ No forced promotion
□ No alert bypassing
□ No manual DB mutations
□ No "wait and see" beyond 5 minutes
```

---

## 6. Failure Modes to Watch For (Drill Anti-Patterns)

| Anti-Pattern | Why It's Wrong |
|--------------|----------------|
| "Let's wait 10 more minutes" | Delay compounds damage |
| "Metrics look weird but uploads succeeded" | Success ≠ correctness |
| "I'll just re-run the batch" | May duplicate corruption |
| "Alerts didn't fire so it's probably fine" | Alerts have blind spots |
| "Let me just fix this one row" | Unauthorized mutation |
| "I don't have authority to pause" | Everyone can pause |

**Any of the above = FAILED DRILL**

---

## 7. Drill Outcome Classification

### PASS
```
✓ System paused before damage scaled
✓ Correct authority exercised
✓ Decisions logged
✓ Timeline documented
✓ No forbidden actions taken
```

### SOFT FAIL
```
△ Delay > 15 min but no corruption persisted
△ Minor procedural gaps
△ Requires D8/D9 clarification
```

### HARD FAIL
```
✗ Silent corruption continues
✗ No pause / kill-switch invoked
✗ Unauthorized actions taken
✗ Escalation not followed
```

---

## 8. Post-Drill Actions

| Action | Owner | Trigger |
|--------|-------|---------|
| Update D9 ownership notes | Ingestion Owner | Confusion observed |
| Update D8 runbook wording | On-Call | Ambiguity found |
| Add scenario notes to D10 appendix | SRE Lead | New pattern identified |
| Schedule remediation training | PM | Soft/Hard fail |

**Note:** No code changes allowed from drill findings.

---

## 9. Drill Execution Log Template

```
DRILL EXECUTION LOG
───────────────────

Date: ____________
Scenario: A / B
Participants: _________________________

Timeline:
T+0:  ________________________________
T+5:  ________________________________
T+15: ________________________________
T+30: ________________________________

Outcome: PASS / SOFT FAIL / HARD FAIL

Observations:
1. ________________________________
2. ________________________________
3. ________________________________

Action Items:
1. ________________________________
2. ________________________________
```

---

## 10. Core Principle (Reaffirmed)

> **The system is safe only if humans are allowed — and willing — to stop it.**

D11 validates people, not pipelines.

---

## 11. Document Control

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2024-12-29 | Initial drill specification |

---

## 12. Sign-Off

| Role | Approval | Date |
|------|----------|------|
| Ingestion Owner | | |
| SRE Lead | | |
| On-Call Primary | | |
