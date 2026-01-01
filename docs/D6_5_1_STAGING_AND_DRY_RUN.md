# D6.5.1 — Staging & Dry-Run Execution Design

**Version:** D6.5.1
**Date:** 2024-12-28
**Status:** PRE-IMPLEMENTATION CONTRACT
**Classification:** SAFE EXECUTION DESIGN
**Dependencies:**
- D6.4 Ingestion Architecture Design (FROZEN)
- D6.5 Ingestion Execution Blueprint (FROZEN)
- D6.6 Alert Evaluation Runtime (FROZEN)
- D6.7.1 Ingestion Boundary & Scheduling (FROZEN)
- D6.7.2 API Pull Ingestion Design (FROZEN)

---

## 1. Staging Table Strategy

### 1.1 Staging Layer Purpose

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        STAGING LAYER ARCHITECTURE                            │
│                                                                             │
│  RAW INPUT                   STAGING                      PRODUCTION        │
│  ─────────                   ───────                      ──────────        │
│                                                                             │
│  ┌─────────┐              ┌─────────────┐              ┌─────────────┐     │
│  │  CSV    │──────────────│ staging_rows│──────────────│  campaigns  │     │
│  │  API    │   Parse &    │             │   Validate   │  ad_sets    │     │
│  │ Webhook │   Normalize  │ staging_id_ │   & Promote  │  ads        │     │
│  └─────────┘              │ resolution  │              │  metrics    │     │
│                           └─────────────┘              └─────────────┘     │
│                                  │                            │             │
│                                  │                            │             │
│                           SAFE ZONE                    PRODUCTION ZONE     │
│                           ─────────                    ───────────────     │
│                           • All writes go here first  • Only validated     │
│                           • Validation happens here     data reaches here  │
│                           • Rollback is trivial        • Alert evaluation  │
│                           • No downstream impact         may trigger       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 staging_rows Table

**Purpose:** Temporary holding area for parsed and normalized data before production commit.

```
staging_rows (LOGICAL SCHEMA)
─────────────────────────────
id                  UUID        PRIMARY KEY
upload_id           UUID        FK → data_uploads.id
row_number          INTEGER     Position in source file/batch
row_type            ENUM        'campaign' | 'ad_set' | 'ad' | 'daily_metric' | 'demographic_metric'
entity_external_id  TEXT        Platform external ID (for reference)

-- Source data
raw_data            JSONB       Original parsed row (before normalization)
normalized_data     JSONB       After normalization (ready for upsert)

-- Validation state
validation_status   ENUM        'pending' | 'valid' | 'invalid' | 'skipped'
validation_errors   JSONB       Array of error objects [{field, value, reason, severity}]
validation_warnings JSONB       Array of warning objects

-- Processing state
processed_at        TIMESTAMPTZ When promoted to production (NULL if not promoted)
processing_action   ENUM        'INSERT' | 'UPDATE' | 'SKIPPED' | NULL
target_internal_id  UUID        Resolved production ID after promotion (NULL before)

-- Metadata
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ

-- Indexes
INDEX idx_staging_rows_upload_id ON staging_rows(upload_id)
INDEX idx_staging_rows_validation_status ON staging_rows(validation_status)
INDEX idx_staging_rows_row_type ON staging_rows(row_type)
```

### 1.3 staging_id_resolution Table

**Purpose:** Track mapping between external IDs and internal IDs during an ingestion session.

```
staging_id_resolution (LOGICAL SCHEMA)
──────────────────────────────────────
id                  UUID        PRIMARY KEY
upload_id           UUID        FK → data_uploads.id
entity_type         ENUM        'campaign' | 'ad_set' | 'ad'
platform            TEXT        'meta' | 'google' | 'tiktok'
external_id         TEXT        Platform external ID
internal_id         UUID        Resolved production UUID (NULL if pending/new)

-- Resolution state
resolution_status   ENUM        'pending' | 'resolved_existing' | 'resolved_new' | 'unresolved'
resolution_action   ENUM        'INSERT' | 'UPDATE' | NULL

-- Metadata
created_at          TIMESTAMPTZ
resolved_at         TIMESTAMPTZ

-- Constraints
UNIQUE (upload_id, entity_type, platform, external_id)

-- Indexes
INDEX idx_staging_id_upload_id ON staging_id_resolution(upload_id)
INDEX idx_staging_id_external ON staging_id_resolution(external_id)
```

