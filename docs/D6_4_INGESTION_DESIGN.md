# D6.4 — Ingestion Design (Architecture Skeleton)

**Version:** D6.4-REVISED
**Date:** 2024-12-28
**Status:** API-READY DESIGN (NO IMPLEMENTATION CODE)
**Source of Truth:** Supabase `information_schema.columns` export (2024-12-28)

---

## 1. Scope & Non-Goals

### 1.1 Scope

| In Scope | Description |
|----------|-------------|
| Architecture design | Pipeline stages, data flow, contracts |
| Schema documentation | Real columns from Supabase export |
| Natural key definitions | Based on verified columns only |
| Idempotency contracts | Upsert semantics for safe replay |
| Error taxonomy mapping | D5.1-compatible failure classification |
| Validation rules | Based on actual column types |

### 1.2 Non-Goals

| Out of Scope | Rationale |
|--------------|-----------|
| Implementation code | Design-only phase |
| Worker implementation | Deferred to D6.5+ |
| Schema modifications | D4-frozen tables unchanged |
| Alert generation logic | Covered by D6.6 |
| UI changes | No frontend impact |

### 1.3 Compatibility Confirmation

- **D4 Freeze:** All 9 tables are existing production tables; NO schema changes proposed
- **D5.1 Observability:** Error taxonomy mapping included
- **D6.5 Staging:** Design compatible with staging layer
- **D6.6 Alerts:** Alert boundary defined but not implemented

---

## 2. Canonical Schema Snapshot (From Supabase Result Grid)

### 2.1 campaigns

| Ordinal | Column | Data Type | Nullable | Default |
|---------|--------|-----------|----------|---------|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | workspace_id | uuid | NO | null |
| 3 | client_id | uuid | NO | null |
| 4 | platform | text | NO | null |
| 5 | external_id | text | NO | null |
| 6 | name | text | NO | null |
| 7 | objective | text | YES | null |
| 8 | status | text | NO | 'active'::text |
| 9 | start_date | date | YES | null |
| 10 | end_date | date | YES | null |
| 11 | created_at | timestamp with time zone | NO | now() |

**Analysis:**
- **Primary Key:** `id`
- **Correlation Fields:** workspace_id, client_id, platform, external_id, created_at
- **Linking Fields:** None (top of hierarchy)
- **Nullable FK-like:** None
- **Natural Key Candidate:** (workspace_id, client_id, platform, external_id)

---

### 2.2 ad_sets

| Ordinal | Column | Data Type | Nullable | Default |
|---------|--------|-----------|----------|---------|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | workspace_id | uuid | NO | null |
| 3 | client_id | uuid | NO | null |
| 4 | campaign_id | uuid | NO | null |
| 5 | platform | text | NO | null |
| 6 | external_id | text | NO | null |
| 7 | name | text | NO | null |
| 8 | status | text | NO | 'active'::text |
| 9 | daily_budget | numeric | YES | null |
| 10 | lifetime_budget | numeric | YES | null |
| 11 | created_at | timestamp with time zone | NO | now() |

**Analysis:**
- **Primary Key:** `id`
- **Correlation Fields:** workspace_id, client_id, platform, external_id, created_at
- **Linking Fields:** campaign_id (NOT NULL — parent required)
- **Nullable FK-like:** None
- **Natural Key Candidate:** (workspace_id, client_id, platform, external_id)
- **Dependency:** Requires campaigns.id for campaign_id

---

### 2.3 ads

| Ordinal | Column | Data Type | Nullable | Default |
|---------|--------|-----------|----------|---------|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | workspace_id | uuid | NO | null |
| 3 | client_id | uuid | NO | null |
| 4 | campaign_id | uuid | NO | null |
| 5 | ad_set_id | uuid | NO | null |
| 6 | platform | text | NO | null |
| 7 | external_id | text | NO | null |
| 8 | name | text | NO | null |
| 9 | status | text | NO | 'active'::text |
| 10 | landing_url | text | YES | null |
| 11 | creative_id | text | YES | null |
| 12 | created_at | timestamp with time zone | NO | now() |

