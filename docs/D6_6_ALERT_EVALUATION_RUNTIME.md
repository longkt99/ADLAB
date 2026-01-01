# D6.6 — Alert Evaluation Runtime Design

**Version:** D6.6
**Date:** 2024-12-28
**Status:** PRODUCTION-CONTRACT
**Classification:** ALERTING SYSTEM CORE
**Dependencies:**
- D6.4 Ingestion Architecture Design (FROZEN)
- D6.5 Ingestion Execution Blueprint (FROZEN)
- D5.1 Observability Specification (FROZEN)
- D4 Schema Contract (FROZEN)

---

## 1. Alert Evaluation Trigger Model

### 1.1 Evaluation Triggers

| Trigger Type | Description | Frequency | Scope |
|--------------|-------------|-----------|-------|
| POST_INGESTION | Triggered after ingestion completes | Per ingestion | Affected date range |
| SCHEDULED | Periodic background evaluation | Configurable (default: hourly) | Full active rule set |
| MANUAL | User-initiated rule evaluation | On-demand | Specified rules/entities |

### 1.2 Post-Ingestion Trigger

**Source Event:** `IngestionCompleteEvent` from D6.5 Alert Boundary Notifier

```
IngestionCompleteEvent {
  upload_id: uuid
  workspace_id: uuid
  client_id: uuid
  platform: string
  status: 'completed' | 'partially_completed'
  metrics_affected: {
    daily_count: number
    demographic_count: number
    date_range: { start: date, end: date }
  }
  timestamp: ISO8601
}
```

**Evaluation Scope Derived From Event:**

| Event Field | Evaluation Filter |
|-------------|-------------------|
| workspace_id | Evaluate rules WHERE workspace_id = ? |
| client_id | Evaluate rules WHERE client_id = ? OR client_id IS NULL |
| platform | Evaluate rules WHERE platform = ? OR platform IS NULL |
| date_range | Evaluate metrics WHERE metric_date BETWEEN start AND end |

### 1.3 Scheduled Trigger

**Purpose:** Catch alerts for:
- Rules spanning multiple ingestion windows
- Late-arriving data corrections
- Time-based rules (e.g., "no data for 24 hours")

**Schedule Contract:**

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Default interval | 60 minutes | Balance freshness vs load |
| Minimum interval | 15 minutes | Prevent overload |
| Maximum interval | 24 hours | Ensure daily coverage |
| Execution window | Off-peak hours preferred | Minimize user-facing impact |

**Scope:** All enabled rules for the workspace.

### 1.4 Manual Trigger

**Use Cases:**
- Rule testing during creation
- Re-evaluation after rule modification
- Debugging alert behavior

**Constraints:**

| Constraint | Value |
|------------|-------|
| Rate limit | 10 requests per minute per workspace |
| Max rules per request | 100 |
| Max date range | 90 days |

### 1.5 Fact Tables Triggering Evaluation

| Table | Triggers Evaluation | Reason |
|-------|---------------------|--------|
| daily_metrics | YES | Primary metric source |
| demographic_metrics | YES | Demographic rules |
| campaigns | NO | Dimension changes don't trigger alerts |
| ad_sets | NO | Dimension changes don't trigger alerts |
| ads | NO | Dimension changes don't trigger alerts |

**Invariant:** Only FACT table changes trigger alert evaluation. DIMENSION changes are informational only.

### 1.6 Batch vs Incremental Evaluation

| Mode | Description | Use Case |
|------|-------------|----------|
| INCREMENTAL | Evaluate only affected date range | Post-ingestion |
| BATCH | Evaluate full window_days range | Scheduled, manual |

**Incremental Evaluation (Default for Post-Ingestion):**

```
Input: IngestionCompleteEvent
Output: Alerts for affected date range only

1. Identify affected (workspace_id, client_id, platform, date_range)
2. Load applicable alert_rules
3. Query metrics ONLY for date_range.start to date_range.end
4. Evaluate rules against filtered metrics
5. Generate/update alerts
```

**Batch Evaluation (Scheduled):**

```
Input: Workspace ID, optional rule filter
Output: Alerts for full window_days

1. Load all enabled alert_rules for workspace
2. For each rule, query metrics for (today - window_days) to today
3. Evaluate each rule
4. Generate/update alerts
```

### 1.7 Evaluation Window Semantics (window_days)

The `window_days` field on `alert_rules` defines the lookback period.

| window_days Value | Interpretation | Metric Query Range |
|-------------------|----------------|-------------------|
| 1 | Single day | metric_date = evaluation_date |
| 7 | Rolling week | metric_date BETWEEN (evaluation_date - 6) AND evaluation_date |
| 30 | Rolling month | metric_date BETWEEN (evaluation_date - 29) AND evaluation_date |
| NULL | Default (7 days) | Same as 7 |

