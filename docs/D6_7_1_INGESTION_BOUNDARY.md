# D6.7.1 — Ingestion Boundary & Scheduling Contract

**Version:** D6.7.1
**Date:** 2024-12-28
**Status:** CONTROL PLANE CONTRACT
**Classification:** INGESTION GOVERNANCE
**Dependencies:**
- D6.4 Ingestion Architecture Design (FROZEN)
- D6.5 Ingestion Execution Blueprint (FROZEN)
- D6.6 Alert Evaluation Runtime (FROZEN)

---

## 1. Ingestion Entry Points

### 1.1 Entry Point Classification

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        INGESTION ENTRY POINTS                                │
│                                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐ │
│  │      MANUAL         │  │     SCHEDULED       │  │   EVENT-TRIGGERED   │ │
│  │                     │  │                     │  │                     │ │
│  │  User initiates     │  │  System initiates   │  │  External system    │ │
│  │  via UI/API         │  │  on time-based      │  │  pushes data via    │ │
│  │                     │  │  schedule           │  │  webhook            │ │
│  └──────────┬──────────┘  └──────────┬──────────┘  └──────────┬──────────┘ │
│             │                        │                        │             │
│             ▼                        ▼                        ▼             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    INGESTION BOUNDARY GATE                            │  │
│  │                                                                       │  │
│  │  • Authentication check                                               │  │
│  │  • Authorization check (workspace/client access)                      │  │
│  │  • Rate limit check                                                   │  │
│  │  • Quota check                                                        │  │
│  │  • Concurrency check                                                  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                              PASS / REJECT                                  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    INGESTION PIPELINE (D6.5)                          │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Manual Ingestion

**Definition:** User-initiated data upload or sync request.

| Attribute | Specification |
|-----------|---------------|
| Trigger source | UI button click, API call |
| Authentication | Required (user session or API key) |
| Authorization | User must have write access to workspace/client |
| Input types | CSV upload, manual API sync request |
| Execution | Synchronous acknowledgment, async processing |

**Allowed When:**

| Condition | Required |
|-----------|----------|
| User is authenticated | YES |
| User has workspace write access | YES |
| Client rate limit not exceeded | YES |
| No concurrent ingestion for same client | YES |
| System not in maintenance mode | YES |

**Rejected When:**

| Condition | Rejection Response |
|-----------|-------------------|
| Unauthenticated | 401 Unauthorized |
| No workspace access | 403 Forbidden |
| Rate limit exceeded | 429 Too Many Requests |
| Concurrent ingestion active | 409 Conflict |
| Maintenance mode | 503 Service Unavailable |

### 1.3 Scheduled Ingestion

**Definition:** System-initiated data sync on a recurring schedule.

| Attribute | Specification |
|-----------|---------------|
| Trigger source | Cron job, scheduler service |
| Authentication | System service account |
| Authorization | Inherited from schedule configuration |
| Input types | API pull from external platforms |
| Execution | Fully asynchronous |

**Allowed When:**

| Condition | Required |
|-----------|----------|
| Schedule is enabled | YES |
| Platform credentials are valid | YES |
| Previous run completed or timed out | YES |
| Workspace/client not suspended | YES |
| System not in maintenance mode | YES |

**Rejected When:**

| Condition | Behavior |
|-----------|----------|
| Schedule disabled | Skip silently, log |
| Invalid credentials | Skip, log error, notify |
| Previous run still active | Skip, log overlap |
| Workspace suspended | Skip, log |
| Maintenance mode | Defer to next window |

### 1.4 Event-Triggered Ingestion (Future Webhook)

**Definition:** External system pushes data via webhook endpoint.

| Attribute | Specification |
|-----------|---------------|
| Trigger source | HTTP POST to webhook URL |
| Authentication | Webhook signature or API key |
| Authorization | Webhook configured for specific client |
| Input types | JSON payload |
| Execution | Synchronous validation, async processing |