**Analysis:**
- **Primary Key:** `id`
- **Correlation Fields:** workspace_id, client_id, platform, external_id, created_at
- **Linking Fields:** campaign_id (NOT NULL), ad_set_id (NOT NULL)
- **Nullable FK-like:** None
- **Natural Key Candidate:** (workspace_id, client_id, platform, external_id)
- **Dependency:** Requires campaigns.id AND ad_sets.id

---

### 2.4 daily_metrics

| Ordinal | Column | Data Type | Nullable | Default |
|---------|--------|-----------|----------|---------|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | workspace_id | uuid | NO | null |
| 3 | client_id | uuid | NO | null |
| 4 | platform | text | NO | null |
| 5 | metric_date | date | NO | null |
| 6 | campaign_id | uuid | YES | null |
| 7 | ad_set_id | uuid | YES | null |
| 8 | ad_id | uuid | YES | null |
| 9 | impressions | bigint | NO | 0 |
| 10 | clicks | bigint | NO | 0 |
| 11 | spend | numeric | NO | 0 |
| 12 | conversions | bigint | NO | 0 |
| 13 | revenue | numeric | NO | 0 |
| 14 | created_at | timestamp with time zone | NO | now() |

**Analysis:**
- **Primary Key:** `id`
- **Correlation Fields:** workspace_id, client_id, platform, metric_date, created_at
- **Linking Fields:** campaign_id, ad_set_id, ad_id (ALL NULLABLE)
- **Nullable FK-like:** campaign_id, ad_set_id, ad_id — allows orphan/aggregate metrics
- **Natural Key Candidate:** (workspace_id, client_id, platform, metric_date, campaign_id, ad_set_id, ad_id)
- **Metric Columns:** impressions, clicks, spend, conversions, revenue

**Orphan Tolerance:** All entity FKs are nullable. Metrics can exist at workspace/client level without referencing specific campaign/ad_set/ad.

---

### 2.5 demographic_metrics

| Ordinal | Column | Data Type | Nullable | Default |
|---------|--------|-----------|----------|---------|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | workspace_id | uuid | NO | null |
| 3 | client_id | uuid | NO | null |
| 4 | platform | text | NO | null |
| 5 | metric_date | date | NO | null |

**Analysis:**
- **Primary Key:** `id`
- **Correlation Fields:** workspace_id, client_id, platform, metric_date
- **Linking Fields:** UNKNOWN (not in provided data)
- **Metric Columns:** UNKNOWN (not in provided data)
- **Demographic Dimensions:** UNKNOWN (not in provided data)

**⚠️ INCOMPLETE DATA:** Only 5 columns visible. Expected additional columns for:
- campaign_id, ad_set_id, ad_id (entity linking)
- age_range, gender, country, region (demographic dimensions)
- impressions, clicks, spend, conversions, revenue (metrics)
- created_at (audit)

---

### 2.6 alert_rules

| Ordinal | Column | Data Type | Nullable | Default |
|---------|--------|-----------|----------|---------|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | workspace_id | uuid | NO | null |
| 3 | client_id | uuid | NO | null |
| 4 | name | text | NO | null |
| 5 | description | text | YES | null |
| 6 | platform | text | YES | null |
| 7 | metric_key | text | NO | null |
| 8 | operator | text | NO | null |
| 9 | threshold | numeric | NO | null |
| 10 | window_days | integer | NO | 1 |
| 11 | is_enabled | boolean | NO | TRUE |
| 12 | campaign_id | uuid | YES | null |
| 13 | ad_set_id | uuid | YES | null |
| 14 | ad_id | uuid | YES | null |
| 15 | created_by | uuid | YES | null |
| 16 | created_at | timestamp with time zone | NO | now() |
| 17 | updated_at | timestamp with time zone | NO | now() |

**Analysis:**
- **Primary Key:** `id`
- **Correlation Fields:** workspace_id, client_id, platform, created_at, updated_at
- **Linking Fields:** campaign_id, ad_set_id, ad_id (ALL NULLABLE — rule can target any level)
- **Rule Definition:** metric_key, operator, threshold, window_days
- **Control:** is_enabled, created_by

**Scope Interpretation:**
- All entity FKs NULL → workspace-wide rule
- campaign_id set, others NULL → campaign-level rule
- ad_id set → ad-level rule

---

### 2.7 alerts