**Aggregation Over Window:**

| metric_key | Aggregation | Example |
|------------|-------------|---------|
| spend | SUM | Total spend over window |
| impressions | SUM | Total impressions over window |
| clicks | SUM | Total clicks over window |
| ctr | AVG | Average CTR over window |
| cpc | AVG | Average CPC over window |
| cpm | AVG | Average CPM over window |
| conversions | SUM | Total conversions over window |
| cpa | AVG | Average CPA over window |

---

## 2. Rule Scoping & Targeting

### 2.1 Rule Scope Hierarchy

```
alert_rules.scope determines which entities the rule applies to:

┌─────────────────────────────────────────────────────────────────────────────┐
│                        RULE SCOPE HIERARCHY                                  │
│                                                                             │
│   scope = 'workspace'                                                       │
│   ─────────────────────                                                     │
│   Rule applies to: ALL entities in workspace                                │
│   Evaluated at: Workspace aggregate level OR per-entity (based on config)  │
│                                                                             │
│   scope = 'client'                                                          │
│   ───────────────                                                           │
│   Rule applies to: ALL entities under specified client_id                   │
│   Evaluated at: Client aggregate level OR per-entity                        │
│                                                                             │
│   scope = 'campaign'                                                        │
│   ────────────────                                                          │
│   Rule applies to: Single campaign and its children (ad_sets, ads)          │
│   Evaluated at: Campaign level aggregate                                    │
│                                                                             │
│   scope = 'ad_set'                                                          │
│   ──────────────                                                            │
│   Rule applies to: Single ad_set and its children (ads)                     │
│   Evaluated at: Ad Set level aggregate                                      │
│                                                                             │
│   scope = 'ad'                                                              │
│   ──────────                                                                │
│   Rule applies to: Single ad                                                │
│   Evaluated at: Ad level (no aggregation)                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Entity Targeting

| alert_rules Field | Targeting Behavior |
|-------------------|-------------------|
| client_id = NULL | Rule applies to ALL clients in workspace |
| client_id = X | Rule applies ONLY to client X |
| platform = NULL | Rule applies to ALL platforms |
| platform = 'meta' | Rule applies ONLY to Meta platform |
| scope = 'campaign' | Evaluate at campaign granularity |
| scope = 'ad' | Evaluate at individual ad granularity |

### 2.3 Entity Resolution Matrix

| Rule Fields | Metrics Queried | Alert Generated For |
|-------------|-----------------|---------------------|
| client_id=NULL, scope='client' | All clients aggregated separately | Each client |
| client_id=X, scope='campaign' | All campaigns under client X | Each campaign |
| client_id=X, scope='ad', platform='meta' | All Meta ads under client X | Each ad |

### 2.4 Rule Resolution Precedence

When multiple rules could apply to the same entity:

| Priority | Rule Type | Resolution |
|----------|-----------|------------|
| 1 (highest) | Entity-specific (scope='ad', specific ad_id) | Wins |
| 2 | Scope-specific (scope='ad_set') | Applies if no ad-level rule |
| 3 | Client-level (scope='client', client_id=X) | Applies if no narrower rule |
| 4 (lowest) | Workspace-wide (client_id=NULL) | Default fallback |

### 2.5 Conflict Handling

**Definition:** Conflict occurs when the same metric for the same entity is evaluated by multiple rules with different thresholds.

**Resolution Strategy:** ALL applicable rules are evaluated independently.

| Scenario | Behavior | Alerts Generated |
|----------|----------|------------------|
| Rule A: spend > 1000, Rule B: spend > 500 | Both evaluate | 0, 1, or 2 alerts |
| Rule A: client X spend > 100, Rule B: all clients spend > 200 | Both evaluate | Each produces independent alert |

**Rationale:** Users explicitly create rules; suppressing any would violate intent.

### 2.6 Platform-Level Targeting

| alert_rules.platform | Behavior |
|----------------------|----------|
| NULL | Evaluate across all platforms (aggregate or per-platform based on scope) |
| 'meta' | Evaluate ONLY Meta metrics |
| 'google' | Evaluate ONLY Google Ads metrics |
| 'tiktok' | Evaluate ONLY TikTok metrics |

**Cross-Platform Aggregation:**

When `platform = NULL` and `scope = 'client'`:
- Metrics from all platforms are aggregated together
- Single alert generated for combined metric

When `platform = NULL` and `scope = 'ad'`:
- Each ad evaluated separately (ads are platform-specific)
- Alerts generated per-ad with platform context

---

## 3. Metric Resolution

### 3.1 metric_key Mapping

| metric_key | Source Table | Source Column | Data Type |
|------------|--------------|---------------|-----------|
| spend | daily_metrics | spend | NUMERIC |
| impressions | daily_metrics | impressions | INTEGER |
| reach | daily_metrics | reach | INTEGER |
| clicks | daily_metrics | clicks | INTEGER |
| link_clicks | daily_metrics | link_clicks | INTEGER |
| ctr | daily_metrics | ctr | NUMERIC |
| cpc | daily_metrics | cpc | NUMERIC |
| cpm | daily_metrics | cpm | NUMERIC |
| conversions | daily_metrics | conversions | INTEGER |
| conversion_value | daily_metrics | conversion_value | NUMERIC |
| cpa | daily_metrics | cpa | NUMERIC |
| video_views | daily_metrics | video_views | INTEGER |

### 3.2 Demographic Metric Keys

| metric_key | Source Table | Additional Filters |
|------------|--------------|-------------------|
| demo_spend | demographic_metrics | dimension, key |
| demo_impressions | demographic_metrics | dimension, key |
| demo_clicks | demographic_metrics | dimension, key |
| demo_conversions | demographic_metrics | dimension, key |

**Demographic Rule Example:**

```
Rule: "Alert if spend for age 18-24 exceeds $500"
  metric_key: 'demo_spend'
  additional_filters: { dimension: 'age', key: '18-24' }
  threshold: 500
  operator: '>'
