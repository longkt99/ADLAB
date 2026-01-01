# D8 — Production Day-0 / Day-1 Runbook

**Version:** 1.0
**Date:** 2024-12-29
**Status:** OPERATIONAL
**Prerequisites:** D6.6 (Runtime), D6.7 (Guardrails), D7 (GA Plan)

---

## 1. Day-0 Pre-Launch Checklist

### 1.1 Infrastructure Verification

```
□ Database
  □ Supabase project healthy (dashboard green)
  □ Connection pool available (< 80% utilization)
  □ RLS policies verified on all tables
  □ Staging tables exist (008_staging_tables.sql applied)

□ File Storage
  □ Storage bucket exists and accessible
  □ Upload permissions configured
  □ Retention policy set (if applicable)

□ Environment Variables
  □ INGESTION_ENABLED=false (will enable at launch)
  □ DATABASE_URL set
  □ STORAGE_URL set
  □ All secrets populated (no placeholders)
```

### 1.2 Application Verification

```
□ Workers Deployed
  □ IntakeWorker responsive
  □ ParseWorker responsive
  □ PromotionWorker responsive
  □ CleanupWorker scheduled (cron active)

□ Feature Flags
  □ ingestion_v2_enabled configured
  □ Set to P0 allowlist (internal only)

□ Health Endpoints
  □ /health returns 200
  □ /ready returns 200
  □ Worker heartbeats active
```

### 1.3 Monitoring Verification

```
□ Metrics
  □ ingestion_uploads_total emitting
  □ ingestion_errors_total emitting
  □ ingestion_duration_seconds emitting
  □ ingestion_circuit_breaker_state emitting

□ Alerts
  □ IngestionCircuitOpen configured
  □ IngestionHighErrorRate configured
  □ IngestionStagingBacklog configured
  □ Alert routing verified (test alert sent)

□ Dashboard
  □ Dashboard accessible
  □ All panels loading data
  □ Time range correct (last 24h default)
```

### 1.4 Operational Readiness

```
□ On-Call
  □ Primary on-call identified
  □ Secondary on-call identified
  □ Escalation path documented
  □ Contact numbers verified

□ Communication
  □ #ingestion-rollout Slack channel created
  □ Stakeholders added to channel
  □ Status page updated (if applicable)

□ Rollback
  □ Rollback procedure reviewed
  □ Kill-switch tested in staging
  □ Previous version tagged (for code rollback if needed)
```

### 1.5 Final Go/No-Go

```
□ All above checkboxes completed
□ No open P1/P2 bugs
□ Stakeholder verbal approval obtained
□ Launch time confirmed: ____________
□ Go decision recorded in Slack
```

---

## 2. Day-0 Launch Sequence

### 2.1 Launch Commands

**Step 1: Enable Ingestion (T-0)**
```bash
# Set environment variable
export INGESTION_ENABLED=true

# Or via config management
# config set ingestion.enabled true
```

**Step 2: Verify Kill-Switch Off**
```sql
-- Check no workspace pauses active
SELECT workspace_id, ingestion_paused
FROM workspace_settings
WHERE ingestion_paused = true;
-- Expected: 0 rows
```

**Step 3: Enable Feature Flag for P0**
```json
{
  "ingestion_v2_enabled": {
    "enabled": false,
    "allowlist": ["<internal-test-workspace-id>"]
  }
}
```

**Step 4: Trigger Test Upload**
```bash
# Upload synthetic test file
curl -X POST https://api.example.com/v1/uploads \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-data/synthetic-small.csv" \
  -F "workspace_id=<internal-test-workspace-id>" \
  -F "platform=meta" \
  -F "source=manual"
```

**Step 5: Verify Test Upload**
```sql
-- Check upload created
SELECT id, status, row_count, error_text, created_at
FROM data_uploads
WHERE workspace_id = '<internal-test-workspace-id>'
ORDER BY created_at DESC
LIMIT 1;
-- Expected: status = 'completed', row_count > 0
```

### 2.2 Post-Launch Verification (T+5 minutes)

```
□ Test upload completed successfully
□ Staging rows created and promoted
□ Production tables updated
□ Metrics incrementing
□ No errors in logs
□ Dashboard showing activity
```

### 2.3 Announce Launch

```
Post to #ingestion-rollout:
─────────────────────────────
🚀 Ingestion P0 LAUNCHED
- Time: [timestamp]
- Status: GREEN
- Test upload: PASSED
- Monitoring: ACTIVE
- On-call: [name]
```

---

## 3. Day-1 Monitoring & Actions

### 3.1 Monitoring Schedule

| Time | Action | Owner |
|------|--------|-------|
| T+0 | Launch, verify test upload | Engineer |
| T+1h | Check metrics, review logs | Engineer |
| T+4h | First checkpoint review | Engineer + PM |
| T+8h | Shift handoff (if applicable) | On-call |
| T+24h | Day-1 review meeting | Team |

### 3.2 Hourly Health Check

