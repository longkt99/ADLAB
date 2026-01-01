# AdLab D5.2 Production Monitoring Specification

**Version:** D5.2
**Date:** 2024-12-28
**Status:** PLATFORM-AGNOSTIC MONITORING RULES

---

## 1. Required Log Events

These events MUST be logged in production. No exceptions.

### 1.1 Mandatory Events

| Event | Level | Trigger | Required Fields |
|-------|-------|---------|-----------------|
| SCHEMA_CONTRACT_VIOLATION | CRITICAL | Table/column missing | table, column, query_context |
| QUERY_FAILURE | ERROR | Supabase error returned | table, operation, error_message |
| UNKNOWN_RUNTIME_ERROR | ERROR | Unclassified exception | component, error_message, stack_hash |
| ORDER_BY_SAFETY_RISK | ERROR | NULL in sort column | table, column, record_count |
| RLS_DENIED | WARN | Permission denied | table, operation |
| MUTATION_FAILURE | ERROR | Update/insert fails | table, operation, alert_id |
| BULK_ACTION_FAILURE | ERROR | Bulk operation fails | action_type, attempted_count, error_message |
| BULK_ACTION_SUCCESS | INFO | Bulk operation succeeds | action_type, affected_count |

### 1.2 Event Schema

All log events must include:

```
{
  "timestamp": "ISO8601 format",
  "level": "CRITICAL | ERROR | WARN | INFO | DEBUG",
  "error_code": "From D5.1 taxonomy",
  "context": {
    "page": "Route path",
    "table": "Database table",
    "operation": "select | insert | update | delete"
  },
  "message": "Human-readable description",
  "correlation_id": "Request identifier"
}
```

### 1.3 Minimum Production Log Set

| Category | Events | Justification |
|----------|--------|---------------|
| Schema integrity | SCHEMA_CONTRACT_VIOLATION | System health |
| Query health | QUERY_FAILURE | Feature availability |
| Data integrity | ORDER_BY_SAFETY_RISK | Data quality |
| Security | RLS_DENIED | Access control |
| Operations | MUTATION_FAILURE, BULK_ACTION_* | User actions |

---

## 2. Forbidden Logs

These items MUST NEVER appear in logs. Violation is a security incident.

### 2.1 Never Log

| Data Type | Reason | Alternative |
|-----------|--------|-------------|
| User email addresses | Privacy | user_id only |
| User passwords | Security | Never log |
| API keys | Security | Never log |
| JWT tokens | Security | Never log |
| Supabase service role key | Security | Never log |
| Full request bodies | Privacy | Operation type only |
| Full response bodies | Privacy | Status code only |
| Alert message content | Business data | alert_id only |
| Note content | User data | note_exists: boolean |
| Client names | Business data | client_id only |
| Campaign names | Business data | campaign_id only |
| IP addresses | Privacy | Never log |
| User agent strings | Privacy | Never log |
| Stack traces (client-side) | Security | Never expose to client |

### 2.2 Redaction Rules

If any forbidden data accidentally enters log pipeline:

| Pattern | Detection | Action |
|---------|-----------|--------|
| Email pattern | `*@*.*` | Replace with [REDACTED_EMAIL] |
| JWT pattern | `eyJ...` | Replace with [REDACTED_TOKEN] |
| UUID in message | Keep | UUIDs are not sensitive |
| Error stack | Server only | Never send to client |

---

## 3. Correlation Strategy

### 3.1 Correlation Chain

```
Request → Page → Table → Entity → Alert
```

Every log event should be traceable through this chain.

### 3.2 Correlation Fields

| Field | Source | Purpose | Required |
|-------|--------|---------|----------|
| correlation_id | Generated per request | Trace request lifecycle | YES |
| page | Router path | Identify origin | YES |
| table | Query target | Identify data source | When applicable |
| entity_id | Record ID | Identify specific record | When applicable |
| alert_id | Alert being acted on | Trace alert operations | For alert mutations |

### 3.3 Correlation Examples

**Page Load:**
```
{correlation_id: "req_123"} → {page: "/ads/alerts"} → {table: "alerts"} → {count: 15}
```

**Alert Mutation:**
```
{correlation_id: "req_456"} → {page: "/ads/alerts/abc"} → {table: "alerts"} → {alert_id: "abc"} → {action: "resolve"}
```

**Error Trace:**
```
{correlation_id: "req_789"} → {page: "/ads/metrics"} → {table: "daily_metrics"} → {error_code: "QUERY_FAILURE"}
```

---

## 4. Log Level Mapping

### 4.1 Level Definitions

| Level | Usage | Production Behavior | Retention |
|-------|-------|---------------------|-----------|
| CRITICAL | System integrity compromised | Always log, always alert | Indefinite |
| ERROR | Operation failed, action required | Always log, alert if threshold | 90 days |
| WARN | Unexpected but handled | Always log | 30 days |
| INFO | Normal operations of interest | Always log | 7 days |
| DEBUG | Detailed diagnostics | Production: OFF | Development only |

### 4.2 Level Assignment by Error Code

| Error Code | Level | Rationale |
|------------|-------|-----------|
| DATA_ABSENT_EXPECTED | DEBUG | Normal operation |
| DATA_ABSENT_UNEXPECTED | INFO | Worth tracking |
| QUERY_FAILURE | ERROR | Feature broken |
| RLS_DENIED | WARN | Expected security behavior |
| SCHEMA_CONTRACT_VIOLATION | CRITICAL | System broken |
| ORDER_BY_SAFETY_RISK | ERROR | Data integrity |
| REFERENCE_ORPHANED | INFO | Expected edge case |
| UNKNOWN_RUNTIME_ERROR | ERROR | Needs investigation |