**Allowed When:**

| Condition | Required |
|-----------|----------|
| Webhook signature valid | YES |
| Webhook is enabled | YES |
| Payload schema valid | YES |
| Rate limit not exceeded | YES |
| Workspace/client active | YES |

**Rejected When:**

| Condition | Rejection Response |
|-----------|-------------------|
| Invalid signature | 401 Unauthorized |
| Webhook disabled | 404 Not Found |
| Invalid payload schema | 400 Bad Request |
| Rate limit exceeded | 429 Too Many Requests |
| Client suspended | 403 Forbidden |

### 1.5 Entry Point Priority

When multiple entry points compete for the same client:

| Priority | Entry Point | Rationale |
|----------|-------------|-----------|
| 1 (highest) | Manual | User intent takes precedence |
| 2 | Event-triggered | Real-time data has freshness value |
| 3 (lowest) | Scheduled | Can be deferred |

**Conflict Resolution:**

| Scenario | Resolution |
|----------|------------|
| Manual request during scheduled run | Queue manual, let scheduled complete |
| Webhook during scheduled run | Queue webhook, let scheduled complete |
| Manual during webhook processing | Queue manual, let webhook complete |
| Two manual requests | Second request rejected (409 Conflict) |

---

## 2. Scheduling Model

### 2.1 Schedule Types

| Schedule Type | Interval | Use Case |
|---------------|----------|----------|
| HOURLY | Every 60 minutes | High-frequency campaigns |
| DAILY | Once per day (configurable hour) | Standard reporting |
| CUSTOM | Cron expression | Advanced use cases |

### 2.2 Schedule Configuration Schema

```
IngestionSchedule {
  id: uuid
  workspace_id: uuid
  client_id: uuid
  platform: 'meta' | 'google' | 'tiktok'
  schedule_type: 'HOURLY' | 'DAILY' | 'CUSTOM'
  cron_expression: string | null       # For CUSTOM type
  preferred_hour: integer | null       # 0-23 for DAILY
  timezone: string                     # IANA timezone
  is_enabled: boolean
  lookback_days: integer               # Days to fetch (default: 7)
  created_at: timestamp
  updated_at: timestamp
}
```

### 2.3 Time-Based Schedule Semantics

**HOURLY Schedule:**

| Attribute | Value |
|-----------|-------|
| Execution interval | 60 minutes |
| Data window | Last 24 hours (rolling) |
| Tolerance | ±5 minutes |
| Catch-up | Next available slot |

**DAILY Schedule:**

| Attribute | Value |
|-----------|-------|
| Execution interval | 24 hours |
| Execution hour | preferred_hour in timezone |
| Data window | lookback_days ending yesterday |
| Tolerance | ±30 minutes |
| Catch-up | Immediate on next scheduler tick |

### 2.4 Backfill Windows

**Definition:** Ingestion of historical data beyond the standard lookback.

| Backfill Type | Max Range | Trigger |
|---------------|-----------|---------|
| Standard lookback | 7 days | Every scheduled run |
| Extended backfill | 30 days | Manual request only |
| Full historical | 90 days | Manual request with approval |

**Backfill Constraints:**

| Constraint | Value | Rationale |
|------------|-------|-----------|
| Max days per request | 90 | API rate limits |
| Max concurrent backfills | 1 per client | Resource protection |
| Backfill priority | LOWEST | Does not block current data |

### 2.5 Catch-Up Behavior

When scheduled runs are missed (system downtime, maintenance):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CATCH-UP STRATEGY                                     │
│                                                                             │
│  Missed Windows:  T-3h    T-2h    T-1h    T (now)                          │
│                    ↓       ↓       ↓       ↓                                │
│                 MISSED  MISSED  MISSED  CURRENT                             │
│                                                                             │
│  Strategy: CONSOLIDATE                                                       │
│  ─────────────────────                                                      │
│  Instead of running 4 separate ingestions,                                  │
│  run 1 ingestion with extended lookback                                     │
│                                                                             │
│  Result: Single run covering T-3h to T                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Catch-Up Rules:**