```

### 3.3 Aggregation Rules

| Aggregation | Applicable Metrics | Formula |
|-------------|-------------------|---------|
| SUM | spend, impressions, reach, clicks, conversions, video_views | SUM(value) over window |
| AVG | ctr, cpc, cpm, cpa | AVG(value) over window |
| LAST | N/A (all metrics aggregated) | Not used |
| MIN | Any | MIN(value) over window |
| MAX | Any | MAX(value) over window |

**Default Aggregation per Metric:**

| metric_key | Default Aggregation |
|------------|---------------------|
| spend | SUM |
| impressions | SUM |
| clicks | SUM |
| ctr | AVG |
| cpc | AVG |
| cpm | AVG |
| conversions | SUM |
| cpa | AVG |

### 3.4 Handling Missing Data

| Scenario | Detection | Behavior |
|----------|-----------|----------|
| No metrics for date range | Query returns empty | Treat as 0 for SUM, NULL for AVG |
| Partial data in window | Some days missing | Aggregate available data only |
| All NULL values | All metric values NULL | Skip evaluation, no alert |
| Zero values | Metric = 0 | Evaluate normally (0 is valid) |

**Zero vs Missing Distinction:**

| State | Meaning | Evaluation |
|-------|---------|------------|
| spend = 0 | No spend occurred | Evaluate: 0 < threshold? |
| spend IS NULL | Data not available | Skip this data point |
| No row exists | No data ingested | Treat as missing (NULL aggregate) |

### 3.5 Metric Query Template

```
SELECT
  {aggregation}({metric_column}) as metric_value
FROM daily_metrics
WHERE workspace_id = :workspace_id
  AND (:client_id IS NULL OR client_id = :client_id)
  AND (:platform IS NULL OR platform = :platform)
  AND (:campaign_id IS NULL OR campaign_id = :campaign_id)
  AND (:ad_set_id IS NULL OR ad_set_id = :ad_set_id)
  AND (:ad_id IS NULL OR ad_id = :ad_id)
  AND metric_date BETWEEN :window_start AND :window_end