| Ordinal | Column | Data Type | Nullable | Default |
|---------|--------|-----------|----------|---------|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | workspace_id | uuid | NO | null |
| 3 | client_id | uuid | NO | null |
| 4 | rule_id | uuid | YES | null |
| 5 | platform | text | YES | null |
| 6 | metric_key | text | YES | null |
| 7 | metric_value | numeric | YES | null |
| 8 | threshold | numeric | YES | null |
| 9 | operator | text | YES | null |
| 10 | metric_date | date | YES | null |
| 11 | campaign_id | uuid | YES | null |
| 12 | ad_set_id | uuid | YES | null |
| 13 | ad_id | uuid | YES | null |
| 14 | severity | text | NO | 'warning'::text |
| 15 | message | text | YES | null |
| 16 | is_read | boolean | NO | FALSE |
| 17 | read_at | timestamp with time zone | YES | null |
| 18 | created_at | timestamp with time zone | NO | now() |

**Analysis:**
- **Primary Key:** `id`
- **Correlation Fields:** workspace_id, client_id, platform, metric_date, created_at
- **Linking Fields:** rule_id, campaign_id, ad_set_id, ad_id (ALL NULLABLE)
- **Evaluation Snapshot:** metric_key, metric_value, threshold, operator
- **Status:** severity, message, is_read, read_at

**Note:** Missing `resolved_at` and `note` columns that were expected from D1 phase. These may have been added via migration 20241228_phase_d1.sql but are not visible in this export.

**⚠️ POSSIBLY INCOMPLETE:** Expected columns from D1:
- resolved_at (timestamp with time zone, nullable)
- note (text, nullable)
- updated_at (timestamp with time zone)

---

### 2.8 reports

| Ordinal | Column | Data Type | Nullable | Default |
|---------|--------|-----------|----------|---------|
| **UNKNOWN** | — | — | — | — |

**⚠️ MISSING FROM PROVIDED DATA:** The `reports` table was not included in the pasted Result Grid output.

**Expected columns (from previous D4 documentation):**
- id, workspace_id, client_id, name, report_type, date_from, date_to, platforms, status, file_url, generated_at, error_message, created_by, created_at, updated_at

---

### 2.9 data_uploads

| Ordinal | Column | Data Type | Nullable | Default |
|---------|--------|-----------|----------|---------|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | workspace_id | uuid | NO | null |
| 3 | client_id | uuid | YES | null |
| 4 | platform | text | NO | null |
| 5 | source | text | NO | 'manual'::text |
| 6 | filename | text | YES | null |
| 7 | file_url | text | YES | null |
| 8 | status | text | NO | 'pending'::text |
| 9 | row_count | integer | NO | 0 |
| 10 | error_text | text | YES | null |
| 11 | created_by | uuid | YES | null |
| 12 | created_at | timestamp with time zone | NO | now() |

**Analysis:**
- **Primary Key:** `id`
- **Correlation Fields:** workspace_id, client_id, platform, created_at
- **Upload Tracking:** source, filename, file_url, status, row_count, error_text, created_by
- **Notable:** client_id is NULLABLE (unlike most tables)

**Status Values (expected):** 'pending', 'processing', 'completed', 'failed', 'partial'

---

## 3. Ingestion Pipeline (Design)

### 3.1 Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        INGESTION PIPELINE                                    │
│                                                                             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌──────────┐  │
│  │ STAGE A │───▶│ STAGE B │───▶│ STAGE C │───▶│ STAGE D │───▶│ STAGE E  │  │
│  │ INTAKE  │    │ PARSE & │    │DIMENSION│    │  FACT   │    │  POST    │  │
│  │         │    │NORMALIZE│    │ UPSERT  │    │ UPSERT  │    │ VALIDATE │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘    └──────────┘  │
│       │              │              │              │              │         │
│       ▼              ▼              ▼              ▼              ▼         │
│  data_uploads   Normalized    campaigns      daily_metrics   Integrity     │
│  (pending)      records       ad_sets        demographic_    verified      │
│                               ads            metrics                       │
│                                                                             │
│                                              ┌─────────┐                   │
│                                              │ STAGE F │                   │
│                                              │ ALERT   │                   │
│                                              │BOUNDARY │                   │
│                                              └─────────┘                   │
│                                                   │                        │
│                                                   ▼                        │
│                                           IngestionComplete                │
│                                              Event                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Stage A — Intake

