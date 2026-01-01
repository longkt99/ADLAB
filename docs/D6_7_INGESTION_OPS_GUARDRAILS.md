# D6.7 — Ingestion Operational Guardrails & Production Controls

**Version:** 1.0
**Date:** 2024-12-29
**Status:** PRODUCTION-READY
**Prerequisites:** D6.4 (Schema), D6.5 (Lock), D6.6 (Runtime)

---

## 1. Kill-Switch & Pause Conditions

### 1.1 Global Kill-Switch

| Control | Behavior | Trigger |
|---------|----------|---------|
| `INGESTION_ENABLED` | false = reject all new uploads | Environment variable |
| Effect on pending | Continue processing existing | — |
| Effect on new | Return 503 Service Unavailable | — |
| Recovery | Set true, no restart required | Manual |

### 1.2 Workspace-Level Pause

| Control | Behavior | Trigger |
|---------|----------|---------|
| `workspace.ingestion_paused` | Pause specific workspace | Admin action |
| Effect | New uploads rejected, existing continue | — |
| Response | 403 with reason: "ingestion_paused" | — |

### 1.3 Automatic Pause Triggers

| Condition | Action | Recovery |
|-----------|--------|----------|
| Error rate > 50% (last 10 uploads) | Pause workspace | Manual review |
| Staging table > 1M rows | Pause all ingestion | CleanupWorker runs |
| Database connection failures > 10/min | Global pause | Auto-resume after 5 min healthy |
| Disk usage > 90% | Global pause | Manual intervention |

---

## 2. Hard Safety Limits

### 2.1 Input Limits

| Limit | Value | Enforcement | On Exceed |
|-------|-------|-------------|-----------|
| Max file size | 50 MB | IntakeWorker | Reject 413 |
| Max rows per upload | 100,000 | ParseWorker | Truncate + warn |
| Max columns | 50 | ParseWorker | Reject |
| Max cell length | 10,000 chars | ParseWorker | Truncate cell |
| Max filename length | 255 chars | IntakeWorker | Truncate |

### 2.2 Runtime Limits

| Limit | Value | Enforcement | On Exceed |
|-------|-------|-------------|-----------|
| Parse timeout | 5 minutes | ParseWorker | Fail upload |
| Promotion timeout | 10 minutes | PromotionWorker | Fail upload |
| Total upload timeout | 20 minutes | All workers | Fail upload |
| Single transaction timeout | 30 seconds | Database | Rollback + retry |
| Staging row TTL | 7 days | CleanupWorker | Delete |

### 2.3 Concurrency Limits

| Limit | Value | Scope | Enforcement |
|-------|-------|-------|-------------|
| Concurrent uploads per workspace | 3 | Workspace | Queue excess |
| Concurrent uploads global | 50 | System | Reject 503 |
| Concurrent PromotionWorkers | 10 | System | Queue excess |
| Batch size (promotion) | 1,000 rows | Per transaction | Worker config |

---

## 3. Retry Budgets & Circuit Breakers

### 3.1 Retry Budgets

| Operation | Max Retries | Budget Period | Reset |
|-----------|-------------|---------------|-------|
| Database connection | 3 | Per operation | Immediate |
| Transaction commit | 2 | Per batch | Immediate |
| File read | 2 | Per upload | Immediate |
| FK resolution | 3 | Per row | Immediate |

**Budget Exhaustion:** When retry budget exhausted, fail the operation (no infinite loops).

### 3.2 Circuit Breaker: Database

| State | Condition | Behavior |
|-------|-----------|----------|
| CLOSED | Normal operation | All requests proceed |
| OPEN | 5 failures in 60 seconds | Reject all DB operations |
| HALF-OPEN | After 30 seconds in OPEN | Allow 1 test request |
| Recovery | Test request succeeds | Return to CLOSED |

```
Circuit Breaker State Machine:
──────────────────────────────

    ┌──────────────────────────────────────┐
    │                                      │
    ▼                                      │
┌────────┐  5 failures/60s  ┌──────┐      │
│ CLOSED │─────────────────▶│ OPEN │      │
└────────┘                  └──────┘      │
    ▲                           │         │
    │                      30s timeout    │
    │                           │         │
    │                           ▼         │
    │    success          ┌───────────┐   │
    └─────────────────────│ HALF-OPEN │───┘
                          └───────────┘
                               │ failure
                               └──────────▶ OPEN
```

### 3.3 Circuit Breaker: File Storage

| State | Condition | Behavior |
|-------|-----------|----------|
| CLOSED | Normal | Proceed |
| OPEN | 3 failures in 30 seconds | Reject file operations |
| HALF-OPEN | After 15 seconds | Test single read |

---

## 4. Human Intervention Triggers

### 4.1 Mandatory Escalation

| Trigger | Severity | Action Required |
|---------|----------|-----------------|
| Circuit breaker OPEN > 5 minutes | P1 | On-call paged |
| Global kill-switch activated | P1 | On-call notified |
| Workspace paused (auto) | P2 | Review within 1 hour |
| Staging > 500K rows | P2 | Investigate cleanup |
| Upload stuck in `processing` > 30 min | P3 | Manual review |
| Error rate > 30% (24 hour window) | P3 | Investigate |

### 4.2 Manual Override Controls

| Control | Purpose | Authorization |
|---------|---------|---------------|
| Force-fail upload | Unstick processing | Admin |
| Force-complete upload | Skip remaining rows | Admin |
| Purge staging (upload) | Clear stuck staging | Admin |
| Reset circuit breaker | Force CLOSED state | SRE |
| Bypass validation threshold | Promote < 90% valid | Admin + reason |

### 4.3 Override Audit Requirements