GROUP BY {entity_grouping}
```

---

## 4. Evaluation Algorithm (Logical)

### 4.1 High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     ALERT EVALUATION ALGORITHM                               │
│                                                                             │
│  ┌─────────────┐                                                            │
│  │ 1. TRIGGER  │◄─── IngestionCompleteEvent OR Schedule OR Manual          │
│  └──────┬──────┘                                                            │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────┐                                                        │
│  │ 2. LOAD RULES   │◄─── Filter by workspace, client, platform, is_enabled │
│  └──────┬──────────┘                                                        │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────┐                                                        │
│  │ 3. RESOLVE      │◄─── For each rule, identify target entities           │
│  │    TARGETS      │                                                        │
│  └──────┬──────────┘                                                        │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────┐                                                        │
│  │ 4. QUERY        │◄─── Fetch metrics for each (rule, entity, window)     │
│  │    METRICS      │                                                        │
│  └──────┬──────────┘                                                        │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────┐                                                        │
│  │ 5. AGGREGATE    │◄─── Apply aggregation function (SUM, AVG, etc.)       │
│  └──────┬──────────┘                                                        │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────┐                                                        │
│  │ 6. COMPARE      │◄─── metric_value {operator} threshold                 │
│  └──────┬──────────┘                                                        │
│         │                                                                   │
│     ┌───┴───┐                                                               │
│     │       │                                                               │
│   PASS    FAIL                                                              │
│     │       │                                                               │
│     ▼       ▼                                                               │
│  ┌──────┐ ┌─────────────────┐                                               │
│  │ SKIP │ │ 7. GENERATE     │◄─── Create or update alert record            │
│  └──────┘ │    ALERT        │                                               │
│           └──────┬──────────┘                                               │
│                  │                                                          │
│                  ▼                                                          │
│           ┌─────────────────┐                                               │
│           │ 8. PERSIST      │◄─── Upsert to alerts table                   │
│           │    ALERT        │                                               │
│           └─────────────────┘                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Step-by-Step Algorithm

**STEP 1: TRIGGER**

```
FUNCTION handleTrigger(trigger: Trigger):
  IF trigger.type == 'POST_INGESTION':
    context = {
      workspace_id: trigger.event.workspace_id,
      client_id: trigger.event.client_id,
      platform: trigger.event.platform,
      date_range: trigger.event.metrics_affected.date_range,
      mode: 'INCREMENTAL'
    }
  ELSE IF trigger.type == 'SCHEDULED':
    context = {
      workspace_id: trigger.workspace_id,
      client_id: NULL,  # All clients
      platform: NULL,   # All platforms
      date_range: { start: today - max_window_days, end: today },
      mode: 'BATCH'
    }
  ELSE IF trigger.type == 'MANUAL':
    context = trigger.parameters

  CALL evaluateRules(context)
```

**STEP 2: LOAD RULES**

```
FUNCTION loadRules(context):
  rules = SELECT * FROM alert_rules
    WHERE workspace_id = context.workspace_id
      AND is_enabled = TRUE
      AND (client_id IS NULL OR client_id = context.client_id)
      AND (platform IS NULL OR platform = context.platform)

  RETURN rules
```

**STEP 3: RESOLVE TARGETS**

```
FUNCTION resolveTargets(rule, context):
  targets = []

  IF rule.scope == 'workspace':
    targets = [{ level: 'workspace', entity_id: NULL }]

  ELSE IF rule.scope == 'client':
    IF rule.client_id IS NOT NULL:
      targets = [{ level: 'client', entity_id: rule.client_id }]
    ELSE:
      clients = SELECT id FROM clients WHERE workspace_id = context.workspace_id
      FOR each client IN clients:
        targets.append({ level: 'client', entity_id: client.id })

  ELSE IF rule.scope == 'campaign':
    campaigns = SELECT id FROM campaigns
      WHERE workspace_id = context.workspace_id
        AND (rule.client_id IS NULL OR client_id = rule.client_id)
        AND (rule.platform IS NULL OR platform = rule.platform)
    FOR each campaign IN campaigns:
      targets.append({ level: 'campaign', entity_id: campaign.id })

  ELSE IF rule.scope == 'ad_set':
    ad_sets = SELECT id FROM ad_sets
      WHERE workspace_id = context.workspace_id
        AND (rule.client_id IS NULL OR client_id = rule.client_id)
        AND (rule.platform IS NULL OR platform = rule.platform)
    FOR each ad_set IN ad_sets:
      targets.append({ level: 'ad_set', entity_id: ad_set.id })

  ELSE IF rule.scope == 'ad':
    ads = SELECT id FROM ads
      WHERE workspace_id = context.workspace_id
        AND (rule.client_id IS NULL OR client_id = rule.client_id)
        AND (rule.platform IS NULL OR platform = rule.platform)
    FOR each ad IN ads:
      targets.append({ level: 'ad', entity_id: ad.id })

  RETURN targets
```

**STEP 4: QUERY METRICS**

```
FUNCTION queryMetrics(rule, target, context):
  window_days = rule.window_days OR 7
  window_start = context.date_range.end - (window_days - 1)
  window_end = context.date_range.end

  # Clamp to context date range for incremental mode
  IF context.mode == 'INCREMENTAL':
    window_start = MAX(window_start, context.date_range.start)

  metric_column = RESOLVE_COLUMN(rule.metric_key)
  aggregation = RESOLVE_AGGREGATION(rule.metric_key)

  query = "
    SELECT {aggregation}({metric_column}) as metric_value
    FROM daily_metrics
    WHERE workspace_id = :workspace_id
      AND metric_date BETWEEN :window_start AND :window_end
  "

  # Add entity filter based on target level
  IF target.level == 'client':
    query += " AND client_id = :entity_id"
  ELSE IF target.level == 'campaign':
    query += " AND campaign_id = :entity_id"
  ELSE IF target.level == 'ad_set':
    query += " AND ad_set_id = :entity_id"
  ELSE IF target.level == 'ad':
    query += " AND ad_id = :entity_id"

  # Add platform filter
  IF rule.platform IS NOT NULL:
    query += " AND platform = :platform"

  result = EXECUTE(query, parameters)
  RETURN result.metric_value
