# D6.5 — Ingestion Execution Blueprint

**Version:** D6.5
**Date:** 2024-12-28
**Status:** IMPLEMENTATION-READY BLUEPRINT
**Classification:** PLATFORM CONTRACT
**Dependency:** D6.4 Ingestion Architecture Design (FROZEN)

---

## 1. Execution Components

### 1.1 Component Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EXECUTION COMPONENT GRAPH                             │
│                                                                             │
│  ┌──────────────────────┐                                                   │
│  │ INGESTION            │                                                   │
│  │ ORCHESTRATOR         │◄─────── Entry point for all ingestion modes      │
│  └──────────┬───────────┘                                                   │
│             │                                                               │
│             ▼                                                               │
│  ┌──────────────────────┐                                                   │
│  │ PARSER /             │                                                   │
│  │ NORMALIZER           │◄─────── Transforms raw input to normalized rows  │
│  └──────────┬───────────┘                                                   │
│             │                                                               │
│             ▼                                                               │
│  ┌──────────────────────┐                                                   │
│  │ DIMENSION            │                                                   │
│  │ UPSERTER             │◄─────── Upserts campaigns, ad_sets, ads          │
│  └──────────┬───────────┘                                                   │
│             │                                                               │
│             ▼                                                               │
│  ┌──────────────────────┐                                                   │
│  │ FACT                 │                                                   │
│  │ UPSERTER             │◄─────── Upserts daily_metrics, demographic_metrics│
│  └──────────┬───────────┘                                                   │
│             │                                                               │
│             ▼                                                               │
│  ┌──────────────────────┐                                                   │
│  │ VALIDATION           │                                                   │
│  │ RUNNER               │◄─────── Post-ingestion integrity checks          │
│  └──────────┬───────────┘                                                   │
│             │                                                               │
│             ▼                                                               │
│  ┌──────────────────────┐                                                   │
│  │ ALERT BOUNDARY       │                                                   │
│  │ NOTIFIER             │◄─────── Signals completion, no alert execution   │
│  └──────────────────────┘                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 1.2 Ingestion Orchestrator

| Attribute | Specification |
|-----------|---------------|
| **Responsibility** | Coordinates end-to-end ingestion pipeline execution |
| **Inputs** | Upload request (file reference, metadata, context) |
| **Outputs** | Final data_uploads status, completion signal |
| **Stateless/Stateful** | STATEFUL — maintains pipeline state via data_uploads record |
| **Failure Behavior** | Captures failure at any stage, updates data_uploads.status, halts pipeline |

**Orchestrator Duties:**

| Duty | Description |
|------|-------------|
| Acquire upload context | Extract workspace_id, client_id, platform from request |
| Create data_uploads record | Initialize with status='pending' |
| Invoke pipeline stages in order | A → B → C → D → E → F |
| Transition data_uploads.status | pending → processing → [completed\|failed\|partially_completed] |
| Propagate context | Pass upload_id and resolved IDs between stages |
| Enforce timeouts | Abort if stage exceeds maximum duration |
| Log pipeline events | Emit start, stage transitions, completion events |

**Orchestrator MUST NOT:**

| Forbidden Action | Reason |
|------------------|--------|
| Execute business logic | Orchestrator coordinates, does not transform |
| Write to dimension/fact tables directly | Delegated to Upserters |
| Evaluate alerts | Alert evaluation is downstream (D6.6+) |
| Retry automatically without policy check | Retry policy is explicit |

---

### 1.3 Parser / Normalizer

| Attribute | Specification |
|-----------|---------------|
| **Responsibility** | Transform raw input (CSV, JSON, API response) into normalized records |
| **Inputs** | Raw file content or structured payload |
| **Outputs** | NormalizedDimensionBatch, NormalizedFactBatch |
| **Stateless/Stateful** | STATELESS — pure transformation |
| **Failure Behavior** | Return ParseResult with errors, do not throw |

**Output Schema:**

```
NormalizedDimensionBatch {
  campaigns: NormalizedCampaign[]
  ad_sets: NormalizedAdSet[]
  ads: NormalizedAd[]
  parse_errors: ParseError[]
}

NormalizedFactBatch {
  daily_metrics: NormalizedDailyMetric[]
  demographic_metrics: NormalizedDemographicMetric[]
  parse_errors: ParseError[]
}

ParseError {
  row_number: number
  field: string
  value: string
  reason: string
  severity: 'ERROR' | 'WARN'
}
```

**Normalization Contract (per D6.4 Section 4.3):**

| Field Type | Normalization Rule |
|------------|-------------------|
| Dates | ISO 8601 (YYYY-MM-DD) |
| Currency (Meta) | Divide cents by 100 |
| Currency (Google) | Divide micros by 1,000,000 |
| Currency (TikTok) | No conversion (already decimal) |
| Platform identifiers | Lowercase, trimmed |
| External IDs | Preserve exactly as received |
| Enums | Map to allowed values or flag as error |
| NULL | Explicit null for missing optional fields |

**Parser MUST:**