| Missed Windows | Behavior |
|----------------|----------|
| 1-3 hours | Consolidate into single run |
| 4-23 hours | Single run with 24h lookback |
| 1-7 days | Single run with 7-day lookback |
| >7 days | Manual backfill required |

### 2.6 Concurrency Limits

| Scope | Max Concurrent | Rationale |
|-------|----------------|-----------|
| Global (all workspaces) | 50 | System capacity |
| Per workspace | 10 | Fair distribution |
| Per client | 1 | Data consistency |
| Per platform | 20 | API rate limit alignment |

**Concurrency Enforcement:**

```
FUNCTION checkConcurrency(workspace_id, client_id):
  global_active = COUNT(active_ingestions)
  workspace_active = COUNT(active_ingestions WHERE workspace_id = ?)
  client_active = COUNT(active_ingestions WHERE client_id = ?)

  IF global_active >= 50:
    RETURN REJECT("System at capacity")
  IF workspace_active >= 10:
    RETURN REJECT("Workspace limit reached")
  IF client_active >= 1:
    RETURN REJECT("Client ingestion in progress")

  RETURN ALLOW
```

---

## 3. Rate Limit & Quota Safety

### 3.1 Rate Limit Tiers

| Tier | Requests/Hour | Requests/Day | Use Case |
|------|---------------|--------------|----------|
| FREE | 10 | 50 | Trial accounts |
| STANDARD | 60 | 500 | Standard subscriptions |
| PROFESSIONAL | 300 | 2000 | Business accounts |
| ENTERPRISE | 1000 | 10000 | Enterprise contracts |

### 3.2 Per-Client Ingestion Caps

| Limit Type | Value | Enforcement |
|------------|-------|-------------|
| Max uploads per hour | Tier-based | Hard limit, 429 response |
| Max uploads per day | Tier-based | Hard limit, 429 response |
| Max file size | 50 MB | Rejected at upload |
| Max rows per upload | 100,000 | Rejected at parse |

### 3.3 Per-Platform Rate Limits

External API rate limits that must be respected:

| Platform | Rate Limit | AdLab Safety Margin |
|----------|------------|---------------------|
| Meta Ads API | 200 calls/hour/account | 150 calls/hour (75%) |
| Google Ads API | 15,000 calls/day/account | 10,000 calls/day (67%) |
| TikTok Ads API | 600 calls/minute/account | 400 calls/minute (67%) |

**Safety Margin Rationale:** Leave headroom for:
- User's own API usage
- Retry operations
- Unexpected bursts

### 3.4 Burst vs Sustained Rules

| Mode | Definition | Allowed Duration |
|------|------------|------------------|
| BURST | 2x normal rate limit | 5 minutes max |
| SUSTAINED | Normal rate limit | Ongoing |

**Burst Allowance:**

```
FUNCTION checkBurstAllowance(client_id):
  recent_requests = COUNT(requests WHERE client_id = ? AND time > now() - 5min)
  hourly_limit = GET_TIER_LIMIT(client_id)
  burst_limit = hourly_limit * 2 / 12  # 2x rate for 5 minutes

  IF recent_requests > burst_limit:
    # Check if in burst mode
    IF client.burst_window_start IS NULL:
      client.burst_window_start = now()
    ELSE IF now() - client.burst_window_start > 5min:
      RETURN REJECT("Burst window exceeded")

  RETURN ALLOW
```

### 3.5 Quota Tracking

| Quota Type | Reset Period | Tracking |
|------------|--------------|----------|
| Hourly requests | Rolling 60 minutes | In-memory counter |
| Daily requests | Midnight UTC | Persistent counter |
| Monthly data volume | 1st of month | Persistent counter |

**Quota Exceeded Behavior:**