```

**STEP 5: AGGREGATE**

```
FUNCTION aggregate(metric_values, aggregation):
  IF metric_values IS EMPTY:
    RETURN NULL

  IF aggregation == 'SUM':
    RETURN SUM(metric_values)
  ELSE IF aggregation == 'AVG':
    RETURN AVG(metric_values WHERE value IS NOT NULL)
  ELSE IF aggregation == 'MIN':
    RETURN MIN(metric_values)
  ELSE IF aggregation == 'MAX':
    RETURN MAX(metric_values)
```

**STEP 6: COMPARE**

```
FUNCTION compare(metric_value, operator, threshold):
  IF metric_value IS NULL:
    RETURN { result: 'SKIP', reason: 'NO_DATA' }

  passed = FALSE

  IF operator == '>':
    passed = metric_value > threshold
  ELSE IF operator == '>=':
    passed = metric_value >= threshold
  ELSE IF operator == '<':
    passed = metric_value < threshold
  ELSE IF operator == '<=':
    passed = metric_value <= threshold
  ELSE IF operator == '==':
    passed = metric_value == threshold
  ELSE IF operator == '!=':
    passed = metric_value != threshold

  IF passed:
    RETURN { result: 'TRIGGERED', metric_value: metric_value }
  ELSE:
    RETURN { result: 'PASSED', metric_value: metric_value }
```

**STEP 7: GENERATE ALERT**

```
FUNCTION generateAlert(rule, target, comparison_result, context):
  alert = {
    workspace_id: context.workspace_id,
    client_id: RESOLVE_CLIENT_ID(target),
    rule_id: rule.id,
    platform: rule.platform OR RESOLVE_PLATFORM(target),
    metric_key: rule.metric_key,
    metric_value: comparison_result.metric_value,
    threshold: rule.threshold,
    operator: rule.operator,
    metric_date: context.date_range.end,
    campaign_id: IF target.level IN ('campaign', 'ad_set', 'ad') THEN RESOLVE_CAMPAIGN_ID(target) ELSE NULL,
    ad_set_id: IF target.level IN ('ad_set', 'ad') THEN RESOLVE_AD_SET_ID(target) ELSE NULL,
    ad_id: IF target.level == 'ad' THEN target.entity_id ELSE NULL,
    severity: rule.severity OR 'warning',
    message: CONSTRUCT_MESSAGE(rule, target, comparison_result),
    is_read: FALSE,
    created_at: NOW(),
    updated_at: NOW()
  }

  RETURN alert
```

**STEP 8: PERSIST ALERT**

```
FUNCTION persistAlert(alert):
  natural_key = (
    workspace_id,
    client_id,
    rule_id,
    platform,
    metric_date,
    campaign_id,
    ad_set_id,
    ad_id
  )

  existing = SELECT * FROM alerts WHERE natural_key

  IF existing IS NOT NULL:
    # Update existing alert
    UPDATE alerts SET
      metric_value = alert.metric_value,
      updated_at = NOW()
    WHERE id = existing.id

    RETURN { action: 'UPDATED', alert_id: existing.id }
  ELSE:
    # Insert new alert
    INSERT INTO alerts VALUES alert

    RETURN { action: 'INSERTED', alert_id: alert.id }