| Requirement | Enforcement |
|-------------|-------------|
| Validate all required fields present | Return ParseError for missing |
| Type-check all fields | Return ParseError for type mismatch |
| Preserve row numbers for error correlation | ParseError.row_number |
| Handle platform-specific column names | Platform column mapping |
| Never mutate input | Pure function |

**Parser MUST NOT:**

| Forbidden Action | Reason |
|------------------|--------|
| Write to database | Parsing is read-only transformation |
| Make network calls | Parsing is synchronous and isolated |
| Throw exceptions for data errors | Return ParseError instead |

---

### 1.4 Dimension Upserter

| Attribute | Specification |
|-----------|---------------|
| **Responsibility** | Persist normalized dimension records to database |
| **Inputs** | NormalizedDimensionBatch, upload context |
| **Outputs** | UpsertResult with resolved IDs and failures |
| **Stateless/Stateful** | STATELESS per invocation — database is state |
| **Failure Behavior** | Return UpsertResult with per-row outcomes |

**Output Schema:**

```
DimensionUpsertResult {
  campaigns: EntityUpsertOutcome[]
  ad_sets: EntityUpsertOutcome[]
  ads: EntityUpsertOutcome[]
  total_inserted: number
  total_updated: number
  total_failed: number
}

EntityUpsertOutcome {
  external_id: string
  internal_id: uuid | null
  action: 'INSERT' | 'UPDATE' | 'FAILED'
  error: string | null
}
```

**Processing Order (STRICT):**

| Order | Entity | Dependency |
|-------|--------|------------|
| 1 | campaigns | None — process first |
| 2 | ad_sets | Requires resolved campaign_id |
| 3 | ads | Requires resolved ad_set_id |

**ID Resolution Cache:**

```
ResolvedIdCache {
  campaigns: Map<external_id, internal_id>
  ad_sets: Map<external_id, internal_id>
  ads: Map<external_id, internal_id>
}
```

Cache populated during upsert, used for FK resolution in subsequent entities.

**Upsert Logic (per D6.4 Section 5.2):**

```
FOR each normalized_campaign:
  key = (workspace_id, client_id, platform, external_id)
  existing = SELECT id FROM campaigns WHERE key
  IF existing:
    UPDATE campaigns SET name, objective, status, start_date, end_date WHERE key
    action = 'UPDATE'
  ELSE:
    INSERT INTO campaigns (all fields)
    action = 'INSERT'
  cache.campaigns[external_id] = internal_id
  RETURN EntityUpsertOutcome
```

**Dimension Upserter MUST:**

| Requirement | Enforcement |
|-------------|-------------|
| Process in dependency order | campaigns → ad_sets → ads |
| Use natural key for upsert | Per D6.4 Section 5.1 |
| Cache resolved IDs | For FK resolution |
| Return per-row outcome | Never partial silent failure |
| Validate FK existence | ad_set requires campaign_id exists |

**Dimension Upserter MUST NOT:**

| Forbidden Action | Reason |
|------------------|--------|
| Skip validation on batch | Each row validated |
| Auto-create missing parents | Reject if FK missing |
| Update immutable fields | id, external_id, created_at unchanged |

---

### 1.5 Fact Upserter

| Attribute | Specification |
|-----------|---------------|
| **Responsibility** | Persist normalized metric records to database |
| **Inputs** | NormalizedFactBatch, ResolvedIdCache, upload context |
| **Outputs** | FactUpsertResult with outcomes |
| **Stateless/Stateful** | STATELESS per invocation — database is state |
| **Failure Behavior** | Return FactUpsertResult with per-row outcomes |

**Output Schema:**

```
FactUpsertResult {
  daily_metrics: MetricUpsertOutcome[]
  demographic_metrics: MetricUpsertOutcome[]
  total_inserted: number
  total_updated: number
  total_failed: number
}

MetricUpsertOutcome {
  metric_date: date
  entity_level: 'workspace' | 'client' | 'campaign' | 'ad_set' | 'ad'
  action: 'INSERT' | 'UPDATE' | 'FAILED'
  error: string | null
}
```

**Upsert Logic (per D6.4 Section 5.3):**

```
FOR each normalized_metric:
  # Resolve FKs from cache (if provided)
  campaign_id = cache.campaigns[metric.campaign_external_id] OR NULL
  ad_set_id = cache.ad_sets[metric.ad_set_external_id] OR NULL
  ad_id = cache.ads[metric.ad_external_id] OR NULL

  # Validate hierarchy constraint
  IF ad_id AND NOT ad_set_id: REJECT
  IF ad_set_id AND NOT campaign_id: REJECT

  key = (workspace_id, client_id, platform, metric_date, campaign_id, ad_set_id, ad_id)
  existing = SELECT id FROM daily_metrics WHERE key
  IF existing:
    UPDATE daily_metrics SET impressions, clicks, spend, conversions, revenue WHERE key
    action = 'UPDATE'
  ELSE:
    INSERT INTO daily_metrics (all fields)
    action = 'INSERT'
  RETURN MetricUpsertOutcome
```

**Fact Upserter MUST:**

| Requirement | Enforcement |
|-------------|-------------|
| Use composite natural key | Per D6.4 Section 5.1 |
| Respect NULL as valid key component | NULL campaign_id is valid |
| Validate hierarchy integrity | ad requires ad_set requires campaign |
| Replace metric values on match | Full replacement, not increment |