| Aspect | Specification |
|--------|---------------|
| **Input** | CSV file, API response, or webhook payload |
| **Output** | data_uploads record with status='pending' |
| **Required Fields** | workspace_id, platform, source |
| **Optional Fields** | client_id, filename, file_url, created_by |
| **Validation** | File exists, format recognizable, size limits |
| **Failure Mode** | status='failed', error_text populated |

### 3.3 Stage B — Parse & Normalize

| Aspect | Specification |
|--------|---------------|
| **Input** | Raw file/payload content |
| **Output** | Normalized dimension and fact records |
| **Column Mapping** | Platform-specific → internal schema |
| **Date Normalization** | All dates → ISO 8601 (YYYY-MM-DD) |
| **Currency Normalization** | Meta: ÷100, Google: ÷1M, TikTok: as-is |
| **ID Preservation** | external_id stored exactly as received |
| **Failure Mode** | Per-row errors collected, continue processing |

### 3.4 Stage C — Dimension Upsert

**Strict Order (Enforced):**

```
1. campaigns    (no dependencies)
       ↓
2. ad_sets      (requires campaign_id)
       ↓
3. ads          (requires campaign_id + ad_set_id)
```

| Table | Required for Upsert | FK Resolution |
|-------|---------------------|---------------|
| campaigns | workspace_id, client_id, platform, external_id, name | None |
| ad_sets | workspace_id, client_id, platform, external_id, name, campaign_id | Lookup campaigns by external_id |
| ads | workspace_id, client_id, platform, external_id, name, campaign_id, ad_set_id | Lookup campaigns + ad_sets |

**FK Resolution Strategy:**
1. For ad_sets: lookup campaign by (workspace_id, client_id, platform, campaign_external_id)
2. For ads: lookup campaign + ad_set by their external_ids
3. Cache resolved IDs for the batch

### 3.5 Stage D — Fact Upsert

| Table | Required Fields | Optional FK Fields |
|-------|-----------------|-------------------|
| daily_metrics | workspace_id, client_id, platform, metric_date, impressions, clicks, spend, conversions, revenue | campaign_id, ad_set_id, ad_id |
| demographic_metrics | workspace_id, client_id, platform, metric_date + UNKNOWN additional fields | UNKNOWN |

**FK Handling:**
- All entity FKs (campaign_id, ad_set_id, ad_id) are NULLABLE in daily_metrics
- If entity not found: set FK to NULL, log REFERENCE_ORPHANED warning
- Metrics without entity refs are valid (workspace/client aggregates)

### 3.6 Stage E — Post-Validation

| Check | Pass Criteria | Failure Severity |
|-------|---------------|------------------|
| Row count match | Processed ≈ input (within tolerance) | WARN |
| Workspace integrity | All records have workspace_id | ERROR |
| Client integrity | All records have client_id | ERROR |
| Date validity | metric_date ≤ today | ERROR |
| Orphan count | < 10% orphan references | WARN |

### 3.7 Stage F — Alert Boundary

| Action | Description |
|--------|-------------|
| Emit IngestionCompleteEvent | Signal for D6.6 alert evaluation |
| Update data_uploads.status | 'completed' or 'partial' |
| Update data_uploads.row_count | Actual processed count |

**Critical:** This stage does NOT evaluate alerts. It only signals completion.

---

## 4. Natural Keys & Idempotency Contract

### 4.1 Dimension Natural Keys (Verified Columns)

| Table | Natural Key | Columns Used |
|-------|-------------|--------------|
| campaigns | workspace + client + platform + external_id | workspace_id, client_id, platform, external_id |
| ad_sets | workspace + client + platform + external_id | workspace_id, client_id, platform, external_id |
| ads | workspace + client + platform + external_id | workspace_id, client_id, platform, external_id |

### 4.2 Fact Natural Keys (Verified Columns)

| Table | Natural Key | Columns Used |
|-------|-------------|--------------|
| daily_metrics | workspace + client + platform + date + entities | workspace_id, client_id, platform, metric_date, campaign_id, ad_set_id, ad_id |
| demographic_metrics | PARTIAL: workspace + client + platform + date | workspace_id, client_id, platform, metric_date + UNKNOWN demographic dimensions |