```

### 4.3 Result Classification

| Comparison Result | Alert Action | Reason |
|-------------------|--------------|--------|
| TRIGGERED | Generate/Update alert | Threshold exceeded |
| PASSED | No action | Metric within bounds |
| SKIP (NO_DATA) | No action | Cannot evaluate without data |
| SKIP (RULE_DISABLED) | No action | Rule not active |

---

## 5. Alert Generation Contract

### 5.1 When a New Alert Row Is Created

| Condition | Action |
|-----------|--------|
| Threshold exceeded AND no existing alert for natural key | INSERT new alert |
| Threshold exceeded AND existing alert for natural key | UPDATE metric_value, updated_at |
| Threshold not exceeded AND existing unresolved alert | No action (alert persists) |
| Threshold not exceeded AND no existing alert | No action |

**Key Principle:** Alerts are CREATED when thresholds are first exceeded. They are UPDATED if the same condition recurs. They are NOT auto-resolved when thresholds return to normal.

### 5.2 Natural Key for Deduplication

```
AlertNaturalKey {
  workspace_id: uuid      # Required
  client_id: uuid         # Required
  rule_id: uuid           # Required (links to rule that generated it)
  platform: string        # Nullable (if rule is cross-platform)
  metric_date: date       # Required (the evaluation date)
  campaign_id: uuid       # Nullable (based on scope)
  ad_set_id: uuid         # Nullable (based on scope)
  ad_id: uuid             # Nullable (based on scope)
}
```

**Uniqueness:** One alert per (rule, entity, date) combination.

**Implication:** Re-running evaluation for the same date will UPDATE, not duplicate.

### 5.3 Re-Alert vs Suppress Behavior

| Scenario | Behavior |
|----------|----------|
| Same rule, same entity, same date | UPDATE existing alert |
| Same rule, same entity, different date | INSERT new alert |
| Same rule, different entity, same date | INSERT new alert |
| Different rule, same entity, same date | INSERT new alert |

**Re-Alert Window:**

| Condition | Re-alert? |
|-----------|-----------|
| Alert exists, is_read = FALSE | No new notification (update silently) |
| Alert exists, is_read = TRUE | Update alert, optionally re-notify |
| Alert exists, resolved_at NOT NULL | Update alert (re-open implicitly) |

### 5.4 Severity Assignment

| Source | Priority |
|--------|----------|
| alert_rules.severity | Primary |
| Default fallback | 'warning' |

**Severity Values (from D4 schema):**

| Severity | Meaning |
|----------|---------|
| info | Informational, no action required |
| warning | Attention needed, not urgent |
| critical | Immediate action required |

### 5.5 Message Construction Rules

**Message Template:**

```
"{metric_key} {verb} {threshold_description} for {entity_description}"
```

**Components:**

| Component | Generation Rule |
|-----------|-----------------|
| metric_key | Humanized form: 'spend' → 'Spend', 'ctr' → 'CTR' |
| verb | Based on operator: '>' → 'exceeded', '<' → 'dropped below' |
| threshold_description | Formatted value: '$100.00', '5%', '1,000 impressions' |
| entity_description | Entity name or "all campaigns" etc. |

**Message Examples:**

| Rule | Message |
|------|---------|
| spend > 1000, scope='campaign' | "Spend exceeded $1,000.00 for Campaign: Summer Sale" |
| ctr < 0.5, scope='ad' | "CTR dropped below 0.5% for Ad: Blue Banner v2" |
| conversions < 10, scope='client' | "Conversions dropped below 10 for Client: Acme Corp" |

**Message Invariants:**
- No technical jargon
- No internal IDs
- No raw operator symbols
- Always include entity context
- Always include threshold value

---

## 6. Idempotency & Replay Safety

### 6.1 Idempotent Evaluation Guarantee

**Definition:** Running the same evaluation multiple times with the same input produces the same output (alerts).

**Mechanism:**

| Layer | Idempotency Enforcement |
|-------|------------------------|
| Rule loading | Deterministic query with ordering |
| Target resolution | Deterministic entity enumeration |
| Metric query | Same date range, same aggregation |
| Alert persistence | Upsert on natural key |

### 6.2 Natural Key Enforcement

The natural key ensures:

| Property | Guarantee |
|----------|-----------|
| No duplicates | Same (rule, entity, date) = same alert row |
| Safe retries | Re-evaluation updates, never inserts duplicate |
| Audit trail | updated_at tracks re-evaluations |

### 6.3 Replay After Ingestion Retry

**Scenario:** Ingestion fails, is retried, succeeds. Alert evaluation runs twice.

```
Timeline:
  T1: Ingestion attempt 1 → Fails
  T2: Ingestion retry → Succeeds
  T3: Alert evaluation (post-ingestion)
  T4: Manual alert evaluation (user triggered)

Result at T4:
  - Alerts reflect final metric state
  - No duplicate alerts exist
  - updated_at shows T4 timestamp