### 1.4 Retention Policy

| Data Location | Retention Period | Cleanup Trigger |
|---------------|------------------|-----------------|
| staging_rows (pending) | Until processed | Promotion or abort |
| staging_rows (valid, promoted) | 7 days | Background cleanup |
| staging_rows (invalid) | 30 days | Background cleanup (for debugging) |
| staging_id_resolution | 7 days | Background cleanup |
| Failed upload staging data | 30 days | Manual cleanup or TTL |

### 1.5 Cleanup Rules

```
CleanupPolicy {
  // Automatic cleanup
  auto_cleanup_enabled: true
  cleanup_interval: '1 hour'

  // Retention windows
  promoted_data_retention_days: 7
  invalid_data_retention_days: 30
  unprocessed_data_retention_days: 1   // Orphaned staging data

  // Safety
  min_age_before_cleanup_hours: 24     // Never clean < 24h old
  batch_size: 10000                    // Rows per cleanup batch
}

FUNCTION cleanupStagingData():
  cutoff_promoted = now() - 7 days
  cutoff_invalid = now() - 30 days
  cutoff_orphan = now() - 1 day

  // Clean promoted data
  DELETE FROM staging_rows
  WHERE processed_at IS NOT NULL
    AND processed_at < cutoff_promoted
  LIMIT 10000

  // Clean old invalid data
  DELETE FROM staging_rows
  WHERE validation_status = 'invalid'
    AND created_at < cutoff_invalid
  LIMIT 10000

  // Clean orphaned staging data (never processed)
  DELETE FROM staging_rows
  WHERE processed_at IS NULL
    AND validation_status IN ('pending', 'valid')
    AND created_at < cutoff_orphan
  LIMIT 10000

  // Clean ID resolution
  DELETE FROM staging_id_resolution
  WHERE created_at < cutoff_promoted
  LIMIT 10000
```

---

## 2. Dry-Run Modes

### 2.1 Execution Mode Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXECUTION MODES                                      │
│                                                                             │
│  Mode              Staging Writes    Fact Writes    Alert Trigger           │
│  ────              ──────────────    ───────────    ─────────────           │
│                                                                             │
│  FULL_DRY_RUN      NO                NO             NO                      │
│  │                 (parse & validate only)                                  │
│  │                                                                          │
│  STAGING_ONLY      YES               NO             NO                      │
│  │                 (write staging, validate, stop)                          │
│  │                                                                          │
│  SAFE_PROD         YES               YES            YES (via debounce)      │
│                    (full pipeline with safety gates)                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 FULL_DRY_RUN Mode

**Purpose:** Validate input data without any database writes.

| Attribute | Value |
|-----------|-------|
| Staging writes | NO |
| Fact writes | NO |
| Alert trigger | NO |
| ID resolution | In-memory only |
| Use case | Pre-flight check before real ingestion |

**Execution Flow:**

```
FUNCTION executeDryRun(input):
  result = DryRunResult {}

  // Step 1: Parse
  parsed = parser.parse(input)
  result.parse_errors = parsed.errors
  result.rows_parsed = parsed.rows.length

  IF parsed.errors.critical:
    result.status = 'PARSE_FAILED'
    RETURN result

  // Step 2: Normalize
  normalized = normalizer.normalize(parsed.rows)
  result.normalization_errors = normalized.errors
  result.rows_normalized = normalized.rows.length

  // Step 3: Validate (schema, business rules)
  validation = validator.validate(normalized.rows)
  result.validation_errors = validation.errors
  result.validation_warnings = validation.warnings
  result.rows_valid = validation.valid_count
  result.rows_invalid = validation.invalid_count

  // Step 4: Simulate ID resolution (in-memory)
  resolution = resolver.resolveIds(normalized.rows, { mode: 'DRY_RUN' })
  result.new_entities = resolution.new_count
  result.existing_entities = resolution.existing_count
  result.unresolved_refs = resolution.unresolved_count

  // Step 5: Summary
  result.status = IF result.rows_invalid == 0 THEN 'VALID' ELSE 'INVALID'
  result.ready_for_production = result.status == 'VALID'

  RETURN result

DryRunResult {
  status: 'VALID' | 'INVALID' | 'PARSE_FAILED'
  ready_for_production: boolean

  rows_parsed: number
  rows_normalized: number
  rows_valid: number
  rows_invalid: number

  parse_errors: Error[]
  normalization_errors: Error[]
  validation_errors: Error[]
  validation_warnings: Warning[]

  new_entities: number
  existing_entities: number
  unresolved_refs: number
}
```

