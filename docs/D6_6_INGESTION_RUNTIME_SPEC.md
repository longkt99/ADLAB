# D6.6 — Ingestion Runtime Specification

**Version:** 1.0
**Date:** 2024-12-29
**Status:** DESIGN COMPLETE
**Prerequisites:** D6.4 (Schema), D6.5 (Execution Lock)

---

## 1. Scope

### 1.1 In Scope

| Component | Description |
|-----------|-------------|
| Worker responsibilities | What each worker does and does not do |
| I/O contracts | Upload → Batch → Staging → Promotion flow |
| State machine | States, transitions, retry rules |
| Concurrency model | Locking, isolation, conflict resolution |
| Failure handling | Resume, rollback, skip semantics |
| IngestionCompleteEvent | Exact emission conditions |

### 1.2 Out of Scope (Per D6.5)

| Excluded | Rationale |
|----------|-----------|
| demographic_metrics | BLOCKED — schema incomplete |
| reports table | BLOCKED — not exported |
| API pull ingestion | DEFERRED to D7+ |
| Scheduled ingestion | DEFERRED to D7+ |
| Alert evaluation | Separate subsystem (D6.6 original) |

---

## 2. Worker Architecture

### 2.1 Worker Types

| Worker | Responsibility | Triggers |
|--------|----------------|----------|
| **IntakeWorker** | Validate upload request, create data_uploads record | HTTP request, file drop |
| **ParseWorker** | Read file, normalize rows, write to staging | data_uploads.status = 'pending' |
| **PromotionWorker** | Upsert staging → production tables | staging complete + validation pass |
| **CleanupWorker** | Purge expired staging rows | Cron (daily) |

### 2.2 Worker Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│                      WORKER BOUNDARIES                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  IntakeWorker          ParseWorker           PromotionWorker    │
│  ─────────────         ───────────           ────────────────   │
│  WRITES:               WRITES:               WRITES:            │
│  • data_uploads        • staging_rows        • campaigns        │
│                        • staging_id_res      • ad_sets          │
│  READS:                                      • ads              │
│  • (request only)      READS:                • daily_metrics    │
│                        • file content        • data_uploads     │
│  NEVER:                • data_uploads                           │
│  • staging                                   READS:             │
│  • production          NEVER:                • staging_rows     │
│                        • production tables   • staging_id_res   │
│                                                                 │
│  CleanupWorker                                                  │
│  ─────────────                                                  │
│  DELETES: staging_rows, staging_id_resolution (expired)         │
│  NEVER: production tables                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Worker Isolation Rules

| Rule | Specification |
|------|---------------|
| Single upload ownership | One worker per upload_id at a time |
| No cross-upload access | Worker reads only its assigned upload |
| No direct production writes | ParseWorker never touches production |
| Staging is ephemeral | Workers must not assume staging persists beyond 7 days |

---

## 3. Input/Output Contracts

### 3.1 Contract Chain

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  UPLOAD  │───▶│  BATCH   │───▶│ STAGING  │───▶│PROMOTION │
│ REQUEST  │    │  RECORD  │    │   ROWS   │    │  COMMIT  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │
     ▼               ▼               ▼               ▼
  HTTP POST     data_uploads    staging_rows    production
  + file        row created     populated       tables updated
```

### 3.2 Upload Request Contract

**Input:**
```
{
  workspace_id: uuid (required)
  client_id: uuid (optional — nullable in data_uploads)
  platform: 'meta' | 'google' | 'tiktok' (required)
  source: 'manual' | 'api' | 'webhook' (required)
  file: binary (required for manual)
  filename: string (optional)
  created_by: uuid (optional)
}
```

**Output:**
```
{
  upload_id: uuid
  status: 'pending'
}
```

**Validation:**
- workspace_id must be valid UUID
- platform must be in allowed list
- file size ≤ 50 MB
- file format: CSV or JSON

### 3.3 Batch Record Contract (data_uploads)

| Field | Set By | When |
|-------|--------|------|
| id | IntakeWorker | Creation |
| workspace_id | IntakeWorker | Creation |
| client_id | IntakeWorker | Creation (nullable) |
| platform | IntakeWorker | Creation |
| source | IntakeWorker | Creation |
| filename | IntakeWorker | Creation |
| file_url | IntakeWorker | After storage |
| status | All workers | State transitions |
| row_count | PromotionWorker | Completion |
| error_text | Any worker | On failure |
| created_by | IntakeWorker | Creation |
| created_at | Database | Auto |

### 3.4 Staging Contract (staging_rows)

**Input (from ParseWorker):**
```
{
  upload_id: uuid (required)
  workspace_id: uuid (required)
  row_index: integer (required, 0-based)
  entity_type: 'campaign' | 'ad_set' | 'ad' | 'daily_metric' (required)
  natural_key_hash: text (required, SHA-256 of natural key)
  raw_data: jsonb (required, normalized row)
  validation_status: 'pending' | 'valid' | 'invalid' (required)
  validation_errors: jsonb (nullable)
  created_at: timestamp (auto)
}
```

**Output (to PromotionWorker):**
- Rows with validation_status = 'valid'
- Grouped by entity_type
- Ordered by row_index

### 3.5 Promotion Contract

**Input:** Valid staging_rows for upload_id
**Output:** Upserted records in production tables

| Entity Type | Target Table | Upsert Key |
|-------------|--------------|------------|
| campaign | campaigns | (workspace_id, client_id, platform, external_id) |
| ad_set | ad_sets | (workspace_id, client_id, platform, external_id) |
| ad | ads | (workspace_id, client_id, platform, external_id) |
| daily_metric | daily_metrics | (workspace_id, client_id, platform, metric_date, campaign_id, ad_set_id, ad_id) |

---

## 4. State Machine

### 4.1 States

| State | Description | Owner |
|-------|-------------|-------|
| `pending` | Upload created, awaiting parse | IntakeWorker |
| `processing` | Parse in progress | ParseWorker |
| `staging_complete` | All rows staged, validation done | ParseWorker |
| `promoting` | Writing to production | PromotionWorker |
| `completed` | All rows promoted | PromotionWorker |
| `partial` | Some rows failed, rest promoted | PromotionWorker |
| `failed` | Unrecoverable error | Any worker |

### 4.2 State Transition Diagram

```
                    ┌─────────────────────────────────────┐
                    │                                     │
                    ▼                                     │