| Field | Required |
|-------|----------|
| Who | User ID of authorizer |
| What | Action taken |
| Why | Reason text (min 10 chars) |
| When | Timestamp |
| Upload ID | Affected resource |

---

## 5. Production Safety Rules

### 5.1 Must Never Happen

| Rule | Enforcement | Detection |
|------|-------------|-----------|
| Delete production data during ingestion | No DELETE in workers | Code review + audit |
| Modify other workspace's data | RLS policies | Query check |
| Promote without staging | PromotionWorker reads staging only | Worker boundary |
| Skip validation entirely | Validation step is mandatory | State machine |
| Infinite retry loop | Retry budgets enforced | Budget exhaustion check |
| Unbounded memory growth | Streaming parse, batch limits | Memory monitoring |
| Silent data corruption | Checksum on file, hash on rows | Validation stage |

### 5.2 Must Always Happen

| Rule | Enforcement |
|------|-------------|
| Log every state transition | Worker logging |
| Record error_text on failure | State transition logic |
| Update row_count on completion | PromotionWorker |
| Emit IngestionCompleteEvent when applicable | D6.6 Section 7 |
| Release locks on worker exit | Finally block / defer |
| Respect kill-switch | Check before each stage |

### 5.3 Data Integrity Invariants

| Invariant | Check Point |
|-----------|-------------|
| workspace_id matches throughout | Every upsert |
| client_id consistent (if set) | Every upsert |
| platform consistent | Every upsert |
| natural_key_hash unique per upload | Staging insert |
| FK references valid or NULL | Promotion stage |

---

## 6. Operational Signals (SRE / On-Call)

### 6.1 Metrics to Expose

| Metric | Type | Labels | Alert Threshold |
|--------|------|--------|-----------------|
| `ingestion_uploads_total` | Counter | workspace_id, platform, status | — |
| `ingestion_rows_processed` | Counter | workspace_id, entity_type | — |
| `ingestion_duration_seconds` | Histogram | stage (parse, promote) | p99 > 300s |
| `ingestion_errors_total` | Counter | workspace_id, error_code | > 10/min |
| `ingestion_staging_rows` | Gauge | — | > 500K |
| `ingestion_active_uploads` | Gauge | workspace_id | > 3 per workspace |
| `ingestion_circuit_breaker_state` | Gauge | breaker_name | OPEN > 0 |
| `ingestion_retry_exhausted_total` | Counter | operation | > 5/min |

### 6.2 Log Events (Structured)

| Event | Level | Required Fields |
|-------|-------|-----------------|
| `ingestion.started` | INFO | upload_id, workspace_id, platform |
| `ingestion.state_change` | INFO | upload_id, from_state, to_state |
| `ingestion.stage_complete` | INFO | upload_id, stage, duration_ms, row_count |
| `ingestion.error` | ERROR | upload_id, error_code, error_message, stage |
| `ingestion.completed` | INFO | upload_id, status, total_rows, duration_ms |
| `ingestion.circuit_open` | WARN | breaker_name, failure_count |
| `ingestion.circuit_closed` | INFO | breaker_name |
| `ingestion.kill_switch` | WARN | enabled, triggered_by |
| `ingestion.override` | WARN | action, user_id, reason, upload_id |

### 6.3 Dashboard Panels (Recommended)

| Panel | Visualization | Purpose |
|-------|---------------|---------|
| Uploads by Status | Pie chart | Current state distribution |
| Upload Rate | Time series | Throughput trend |
| Error Rate | Time series | Health indicator |
| Duration by Stage | Histogram | Performance profile |
| Active Circuit Breakers | Status indicator | System health |
| Staging Table Size | Gauge | Cleanup health |
| Top Error Codes | Table | Debugging focus |

### 6.4 Alert Definitions

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| `IngestionCircuitOpen` | circuit_breaker_state{} == 1 for 5m | P1 | Page on-call |
| `IngestionHighErrorRate` | error_rate > 0.3 for 15m | P2 | Notify Slack |
| `IngestionStagingBacklog` | staging_rows > 500000 | P2 | Notify Slack |
| `IngestionStuckUpload` | upload in processing > 30m | P3 | Ticket |
| `IngestionSlowPromote` | promote_duration_p99 > 600s | P3 | Investigate |

---

## 7. Guardrail Checklist

### Pre-Production

- [ ] Kill-switch environment variable configured
- [ ] Circuit breaker thresholds tuned for environment
- [ ] All metrics endpoints exposed
- [ ] Structured logging enabled
- [ ] Alert rules deployed
- [ ] Dashboard created
- [ ] On-call runbook written

### Per-Deployment

- [ ] Verify kill-switch is OFF (unless intentional)
- [ ] Check circuit breakers are CLOSED
- [ ] Confirm staging table size < 100K
- [ ] Review error rate trend

### Incident Response

- [ ] Check circuit breaker state first
- [ ] Review last 10 uploads for error pattern
- [ ] Check staging table for stuck rows
- [ ] Verify database connectivity
- [ ] Check file storage availability
- [ ] Review override audit log

---

## 8. Alignment Verification

| Requirement | Reference | Satisfied |
|-------------|-----------|-----------|
| No schema changes | D6.4/D6.5 | ✓ No DDL |
| No new workers | D6.6 | ✓ Uses existing 4 workers |
| No alert logic | Scope | ✓ Not referenced |
| No API pull | Scope | ✓ Not referenced |
| No scheduling | Scope | ✓ Not referenced |
| Sits on D6.6 | D6.6 | ✓ References runtime spec |

---

## 9. Document Control

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2024-12-29 | Initial specification |

---

| Role | Approval | Date |
|------|----------|------|
| SRE Lead | | |
| Platform Owner | | |