### 2.3 STAGING_ONLY Mode

**Purpose:** Write to staging tables, validate, but do not promote to production.

| Attribute | Value |
|-----------|-------|
| Staging writes | YES |
| Fact writes | NO |
| Alert trigger | NO |
| ID resolution | Persisted to staging_id_resolution |
| Use case | Test ingestion pipeline, review before commit |

**Execution Flow:**

```
FUNCTION executeStagingOnly(input, upload_id):
  result = StagingResult {}

  // Step 1: Parse & Normalize
  parsed = parser.parse(input)
  normalized = normalizer.normalize(parsed.rows)

  // Step 2: Write to staging_rows
  FOR row IN normalized.rows:
    staging_row = {
      upload_id: upload_id,
      row_number: row.index,
      row_type: row.type,
      entity_external_id: row.external_id,
      raw_data: row.raw,
      normalized_data: row.normalized,
      validation_status: 'pending'
    }
    INSERT INTO staging_rows VALUES staging_row

  result.rows_staged = normalized.rows.length

  // Step 3: Validate staged rows
  staged_rows = SELECT * FROM staging_rows WHERE upload_id = upload_id
  FOR row IN staged_rows:
    validation = validator.validateRow(row.normalized_data)

    UPDATE staging_rows SET
      validation_status = IF validation.valid THEN 'valid' ELSE 'invalid',
      validation_errors = validation.errors,
      validation_warnings = validation.warnings
    WHERE id = row.id

    IF validation.valid:
      result.rows_valid++
    ELSE:
      result.rows_invalid++

  // Step 4: Resolve IDs (persist to staging_id_resolution)
  dimension_rows = staged_rows.filter(r => r.row_type IN ['campaign', 'ad_set', 'ad'])
  FOR row IN dimension_rows:
    resolution = resolver.resolve(row.normalized_data)
    INSERT INTO staging_id_resolution VALUES {
      upload_id: upload_id,
      entity_type: row.row_type,
      platform: row.normalized_data.platform,
      external_id: row.entity_external_id,
      internal_id: resolution.internal_id,
      resolution_status: resolution.status,
      resolution_action: resolution.action
    }

  // Step 5: Summary (NO promotion)
  result.status = IF result.rows_invalid == 0 THEN 'STAGED_VALID' ELSE 'STAGED_INVALID'
  result.can_promote = result.status == 'STAGED_VALID'

  RETURN result
```

### 2.4 SAFE_PROD Mode

**Purpose:** Full production pipeline with safety gates at each stage.

| Attribute | Value |
|-----------|-------|
| Staging writes | YES (first) |
| Fact writes | YES (after validation gate) |
| Alert trigger | YES (via D6.6 debounce) |
| ID resolution | Full production resolution |
| Use case | Normal production ingestion |

**Execution Flow:**

```
FUNCTION executeSafeProd(input, upload_id):
  result = ProdResult {}

  // Stage 1: Execute STAGING_ONLY first
  staging_result = executeStagingOnly(input, upload_id)
  result.staging = staging_result

  IF NOT staging_result.can_promote:
    result.status = 'STAGING_VALIDATION_FAILED'
    result.promoted = false
    RETURN result

  // Gate: Validation passed, proceed to promotion
  LOG INFO("Validation passed, promoting to production", { upload_id })

  // Stage 2: Promote to production
  promotion_result = promoteToProduction(upload_id)
  result.promotion = promotion_result

  IF NOT promotion_result.success:
    result.status = 'PROMOTION_FAILED'
    result.promoted = false
    RETURN result

  // Stage 3: Mark staging as processed
  UPDATE staging_rows SET
    processed_at = now(),
    processing_action = 'PROMOTED'
  WHERE upload_id = upload_id

  // Stage 4: Trigger alert evaluation (via D6.6)
  emitIngestionCompleteEvent(upload_id)

  result.status = 'COMPLETED'
  result.promoted = true
  RETURN result
```