```

**Why This Works:**
1. Ingestion upserts metrics (natural key)
2. Alert evaluation upserts alerts (natural key)
3. Both operations are idempotent

### 6.4 Safe Reprocessing Contract

| Reprocessing Scenario | Safety |
|-----------------------|--------|
| Same metrics re-ingested | Safe (upsert) |
| Same rules re-evaluated | Safe (upsert) |
| Historical backfill | Safe (upsert with date) |
| Rule modification then re-eval | Safe (new rule_id = new alerts) |

---

## 7. Failure & Error Handling

### 7.1 D5.1 Error Taxonomy Mapping

| Evaluation Failure | D5.1 Error Code | Severity | Behavior |
|--------------------|-----------------|----------|----------|
| Rule query returns error | QUERY_FAILURE | ERROR | Skip rule, continue batch |
| Metric query returns error | QUERY_FAILURE | ERROR | Skip target, continue |
| Entity not found | REFERENCE_ORPHANED | WARN | Skip target, log |
| Metric column missing | SCHEMA_CONTRACT_VIOLATION | CRITICAL | Abort batch |
| Alert insert fails | QUERY_FAILURE | ERROR | Log, continue |
| All metrics NULL | DATA_ABSENT_EXPECTED | INFO | Skip evaluation |
| Unexpected exception | UNKNOWN_RUNTIME_ERROR | ERROR | Log, skip item |

### 7.2 Continue, Skip, Abort Decision Matrix

| Failure Type | Rule-Level | Target-Level | Batch-Level |
|--------------|------------|--------------|-------------|
| Single metric query fails | — | SKIP target | CONTINUE |
| Single rule load fails | SKIP rule | — | CONTINUE |
| Alert persist fails | — | — | CONTINUE |
| Schema violation | — | — | ABORT |
| Database connection lost | — | — | ABORT |
| Unexpected exception | SKIP rule | — | CONTINUE |

### 7.3 Error Recording

| Error Location | Recording Method |
|----------------|------------------|
| Rule-level failure | Log with rule_id, error_code |
| Target-level failure | Log with rule_id, target, error_code |
| Batch-level abort | Log with batch_id, reason, rules_processed |

**No error data written to alerts table.** Alerts only contain successful evaluations.

### 7.4 Partial Evaluation Handling

| Scenario | Behavior |
|----------|----------|
| 10 rules, 1 fails | 9 rules evaluated, 1 logged as failed |
| 100 targets, 5 fail | 95 targets evaluated, 5 logged as skipped |
| Critical failure mid-batch | Abort, log progress, no partial persist |

---

## 8. Observability & Auditability

### 8.1 Required Log Events

| Event | Level | Required Fields |
|-------|-------|-----------------|
| evaluation.started | INFO | batch_id, trigger_type, workspace_id, rule_count |
| evaluation.rule_started | DEBUG | batch_id, rule_id, target_count |
| evaluation.target_evaluated | DEBUG | batch_id, rule_id, target, metric_value, result |
| evaluation.alert_generated | INFO | batch_id, rule_id, alert_id, severity |
| evaluation.alert_updated | DEBUG | batch_id, rule_id, alert_id |
| evaluation.rule_skipped | WARN | batch_id, rule_id, reason |
| evaluation.target_skipped | WARN | batch_id, rule_id, target, reason |
| evaluation.completed | INFO | batch_id, duration_ms, alerts_generated, alerts_updated |
| evaluation.failed | ERROR | batch_id, error_code, error_message |

### 8.2 Required Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| alert_evaluations_total | Counter | workspace_id, trigger_type, status | Total evaluation runs |
| alert_evaluation_duration_seconds | Histogram | workspace_id | Evaluation duration |
| alert_rules_evaluated_total | Counter | workspace_id | Rules processed |
| alert_targets_evaluated_total | Counter | workspace_id, scope | Targets processed |
| alerts_generated_total | Counter | workspace_id, severity | New alerts created |
| alerts_updated_total | Counter | workspace_id | Existing alerts updated |
| alert_evaluation_errors_total | Counter | workspace_id, error_code | Evaluation errors |

### 8.3 Correlation IDs

```
Correlation Hierarchy:

batch_id (evaluation run scope)
    ├── rule_id (rule evaluation scope)
    │       ├── target_id (target evaluation scope)
    │       │       └── alert_id (generated alert scope)
    │       │
    │       └── (repeated for each target)
    │
    └── (repeated for each rule)
```

**All logs MUST include:** batch_id, timestamp, workspace_id

### 8.4 Audit Fields in alerts Table

| Field | Audit Purpose |
|-------|---------------|
| rule_id | Which rule generated this alert |
| metric_key | What metric was evaluated |
| metric_value | Actual value at evaluation time |
| threshold | Rule threshold at evaluation time |
| operator | Comparison operator used |
| metric_date | Date of evaluated metrics |
| created_at | When alert was first generated |
| updated_at | When alert was last updated/re-evaluated |

**Audit Query Example:**

```sql
-- Reconstruct why this alert exists
SELECT
  a.message,
  a.metric_key,
  a.metric_value,
  a.threshold,
  a.operator,
  a.metric_date,
  ar.name as rule_name,
  ar.scope,
  ar.window_days
