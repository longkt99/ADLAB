# AdLab Runtime Logging Rules

**Version:** D5.1
**Date:** 2024-12-28
**Status:** PRODUCTION SPECIFICATION

---

## 1. Logging Principles

### 1.1 Core Rules

1. Log for diagnosis, not for metrics
2. Never log sensitive data
3. Always include correlation context
4. Use structured logging format
5. Keep messages actionable

### 1.2 Log Levels

| Level | Usage | Retention |
|-------|-------|-----------|
| DEBUG | Empty states, successful operations | Development only |
| INFO | State transitions, orphaned references | 7 days |
| WARN | RLS denials, unexpected empty data | 30 days |
| ERROR | Query failures, unknown exceptions | 90 days |
| CRITICAL | Schema violations, data integrity issues | Indefinite |

---

## 2. What MUST Be Logged

### 2.1 Mandatory Log Events

| Event | Level | Required Fields |
|-------|-------|-----------------|
| Query failure | ERROR | error_code, table_name, operation |
| Schema contract violation | CRITICAL | table_name, column_name, expected_type |
| RLS denial | WARN | table_name, operation |
| Orphaned reference | INFO | source_table, source_id, target_table, target_id |
| Unknown runtime error | ERROR | error_message, component_name |
| Bulk action completion | INFO | action_type, affected_count, success |
| Mutation failure | ERROR | table_name, operation, error_message |

### 2.2 Structured Log Format

```
{
  "timestamp": "ISO8601",
  "level": "ERROR",
  "error_code": "QUERY_FAILURE",
  "context": {
    "page": "/ads/alerts",
    "table": "alerts",
    "operation": "select"
  },
  "message": "Query returned error",
  "details": {
    "supabase_error": "relation does not exist"
  }
}
```

### 2.3 Correlation Fields

| Field | Source | Purpose |
|-------|--------|---------|
| request_id | Generated per request | Trace across operations |
| page | Router path | Identify origin |
| table | Query target | Identify data source |
| operation | select/insert/update | Identify action type |

---

## 3. What MUST NOT Be Logged

### 3.1 Forbidden Data

| Data Type | Reason | Alternative |
|-----------|--------|-------------|
| User email | Privacy | Log user_id only |
| Auth tokens | Security | Never log |
| API keys | Security | Never log |
| Full request body | Privacy | Log operation type only |
| Alert message content | Privacy | Log alert_id only |
| Note content | Privacy | Log note_exists: boolean |
| Client names | Business sensitive | Log client_id only |
| Campaign names | Business sensitive | Log campaign_id only |

### 3.2 Redaction Rules

| Pattern | Action |
|---------|--------|
| Email addresses | Replace with [REDACTED_EMAIL] |
| UUIDs in URLs | Keep (not sensitive) |
| IP addresses | Do not log |
| User agent | Do not log |
| Stack traces | Server-side only, never client |

---

## 4. Page-Specific Logging

### 4.1 Alerts Page (/ads/alerts)

| Event | Log | Level | Fields |
|-------|-----|-------|--------|
| Page load success | NO | - | - |
| Empty result | YES | DEBUG | filter_state, count: 0 |
| Query error | YES | ERROR | error_code, error_message |
| Filter applied | NO | - | - |
| Bulk action started | YES | INFO | action_type, selected_count |
| Bulk action completed | YES | INFO | action_type, affected_count |
| Bulk action failed | YES | ERROR | action_type, error_message |

### 4.2 Alert Detail Page (/ads/alerts/[id])

| Event | Log | Level | Fields |
|-------|-----|-------|--------|
| Alert loaded | NO | - | - |
| Alert not found | YES | WARN | alert_id |
| Trace entity missing | YES | INFO | entity_type, entity_id |
| Mark read success | NO | - | - |
| Mark read failure | YES | ERROR | alert_id, error_message |
| Resolve success | NO | - | - |
| Resolve failure | YES | ERROR | alert_id, error_message |
| Note save success | NO | - | - |
| Note save failure | YES | ERROR | alert_id, error_message |

### 4.3 Metrics Page (/ads/metrics)

| Event | Log | Level | Fields |
|-------|-----|-------|--------|
| Page load success | NO | - | - |
| Daily metrics empty | YES | DEBUG | count: 0 |
| Demographic metrics empty | YES | DEBUG | count: 0 |
| Query error (daily) | YES | ERROR | error_code, section: 'daily' |
| Query error (demographic) | YES | ERROR | error_code, section: 'demographic' |

### 4.4 Reports Page (/ads/reports)

| Event | Log | Level | Fields |
|-------|-----|-------|--------|
| Page load success | NO | - | - |
| Empty result | YES | DEBUG | count: 0 |
| Query error | YES | ERROR | error_code, error_message |

### 4.5 Entity Pages (clients, campaigns, ad-sets, ads)

| Event | Log | Level | Fields |
|-------|-----|-------|--------|
| Page load success | NO | - | - |
| Empty result | YES | DEBUG | entity_type, count: 0 |
| Query error | YES | ERROR | entity_type, error_code |

---

## 5. Correlation Strategy

### 5.1 Request-to-Screen Correlation

```
Request ID → Page Path → Table → Operation → Result
```

Example trace:
```
req_abc123 → /ads/alerts → alerts → select → success (count: 15)
req_abc123 → /ads/alerts → alerts → select → success (filter: severity=critical, count: 3)
```

### 5.2 Entity Correlation

```
Alert ID → Client ID → Campaign ID → Ad Set ID → Ad ID
```

When logging orphaned references:
```
{
  "error_code": "REFERENCE_ORPHANED",
  "source": { "table": "alerts", "id": "alert_123" },
  "target": { "table": "campaigns", "id": "campaign_456" },
  "relationship": "campaign_id"
}
```

### 5.3 Action Correlation

```
User Action → Mutation → Result → Revalidation
```

Example:
```
action: bulk_resolve → mutation: update alerts → result: 5 affected → revalidate: /ads/alerts
```

---

## 6. Log Aggregation Rules

### 6.1 Aggregation Boundaries

| Aggregate By | Window | Purpose |
|--------------|--------|---------|
| error_code | 1 hour | Detect error spikes |
| table_name | 1 hour | Detect table-specific issues |
| page | 1 hour | Detect page-specific issues |

### 6.2 Alert Thresholds

| Condition | Threshold | Action |
|-----------|-----------|--------|
| SCHEMA_CONTRACT_VIOLATION | > 0 | Immediate alert |
| QUERY_FAILURE | > 10/hour | Alert |
| RLS_DENIED | > 50/hour | Monitor |
| UNKNOWN_RUNTIME_ERROR | > 5/hour | Alert |

---

## 7. Development vs Production

### 7.1 Development Mode

| Behavior | Enabled |
|----------|---------|
| DEBUG level logs | YES |
| Console output | YES |
| Stack traces | YES |
| Request body logging | NO (never) |

### 7.2 Production Mode

| Behavior | Enabled |
|----------|---------|
| DEBUG level logs | NO |
| Console output | NO |
| Stack traces | Server-side only |
| Request body logging | NO (never) |
| Log aggregation | YES |
| Alert integration | YES |

---

## Document Control

| Version | Date | Change |
|---------|------|--------|
| D5.1 | 2024-12-28 | Initial logging specification |