| Quota Type | When Exceeded | Recovery |
|------------|---------------|----------|
| Hourly | 429, retry after 60 min | Automatic |
| Daily | 429, retry tomorrow | Automatic |
| Monthly | 429, upgrade required | Manual |

---

## 4. Ingestion vs Alert Coordination

### 4.1 Alert Evaluation Timing

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   INGESTION → ALERT COORDINATION                             │
│                                                                             │
│  INGESTION                                                                  │
│  ──────────                                                                 │
│  T+0:00  Ingestion starts                                                   │
│  T+0:30  Dimension upsert complete                                          │
│  T+1:00  Fact upsert complete                                               │
│  T+1:05  Validation complete                                                │
│  T+1:10  IngestionCompleteEvent emitted                                     │
│                                                                             │
│  DEBOUNCE WINDOW                                                            │
│  ───────────────                                                            │
│  T+1:10 to T+6:10  5-minute debounce window                                 │
│                    (wait for additional ingestions)                         │
│                                                                             │
│  ALERT EVALUATION                                                           │
│  ────────────────                                                           │
│  T+6:10  Debounce expires, no new ingestions                                │
│  T+6:15  Alert evaluation starts                                            │
│  T+7:00  Alert evaluation complete                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Alert Spam Prevention

**Problem:** Multiple rapid ingestions could trigger multiple alert evaluations.

**Solution:** Debounce and consolidate.

| Strategy | Implementation |
|----------|----------------|
| DEBOUNCE | Wait 5 minutes after last ingestion before evaluating |
| CONSOLIDATE | Single evaluation covers all recent ingestions |
| DEDUPLICATE | Natural key prevents duplicate alerts |

### 4.3 Debounce Strategy

```
DebounceState {
  workspace_id: uuid
  client_id: uuid
  last_ingestion_at: timestamp
  pending_evaluation: boolean
  affected_date_range: { start: date, end: date }
}

FUNCTION onIngestionComplete(event):
  state = GET_OR_CREATE_DEBOUNCE_STATE(event.workspace_id, event.client_id)

  # Extend affected range
  state.affected_date_range = MERGE_RANGES(
    state.affected_date_range,
    event.metrics_affected.date_range
  )
  state.last_ingestion_at = now()
  state.pending_evaluation = TRUE

  # Schedule evaluation (will be deferred if more ingestions arrive)
  SCHEDULE_AFTER(5 minutes):
    IF now() - state.last_ingestion_at >= 5 minutes:
      TRIGGER_ALERT_EVALUATION(state)
      state.pending_evaluation = FALSE
      state.affected_date_range = NULL
```

### 4.4 Partial Data Protection

**Problem:** Alert evaluation on incomplete data may produce false alerts.

**Protection Strategies:**

| Strategy | When Applied |
|----------|--------------|
| Minimum completeness | Require >90% expected rows |
| Time threshold | Only evaluate data older than 2 hours |
| Source validation | Ensure all expected platforms ingested |

**Partial Ingestion Handling:**

| Scenario | Behavior |
|----------|----------|
| Ingestion failed | Do not trigger alert evaluation |
| Ingestion partially_completed | Evaluate with warning flag |
| Ingestion completed | Normal evaluation |

### 4.5 Alert Delay Configuration

| Setting | Default | Range | Purpose |
|---------|---------|-------|---------|
| debounce_minutes | 5 | 1-30 | Wait time after ingestion |
| min_data_age_hours | 2 | 0-24 | Minimum data staleness |
| max_evaluation_delay_hours | 6 | 1-24 | Force evaluation ceiling |

**Delay Logic:**