FROM alerts a
JOIN alert_rules ar ON a.rule_id = ar.id
WHERE a.id = :alert_id
```

### 8.5 Evaluation Audit Trail

For each evaluation batch, persist:

```
EvaluationAuditRecord {
  batch_id: uuid
  workspace_id: uuid
  trigger_type: 'POST_INGESTION' | 'SCHEDULED' | 'MANUAL'
  trigger_source: string  # upload_id, schedule_name, user_id
  started_at: timestamp
  completed_at: timestamp
  rules_total: number
  rules_evaluated: number
  rules_skipped: number
  targets_total: number
  targets_evaluated: number
  targets_skipped: number
  alerts_generated: number
  alerts_updated: number
  errors: number
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED'
}
```

---

## 9. Freeze & Safety Confirmation

### 9.1 Schema Compliance

| D4 Freeze Requirement | D6.6 Design Compliance |
|-----------------------|------------------------|
| No new tables | COMPLIANT — uses existing alert_rules, alerts |
| No new columns | COMPLIANT — all fields from D4 schema |
| No column modifications | COMPLIANT — no ALTER statements |
| alerts table unchanged | COMPLIANT — uses existing columns |
| alert_rules table unchanged | COMPLIANT — uses existing columns |

### 9.2 No Ingestion Coupling

| Boundary | Enforcement |
|----------|-------------|
| Ingestion does not call evaluation directly | Decoupled via IngestionCompleteEvent |
| Evaluation does not modify metrics | Read-only queries |
| Evaluation does not trigger re-ingestion | One-way dependency |

**Coupling Diagram:**

```
INGESTION ──────► IngestionCompleteEvent ──────► EVALUATION
    │                                                 │
    ▼                                                 ▼
daily_metrics                                      alerts
demographic_metrics                                  │
    │                                                 │
    └─────────────────────────────────────────────────┘
                    (read-only)
```

### 9.3 No UX Impact

| UX Component | Impact |
|--------------|--------|
| /ads/alerts page | NONE — reads alerts as before |
| Alert detail page | NONE — existing fields |
| Alert list filters | NONE — existing columns |
| Alert mutations (read, resolve) | NONE — unchanged |
| Alert counts | NONE — standard queries |

### 9.4 Forward Compatibility

| Future Phase | D6.6 Design Supports |
|--------------|----------------------|
| D6.7 API Pull | IngestionCompleteEvent works for any source |
| D6.8 Webhook Push | IngestionCompleteEvent works for any source |
| Alert rule UI | Uses existing alert_rules schema |
| Alert notifications | severity, message ready for notification layer |
| Alert analytics | Audit fields support analysis |

### 9.5 Safety Summary

| Safety Property | Mechanism |
|-----------------|-----------|
| No duplicate alerts | Natural key upsert |
| No data corruption | Read-only metric access |
| No cascading failures | Skip-and-continue error handling |
| No silent failures | Comprehensive logging |
| Deterministic output | Idempotent evaluation |
| Auditable history | Rule + metric snapshot in alert |

---

## 10. Implementation Checklist

For the implementing engineer:

### 10.1 Pre-Implementation

| Check | Verified |
|-------|----------|
| Read D6.4 Ingestion Architecture | |
| Read D6.5 Ingestion Execution Blueprint | |
| Read D5.1 Observability Specification | |
| Confirm alert_rules table exists with required columns | |
| Confirm alerts table exists with required columns | |
| Confirm IngestionCompleteEvent is emitted by D6.5 | |

### 10.2 Implementation Order

| Order | Component | Dependencies |
|-------|-----------|--------------|
| 1 | Metric query builder | None |
| 2 | Aggregation functions | Metric query builder |
| 3 | Comparison engine | None |
| 4 | Message constructor | None |
| 5 | Alert generator | Aggregation, comparison, message |
| 6 | Alert persister (upsert) | Alert generator |
| 7 | Rule loader | None |
| 8 | Target resolver | Rule loader |
| 9 | Evaluation orchestrator | All components |
| 10 | Trigger handlers | Evaluation orchestrator |

### 10.3 Test Requirements

| Test Type | Coverage Target |
|-----------|-----------------|
| Unit: Comparison operators | All 6 operators |
| Unit: Aggregation functions | SUM, AVG, MIN, MAX |
| Unit: Message construction | All patterns |
| Integration: Single rule evaluation | Happy path |
| Integration: Multi-rule batch | Parallel rules |
| Integration: Natural key upsert | No duplicates |
| Integration: Error handling | Skip behavior |
| Idempotency: Repeated evaluation | Same output |

### 10.4 Sign-Off Before Production

| Approval | Role | Required |
|----------|------|----------|
| Design compliance | Tech Lead | YES |
| Schema compliance | Schema Owner | YES |
| Test coverage | QA | YES |
| Observability hooks | Ops | YES |

---

## 11. Document Control

| Version | Date | Change |
|---------|------|--------|
| D6.6 | 2024-12-28 | Initial alert evaluation runtime design |

---

## 12. Approval

This document is a production contract. Implementation requires separate approval.

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Alerting Systems Architect | | | |
| Data Engineer | | | |
| Product Owner | | | |