**Fact Upserter MUST NOT:**

| Forbidden Action | Reason |
|------------------|--------|
| Aggregate metrics | Upsert replaces, does not sum |
| Accept future dates | metric_date <= today |
| Create dimension records | Dimensions must pre-exist |

---

### 1.6 Validation Runner

| Attribute | Specification |
|-----------|---------------|
| **Responsibility** | Verify data integrity after all writes complete |
| **Inputs** | Upload context, expected row counts |
| **Outputs** | ValidationResult with pass/fail and issues |
| **Stateless/Stateful** | STATELESS — read-only verification |
| **Failure Behavior** | Return ValidationResult, never throw |

**Output Schema:**

```
ValidationResult {
  passed: boolean
  checks: ValidationCheck[]
  warnings: ValidationWarning[]
}

ValidationCheck {
  name: string
  expected: any
  actual: any
  passed: boolean
}

ValidationWarning {
  type: string
  message: string
  count: number
}
```

**Required Checks (per D6.4 Section 4.6):**

| Check | Query Pattern | Pass Criteria |
|-------|---------------|---------------|
| Row count match | Compare input rows to processed | Match within tolerance |
| Workspace integrity | All new records have workspace_id | 100% |
| Client integrity | All new records have client_id | 100% |
| Date validity | All metrics have valid metric_date | 100% |
| Orphan ad_sets | ad_sets without valid campaign_id | 0 (warn if > 0) |
| Orphan ads | ads without valid ad_set_id | 0 (warn if > 0) |

**Validation Runner MUST:**

| Requirement | Enforcement |
|-------------|-------------|
| Run all checks | Never skip checks |
| Return structured result | Machine-readable |
| Distinguish ERROR vs WARN | Errors fail, warnings log only |

**Validation Runner MUST NOT:**

| Forbidden Action | Reason |
|------------------|--------|
| Modify data | Read-only |
| Delete orphans | Validation observes, does not fix |

---

### 1.7 Alert Boundary Notifier

| Attribute | Specification |
|-----------|---------------|
| **Responsibility** | Signal ingestion completion for downstream processes |
| **Inputs** | Upload context, ValidationResult |
| **Outputs** | Notification event (no return value) |
| **Stateless/Stateful** | STATELESS — fire-and-forget notification |
| **Failure Behavior** | Log failure, do not block pipeline completion |

**Notification Contract:**

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

**Alert Boundary Notifier MUST:**

| Requirement | Enforcement |
|-------------|-------------|
| Emit event only on success/partial | Never on failed |
| Include affected date range | For alert rule scoping |
| Be non-blocking | Notification failure does not fail ingestion |

**Alert Boundary Notifier MUST NOT:**

| Forbidden Action | Reason |
|------------------|--------|
| Evaluate alert rules | D6.6+ responsibility |
| Generate alerts | Alert generation is separate |
| Block on downstream response | Fire-and-forget |

---

## 2. Staging Strategy (Design Only)

### 2.1 Purpose of Staging Layer

| Purpose | Description |
|---------|-------------|
| Isolation | Validate data before production table writes |
| Atomicity | Enable all-or-nothing batch processing |
| Rollback | Discard staging on failure without production impact |
| Audit | Preserve original input for debugging |

### 2.2 Logical Staging Schema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        STAGING LAYER (LOGICAL)                               │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ staging_rows                                                         │   │
│  │ ─────────────────────────────────────────────────────────────────── │   │
│  │ upload_id       UUID        FK to data_uploads                      │   │
│  │ row_number      INTEGER     Position in source file                 │   │
│  │ row_type        ENUM        'campaign'|'ad_set'|'ad'|'metric'       │   │
│  │ raw_data        JSONB       Original parsed row                     │   │
│  │ normalized_data JSONB       After normalization                     │   │
│  │ validation_status ENUM      'pending'|'valid'|'invalid'             │   │
│  │ validation_errors JSONB     Array of error objects                  │   │
│  │ processed_at    TIMESTAMP   When moved to production                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ staging_id_resolution                                                │   │
│  │ ─────────────────────────────────────────────────────────────────── │   │
│  │ upload_id       UUID        FK to data_uploads                      │   │
│  │ entity_type     ENUM        'campaign'|'ad_set'|'ad'                │   │
│  │ external_id     TEXT        Platform external ID                    │   │
│  │ internal_id     UUID        Resolved production ID (after upsert)   │   │
│  │ action          ENUM        'INSERT'|'UPDATE'                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Staging Flow

```
                    ┌──────────────┐
                    │ Raw Input    │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Parse &      │
                    │ Stage Rows   │──────► staging_rows (raw_data)
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Normalize    │──────► staging_rows (normalized_data)
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Validate     │──────► staging_rows (validation_status)
                    │ All Rows     │
                    └──────┬───────┘
                           │
                    ┌──────┴──────┐
                    │             │
              ▼ ALL VALID    ▼ ANY INVALID
         ┌──────────┐    ┌──────────────┐
         │ Commit   │    │ Abort        │
         │ to Prod  │    │ Mark Failed  │
         └──────────┘    └──────────────┘
```