```
FUNCTION shouldEvaluateAlerts(client_id):
  last_ingestion = GET_LAST_INGESTION_TIME(client_id)
  last_evaluation = GET_LAST_EVALUATION_TIME(client_id)

  # Debounce check
  IF now() - last_ingestion < debounce_minutes:
    RETURN FALSE

  # Data age check
  oldest_metric_date = GET_OLDEST_UNEVALUATED_METRIC_DATE(client_id)
  IF now() - oldest_metric_date < min_data_age_hours:
    RETURN FALSE

  # Force evaluation ceiling
  IF last_evaluation IS NULL OR now() - last_evaluation > max_evaluation_delay_hours:
    RETURN TRUE

  RETURN TRUE
```

---

## 5. Failure & Retry Boundary

### 5.1 Retry Decision Matrix

| Failure Type | Retryable | Max Retries | Backoff |
|--------------|-----------|-------------|---------|
| Network timeout | YES | 3 | Exponential |
| Rate limit (429) | YES | 5 | Rate-limit specific |
| Authentication failed | NO | 0 | N/A |
| Invalid credentials | NO | 0 | N/A |
| Parse error | NO | 0 | N/A |
| Schema violation | NO | 0 | N/A |
| Partial success | PARTIAL | 1 | Fixed delay |

### 5.2 Retry Backoff Strategy

```
RetryPolicy {
  max_attempts: 3
  initial_delay_ms: 1000
  max_delay_ms: 300000      # 5 minutes
  backoff_multiplier: 2
  jitter_factor: 0.1
}

Attempt 1: Immediate
Attempt 2: 1000ms × (1 + random(0, 0.1)) = ~1000-1100ms
Attempt 3: 2000ms × (1 + random(0, 0.1)) = ~2000-2200ms
Attempt 4: STOP (max_attempts exceeded)
```

### 5.3 Rate-Limit Specific Backoff

When receiving 429 Too Many Requests:

```
FUNCTION handleRateLimitResponse(response):
  IF response.headers['Retry-After']:
    delay = PARSE_SECONDS(response.headers['Retry-After'])
    delay = MIN(delay, 3600)  # Cap at 1 hour
  ELSE:
    delay = 60  # Default 1 minute

  SCHEDULE_RETRY_AFTER(delay)
```

### 5.4 When Ingestion Stops Permanently

| Condition | Action | Recovery |
|-----------|--------|----------|
| Max retries exceeded | Mark FAILED | Manual intervention |
| Invalid credentials | Mark FAILED, disable schedule | Re-authenticate |
| Workspace suspended | Mark FAILED | Account resolution |
| Schema contract violation | Mark FAILED | Code fix required |
| Platform API discontinued | Mark FAILED | Configuration update |

### 5.5 Human Intervention Required

| Trigger | Notification | Required Action |
|---------|--------------|-----------------|
| 3 consecutive failures | Email to workspace admin | Review and retry |
| Credential expiration | Email + in-app alert | Re-authenticate |
| Rate limit sustained 24h | Email to workspace admin | Review usage |
| Schema violation | Alert to ops team | Code deployment |

### 5.6 Failure Escalation Path

```
Level 1: Automatic Retry (0-3 attempts)
    │
    ▼ (all retries failed)
Level 2: Deferred Retry (next scheduled window)
    │
    ▼ (2 consecutive scheduled failures)
Level 3: Notify Workspace Admin
    │
    ▼ (no action for 24h)
Level 4: Disable Schedule, Notify Admin + Ops
    │
    ▼ (requires manual re-enablement)
Level 5: Manual Resolution Required
```

---

## 6. Observability & Control Signals

### 6.1 Ingestion Boundary Log Events