### 4.3 Upsert Semantics

```
Dimension Upsert Contract:
──────────────────────────
ON CONFLICT (natural_key):
  - UPDATE: name, status, objective, dates, budgets
  - PRESERVE: id, workspace_id, client_id, platform, external_id, created_at

Fact Upsert Contract:
─────────────────────
ON CONFLICT (natural_key):
  - REPLACE: impressions, clicks, spend, conversions, revenue
  - PRESERVE: id, workspace_id, client_id, platform, metric_date, created_at
```

### 4.4 Replay Safety Guarantees

| Guarantee | Mechanism |
|-----------|-----------|
| No duplicates | Natural key uniqueness constraint |
| Safe re-upload | Same key → update, not insert |
| Late data correction | Re-upload overwrites old values |
| Partial re-upload | Only affected rows updated |

---

## 5. Failure / Error Taxonomy Mapping (D5.1-Compatible)

### 5.1 Error Classification

| Ingestion Failure | D5.1 Code | Severity | Action |
|-------------------|-----------|----------|--------|
| File not found | DATA_ABSENT_UNEXPECTED | ERROR | ABORT |
| Empty file (valid but no data) | DATA_ABSENT_EXPECTED | INFO | COMPLETE (0 rows) |
| Parse error (malformed CSV/JSON) | QUERY_FAILURE | ERROR | ABORT |
| Missing required column | SCHEMA_CONTRACT_VIOLATION | ERROR | ABORT |
| Type mismatch (string in numeric) | QUERY_FAILURE | ERROR | SKIP row |
| FK entity not found | REFERENCE_ORPHANED | WARN | Set NULL, continue |
| Unique constraint violation | QUERY_FAILURE | ERROR | SKIP row (or update) |
| RLS permission denied | RLS_DENIED | ERROR | ABORT |
| Database connection timeout | QUERY_FAILURE | ERROR | RETRY then ABORT |
| Unknown exception | UNKNOWN_RUNTIME_ERROR | ERROR | ABORT |

### 5.2 Action Definitions

| Action | Behavior |
|--------|----------|
| ABORT | Stop entire ingestion, mark data_uploads.status='failed' |
| SKIP | Skip affected row, continue with others |
| WARN | Log warning, continue processing |
| RETRY | Attempt operation again (with backoff) |
| COMPLETE | Finish successfully (even if 0 rows) |

---

## 6. Validation Rules (Based on Verified Columns)

### 6.1 Dimension Validation

| Table | Field | Rule | Severity |
|-------|-------|------|----------|
| campaigns | workspace_id | NOT NULL | ERROR |
| campaigns | client_id | NOT NULL | ERROR |
| campaigns | platform | IN ('meta', 'google', 'tiktok') | ERROR |
| campaigns | external_id | NOT NULL, NOT EMPTY | ERROR |
| campaigns | name | NOT NULL, NOT EMPTY | ERROR |
| campaigns | status | Default 'active' if missing | INFO |
| campaigns | start_date | ≤ end_date if both present | WARN |
| ad_sets | campaign_id | Must resolve to existing campaign | ERROR |
| ads | campaign_id | Must resolve | ERROR |
| ads | ad_set_id | Must resolve | ERROR |

### 6.2 Fact Validation (daily_metrics)

| Field | Rule | Severity |
|-------|------|----------|
| workspace_id | NOT NULL | ERROR |
| client_id | NOT NULL | ERROR |
| platform | NOT NULL | ERROR |
| metric_date | NOT NULL, ≤ today, ≥ 2020-01-01 | ERROR |
| impressions | ≥ 0 | ERROR |
| clicks | ≥ 0, ≤ impressions | WARN (clicks > impressions is unusual but possible) |
| spend | ≥ 0 | ERROR |
| conversions | ≥ 0 | ERROR |
| revenue | ≥ 0 | ERROR |
| campaign_id | If provided, must exist OR set NULL | WARN |
| ad_set_id | If provided, must exist OR set NULL | WARN |
| ad_id | If provided, must exist OR set NULL | WARN |

### 6.3 Orphan Handling Policy