### 2.4 Data Lifecycle

| Data Location | Retention | Cleanup Trigger |
|---------------|-----------|-----------------|
| staging_rows (pending) | Until processed | Commit or abort |
| staging_rows (valid, committed) | 7 days | Background cleanup job |
| staging_rows (invalid) | 30 days | Background cleanup job |
| staging_id_resolution | 7 days | Background cleanup job |
| Production tables | Permanent | N/A |

### 2.5 Staging Protection Scenarios

#### Partial Upload Protection

```
Scenario: 1000 rows, row 750 has invalid FK
Without Staging: 749 rows committed, row 750+ lost
With Staging:    All rows in staging, validation fails,
                 data_uploads.status='failed',
                 no production writes
```

#### Corrupt Row Protection

```
Scenario: Row 500 has malformed JSON in creative_id
Without Staging: Parser throws, loses context
With Staging:    Row 500 stored in staging_rows with
                 validation_status='invalid',
                 validation_errors=[{field: 'creative_id', ...}],
                 other rows continue processing
```

#### Late-Arriving Data Protection

```
Scenario: Re-upload with corrections for yesterday's data
Without Staging: Risk of duplicate inserts
With Staging:    Normalize in staging, resolve IDs,
                 detect existing records,
                 upsert safely with natural key match
```

### 2.6 Staging Mode Configuration

| Mode | Behavior | Use Case |
|------|----------|----------|
| STRICT | Abort entire batch on any invalid row | Financial data, compliance |
| LENIENT | Commit valid rows, skip invalid | Best-effort ingestion |
| DRY_RUN | Validate only, never commit | Pre-flight check |

Default: STRICT (safest for production)

---

## 3. Worker Model

### 3.1 Worker Types

| Worker Type | Responsibility | Lifecycle |
|-------------|----------------|-----------|
| IngestionWorker | Execute full pipeline for one upload | Per-upload |
| CleanupWorker | Remove expired staging data | Scheduled |
| RetryWorker | Re-attempt failed uploads (if retryable) | Scheduled |

### 3.2 IngestionWorker Specification

```
IngestionWorker {
  upload_id: uuid
  workspace_id: uuid
  client_id: uuid

  execute():
    ACQUIRE lock on upload_id
    TRY:
      orchestrator.run(upload_id)
    FINALLY:
      RELEASE lock on upload_id
}
```

**Worker Lifecycle:**

```
┌─────────────┐
│   IDLE      │
└──────┬──────┘
       │ upload queued
       ▼
┌─────────────┐
│  CLAIMED    │───► Lock acquired
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  RUNNING    │───► Pipeline executing
└──────┬──────┘
       │
   ┌───┴───┐
   │       │
   ▼       ▼
┌──────┐ ┌──────┐
│DONE  │ │FAILED│
└──────┘ └──────┘
       │
       ▼
┌─────────────┐
│   IDLE      │───► Lock released, ready for next
└─────────────┘
```

### 3.3 Concurrency Model

| Constraint | Value | Rationale |
|------------|-------|-----------|
| Max concurrent workers (global) | 10 | Limit database connection pressure |
| Max concurrent workers per workspace | 3 | Fair resource distribution |
| Max concurrent workers per client | 1 | Prevent race conditions on same client data |

### 3.4 Ordering Guarantees

| Guarantee | Enforcement |
|-----------|-------------|
| FIFO per client | Queue ordered by created_at |
| No parallel uploads for same client | Client-level lock |
| Workspace isolation | Separate queue partitions |

**Why client-level serialization:**
- Prevents race conditions on natural key lookups
- Ensures ID resolution cache is valid for entire batch
- Simplifies conflict resolution

### 3.5 Parallelism Limits Within Pipeline

| Stage | Parallelism | Rationale |
|-------|-------------|-----------|
| Parse/Normalize | Parallel row processing | CPU-bound, no DB |
| Dimension Upsert | Sequential by entity type | FK dependency order |
| Fact Upsert | Parallel batches (50 rows) | Batch writes efficient |
| Validation | Sequential checks | Read-only, fast |

### 3.6 Workspace / Client Isolation Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      ISOLATION BOUNDARY                                  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Workspace A                                                      │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │   │
│  │  │ Client A1     │  │ Client A2     │  │ Client A3     │       │   │
│  │  │ Queue: [1,2]  │  │ Queue: [3]    │  │ Queue: []     │       │   │
│  │  │ Worker: RUN   │  │ Worker: IDLE  │  │ Worker: IDLE  │       │   │
│  │  └───────────────┘  └───────────────┘  └───────────────┘       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Workspace B                                                      │   │
│  │  ┌───────────────┐  ┌───────────────┐                           │   │
│  │  │ Client B1     │  │ Client B2     │                           │   │
│  │  │ Queue: [4,5,6]│  │ Queue: [7]    │                           │   │
│  │  │ Worker: RUN   │  │ Worker: RUN   │                           │   │
│  │  └───────────────┘  └───────────────┘                           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘

Isolation guarantees:
- Workspace A uploads never see Workspace B data
- Client A1 uploads serialized, Client A2 independent
- Cross-workspace queries impossible (RLS enforced)
```

---

## 4. Identity & Idempotency

### 4.1 Duplicate Ingestion Prevention

| Layer | Mechanism | Scope |
|-------|-----------|-------|
| Upload level | data_uploads.id is unique | Global |
| Entity level | Natural key uniqueness | Per workspace/client/platform |
| Metric level | Composite natural key | Per time/entity/demographic |

### 4.2 Natural Key Enforcement (per D6.4 Section 5.1)

| Table | Natural Key | Unique Constraint |
|-------|-------------|-------------------|
| campaigns | (workspace_id, client_id, platform, external_id) | UNIQUE |
| ad_sets | (workspace_id, client_id, platform, external_id) | UNIQUE |
| ads | (workspace_id, client_id, platform, external_id) | UNIQUE |
| daily_metrics | (workspace_id, client_id, platform, metric_date, campaign_id, ad_set_id, ad_id) | UNIQUE |
| demographic_metrics | (workspace_id, client_id, platform, metric_date, campaign_id, ad_set_id, ad_id, age_range, gender, country, region) | UNIQUE |

### 4.3 Retry Safety

**Safe Retry Scenario:**

```
Upload U1 processing...
  - Stage C: Insert campaign C1 ✓
  - Stage C: Insert ad_set AS1 ✓
  - Stage D: Connection timeout FAIL

Retry U1...
  - Stage C: Upsert campaign C1 → UPDATE (already exists)
  - Stage C: Upsert ad_set AS1 → UPDATE (already exists)
  - Stage D: Insert metrics ✓
  - Result: Success, no duplicates
```

**Why it's safe:**
1. Dimension upserts use natural keys — re-insert becomes update
2. Fact upserts use composite keys — re-insert replaces values
3. No auto-increment counters exposed to business logic
4. Staging table tracks which rows were processed

### 4.4 Exactly-Once vs At-Least-Once

| Semantic | Applicability | Justification |
|----------|---------------|---------------|
| **At-Least-Once** | Dimension upserts | Safe due to natural key idempotency |
| **At-Least-Once** | Fact upserts | Safe due to replacement semantics |
| **Exactly-Once** | data_uploads status | Single source of truth, transaction-protected |

**Why not exactly-once for data:**
- Exactly-once requires distributed transactions or event sourcing
- At-least-once with idempotent operations achieves same outcome
- Simpler implementation, proven pattern
- Natural key upsert makes duplicates harmless

### 4.5 Idempotency Token Strategy

```
IdempotencyContext {
  upload_id: uuid          // Primary correlation
  client_id: uuid          // Scope isolation
  file_hash: sha256        // Detect re-upload of same file
  created_at: timestamp    // Ordering
}
```

**Re-upload Detection:**

| Scenario | Detection | Behavior |
|----------|-----------|----------|
| Same file, same client, < 1 hour | file_hash match | Warn, allow (may be intentional retry) |
| Same file, same client, > 1 hour | file_hash match | Allow (likely intentional re-upload) |
| Different file, same external_ids | Natural key match | Upsert (update existing) |

---

## 5. Failure & Retry Policy

### 5.1 Error Classification

| Error Class | Examples | Retryable |
|-------------|----------|-----------|
| TRANSIENT | Connection timeout, lock contention, rate limit | YES |
| DATA_ERROR | Invalid format, missing required field, FK violation | NO |
| SYSTEM_ERROR | Out of memory, disk full, service unavailable | YES (with backoff) |
| CONFIGURATION | Invalid credentials, missing permissions | NO |

### 5.2 Retryable vs Non-Retryable

| Error Type | Retryable | Reason |
|------------|-----------|--------|
| Database connection timeout | YES | Transient network issue |
| Database query timeout | YES | Temporary load |
| Foreign key violation | NO | Data error, fix required |
| Parse error | NO | Input data invalid |
| File not found | NO | Source missing |
| Permission denied (RLS) | NO | Configuration/auth issue |
| Constraint violation | NO | Data violates schema |
| Out of memory | YES | May succeed with backoff |
| Rate limit exceeded | YES | Wait and retry |

### 5.3 Backoff Strategy

```
RetryPolicy {
  max_attempts: 3
  initial_delay_ms: 1000
  max_delay_ms: 60000
  backoff_multiplier: 2
  jitter: true
}