```sql
-- Uploads in last hour
SELECT status, COUNT(*)
FROM data_uploads
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY status;

-- Error rate
SELECT
  COUNT(*) FILTER (WHERE status = 'failed') * 100.0 / COUNT(*) as error_rate
FROM data_uploads
WHERE created_at > NOW() - INTERVAL '1 hour';
-- Target: < 5%

-- Staging backlog
SELECT COUNT(*) FROM staging_rows;
-- Target: < 10,000

-- Circuit breaker status
-- Check metrics dashboard or:
SELECT * FROM circuit_breaker_state;
-- Expected: all CLOSED
```

### 3.3 Log Review Commands

```bash
# Recent errors
grep -i "error" /var/log/ingestion/*.log | tail -50

# State transitions
grep "state_change" /var/log/ingestion/*.log | tail -20

# Slow uploads (> 5 min)
grep "ingestion.completed" /var/log/ingestion/*.log | \
  jq 'select(.duration_ms > 300000)'
```

### 3.4 Escalation Triggers

| Condition | Action |
|-----------|--------|
| Error rate > 5% | Alert team in Slack |
| Error rate > 10% | Page on-call |
| Circuit breaker OPEN | Page on-call immediately |
| Upload stuck > 30 min | Investigate, consider force-fail |
| Client complaint | Prioritize, investigate |

---

## 4. Pause / Rollback Procedures

### 4.1 Pause Procedure (Reversible)

**When:** Error rate > 10%, unknown issue, need investigation time

```bash
# Step 1: Activate kill-switch
export INGESTION_ENABLED=false

# Step 2: Announce pause
# Post to #ingestion-rollout:
# ⚠️ INGESTION PAUSED
# - Time: [timestamp]
# - Reason: [brief reason]
# - Investigating: [name]
```

```sql
-- Step 3: Check in-flight uploads
SELECT id, status, created_at
FROM data_uploads
WHERE status IN ('pending', 'processing', 'promoting')
ORDER BY created_at;
-- Note: These will complete, new ones blocked
```

**Resume Procedure:**
```bash
# After issue resolved
export INGESTION_ENABLED=true

# Announce resume
# Post to #ingestion-rollout:
# ✅ INGESTION RESUMED
# - Time: [timestamp]
# - Resolution: [what was fixed]
```

### 4.2 Rollback Procedure (Phase Regression)

**When:** Error rate > 20%, data integrity issue, repeated circuit breaker events

```bash
# Step 1: Activate kill-switch
export INGESTION_ENABLED=false

# Step 2: Roll back feature flag
# Set to previous phase or disable entirely
{
  "ingestion_v2_enabled": {
    "enabled": false,
    "allowlist": []
  }
}
```

```sql
-- Step 3: Capture state for investigation
SELECT * FROM data_uploads
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

SELECT COUNT(*), validation_status
FROM staging_rows
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY validation_status;
```

```bash
# Step 4: Announce rollback
# Post to #ingestion-rollout:
# 🔴 INGESTION ROLLED BACK
# - Time: [timestamp]
# - From: P[X]
# - To: P[X-1] / Disabled
# - Reason: [description]
# - Next steps: [investigation plan]
```

### 4.3 Emergency Data Fix (If Needed)

**CAUTION: Only if data corruption confirmed**

```sql
-- Identify affected records
SELECT id, workspace_id, client_id, created_at
FROM [affected_table]
WHERE created_at > '[incident_start_time]'
  AND created_at < '[incident_end_time]';

-- DO NOT DELETE without explicit approval
-- Document affected IDs first
-- Coordinate with client before any fix
```

---

## 5. Incident Response Playbook

### 5.1 First 5 Minutes

```
□ Acknowledge alert
□ Join #ingestion-rollout
□ Post: "Investigating [alert name], stand by"

□ Quick Assessment:
  □ Check dashboard — what's red?
  □ Check error rate — how bad?
  □ Check circuit breakers — any OPEN?
  □ Check recent uploads — pattern visible?

□ Decision Point:
  □ Error rate < 10%: Continue investigating
  □ Error rate > 10%: PAUSE (Section 4.1)
  □ Data integrity risk: ROLLBACK (Section 4.2)
```

### 5.2 Minutes 5-15

```
□ Identify Scope
  □ How many uploads affected?
  □ Which workspaces?
  □ Which platforms (meta/google/tiktok)?
  □ When did it start?

□ Check Logs
  □ grep for error_code pattern
  □ Identify failing stage (parse/promote)
  □ Look for common error message

□ Check Dependencies
  □ Database connectivity OK?
  □ File storage accessible?
  □ External services responding?

□ Update Slack
  □ Post findings so far
  □ Estimated severity (P1/P2/P3)
  □ ETA for next update
```

### 5.3 Minutes 15-30