┌─────────┐    ┌────────────┐    ┌─────────────────┐     │
│ pending │───▶│ processing │───▶│ staging_complete│     │
└─────────┘    └────────────┘    └─────────────────┘     │
     │              │                    │               │
     │              │                    ▼               │
     │              │              ┌───────────┐         │
     │              │              │ promoting │         │
     │              │              └───────────┘         │
     │              │                    │               │
     │              │         ┌──────────┼──────────┐    │
     │              │         ▼          ▼          ▼    │
     │              │    ┌─────────┐ ┌───────┐ ┌────────┐│
     │              └───▶│ failed  │ │partial│ │completed││
     │                   └─────────┘ └───────┘ └────────┘│
     │                        ▲                          │
     └────────────────────────┴──────────────────────────┘
```

### 4.3 Transition Rules

| From | To | Condition | Action |
|------|----|-----------|--------|
| pending | processing | Worker claims upload | Set status, begin parse |
| processing | staging_complete | All rows parsed + validated | Set status |
| processing | failed | Parse error (malformed file) | Set status, error_text |
| staging_complete | promoting | Validation pass rate ≥ threshold | Begin promotion |
| staging_complete | failed | Validation pass rate < threshold | Set status, error_text |
| promoting | completed | All valid rows promoted | Set status, row_count |
| promoting | partial | Some rows failed promotion | Set status, row_count, error_text |
| promoting | failed | Critical promotion error | Set status, error_text |

### 4.4 Validation Threshold

| Metric | Threshold | Behavior |
|--------|-----------|----------|
| Valid row percentage | ≥ 90% | Proceed to promotion |
| Valid row percentage | < 90% | Fail upload (too many errors) |
| Override flag | `force_partial: true` | Promote valid rows regardless |

---

## 5. Concurrency and Locking

### 5.1 Locking Model

| Resource | Lock Type | Scope | Duration |
|----------|-----------|-------|----------|
| data_uploads row | Row-level (SELECT FOR UPDATE) | Single upload | Worker lifetime |
| staging_rows batch | None (append-only) | N/A | N/A |
| Production table | Row-level per upsert | Natural key | Transaction |

### 5.2 Claim Protocol

```
Worker Claim Sequence:
──────────────────────

1. BEGIN TRANSACTION
2. SELECT * FROM data_uploads
   WHERE status = 'pending'
   AND workspace_id = $workspace_id
   ORDER BY created_at ASC
   LIMIT 1
   FOR UPDATE SKIP LOCKED
3. IF row found:
     UPDATE status = 'processing'
     COMMIT
     Process upload
   ELSE:
     ROLLBACK (nothing to process)