### 2.5 Mode Selection Logic

```
FUNCTION selectExecutionMode(request):
  // Explicit mode request
  IF request.mode IS NOT NULL:
    RETURN request.mode

  // Infer from context
  IF request.is_test OR request.dry_run:
    RETURN 'FULL_DRY_RUN'

  IF request.staging_only OR request.preview:
    RETURN 'STAGING_ONLY'

  // Default for production ingestion
  RETURN 'SAFE_PROD'
```

---

## 3. Execution Flow

### 3.1 Complete Execution Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       EXECUTION PIPELINE                                     │
│                                                                             │
│  ENTRY                                                                      │
│  ─────                                                                      │
│  ┌─────────────┐                                                            │
│  │ Input       │                                                            │
│  │ (CSV/API/WH)│                                                            │
│  └──────┬──────┘                                                            │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────┐    ┌─────────────┐                                        │
│  │   Parse &   │───▶│   Write to  │                                        │
│  │  Normalize  │    │   Staging   │                                        │
│  └─────────────┘    └──────┬──────┘                                        │
│                            │                                                │
│  STAGING ZONE              ▼                                                │
│  ────────────    ┌─────────────────┐                                       │
│                  │    Validate     │                                        │
│                  │  Staged Rows    │                                        │
│                  └────────┬────────┘                                        │
│                           │                                                 │
│                           ▼                                                 │
│                  ┌─────────────────┐                                       │
│                  │  DECISION GATE  │                                        │
│                  └────────┬────────┘                                        │
│                           │                                                 │
│              ┌────────────┼────────────┐                                   │
│              │            │            │                                   │
│         ALL VALID    SOME INVALID   ALL INVALID                            │
│              │            │            │                                   │
│              ▼            ▼            ▼                                   │
│         ┌────────┐  ┌──────────┐  ┌────────┐                               │
│         │PROMOTE │  │ PROMOTE  │  │ ABORT  │                               │
│         │  ALL   │  │  VALID   │  │        │                               │
│         │        │  │(LENIENT) │  │        │                               │
│         └───┬────┘  └────┬─────┘  └────────┘                               │
│             │            │                                                  │
│  PRODUCTION │            │                                                  │
│  ZONE       ▼            ▼                                                  │
│         ┌─────────────────────┐                                            │
│         │   Write to Fact     │                                            │
│         │      Tables         │                                            │
│         └──────────┬──────────┘                                            │
│                    │                                                        │
│                    ▼                                                        │
│         ┌─────────────────────┐                                            │
│         │   Post-Validation   │                                            │
│         └──────────┬──────────┘                                            │
│                    │                                                        │
│                    ▼                                                        │
│         ┌─────────────────────┐                                            │
│         │ Emit Ingestion      │                                            │
│         │ Complete Event      │                                            │
│         └─────────────────────┘                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Entry Phase

| Step | Action | Failure Behavior |
|------|--------|------------------|
| 1 | Receive input (file, API response, webhook payload) | Reject with error |
| 2 | Create data_uploads record (status='pending') | Cannot proceed |
| 3 | Validate input format | Mark failed, abort |
| 4 | Determine execution mode | Use default (SAFE_PROD) |

### 3.3 Staging Phase

| Step | Action | Failure Behavior |
|------|--------|------------------|
| 1 | Parse input to raw rows | Mark failed, abort |
| 2 | Normalize rows | Log errors, continue with valid |
| 3 | Write to staging_rows | Mark failed, abort |
| 4 | Validate each row | Mark invalid, continue |
| 5 | Resolve entity IDs | Store resolution state |

### 3.4 Decision Gate