```
□ Root Cause Hypothesis
  □ Document suspected cause
  □ Identify fix or mitigation

□ Decision Point:
  □ Fix is quick (< 1 hour): Apply fix, monitor
  □ Fix is complex (> 1 hour): Rollback, schedule fix
  □ Unknown cause: Rollback, deep investigation

□ Communication
  □ Update stakeholders
  □ Client communication (if impacted)
  □ Status page update (if applicable)

□ Document
  □ Start incident doc
  □ Timeline of events
  □ Actions taken
```

### 5.4 Common Issues & Fixes

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| All uploads failing | Kill-switch on, DB down | Check INGESTION_ENABLED, DB health |
| Parse failures spike | Bad file format, schema change | Check recent uploads, identify pattern |
| Promotion timeout | DB slow, large batch | Check DB metrics, reduce batch size |
| Circuit breaker OPEN | DB connection issues | Wait for HALF-OPEN, check connection pool |
| Staging backlog growing | CleanupWorker not running | Check cron, run manual cleanup |
| Uploads stuck in processing | Worker crashed | Restart worker, check logs |

### 5.5 Useful Queries During Incident

```sql
-- Recent failures with error
SELECT id, status, error_text, created_at
FROM data_uploads
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 20;

-- Error distribution
SELECT error_text, COUNT(*)
FROM data_uploads
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY error_text
ORDER BY COUNT(*) DESC;

-- Stuck uploads
SELECT id, status, created_at,
       EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_stuck
FROM data_uploads
WHERE status IN ('processing', 'promoting')
  AND created_at < NOW() - INTERVAL '30 minutes';

-- Staging health
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE validation_status = 'valid') as valid,
  COUNT(*) FILTER (WHERE validation_status = 'invalid') as invalid,
  MIN(created_at) as oldest
FROM staging_rows;
```

---

## 6. GA Completion Sign-Off

### 6.1 Pre-Sign-Off Checklist

```
□ Quantitative Criteria (7-day window)
  □ Error rate < 1%: _____%
  □ p99 latency < 10 min: _____min
  □ Availability > 99.5%: _____%
  □ Circuit breaker events: _____ (target: 0)
  □ Manual interventions: _____ (target: 0)

□ Qualitative Criteria
  □ Client feedback reviewed: No blockers
  □ Support ticket volume: Normal
  □ On-call burden: < 1 page/week
  □ Documentation: Published
  □ Runbook: Validated in production
```

### 6.2 Sign-Off Meeting Agenda

```
1. Metrics review (10 min)
   - Dashboard walkthrough
   - 7-day trends

2. Incident review (10 min)
   - Any incidents during rollout?
   - Lessons learned?

3. Client feedback (5 min)
   - Any complaints?
   - Feature requests noted?

4. Open items (5 min)
   - Any P3 bugs to track?
   - Documentation gaps?

5. Go/No-Go decision (5 min)
   - Vote from: Engineering, PM, SRE
   - Document decision
```

### 6.3 Sign-Off Form

```
GA SIGN-OFF FORM
────────────────

Date: ____________
Phase completed: P4 (GA)

Metrics Summary:
- Total uploads processed: _______
- Error rate (7-day): _______%
- p99 latency (7-day): _______min
- Availability (7-day): _______%

Approvals:

Engineering Lead: _____________ Date: _______
Product Manager:  _____________ Date: _______
SRE Lead:         _____________ Date: _______

Decision: □ GA APPROVED  □ GA DEFERRED

If deferred, reason: _________________________
Re-review date: _____________
```

### 6.4 Post-GA Actions

```
□ Set feature flag to 100%
□ Update status page (GA live)
□ Publish GA announcement
□ Archive #ingestion-rollout channel
□ Schedule retrospective (optional)
□ Update roadmap with post-GA items
□ Transition to BAU support model
```

---

## 7. Quick Reference

### 7.1 Key Commands

| Action | Command |
|--------|---------|
| Enable ingestion | `export INGESTION_ENABLED=true` |
| Disable ingestion | `export INGESTION_ENABLED=false` |
| Check upload status | `SELECT * FROM data_uploads WHERE id = '<id>'` |
| Check staging | `SELECT COUNT(*) FROM staging_rows` |
| Force-fail upload | `UPDATE data_uploads SET status='failed', error_text='Manual intervention' WHERE id='<id>'` |
| Clear staging (upload) | `DELETE FROM staging_rows WHERE upload_id='<id>'` |

### 7.2 Key Contacts

| Role | Name | Contact |
|------|------|---------|
| Primary On-Call | _______ | _______ |
| Secondary On-Call | _______ | _______ |
| Engineering Lead | _______ | _______ |
| SRE Lead | _______ | _______ |

### 7.3 Key Links

| Resource | URL |
|----------|-----|
| Dashboard | _______ |
| Logs | _______ |
| Alerts | _______ |
| Status Page | _______ |
| Slack Channel | #ingestion-rollout |

---

## 8. Document Control

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2024-12-29 | Initial runbook |

---

| Role | Approval | Date |
|------|----------|------|
| Engineering Lead | | |
| SRE Lead | | |