| Scenario | Behavior |
|----------|----------|
| Metric with unknown campaign_id | Set campaign_id = NULL, log REFERENCE_ORPHANED |
| Metric with unknown ad_set_id | Set ad_set_id = NULL, log REFERENCE_ORPHANED |
| Metric with unknown ad_id | Set ad_id = NULL, log REFERENCE_ORPHANED |
| All entity refs unknown | Accept as workspace/client aggregate |
| Orphan rate > 10% | Log warning, continue (may indicate data issue) |

---

## 7. Observability (Design)

### 7.1 Required Log Events

| Stage | Event | Level | Required Fields |
|-------|-------|-------|-----------------|
| Intake | ingestion.started | INFO | upload_id, workspace_id, client_id, platform, source |
| Intake | ingestion.file_acquired | DEBUG | upload_id, file_size, content_type |
| Parse | parse.started | DEBUG | upload_id |
| Parse | parse.row_error | WARN | upload_id, row_number, field, reason |
| Parse | parse.completed | INFO | upload_id, rows_valid, rows_invalid |
| Dimension | dimension.upsert_started | DEBUG | upload_id, entity_type |
| Dimension | dimension.upsert_completed | INFO | upload_id, entity_type, inserted, updated |
| Fact | fact.upsert_started | DEBUG | upload_id, fact_type |
| Fact | fact.upsert_completed | INFO | upload_id, fact_type, inserted, updated |
| Validate | validation.completed | INFO | upload_id, passed, warnings |
| Complete | ingestion.completed | INFO | upload_id, status, total_rows, duration_ms |
| Error | ingestion.failed | ERROR | upload_id, stage, error_code, error_message |

### 7.2 Correlation ID Chain

```
Correlation Chain (using verified columns):
───────────────────────────────────────────

data_uploads.id (upload_id) ← Primary correlation key
    │
    ├── workspace_id (from data_uploads)
    ├── client_id (from data_uploads, nullable)
    ├── platform (from data_uploads)
    │
    ├── [campaigns upserted]
    │       └── campaigns.id
    │
    ├── [ad_sets upserted]
    │       └── ad_sets.id
    │
    ├── [ads upserted]
    │       └── ads.id
    │
    └── [metrics upserted]
            └── daily_metrics.id / demographic_metrics.id
```

**Note:** No `batch_id` column exists in data_uploads. Use `upload_id` as the primary batch correlation.

### 7.3 Must-Not-Log List

| Data Type | Reason |
|-----------|--------|
| File contents | Size, privacy |
| Raw metric values | Business sensitive |
| User credentials | Security |
| API tokens | Security |
| PII in names | Privacy |
| Full error stack traces | Security (in production logs) |

---

## 8. Missing Visibility / Open Questions

### 8.1 Incomplete Table Data

| Table | Issue | Missing Information |
|-------|-------|---------------------|
| demographic_metrics | Only 5 columns visible | Expected: campaign_id, ad_set_id, ad_id, age_range, gender, country, region, impressions, clicks, spend, conversions, revenue, created_at |
| reports | Not in provided data | Full schema unknown |
| alerts | Possibly incomplete | Expected resolved_at, note, updated_at from D1 migration |

### 8.2 Schema Requirements Not Yet Verified

| Requirement | Status | Impact |
|-------------|--------|--------|
| Unique constraint on natural keys | UNKNOWN | Upsert semantics depend on this |
| Indexes on foreign keys | UNKNOWN | Query performance |
| RLS policies on all tables | UNKNOWN | Security |

### 8.3 Action Items

1. **Re-run schema query** including reports table
2. **Verify demographic_metrics** full column list (query may have been truncated)
3. **Verify alerts** includes D1 columns (resolved_at, note, updated_at)
4. **Confirm unique constraints** exist for proposed natural keys

---

## 9. Document Control

| Version | Date | Change |
|---------|------|--------|
| D6.4 | 2024-12-28 | Initial design based on Supabase export |
| D6.4-REVISED | 2024-12-28 | Rebuilt from actual information_schema.columns export |

---

## 10. Approval

This document is grounded on the actual Supabase schema export provided 2024-12-28. Implementation requires:
1. Resolution of missing schema information (Section 8)
2. Verification of unique constraints
3. Separate implementation approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Data Architect | | | |
| Schema Owner | | | |