```
DecisionGate {
  mode: 'STRICT' | 'LENIENT'
  valid_count: number
  invalid_count: number
  threshold_percent: number  // For LENIENT mode
}

FUNCTION evaluateGate(gate):
  total = gate.valid_count + gate.invalid_count

  IF gate.mode == 'STRICT':
    // All rows must be valid
    IF gate.invalid_count > 0:
      RETURN { decision: 'ABORT', reason: 'Invalid rows found in STRICT mode' }
    RETURN { decision: 'PROMOTE_ALL' }

  IF gate.mode == 'LENIENT':
    // Proceed if enough rows are valid
    valid_percent = (gate.valid_count / total) * 100

    IF gate.valid_count == 0:
      RETURN { decision: 'ABORT', reason: 'No valid rows' }

    IF valid_percent < gate.threshold_percent:
      RETURN { decision: 'ABORT', reason: 'Below validity threshold' }

    IF gate.invalid_count > 0:
      RETURN { decision: 'PROMOTE_VALID', skip_count: gate.invalid_count }

    RETURN { decision: 'PROMOTE_ALL' }
```

**Default Gate Configuration:**

| Setting | Default | Description |
|---------|---------|-------------|
| mode | STRICT | For production safety |
| threshold_percent | 90 | For LENIENT mode |

### 3.5 Promotion Rules

| Decision | Action | Staging Update |
|----------|--------|----------------|
| PROMOTE_ALL | Upsert all valid rows to production | processed_at = now(), action = 'PROMOTED' |
| PROMOTE_VALID | Upsert valid rows only | Valid: promoted, Invalid: skipped |
| ABORT | No production writes | All rows remain unprocessed |

**Promotion Logic:**

```
FUNCTION promoteToProduction(upload_id):
  result = PromotionResult {}

  // Get valid rows in dependency order
  campaigns = SELECT * FROM staging_rows
    WHERE upload_id = upload_id
      AND validation_status = 'valid'
      AND row_type = 'campaign'
    ORDER BY row_number

  ad_sets = SELECT * FROM staging_rows
    WHERE upload_id = upload_id
      AND validation_status = 'valid'
      AND row_type = 'ad_set'
    ORDER BY row_number

  ads = SELECT * FROM staging_rows
    WHERE upload_id = upload_id
      AND validation_status = 'valid'
      AND row_type = 'ad'
    ORDER BY row_number

  metrics = SELECT * FROM staging_rows
    WHERE upload_id = upload_id
      AND validation_status = 'valid'
      AND row_type IN ('daily_metric', 'demographic_metric')
    ORDER BY row_number

  // Promote in order
  BEGIN TRANSACTION:
    result.campaigns = promoteDimensions(campaigns, 'campaigns')
    result.ad_sets = promoteDimensions(ad_sets, 'ad_sets')
    result.ads = promoteDimensions(ads, 'ads')
    result.daily_metrics = promoteFacts(metrics.filter(type='daily_metric'), 'daily_metrics')
    result.demographic_metrics = promoteFacts(metrics.filter(type='demographic_metric'), 'demographic_metrics')
  COMMIT

  result.success = true
  RETURN result
```

### 3.6 Abort Conditions

| Condition | Stage | Behavior |
|-----------|-------|----------|
| Parse failure (100%) | Entry | Abort, mark upload failed |
| Normalization failure (100%) | Staging | Abort, mark upload failed |
| Staging write failure | Staging | Abort, rollback staging |
| Validation threshold not met | Gate | Abort, keep staging for review |
| Promotion transaction failure | Production | Rollback production, keep staging |
| Post-validation failure | Post | Log warning, promotion already done |

---

## 4. Validation Checks

### 4.1 Schema Compliance Checks

| Check | Level | Failure Severity |
|-------|-------|------------------|
| Required field present | Row | ERROR (invalid row) |
| Field type matches expected | Row | ERROR (invalid row) |
| Enum value in allowed set | Row | ERROR (invalid row) |
| String length within limits | Row | ERROR (invalid row) |
| Numeric value in valid range | Row | WARN (may be valid) |
| Date format valid | Row | ERROR (invalid row) |
| UUID format valid | Row | ERROR (invalid row) |

**Schema Validation Implementation:**

```
FUNCTION validateSchema(row, row_type):
  schema = getSchema(row_type)
  errors = []

  FOR field IN schema.required_fields:
    IF row[field.name] IS NULL OR row[field.name] == '':
      errors.push({
        field: field.name,
        value: null,
        reason: 'REQUIRED_FIELD_MISSING',
        severity: 'ERROR'
      })

  FOR field IN schema.all_fields:
    value = row[field.name]
    IF value IS NOT NULL:
      IF NOT matchesType(value, field.type):
        errors.push({
          field: field.name,
          value: value,
          reason: 'TYPE_MISMATCH',
          expected: field.type,
          severity: 'ERROR'
        })

      IF field.enum AND value NOT IN field.enum:
        errors.push({
          field: field.name,
          value: value,
          reason: 'INVALID_ENUM_VALUE',
          allowed: field.enum,
          severity: 'ERROR'
        })

  RETURN { valid: errors.length == 0, errors: errors }
```