| Event | Level | Required Fields | Trigger |
|-------|-------|-----------------|---------|
| ingestion.boundary.request_received | INFO | request_id, entry_point, workspace_id, client_id | Request arrives |
| ingestion.boundary.auth_check | DEBUG | request_id, auth_method, result | Auth validation |
| ingestion.boundary.rate_limit_check | DEBUG | request_id, current_count, limit, result | Rate check |
| ingestion.boundary.quota_check | DEBUG | request_id, quota_used, quota_limit, result | Quota check |
| ingestion.boundary.concurrency_check | DEBUG | request_id, active_count, limit, result | Concurrency check |
| ingestion.boundary.request_allowed | INFO | request_id, entry_point | All checks pass |
| ingestion.boundary.request_rejected | WARN | request_id, rejection_reason, retry_after | Check fails |
| ingestion.schedule.triggered | INFO | schedule_id, workspace_id, client_id, platform | Schedule fires |
| ingestion.schedule.skipped | INFO | schedule_id, skip_reason | Schedule skipped |
| ingestion.schedule.deferred | INFO | schedule_id, defer_reason, next_attempt | Schedule deferred |
| ingestion.debounce.started | DEBUG | workspace_id, client_id, window_end | Debounce begins |
| ingestion.debounce.extended | DEBUG | workspace_id, client_id, new_window_end | Debounce extended |
| ingestion.debounce.expired | INFO | workspace_id, client_id, ingestion_count | Debounce complete |

### 6.2 Scheduling Health Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| ingestion_boundary_requests_total | Counter | entry_point, result | Total requests by outcome |
| ingestion_boundary_latency_ms | Histogram | entry_point | Request processing time |
| ingestion_rate_limit_remaining | Gauge | workspace_id, client_id | Remaining quota |
| ingestion_concurrent_active | Gauge | workspace_id | Active ingestions |
| ingestion_schedule_executions_total | Counter | schedule_type, result | Scheduled runs by outcome |
| ingestion_schedule_lag_seconds | Histogram | schedule_type | Delay from scheduled time |
| ingestion_retry_total | Counter | failure_type | Retry attempts |
| ingestion_debounce_duration_seconds | Histogram | — | Debounce window duration |
| alert_evaluation_lag_seconds | Histogram | trigger_type | Time from ingestion to evaluation |

### 6.3 Alert Correlation

| Ingestion Event | Correlated Alert Event | Correlation Key |
|-----------------|------------------------|-----------------|
| IngestionCompleteEvent | evaluation.started | upload_id, workspace_id, client_id |
| ingestion.boundary.request_allowed | evaluation.triggered | request_id → batch_id |
| ingestion.schedule.triggered | evaluation.scheduled | schedule_id |

**Correlation ID Propagation:**

```
ingestion.request_id
    │
    ├── ingestion.upload_id (data_uploads.id)
    │       │
    │       └── (carries through D6.5 pipeline)
    │
    └── alert_evaluation.batch_id (via IngestionCompleteEvent)
            │
            └── (carries through D6.6 evaluation)
```

### 6.4 Control Signals

| Signal | Source | Action |
|--------|--------|--------|
| PAUSE_INGESTION | Ops command | Reject all new ingestions |
| RESUME_INGESTION | Ops command | Accept ingestions again |
| PAUSE_SCHEDULE | Admin setting | Disable scheduled runs |
| RESUME_SCHEDULE | Admin setting | Enable scheduled runs |
| FORCE_EVALUATION | Ops command | Trigger immediate alert evaluation |
| CLEAR_DEBOUNCE | Ops command | Reset debounce state, evaluate now |

**Control Signal Implementation:**

```
ControlState {
  ingestion_paused: boolean
  scheduling_paused: boolean
  maintenance_mode: boolean
  force_evaluation_pending: Set<client_id>
}

FUNCTION checkControlSignals():
  IF ControlState.maintenance_mode:
    RETURN REJECT("System maintenance")
  IF ControlState.ingestion_paused:
    RETURN REJECT("Ingestion paused by operator")
  IF ControlState.scheduling_paused AND entry_point == 'SCHEDULED':
    RETURN SKIP("Scheduling paused")
  RETURN ALLOW
```

### 6.5 Dashboard Indicators

| Indicator | Source | Display |
|-----------|--------|---------|
| Last successful ingestion | data_uploads | Timestamp |
| Last scheduled run | schedule execution log | Timestamp |
| Current queue depth | active ingestion count | Number |
| Rate limit status | quota tracking | Percentage used |
| Alert evaluation status | last evaluation time | Timestamp |
| System health | all metrics combined | Green/Yellow/Red |