```

### 5.3 Concurrency Limits (Per D6.5)

| Limit | Value | Enforcement |
|-------|-------|-------------|
| Concurrent uploads per workspace | 3 | Claim query filters |
| Concurrent workers per upload | 1 | FOR UPDATE lock |
| Batch size for promotion | 1000 rows | Worker config |

### 5.4 Conflict Resolution

| Scenario | Resolution |
|----------|------------|
| Two workers claim same upload | FOR UPDATE SKIP LOCKED prevents |
| Upsert conflict on natural key | ON CONFLICT DO UPDATE |
| FK resolution race | Retry with backoff (parent may be in-flight) |

---

## 6. Failure Handling and Resume

### 6.1 Failure Classification

| Failure Type | Severity | Action | Resumable |
|--------------|----------|--------|-----------|
| File not found | FATAL | status='failed' | NO |
| Malformed file | FATAL | status='failed' | NO |
| Parse error (row) | ROW | Skip row, continue | N/A |
| Validation error (row) | ROW | Mark invalid, continue | N/A |
| FK not found | ROW | Set NULL, warn | N/A |
| DB connection lost | TRANSIENT | Retry 3x | YES |
| Transaction timeout | TRANSIENT | Retry 3x | YES |
| RLS denied | FATAL | status='failed' | NO |
| Unique constraint (unexpected) | ROW | Skip row, log | N/A |

### 6.2 Retry Rules

| Error Type | Max Retries | Backoff | Final Action |
|------------|-------------|---------|--------------|
| Connection timeout | 3 | Exponential (1s, 2s, 4s) | Fail upload |
| Transaction deadlock | 3 | Exponential (100ms, 200ms, 400ms) | Fail batch |
| Rate limit | 5 | Fixed (60s) | Fail upload |

### 6.3 Resume Semantics

| State | Resume Behavior |
|-------|-----------------|
| pending | Restart from beginning |
| processing | Check staging progress, resume from last row_index |
| staging_complete | Proceed to promotion |
| promoting | Check production, resume unpromoted rows |
| completed | No action (idempotent) |
| partial | No auto-resume (requires manual review) |
| failed | No auto-resume (requires fix + new upload) |

### 6.4 Resume Detection

```
Resume Check Query:
───────────────────

SELECT MAX(row_index) as last_processed
FROM staging_rows
WHERE upload_id = $upload_id
  AND validation_status != 'pending'
```

If `last_processed` exists, resume from `last_processed + 1`.

---

## 7. IngestionCompleteEvent

### 7.1 Event Definition

```
IngestionCompleteEvent {
  upload_id: uuid
  workspace_id: uuid
  client_id: uuid | null
  platform: 'meta' | 'google' | 'tiktok'
  status: 'completed' | 'partial'
  metrics: {
    total_rows: integer
    promoted_rows: integer
    failed_rows: integer
    campaigns_upserted: integer
    ad_sets_upserted: integer
    ads_upserted: integer
    daily_metrics_upserted: integer
  }
  affected_dates: date[]  // For alert evaluation scope
  timestamp: timestamp
}
```

### 7.2 Emission Conditions

| Condition | Emit Event | Event Status |
|-----------|------------|--------------|
| All valid rows promoted | YES | 'completed' |
| Some rows promoted, some failed | YES | 'partial' |
| Zero rows promoted (all invalid) | NO | N/A (status='failed') |
| Upload failed before promotion | NO | N/A |

### 7.3 Emission Rules

```
Emit IngestionCompleteEvent IF AND ONLY IF:
───────────────────────────────────────────

1. data_uploads.status IN ('completed', 'partial')
2. promoted_rows > 0
3. Event not already emitted for this upload_id

DO NOT EMIT IF:
───────────────
• status = 'failed'
• status = 'pending' | 'processing' | 'staging_complete' | 'promoting'
• promoted_rows = 0
```

### 7.4 Event Consumers

| Consumer | Action |
|----------|--------|
| Alert Evaluation (D6.6 original) | Evaluate rules against new data |
| Audit Log | Record ingestion completion |
| WebSocket notifier | Push status to UI |

### 7.5 Idempotency

| Guarantee | Mechanism |
|-----------|-----------|
| Single emission | Check `event_emitted` flag before emit |
| Safe replay | Consumers handle duplicate events gracefully |

---

## 8. Execution Order Summary

```
INGESTION RUNTIME EXECUTION ORDER
═════════════════════════════════

1. IntakeWorker
   ├── Validate request
   ├── Create data_uploads (status='pending')
   └── Store file, set file_url

2. ParseWorker (claims upload)
   ├── Set status='processing'
   ├── Read file content
   ├── For each row:
   │   ├── Normalize fields
   │   ├── Compute natural_key_hash
   │   ├── Validate against rules
   │   └── INSERT staging_rows
   ├── Set status='staging_complete'
   └── Release lock

3. PromotionWorker (claims upload)
   ├── Set status='promoting'
   ├── Dimension upsert (order: campaigns → ad_sets → ads)
   │   └── Populate staging_id_resolution
   ├── Fact upsert (daily_metrics)
   │   └── Resolve FKs via staging_id_resolution
   ├── Set status='completed' | 'partial'
   ├── Set row_count
   └── Emit IngestionCompleteEvent

4. CleanupWorker (cron)
   └── DELETE staging_rows WHERE created_at < now() - 7 days
```

---

## 9. Alignment Verification

| Requirement | D6.4 Reference | D6.5 Reference | Satisfied |
|-------------|----------------|----------------|-----------|
| Natural keys | Section 4.1, 4.2 | Section 2.2 | ✓ |
| Staging tables | — | Section 2.1 | ✓ |
| Production constraints | — | Section 5 | ✓ |
| BLOCKED tables excluded | Section 2.5 (demographic) | Section 3 | ✓ |
| No schema changes | Section 1.2 | N/A | ✓ |
| No alert logic | Section 1.2 | N/A | ✓ |

---

## 10. Document Control

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2024-12-29 | Initial specification |

---

| Role | Approval | Date |
|------|----------|------|
| Runtime Architect | | |
| D6.4/D6.5 Owner | | |