### 4.2 Row-Level Sanity Checks

| Check | Condition | Severity |
|-------|-----------|----------|
| Spend is non-negative | spend >= 0 | ERROR |
| Impressions is non-negative | impressions >= 0 | ERROR |
| Clicks <= Impressions | clicks <= impressions | WARN |
| CTR in valid range | 0 <= ctr <= 100 | WARN |
| Date is not future | metric_date <= today | ERROR |
| Date is not too old | metric_date >= 2020-01-01 | WARN |
| External ID not empty | external_id.length > 0 | ERROR |
| Name not empty | name.length > 0 | ERROR |
| Campaign has client | client_id IS NOT NULL | ERROR |
| Ad Set has campaign | campaign_id IS NOT NULL | ERROR |
| Ad has ad_set | ad_set_id IS NOT NULL | ERROR |

### 4.3 Cardinality & Volume Checks

| Check | Threshold | Severity | Action |
|-------|-----------|----------|--------|
| Total rows | > 1,000,000 | ERROR | Reject batch |
| Campaigns per upload | > 10,000 | WARN | Log, continue |
| Ad Sets per upload | > 50,000 | WARN | Log, continue |
| Ads per upload | > 100,000 | WARN | Log, continue |
| Metrics per upload | > 500,000 | WARN | Log, continue |
| Duplicate external IDs | > 0 (same type) | WARN | Keep last |
| Orphan references | > 10% | WARN | Log, continue |

**Cardinality Check Implementation:**

```
FUNCTION checkCardinality(staged_rows, upload_id):
  warnings = []

  counts = {
    total: staged_rows.length,
    campaigns: staged_rows.filter(r => r.row_type == 'campaign').length,
    ad_sets: staged_rows.filter(r => r.row_type == 'ad_set').length,
    ads: staged_rows.filter(r => r.row_type == 'ad').length,
    metrics: staged_rows.filter(r => r.row_type LIKE '%metric').length
  }

  IF counts.total > 1000000:
    RETURN { valid: false, errors: [{ reason: 'BATCH_TOO_LARGE', count: counts.total }] }

  IF counts.campaigns > 10000:
    warnings.push({ reason: 'HIGH_CAMPAIGN_COUNT', count: counts.campaigns })

  IF counts.ad_sets > 50000:
    warnings.push({ reason: 'HIGH_AD_SET_COUNT', count: counts.ad_sets })

  // Check for duplicates
  duplicates = findDuplicateExternalIds(staged_rows)
  IF duplicates.length > 0:
    warnings.push({ reason: 'DUPLICATE_EXTERNAL_IDS', count: duplicates.length, ids: duplicates.slice(0, 10) })

  RETURN { valid: true, warnings: warnings }
```

### 4.4 Cross-Row Validation

| Check | Description | Severity |
|-------|-------------|----------|
| Campaign exists for Ad Set | campaign_external_id must resolve | ERROR or WARN (orphan handling) |
| Ad Set exists for Ad | ad_set_external_id must resolve | ERROR or WARN |
| Platform consistency | Child entities match parent platform | ERROR |
| Client consistency | All entities belong to same client | ERROR |
| Date range consistency | Metrics fall within campaign dates | WARN |

---

## 5. Failure Isolation

### 5.1 Abort Execution Failures

| Failure | Stage | Reason |
|---------|-------|--------|
| Input file unreadable | Entry | Cannot proceed without data |
| 100% parse failures | Parse | No usable data |
| Staging database unavailable | Staging | Cannot persist intermediate state |
| Transaction deadlock (3 retries) | Promotion | Data integrity risk |
| SCHEMA_CONTRACT_VIOLATION | Any | System integrity at risk |
| Out of memory | Any | System stability at risk |

**Abort Behavior:**