Attempt 1: immediate
Attempt 2: 1000ms + jitter
Attempt 3: 2000ms + jitter
Attempt 4: (exceeded max_attempts) → PERMANENT_FAILURE
```

**Jitter Calculation:**

```
delay = base_delay * (1 + random(0, 0.1))
```

### 5.4 data_uploads.status Transitions

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     STATUS STATE MACHINE                                 │
│                                                                         │
│                         ┌──────────┐                                    │
│                         │ pending  │                                    │
│                         └────┬─────┘                                    │
│                              │ worker claims                            │
│                              ▼                                          │
│                         ┌──────────┐                                    │
│           ┌─────────────│processing│─────────────┐                     │
│           │             └────┬─────┘             │                     │
│           │                  │                   │                     │
│      retryable          all stages          partial                   │
│       failure            success            success                    │
│           │                  │                   │                     │
│           ▼                  ▼                   ▼                     │
│     ┌──────────┐      ┌──────────┐      ┌────────────────┐            │
│     │processing│      │completed │      │partially_      │            │
│     │(retry N) │      │          │      │completed       │            │
│     └────┬─────┘      └──────────┘      └────────────────┘            │
│          │                                                             │
│     max retries                                                        │
│      exceeded                                                          │
│          │                                                             │
│          ▼                                                             │
│     ┌──────────┐                                                       │
│     │  failed  │                                                       │
│     └──────────┘                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.5 Status Definitions

| Status | Definition | Next Actions |
|--------|------------|--------------|
| pending | Upload received, awaiting processing | Worker will claim |
| processing | Pipeline actively executing | Wait for completion |
| completed | All rows processed successfully | None |
| partially_completed | Some rows processed, some rejected | Review error_text |
| failed | Pipeline failed, no data committed | Review error_text, may retry |

### 5.6 Permanent Failure Conditions

| Condition | Action |
|-----------|--------|
| Max retries exceeded | status='failed', no further retries |
| 100% parse errors | status='failed', no data to process |
| Workspace/client not found | status='failed', configuration error |
| File permanently unavailable | status='failed', source lost |
| Schema contract violation | status='failed', requires code fix |

---

## 6. Ingestion State Machine

### 6.1 State Definitions

| State | data_uploads.status | Internal Stage | Description |
|-------|---------------------|----------------|-------------|
| S0 | pending | — | Upload queued |
| S1 | processing | INTAKE | File/input acquired |
| S2 | processing | PARSE | Parsing in progress |
| S3 | processing | DIMENSION_UPSERT | Writing dimensions |
| S4 | processing | FACT_UPSERT | Writing facts |
| S5 | processing | VALIDATION | Post-write checks |
| S6 | completed | COMPLETE | All successful |
| S7 | partially_completed | COMPLETE | Partial success |
| S8 | failed | FAILED | Permanent failure |

### 6.2 State Diagram (ASCII)

```
                                    ┌───────────────────────────────────────┐
                                    │         INGESTION STATE MACHINE       │
                                    └───────────────────────────────────────┘

                                              ┌─────────┐
                                              │   S0    │
                                              │ pending │
                                              └────┬────┘
                                                   │
                                          worker claims
                                                   │
                                                   ▼
                                              ┌─────────┐
                                              │   S1    │
                                              │ INTAKE  │
                                              └────┬────┘
                                                   │
                                    ┌──────────────┼──────────────┐
                                    │              │              │
                              file error      file valid    file empty
                                    │              │              │
                                    ▼              ▼              ▼
                              ┌─────────┐    ┌─────────┐    ┌─────────┐
                              │   S8    │    │   S2    │    │   S6    │
                              │ FAILED  │    │  PARSE  │    │COMPLETE │
                              └─────────┘    └────┬────┘    │(0 rows) │
                                                  │         └─────────┘
                                    ┌─────────────┼─────────────┐
                                    │             │             │
                              all invalid   some valid    all valid
                                    │             │             │
                                    ▼             ▼             ▼
                              ┌─────────┐   ┌─────────┐   ┌─────────┐
                              │   S8    │   │   S3    │   │   S3    │
                              │ FAILED  │   │DIMENSION│   │DIMENSION│
                              └─────────┘   │ UPSERT  │   │ UPSERT  │
                                            └────┬────┘   └────┬────┘
                                                 │             │
                                    ┌────────────┼─────────────┤
                                    │            │             │
                              FK failure   some success  all success
                                    │            │             │
                                    ▼            ▼             ▼
                              ┌─────────┐   ┌─────────┐   ┌─────────┐
                              │   S8    │   │   S4    │   │   S4    │
                              │ FAILED  │   │  FACT   │   │  FACT   │
                              └─────────┘   │ UPSERT  │   │ UPSERT  │
                                            └────┬────┘   └────┬────┘
                                                 │             │
                                    ┌────────────┼─────────────┤
                                    │            │             │
                              constraint    some success  all success
                               failure           │             │
                                    │            │             │
                                    ▼            ▼             ▼
                              ┌─────────┐   ┌─────────┐   ┌─────────┐
                              │   S8    │   │   S5    │   │   S5    │
                              │ FAILED  │   │VALIDATE │   │VALIDATE │
                              └─────────┘   └────┬────┘   └────┬────┘
                                                 │             │
                                    ┌────────────┴─────────────┤
                                    │                          │
                              warnings exist              no warnings
                                    │                          │
                                    ▼                          ▼
                              ┌─────────────┐            ┌─────────┐
                              │     S7      │            │   S6    │
                              │ PARTIALLY   │            │COMPLETE │
                              │ COMPLETED   │            └─────────┘
                              └─────────────┘