---

## 5. Retention Expectations

### 5.1 Retention by Level

| Level | Minimum Retention | Rationale |
|-------|-------------------|-----------|
| CRITICAL | Indefinite | Audit trail, post-mortems |
| ERROR | 90 days | Investigation window |
| WARN | 30 days | Pattern detection |
| INFO | 7 days | Operational visibility |
| DEBUG | 0 (off in production) | Development only |

### 5.2 Retention by Category

| Category | Retention | Rationale |
|----------|-----------|-----------|
| Schema violations | Indefinite | System health history |
| Security events (RLS) | 90 days | Security audit |
| Query failures | 90 days | Reliability metrics |
| Successful operations | 7 days | Operational metrics |

---

## 6. Metrics

### 6.1 Required Metrics

These metrics MUST be tracked. Implementation is platform-dependent.

| Metric | Type | Aggregation | Purpose |
|--------|------|-------------|---------|
| query_failure_count | Counter | Per hour | Reliability |
| schema_violation_count | Counter | Per hour | System health |
| rls_denial_count | Counter | Per hour | Security |
| mutation_success_rate | Percentage | Per hour | Feature health |
| bulk_action_count | Counter | Per day | Usage |
| page_error_rate | Percentage | Per page, per hour | UX health |

### 6.2 Nice-to-Have Metrics

These provide additional insight but are not required.

| Metric | Type | Purpose |
|--------|------|---------|
| query_latency_p50 | Histogram | Performance |
| query_latency_p99 | Histogram | Performance |
| empty_state_render_count | Counter | Data availability |
| orphan_reference_count | Counter | Data quality |
| filter_usage | Counter | Feature adoption |

---

## 7. Alert Triggers

### 7.1 Must Trigger Alert

| Condition | Threshold | Urgency |
|-----------|-----------|---------|
| SCHEMA_CONTRACT_VIOLATION | > 0 | IMMEDIATE |
| QUERY_FAILURE | > 10 per hour | HIGH |
| UNKNOWN_RUNTIME_ERROR | > 5 per hour | HIGH |
| All pages returning errors | > 50% error rate | IMMEDIATE |

### 7.2 Must NOT Trigger Alert

| Condition | Rationale |
|-----------|-----------|
| Empty data returned | Normal operation |
| Single RLS denial | Expected behavior |
| Single orphaned reference | Expected edge case |
| Single query retry succeeded | Transient issue resolved |
| DEBUG level events | Not production concern |

### 7.3 Alert Response Mapping

| Alert | Response | SLA |
|-------|----------|-----|
| SCHEMA_CONTRACT_VIOLATION | Page on-call, stop deployments | 15 min |
| High QUERY_FAILURE rate | Investigate Supabase/connectivity | 1 hour |
| High UNKNOWN_ERROR rate | Investigate new error pattern | 1 hour |
| High error rate all pages | Check deployment, consider rollback | 15 min |

---

## 8. Monitoring Dashboard Requirements

If a monitoring dashboard is implemented, it should include:

### 8.1 Required Views

| View | Contents | Refresh |
|------|----------|---------|
| System Health | Schema violation count, query failure rate | Real-time |
| Error Distribution | Count by error_code, last 24h | 5 min |
| Page Health | Error rate by page, last 1h | 1 min |
| Recent Errors | Last 50 errors with details | Real-time |

### 8.2 Required Filters

| Filter | Values |
|--------|--------|
| Time range | 1h, 6h, 24h, 7d |
| Error level | CRITICAL, ERROR, WARN, INFO |
| Page | All AdLab routes |
| Error code | All taxonomy codes |

---

## 9. Log Format Examples

### 9.1 Query Failure

```json
{
  "timestamp": "2024-12-28T10:15:30.000Z",
  "level": "ERROR",
  "error_code": "QUERY_FAILURE",
  "correlation_id": "req_abc123",
  "context": {
    "page": "/ads/alerts",
    "table": "alerts",
    "operation": "select"
  },
  "message": "Supabase query failed",
  "details": {
    "supabase_code": "PGRST301",
    "supabase_message": "connection refused"
  }
}
```

### 9.2 Schema Violation

```json
{
  "timestamp": "2024-12-28T10:15:30.000Z",
  "level": "CRITICAL",
  "error_code": "SCHEMA_CONTRACT_VIOLATION",
  "correlation_id": "req_def456",
  "context": {
    "page": "/ads/ad-sets",
    "table": "ad_sets",
    "operation": "select"
  },
  "message": "Required column missing",
  "details": {
    "missing_column": "first_seen_at",
    "query_order_by": "first_seen_at DESC"
  }
}
```

### 9.3 Bulk Action Success

```json
{
  "timestamp": "2024-12-28T10:15:30.000Z",
  "level": "INFO",
  "error_code": null,
  "correlation_id": "req_ghi789",
  "context": {
    "page": "/ads/alerts",
    "table": "alerts",
    "operation": "update"
  },
  "message": "Bulk action completed",
  "details": {
    "action_type": "bulk_resolve",
    "attempted_count": 5,
    "affected_count": 5
  }
}
```

---

## Document Control

| Version | Date | Change |
|---------|------|--------|
| D5.2 | 2024-12-28 | Initial monitoring specification |