---

## 7. Freeze & Safety Confirmation

### 7.1 Schema Compliance

| D4 Freeze Requirement | D6.7.1 Compliance |
|-----------------------|-------------------|
| No new tables | COMPLIANT — no schema defined |
| No new columns | COMPLIANT — no columns defined |
| No schema modifications | COMPLIANT — design only |
| data_uploads unchanged | COMPLIANT — uses existing fields |

### 7.2 Alert Logic Isolation

| Boundary | Enforcement |
|----------|-------------|
| Ingestion does not evaluate alerts | Separated by debounce window |
| Ingestion does not write to alerts | No access to alerts table |
| Alert evaluation does not trigger ingestion | One-way dependency |

### 7.3 D6.7 API Pull Compatibility

| API Pull Requirement | D6.7.1 Support |
|---------------------|----------------|
| Scheduled execution | Schedule model defined |
| Rate limit respect | Per-platform limits defined |
| Credential management | Authentication check defined |
| Backfill support | Backfill windows defined |
| Catch-up behavior | Consolidation strategy defined |

### 7.4 D6.8 Webhook Compatibility

| Webhook Requirement | D6.7.1 Support |
|--------------------|-----------------|
| Event-triggered entry | Entry point defined |
| Signature validation | Authentication check defined |
| Rate limiting | Per-client caps defined |
| Concurrency protection | Client-level serialization defined |
| Debounce coordination | Debounce strategy applies |

### 7.5 No Breaking Changes

| Existing Behavior | Impact |
|-------------------|--------|
| Manual CSV upload | Governed by this contract |
| Alert generation | Unchanged, coordinated via debounce |
| Alert UI | Unchanged |
| Existing schedules | Would use this model when implemented |

### 7.6 Safety Summary

| Safety Property | Mechanism |
|-----------------|-----------|
| No system overload | Concurrency limits, rate limits |
| No alert spam | Debounce window, consolidation |
| No partial data alerts | Minimum completeness, data age |
| No credential exposure | Authentication at boundary |
| Auditable scheduling | Log events, metrics |
| Graceful degradation | Skip and defer on failures |

---

## 8. Implementation Checklist

For the implementing engineer:

### 8.1 Pre-Implementation

| Check | Verified |
|-------|----------|
| Read D6.4 Ingestion Architecture | |
| Read D6.5 Ingestion Execution Blueprint | |
| Read D6.6 Alert Evaluation Runtime | |
| Understand existing data_uploads flow | |

### 8.2 Implementation Order

| Order | Component | Dependencies |
|-------|-----------|--------------|
| 1 | Rate limit tracker | None |
| 2 | Quota tracker | None |
| 3 | Concurrency manager | None |
| 4 | Boundary gate (all checks) | 1, 2, 3 |
| 5 | Debounce manager | None |
| 6 | Schedule executor | 4 |
| 7 | Retry handler | 4 |
| 8 | Control signal handler | 4 |
| 9 | Observability hooks | All |

### 8.3 Test Requirements

| Test Type | Coverage |
|-----------|----------|
| Unit: Rate limit logic | All tiers |
| Unit: Quota tracking | Reset behavior |
| Unit: Concurrency check | All scopes |
| Integration: Boundary gate | Happy path + rejections |
| Integration: Debounce | Extension behavior |
| Integration: Schedule | Catch-up scenarios |
| Load: Concurrent requests | System limits |

---

## 9. Document Control

| Version | Date | Change |
|---------|------|--------|
| D6.7.1 | 2024-12-28 | Initial ingestion boundary and scheduling contract |

---

## 10. Approval

This document is a control plane contract. Implementation requires separate approval.

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Platform Architect | | | |
| Ops Lead | | | |
| Product Owner | | | |