```

### 6.3 Transition Rules

| From | To | Trigger | Action |
|------|-----|---------|--------|
| S0 | S1 | Worker claims upload | Acquire lock, set status='processing' |
| S1 | S2 | File acquired | Begin parsing |
| S1 | S8 | File missing/corrupt | Set status='failed', error_text |
| S1 | S6 | File empty (valid but no data) | Set status='completed', row_count=0 |
| S2 | S3 | Parse complete (≥1 valid row) | Proceed to dimension upsert |
| S2 | S8 | Parse complete (0 valid rows) | Set status='failed' |
| S3 | S4 | Dimensions upserted | Proceed to fact upsert |
| S3 | S8 | Critical FK failure | Set status='failed' |
| S4 | S5 | Facts upserted | Proceed to validation |
| S4 | S8 | Critical constraint failure | Set status='failed' |
| S5 | S6 | Validation pass, no warnings | Set status='completed' |
| S5 | S7 | Validation pass with warnings | Set status='partially_completed' |

### 6.4 Internal Stage Tracking

```
data_uploads additional fields (logical, may use JSON column):
{
  "internal_stage": "INTAKE|PARSE|DIMENSION_UPSERT|FACT_UPSERT|VALIDATION|COMPLETE|FAILED",
  "stage_started_at": "ISO8601",
  "stage_metrics": {
    "parse": { "rows_read": 1000, "rows_valid": 990, "rows_invalid": 10 },
    "dimension": { "campaigns_inserted": 5, "campaigns_updated": 10, ... },
    "fact": { "daily_inserted": 500, "daily_updated": 200, ... },
    "validation": { "checks_passed": 6, "warnings": 2 }
  },
  "retry_count": 0,
  "last_error": null
}
```

---

## 7. Observability Hooks (D5-Compatible)

### 7.1 Required Log Events Per Stage

| Stage | Event | Level | Required Fields |
|-------|-------|-------|-----------------|
| INTAKE | ingestion.started | INFO | upload_id, workspace_id, client_id, platform, source, filename |
| INTAKE | ingestion.file_acquired | DEBUG | upload_id, file_size_bytes, content_type |
| INTAKE | ingestion.file_error | ERROR | upload_id, error_code, error_message |
| PARSE | parse.started | DEBUG | upload_id, row_count_expected |
| PARSE | parse.row_error | WARN | upload_id, row_number, field, reason |
| PARSE | parse.completed | INFO | upload_id, rows_valid, rows_invalid |
| DIMENSION | dimension.upsert_started | DEBUG | upload_id, entity_type |
| DIMENSION | dimension.entity_upserted | DEBUG | upload_id, entity_type, external_id, action |
| DIMENSION | dimension.fk_violation | ERROR | upload_id, entity_type, external_id, missing_fk |
| DIMENSION | dimension.upsert_completed | INFO | upload_id, inserted, updated, failed |
| FACT | fact.upsert_started | DEBUG | upload_id, metric_type |
| FACT | fact.batch_upserted | DEBUG | upload_id, metric_type, batch_size, action |
| FACT | fact.constraint_violation | ERROR | upload_id, metric_date, error_detail |
| FACT | fact.upsert_completed | INFO | upload_id, inserted, updated, failed |
| VALIDATION | validation.started | DEBUG | upload_id |
| VALIDATION | validation.check_passed | DEBUG | upload_id, check_name |
| VALIDATION | validation.check_failed | WARN | upload_id, check_name, expected, actual |
| VALIDATION | validation.completed | INFO | upload_id, passed, warnings |
| COMPLETE | ingestion.completed | INFO | upload_id, status, total_duration_ms |
| FAILED | ingestion.failed | ERROR | upload_id, stage, error_code, error_message |

### 7.2 D5.1 Error Taxonomy Mapping

| Ingestion Failure | D5.1 Error Code | Severity | Log Level |
|-------------------|-----------------|----------|-----------|
| File not found | DATA_ABSENT_UNEXPECTED | ERROR | ERROR |
| Empty file (valid) | DATA_ABSENT_EXPECTED | INFO | INFO |
| Empty file (unexpected) | DATA_ABSENT_UNEXPECTED | WARN | WARN |
| CSV parse error | QUERY_FAILURE | ERROR | ERROR |
| JSON parse error | QUERY_FAILURE | ERROR | ERROR |
| Missing required column | QUERY_FAILURE | ERROR | ERROR |
| Type mismatch | QUERY_FAILURE | ERROR | ERROR |
| FK constraint violation | SCHEMA_CONTRACT_VIOLATION | ERROR | ERROR |
| Unique constraint violation | QUERY_FAILURE | ERROR | ERROR |
| RLS denied | RLS_DENIED | ERROR | ERROR |
| Connection timeout | QUERY_FAILURE | ERROR | ERROR |
| Unknown exception | UNKNOWN_RUNTIME_ERROR | ERROR | ERROR |
| Orphan reference detected | REFERENCE_ORPHANED | WARN | WARN |

### 7.3 Correlation ID Strategy

```
Correlation Hierarchy:

request_id (HTTP request scope)
    └── upload_id (ingestion session scope)
            ├── stage_id (pipeline stage scope)
            │       └── entity_id (individual record scope)
            │
            └── batch_id (batch operation scope)
                    └── row_number (source row scope)