```
FUNCTION handleAbort(upload_id, stage, error):
  LOG ERROR("Ingestion aborted", { upload_id, stage, error })

  // Mark upload as failed
  UPDATE data_uploads SET
    status = 'failed',
    error_text = error.message
  WHERE id = upload_id

  // Preserve staging data for debugging
  // (cleanup happens via TTL, not immediately)

  // Emit failure event
  emitIngestionFailedEvent(upload_id, stage, error)

  RETURN AbortResult { upload_id, stage, error }
```

### 5.2 Graceful Degradation Failures

| Failure | Stage | Behavior |
|---------|-------|----------|
| Single row parse failure | Parse | Skip row, continue |
| Single row validation failure | Validation | Mark invalid, continue |
| Non-critical field missing | Normalization | Set NULL, continue |
| Orphan reference (dimension) | Resolution | Mark unresolved, continue with metrics |
| Metric without entity | Promotion | Set FK NULL, log warning |
| Post-validation warning | Post | Log, complete normally |

**Degradation Behavior:**

```
FUNCTION handleDegradation(row, failure):
  LOG WARN("Row degraded", { row_number: row.row_number, failure })

  UPDATE staging_rows SET
    validation_status = 'invalid',
    validation_errors = validation_errors || [failure.toJSON()]
  WHERE id = row.id

  // Continue processing other rows
  RETURN DegradationResult { row_id: row.id, skipped: true, reason: failure }
```

### 5.3 Log-Only Failures

| Failure | Stage | Behavior |
|---------|-------|----------|
| Cleanup job failure | Post | Log error, retry next cycle |
| Metric update slightly differs | Promotion | Log delta, upsert wins |
| Non-critical warning threshold | Validation | Log warning, continue |
| Duplicate row in batch | Normalization | Keep last, log duplicate |
| Platform deprecation warning | Normalization | Log, continue |

---

## 6. Observability

### 6.1 Staging-Specific Log Events

| Event | Level | Required Fields |
|-------|-------|-----------------|
| staging.write_started | INFO | upload_id, row_count, row_types |
| staging.row_written | DEBUG | upload_id, row_number, row_type |
| staging.write_completed | INFO | upload_id, rows_written, duration_ms |
| staging.validation_started | INFO | upload_id, row_count |
| staging.row_validated | DEBUG | upload_id, row_number, status, error_count |
| staging.validation_completed | INFO | upload_id, valid_count, invalid_count, duration_ms |
| staging.gate_evaluated | INFO | upload_id, decision, valid_count, invalid_count |
| staging.promotion_started | INFO | upload_id, rows_to_promote |
| staging.entity_promoted | DEBUG | upload_id, entity_type, external_id, action |
| staging.promotion_completed | INFO | upload_id, promoted_count, skipped_count, duration_ms |
| staging.cleanup_executed | INFO | rows_deleted, tables_affected, duration_ms |

### 6.2 Dry-Run Specific Log Events

| Event | Level | Required Fields |
|-------|-------|-----------------|
| dry_run.started | INFO | request_id, mode, source |
| dry_run.parse_completed | DEBUG | request_id, rows_parsed, errors |
| dry_run.validation_completed | INFO | request_id, valid_count, invalid_count |
| dry_run.completed | INFO | request_id, status, ready_for_production |

### 6.3 Pre-Production Quality Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| staging_rows_written_total | Counter | row_type, validation_status | Rows written to staging |
| staging_validation_duration_seconds | Histogram | upload_id | Validation time |
| staging_valid_row_ratio | Gauge | upload_id | Percentage of valid rows |
| staging_promotion_duration_seconds | Histogram | — | Promotion time |
| staging_gate_decisions_total | Counter | decision | Gate outcomes |
| staging_cleanup_rows_deleted | Counter | table | Cleanup activity |
| dry_run_executions_total | Counter | mode, status | Dry run outcomes |
| dry_run_validation_errors_total | Counter | error_type | Error distribution |

### 6.4 Correlation with Production Runs

| Staging Event | Production Correlation |
|---------------|----------------------|
| staging.promotion_completed | data_uploads.id links to production entities |
| staging.row_validated | staging_rows.target_internal_id links to production |
| staging.gate_evaluated | Decision determines if D6.6 triggers |
| dry_run.completed | Can be followed by SAFE_PROD with same input |

**Correlation ID Chain:**