```

**Log Field Requirements:**

| Scope | Required Correlation Fields |
|-------|----------------------------|
| All ingestion logs | upload_id, timestamp |
| Stage logs | upload_id, stage |
| Entity logs | upload_id, stage, entity_type, entity_id |
| Row logs | upload_id, stage, row_number |
| Batch logs | upload_id, stage, batch_id, batch_size |

### 7.4 Required Metrics (Operations)

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| ingestion_uploads_total | Counter | workspace_id, client_id, platform, status | Total uploads by outcome |
| ingestion_duration_seconds | Histogram | workspace_id, stage | Time per stage |
| ingestion_rows_processed | Counter | workspace_id, client_id, entity_type, action | Rows by outcome |
| ingestion_errors_total | Counter | workspace_id, error_code | Errors by type |
| ingestion_queue_depth | Gauge | workspace_id, client_id | Pending uploads |
| ingestion_active_workers | Gauge | — | Currently processing |
| ingestion_retry_count | Counter | workspace_id, attempt | Retry attempts |

### 7.5 Alerting Thresholds

| Metric Condition | Severity | Action |
|------------------|----------|--------|
| ingestion_errors_total rate > 10/min | P1 | Page on-call |
| ingestion_queue_depth > 100 | P2 | Notify team |
| ingestion_duration_seconds p99 > 300s | P2 | Notify team |
| ingestion_active_workers = max_workers for > 10min | P2 | Investigate backlog |

---

## 8. Freeze & Safety Confirmation

### 8.1 Schema Compliance

| D4 Freeze Requirement | D6.5 Blueprint Compliance |
|-----------------------|---------------------------|
| No new tables | COMPLIANT — staging is logical design only, no SQL |
| No new columns | COMPLIANT — uses existing columns |
| No column modifications | COMPLIANT — no ALTER statements |
| No index changes | COMPLIANT — no index modifications |

### 8.2 Alert Logic Compliance

| Alert Boundary Rule | D6.5 Blueprint Compliance |
|---------------------|---------------------------|
| Ingestion does not evaluate alerts | COMPLIANT — Alert Boundary Notifier emits event only |
| Ingestion does not write to alerts table | COMPLIANT — no INSERT/UPDATE to alerts |
| Ingestion does not read alert_rules for evaluation | COMPLIANT — alert_rules not queried |
| Alert evaluation is downstream | COMPLIANT — D6.6 responsibility |

### 8.3 UX Impact Assessment

| UX Component | Impact |
|--------------|--------|
| /ads/alerts page | NONE — ingestion is backend-only |
| /ads/clients page | NONE — may see new data after ingestion |
| /ads/campaigns page | NONE — may see new data after ingestion |
| Alert detail page | NONE — no alert logic changes |
| Empty states | NONE — unchanged behavior |
| Error displays | NONE — no new error types in UI |

### 8.4 Forward Compatibility

| Future Phase | D6.5 Design Supports |
|--------------|----------------------|
| D6.6 Alert Evaluation | IngestionCompleteEvent provides trigger hook |
| D6.7 API Pull | Worker model supports new ingestion modes |
| D6.8 Webhook Push | Parser supports JSON payloads |
| Staging table creation | Logical schema ready for implementation |

### 8.5 Safety Guarantees

| Guarantee | Mechanism |
|-----------|-----------|
| No data loss on failure | Staging holds data until commit |
| No duplicate records | Natural key upsert semantics |
| No orphan creation | FK validation before commit |
| No partial writes (STRICT mode) | All-or-nothing batch commit |
| Auditable | data_uploads tracks every attempt |
| Recoverable | Failed uploads can be retried |
| Isolated | Client-level serialization prevents conflicts |

---

## 9. Implementation Checklist

For the implementing engineer:

### 9.1 Pre-Implementation

| Check | Verified |
|-------|----------|
| Read D6.4 Ingestion Architecture Design | |
| Read D5.1 Observability specification | |
| Confirm database schema matches D4 freeze | |
| Confirm data_uploads table exists with required columns | |

### 9.2 Component Implementation Order

| Order | Component | Dependencies |
|-------|-----------|--------------|
| 1 | Parser/Normalizer | None |
| 2 | Dimension Upserter | Parser output types |
| 3 | Fact Upserter | Dimension Upserter (ID cache) |
| 4 | Validation Runner | All upserters |
| 5 | Alert Boundary Notifier | Validation Runner |
| 6 | Ingestion Orchestrator | All components |
| 7 | IngestionWorker | Orchestrator |

### 9.3 Test Coverage Requirements

| Test Type | Coverage Target |
|-----------|-----------------|
| Unit tests per component | 100% functions |
| Integration tests (happy path) | All stages |
| Integration tests (failure modes) | All error types |
| Idempotency tests | Retry scenarios |
| Concurrency tests | Parallel client uploads |

### 9.4 Sign-Off Before Production

| Approval | Role | Required |
|----------|------|----------|
| Blueprint compliance | Tech Lead | YES |
| Test coverage | QA | YES |
| Observability hooks | Ops | YES |
| Performance baseline | Eng | YES |

---

## 10. Document Control

| Version | Date | Change |
|---------|------|--------|
| D6.5 | 2024-12-28 | Initial ingestion execution blueprint |

---

## 11. Approval

This document is an implementation blueprint. Code implementation requires separate approval.

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Platform Engineer | | | |
| Data Engineer | | | |
| Tech Lead | | | |