```
dry_run.request_id (optional pre-flight)
    │
    └── upload_id (data_uploads.id)
            │
            ├── staging_rows.upload_id (staging correlation)
            │
            ├── staging_id_resolution.upload_id (ID mapping)
            │
            └── IngestionCompleteEvent.upload_id (D6.6 trigger)
                    │
                    └── alert_evaluation.batch_id
```

---

## 7. Freeze & Safety Confirmation

### 7.1 Schema Compliance

| D4 Freeze Requirement | D6.5.1 Compliance |
|-----------------------|-------------------|
| No new production tables | COMPLIANT — staging is logical design |
| No production column changes | COMPLIANT — no production schema |
| No fact table modifications | COMPLIANT — staging tables only |
| No alert table modifications | COMPLIANT — no alert access |

**Note:** staging_rows and staging_id_resolution are NEW tables for staging purposes only. They do not modify any D4-frozen production tables.

### 7.2 Alert Logic Isolation

| Boundary | Enforcement |
|----------|-------------|
| Staging writes do not trigger alerts | No IngestionCompleteEvent until promotion |
| Dry-run never triggers alerts | No events emitted in dry-run |
| Invalid rows never reach production | Gate prevents promotion |
| Failed ingestion never triggers alerts | Abort path does not emit |

### 7.3 D6.7 API Pull Compatibility

| API Pull Feature | D6.5.1 Support |
|------------------|----------------|
| Entity data flows to staging | Same staging_rows table |
| Validation before production | Same validation pipeline |
| Dry-run for API testing | FULL_DRY_RUN mode |
| Incremental sync | ID resolution tracks state |

### 7.4 D6.6 Alert Evaluation Compatibility

| Alert Feature | D6.5.1 Support |
|---------------|----------------|
| IngestionCompleteEvent | Emitted only after successful promotion |
| Debounce window | Applies to promoted data only |
| Metric availability | Only promoted metrics visible to D6.6 |
| Orphan handling | Invalid metrics never reach production |

### 7.5 Safety Guarantees

| Guarantee | Mechanism |
|-----------|-----------|
| No production corruption | Staging validates before promotion |
| No accidental writes | FULL_DRY_RUN and STAGING_ONLY modes |
| Rollback capability | Staging data preserved for review |
| Testability | Engineers can validate end-to-end safely |
| Auditability | All staging operations logged |
| Isolation | Staging tables separate from production |

---

## 8. Implementation Checklist

For the implementing engineer:

### 8.1 Pre-Implementation

| Check | Verified |
|-------|----------|
| Read D6.4 Ingestion Architecture | |
| Read D6.5 Ingestion Execution Blueprint | |
| Read D6.6 Alert Evaluation Runtime | |
| Read D6.7.1 Ingestion Boundary | |
| Read D6.7.2 API Pull Design | |

### 8.2 Implementation Order

| Order | Component | Dependencies |
|-------|-----------|--------------|
| 1 | staging_rows table (migration) | None |
| 2 | staging_id_resolution table (migration) | None |
| 3 | Staging writer | Tables |
| 4 | Row validator | None |
| 5 | Cardinality checker | None |
| 6 | Cross-row validator | Row validator |
| 7 | Decision gate | Validators |
| 8 | Promotion executor | Decision gate, D6.5 upserters |
| 9 | Dry-run executor | Validators |
| 10 | Cleanup job | Tables |
| 11 | Observability hooks | All |

### 8.3 Test Requirements

| Test Type | Coverage |
|-----------|----------|
| Unit: Row validation | All field types |
| Unit: Schema validation | Required/optional fields |
| Unit: Cardinality checks | Thresholds |
| Integration: FULL_DRY_RUN | No writes verified |
| Integration: STAGING_ONLY | Staging writes, no production |
| Integration: SAFE_PROD | Full pipeline |
| Integration: Abort paths | All abort conditions |
| Integration: Cleanup | TTL enforcement |

---

## 9. Document Control

| Version | Date | Change |
|---------|------|--------|
| D6.5.1 | 2024-12-28 | Initial staging and dry-run design |

---

## 10. Approval

This document is a pre-implementation contract. Implementation requires separate approval.

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Data Platform Architect | | | |
| QA Lead | | | |
| Product Owner | | | |
