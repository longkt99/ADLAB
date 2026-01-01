# D6.5.2 — Staging Schema Delta + Migration Plan

**Version:** D6.5.2
**Date:** 2024-12-28
**Status:** API-READY MIGRATION PLAN
**Classification:** CONTROLLED SCHEMA DELTA
**Dependencies:**
- D6.5.1 Staging & Dry-Run Execution Design (FROZEN)
- D4 Schema Contract (FROZEN — core tables unchanged)

---

## 1. Schema Delta Summary

### 1.1 Classification

**CONTROLLED SCHEMA DELTA: NEW TABLES ONLY**

This migration introduces NEW staging tables to support the D6.5.1 design. It does NOT modify any D4-frozen core tables.

### 1.2 Tables Being Added

| Table Name | Purpose | Classification |
|------------|---------|----------------|
| `staging_rows` | Temporary holding area for ingestion data before production commit | NEW |
| `staging_id_resolution` | Track external_id → internal_id mappings during ingestion sessions | NEW |

### 1.3 Tables NOT Modified

| Table Name | Status | Confirmation |
|------------|--------|--------------|
| workspaces | UNCHANGED | D4 frozen |
| clients | UNCHANGED | D4 frozen |
| campaigns | UNCHANGED | D4 frozen |
| ad_sets | UNCHANGED | D4 frozen |
| ads | UNCHANGED | D4 frozen |
| daily_metrics | UNCHANGED | D4 frozen |
| demographic_metrics | UNCHANGED | D4 frozen |
| alerts | UNCHANGED | D4 frozen |
| alert_rules | UNCHANGED | D4 frozen |
| reports | UNCHANGED | D4 frozen |
| data_uploads | UNCHANGED | D4 frozen |

### 1.4 Migration File

**Filename:** `supabase/migrations/008_staging_tables.sql`

**Execution Order:** After all existing migrations (007_adlab_full_schema.sql)

---

## 2. Table Definitions (DDL)

### 2.1 staging_rows Table

```sql
-- =============================================================================
-- STAGING_ROWS TABLE
-- Purpose: Temporary holding area for parsed and normalized ingestion data
-- Classification: NEW TABLE (D6.5.2 schema delta)
-- =============================================================================

-- Enum for row types
CREATE TYPE staging_row_type AS ENUM (
  'campaign',
  'ad_set',
  'ad',
  'daily_metric',
  'demographic_metric'
);

-- Enum for validation status
CREATE TYPE staging_validation_status AS ENUM (
  'pending',
  'valid',
  'invalid',
  'skipped'
);

-- Enum for processing action
CREATE TYPE staging_processing_action AS ENUM (
  'pending',
  'insert',
  'update',
  'skipped',
  'failed'
);

-- Main staging table
CREATE TABLE IF NOT EXISTS staging_rows (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Correlation fields (required)
  workspace_id UUID NOT NULL,
  client_id UUID NOT NULL,
  upload_id UUID NOT NULL,
  batch_id UUID,                          -- Optional: for grouping related rows
  request_id UUID,                        -- Optional: for API request correlation

  -- Entity identification
  platform TEXT NOT NULL CHECK (platform IN ('meta', 'google', 'tiktok')),
  row_type staging_row_type NOT NULL,
  row_number INTEGER NOT NULL,            -- Position in source file/batch
  entity_external_id TEXT,                -- Platform external ID (for dimensions)

  -- Data payloads
  raw_payload JSONB NOT NULL,             -- Original parsed data (before normalization)
  normalized_payload JSONB,               -- After normalization (ready for upsert)

  -- Validation state
  validation_status staging_validation_status NOT NULL DEFAULT 'pending',
  validation_errors JSONB DEFAULT '[]'::jsonb,   -- Array of error objects
  validation_warnings JSONB DEFAULT '[]'::jsonb, -- Array of warning objects

  -- Processing state
  processing_action staging_processing_action NOT NULL DEFAULT 'pending',
  processed_at TIMESTAMPTZ,               -- When promoted to production
  target_internal_id UUID,                -- Resolved production UUID after promotion

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Foreign keys (soft references - no hard FK to avoid circular deps)
  -- workspace_id references workspaces(id)
  -- client_id references clients(id)
  -- upload_id references data_uploads(id)

  -- Constraints
  CONSTRAINT staging_rows_row_number_positive CHECK (row_number >= 0),
  CONSTRAINT staging_rows_platform_valid CHECK (platform IN ('meta', 'google', 'tiktok'))
);

-- Unique constraint: one row per (upload, row_number, row_type)
-- This prevents duplicate staging of the same source row
CREATE UNIQUE INDEX IF NOT EXISTS staging_rows_upload_row_unique
  ON staging_rows(upload_id, row_number, row_type);

-- Comment
COMMENT ON TABLE staging_rows IS 'Temporary staging area for ingestion data. Rows are validated here before promotion to production tables. Part of D6.5.2 controlled schema delta.';
```

### 2.2 staging_id_resolution Table

```sql
-- =============================================================================
-- STAGING_ID_RESOLUTION TABLE
-- Purpose: Track external_id to internal_id mappings during ingestion sessions
-- Classification: NEW TABLE (D6.5.2 schema delta)
-- =============================================================================

-- Enum for entity types (dimensions only)
CREATE TYPE staging_entity_type AS ENUM (
  'campaign',
  'ad_set',
  'ad'
);

-- Enum for resolution status
CREATE TYPE staging_resolution_status AS ENUM (
  'pending',
  'resolved_existing',  -- Found existing production record
  'resolved_new',       -- Will create new production record
  'unresolved'          -- Could not resolve (error state)
);

-- ID resolution table
CREATE TABLE IF NOT EXISTS staging_id_resolution (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Correlation fields (required)
  workspace_id UUID NOT NULL,
  client_id UUID NOT NULL,
  upload_id UUID NOT NULL,
  batch_id UUID,                          -- Optional: for grouping

  -- Entity identification
  platform TEXT NOT NULL CHECK (platform IN ('meta', 'google', 'tiktok')),
  entity_type staging_entity_type NOT NULL,
  external_id TEXT NOT NULL,              -- Platform external ID

  -- Resolution state
  internal_id UUID,                       -- Resolved production UUID (NULL if pending/unresolved)
  resolution_status staging_resolution_status NOT NULL DEFAULT 'pending',
  resolution_action staging_processing_action, -- INSERT or UPDATE when resolved

  -- Parent resolution (for hierarchy)
  parent_external_id TEXT,                -- campaign_external_id for ad_set, ad_set_external_id for ad
  parent_internal_id UUID,                -- Resolved parent ID

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,                -- When resolution completed
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT staging_id_resolution_platform_valid CHECK (platform IN ('meta', 'google', 'tiktok'))
);

-- Unique constraint: one resolution per (upload, entity_type, platform, external_id)
-- This ensures idempotent resolution within an ingestion session
CREATE UNIQUE INDEX IF NOT EXISTS staging_id_resolution_unique
  ON staging_id_resolution(upload_id, entity_type, platform, external_id);

-- Comment
COMMENT ON TABLE staging_id_resolution IS 'Tracks external_id to internal_id mappings during ingestion. Enables FK resolution for ad_sets (need campaign_id) and ads (need ad_set_id). Part of D6.5.2 controlled schema delta.';
```

### 2.3 Updated Timestamp Trigger

```sql
-- =============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- Reuse existing or create if not exists
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for staging tables
CREATE TRIGGER staging_rows_updated_at
  BEFORE UPDATE ON staging_rows
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER staging_id_resolution_updated_at
  BEFORE UPDATE ON staging_id_resolution
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## 3. Indexing & Performance

### 3.1 staging_rows Indexes

```sql
-- =============================================================================
-- STAGING_ROWS INDEXES
-- Optimized for write-heavy ingestion, cleanup scans, and promotion reads
-- =============================================================================

-- Primary access path: by upload_id (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_staging_rows_upload_id
  ON staging_rows(upload_id);

-- Workspace isolation (for RLS and admin queries)
CREATE INDEX IF NOT EXISTS idx_staging_rows_workspace_id
  ON staging_rows(workspace_id);

-- Client isolation (for per-client queries)
CREATE INDEX IF NOT EXISTS idx_staging_rows_client_id
  ON staging_rows(client_id);

-- Validation status filtering (for promotion decision)
CREATE INDEX IF NOT EXISTS idx_staging_rows_validation_status
  ON staging_rows(validation_status);

-- Row type filtering (for entity-specific processing)
CREATE INDEX IF NOT EXISTS idx_staging_rows_row_type
  ON staging_rows(row_type);

-- Platform filtering
CREATE INDEX IF NOT EXISTS idx_staging_rows_platform
  ON staging_rows(platform);

-- Created_at for cleanup scans (TTL-based deletion)
CREATE INDEX IF NOT EXISTS idx_staging_rows_created_at
  ON staging_rows(created_at);

-- Processed_at for cleanup scans (promoted rows cleanup)
CREATE INDEX IF NOT EXISTS idx_staging_rows_processed_at
  ON staging_rows(processed_at)
  WHERE processed_at IS NOT NULL;

-- Composite index for promotion query (valid rows for a specific upload)
CREATE INDEX IF NOT EXISTS idx_staging_rows_promotion
  ON staging_rows(upload_id, validation_status, row_type)
  WHERE validation_status = 'valid';

-- Partial index for failed/invalid rows (debugging and extended retention)
CREATE INDEX IF NOT EXISTS idx_staging_rows_invalid
  ON staging_rows(upload_id, created_at)
  WHERE validation_status = 'invalid';

-- Batch correlation (optional but useful for grouped operations)
CREATE INDEX IF NOT EXISTS idx_staging_rows_batch_id
  ON staging_rows(batch_id)
  WHERE batch_id IS NOT NULL;
```

### 3.2 staging_id_resolution Indexes

```sql
-- =============================================================================
-- STAGING_ID_RESOLUTION INDEXES
-- Optimized for ID lookups during promotion and hierarchy resolution
-- =============================================================================

-- Primary access path: by upload_id
CREATE INDEX IF NOT EXISTS idx_staging_id_resolution_upload_id
  ON staging_id_resolution(upload_id);

-- External ID lookup (for resolving references)
CREATE INDEX IF NOT EXISTS idx_staging_id_resolution_external_id
  ON staging_id_resolution(external_id);

-- Entity type filtering (for ordered processing: campaigns → ad_sets → ads)
CREATE INDEX IF NOT EXISTS idx_staging_id_resolution_entity_type
  ON staging_id_resolution(entity_type);

-- Workspace/client isolation
CREATE INDEX IF NOT EXISTS idx_staging_id_resolution_workspace_id
  ON staging_id_resolution(workspace_id);

CREATE INDEX IF NOT EXISTS idx_staging_id_resolution_client_id
  ON staging_id_resolution(client_id);

-- Resolution status (for finding unresolved entries)
CREATE INDEX IF NOT EXISTS idx_staging_id_resolution_status
  ON staging_id_resolution(resolution_status);

-- Created_at for cleanup
CREATE INDEX IF NOT EXISTS idx_staging_id_resolution_created_at
  ON staging_id_resolution(created_at);

-- Composite index for FK resolution query
-- "Find internal_id for this external_id in this upload"
CREATE INDEX IF NOT EXISTS idx_staging_id_resolution_lookup
  ON staging_id_resolution(upload_id, platform, entity_type, external_id);

-- Partial index for unresolved entries (error handling)
CREATE INDEX IF NOT EXISTS idx_staging_id_resolution_unresolved
  ON staging_id_resolution(upload_id, entity_type)
  WHERE resolution_status = 'unresolved';
```

### 3.3 Expected Query Patterns

| Query Pattern | Table | Access Path | Index Used |
|---------------|-------|-------------|------------|
| Write staging rows for upload | staging_rows | INSERT | (clustered) |
| Get all rows for upload | staging_rows | upload_id | idx_staging_rows_upload_id |
| Get valid rows for promotion | staging_rows | upload_id + status | idx_staging_rows_promotion |
| Get invalid rows for debugging | staging_rows | upload_id + status | idx_staging_rows_invalid |
| Cleanup promoted rows | staging_rows | processed_at < cutoff | idx_staging_rows_processed_at |
| Cleanup old invalid rows | staging_rows | created_at < cutoff + status | idx_staging_rows_invalid |
| Resolve external_id | staging_id_resolution | upload_id + platform + entity_type + external_id | idx_staging_id_resolution_lookup |
| Get all resolutions for upload | staging_id_resolution | upload_id | idx_staging_id_resolution_upload_id |
| Find unresolved entries | staging_id_resolution | upload_id + status | idx_staging_id_resolution_unresolved |

### 3.4 Performance Expectations

| Operation | Expected Volume | Expected Latency |
|-----------|-----------------|------------------|
| Insert staging row | 1-100k rows/upload | < 100ms per batch of 1000 |
| Validate staging rows | 1-100k rows | < 10s total |
| Promote to production | 1-100k rows | < 30s total |
| Cleanup scan | Up to 1M rows/day | < 60s per batch |
| ID resolution lookup | 1-50k lookups/upload | < 1ms per lookup (indexed) |

---

## 4. RLS & Security Model

### 4.1 RLS Policies for staging_rows

```sql
-- =============================================================================
-- ROW LEVEL SECURITY: staging_rows
-- =============================================================================

-- Enable RLS
ALTER TABLE staging_rows ENABLE ROW LEVEL SECURITY;

-- Policy: Service role has full access (for backend ingestion workers)
CREATE POLICY staging_rows_service_full_access
  ON staging_rows
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can view their workspace's staging data (read-only)
-- This allows admins to debug staging issues via Supabase dashboard
CREATE POLICY staging_rows_workspace_read
  ON staging_rows
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Policy: No direct insert/update/delete by authenticated users
-- All staging writes must go through service role (backend)
-- Note: The SELECT policy above is the only authenticated access

-- Policy: Anon role has no access
-- (No policy = denied by default with RLS enabled)
```

### 4.2 RLS Policies for staging_id_resolution

```sql
-- =============================================================================
-- ROW LEVEL SECURITY: staging_id_resolution
-- =============================================================================

-- Enable RLS
ALTER TABLE staging_id_resolution ENABLE ROW LEVEL SECURITY;

-- Policy: Service role has full access
CREATE POLICY staging_id_resolution_service_full_access
  ON staging_id_resolution
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can view their workspace's resolution data (read-only)
CREATE POLICY staging_id_resolution_workspace_read
  ON staging_id_resolution
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- No insert/update/delete for authenticated users
```

### 4.3 Role Access Summary

| Role | staging_rows | staging_id_resolution |
|------|--------------|----------------------|
| anon | NO ACCESS | NO ACCESS |
| authenticated | SELECT (workspace-scoped) | SELECT (workspace-scoped) |
| service_role | FULL ACCESS | FULL ACCESS |

### 4.4 Security Constraints

| Constraint | Enforcement |
|------------|-------------|
| End users cannot write to staging | RLS: no INSERT/UPDATE/DELETE policies for authenticated |
| End users cannot see other workspaces | RLS: workspace_id filter via workspace_members |
| Only backend can trigger ingestion | service_role required for writes |
| Staging data isolated by workspace | workspace_id column + RLS |
| Staging data isolated by client | client_id column (queryable) |

---

## 5. Retention & Cleanup Plan

### 5.1 Retention Buckets

| Bucket | Condition | Retention | Rationale |
|--------|-----------|-----------|-----------|
| Promoted | processed_at IS NOT NULL | 7 days | Audit trail for successful ingestion |
| Invalid | validation_status = 'invalid' | 30 days | Extended debugging window |
| Orphan | validation_status IN ('pending', 'valid') AND processed_at IS NULL AND age > 1 day | 1 day | Abandoned ingestion cleanup |

### 5.2 Cleanup Strategy

**Mechanism:** Scheduled job (pg_cron or Supabase scheduled function)

**Frequency:** Hourly

**Design Specification:**

```sql
-- =============================================================================
-- CLEANUP FUNCTION (Design Specification)
-- Implementation: pg_cron job or Supabase Edge Function
-- =============================================================================

-- Function to clean up staging_rows
CREATE OR REPLACE FUNCTION cleanup_staging_rows()
RETURNS TABLE(
  promoted_deleted INTEGER,
  invalid_deleted INTEGER,
  orphan_deleted INTEGER
) AS $$
DECLARE
  v_promoted_deleted INTEGER := 0;
  v_invalid_deleted INTEGER := 0;
  v_orphan_deleted INTEGER := 0;
  v_cutoff_promoted TIMESTAMPTZ;
  v_cutoff_invalid TIMESTAMPTZ;
  v_cutoff_orphan TIMESTAMPTZ;
  v_batch_size INTEGER := 10000;
  v_min_age_hours INTEGER := 24;
BEGIN
  -- Calculate cutoffs
  v_cutoff_promoted := now() - INTERVAL '7 days';
  v_cutoff_invalid := now() - INTERVAL '30 days';
  v_cutoff_orphan := now() - INTERVAL '1 day';

  -- Safety: never delete rows younger than min_age_hours
  -- This prevents race conditions with active ingestion

  -- 1. Delete old promoted rows
  WITH deleted AS (
    DELETE FROM staging_rows
    WHERE processed_at IS NOT NULL
      AND processed_at < v_cutoff_promoted
      AND created_at < now() - (v_min_age_hours || ' hours')::INTERVAL
    LIMIT v_batch_size
    RETURNING id
  )
  SELECT COUNT(*) INTO v_promoted_deleted FROM deleted;

  -- 2. Delete old invalid rows
  WITH deleted AS (
    DELETE FROM staging_rows
    WHERE validation_status = 'invalid'
      AND created_at < v_cutoff_invalid
    LIMIT v_batch_size
    RETURNING id
  )
  SELECT COUNT(*) INTO v_invalid_deleted FROM deleted;

  -- 3. Delete orphan rows (never processed, not invalid)
  WITH deleted AS (
    DELETE FROM staging_rows
    WHERE processed_at IS NULL
      AND validation_status IN ('pending', 'valid')
      AND created_at < v_cutoff_orphan
    LIMIT v_batch_size
    RETURNING id
  )
  SELECT COUNT(*) INTO v_orphan_deleted FROM deleted;

  RETURN QUERY SELECT v_promoted_deleted, v_invalid_deleted, v_orphan_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up staging_id_resolution
CREATE OR REPLACE FUNCTION cleanup_staging_id_resolution()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER := 0;
  v_cutoff TIMESTAMPTZ;
  v_batch_size INTEGER := 10000;
BEGIN
  v_cutoff := now() - INTERVAL '7 days';

  WITH deleted AS (
    DELETE FROM staging_id_resolution
    WHERE created_at < v_cutoff
    LIMIT v_batch_size
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted FROM deleted;

  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service_role only
REVOKE ALL ON FUNCTION cleanup_staging_rows() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_staging_rows() TO service_role;

REVOKE ALL ON FUNCTION cleanup_staging_id_resolution() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_staging_id_resolution() TO service_role;
```

### 5.3 pg_cron Schedule (Design)

```sql
-- =============================================================================
-- SCHEDULED CLEANUP JOBS (pg_cron)
-- Note: pg_cron must be enabled in Supabase dashboard
-- =============================================================================

-- Run cleanup every hour at minute 30
-- SELECT cron.schedule('cleanup-staging-rows', '30 * * * *', 'SELECT cleanup_staging_rows()');
-- SELECT cron.schedule('cleanup-staging-id-resolution', '35 * * * *', 'SELECT cleanup_staging_id_resolution()');

-- Alternative: Supabase Edge Function with cron trigger
-- See implementation guide in D6.5.1
```

### 5.4 Safety Minimums & Batch Limits

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| min_age_before_cleanup_hours | 24 | Prevent deleting active ingestion data |
| batch_size | 10,000 | Limit lock contention, allow progress |
| max_execution_time | 60 seconds | Prevent long-running cleanup blocking |
| retry_on_failure | Yes (next hour) | Cleanup is eventually consistent |

---

## 6. Promotion Boundary Contract

### 6.1 Selection Criteria for Promotion

```sql
-- =============================================================================
-- PROMOTION SELECTION QUERY
-- Selects rows ready for promotion to production
-- =============================================================================

-- Get valid dimension rows (in dependency order)
WITH promotion_candidates AS (
  SELECT
    sr.id,
    sr.upload_id,
    sr.row_type,
    sr.row_number,
    sr.normalized_payload,
    sr.entity_external_id,
    sir.internal_id AS resolved_internal_id,
    sir.resolution_action
  FROM staging_rows sr
  LEFT JOIN staging_id_resolution sir ON (
    sir.upload_id = sr.upload_id
    AND sir.platform = sr.platform
    AND sir.entity_type::text = sr.row_type::text
    AND sir.external_id = sr.entity_external_id
  )
  WHERE sr.upload_id = :upload_id
    AND sr.validation_status = 'valid'
    AND sr.processing_action = 'pending'
  ORDER BY
    CASE sr.row_type
      WHEN 'campaign' THEN 1
      WHEN 'ad_set' THEN 2
      WHEN 'ad' THEN 3
      WHEN 'daily_metric' THEN 4
      WHEN 'demographic_metric' THEN 5
    END,
    sr.row_number
)
SELECT * FROM promotion_candidates;
```

### 6.2 Transaction Boundaries

```sql
-- =============================================================================
-- PROMOTION TRANSACTION (Pseudocode as SQL comments)
-- =============================================================================

-- Transaction: Promote all valid rows for an upload
-- BEGIN;

-- Step 1: Lock staging rows for this upload (prevent concurrent promotion)
-- SELECT * FROM staging_rows
-- WHERE upload_id = :upload_id
-- FOR UPDATE SKIP LOCKED;

-- Step 2: Verify gate conditions still met
-- SELECT COUNT(*) as valid_count,
--        SUM(CASE WHEN validation_status = 'invalid' THEN 1 ELSE 0 END) as invalid_count
-- FROM staging_rows WHERE upload_id = :upload_id;
-- IF invalid_count > 0 AND mode = 'STRICT' THEN ROLLBACK;

-- Step 3: Promote dimensions in order (campaigns → ad_sets → ads)
-- For each dimension row:
--   UPSERT INTO production table
--   UPDATE staging_rows SET
--     processing_action = 'insert' or 'update',
--     processed_at = now(),
--     target_internal_id = (returned production id)
--   WHERE id = staging_row_id;

-- Step 4: Promote facts (daily_metrics, demographic_metrics)
-- For each fact row:
--   UPSERT INTO production table
--   UPDATE staging_rows SET
--     processing_action = 'insert' or 'update',
--     processed_at = now()
--   WHERE id = staging_row_id;

-- Step 5: Update data_uploads status
-- UPDATE data_uploads SET
--   status = 'completed',
--   row_count = (count of promoted rows)
-- WHERE id = :upload_id;

-- COMMIT;
```

### 6.3 Rollback Expectations

| Failure Point | Rollback Scope | Staging State |
|---------------|----------------|---------------|
| Before COMMIT | Full transaction rollback | Unchanged (processing_action = 'pending') |
| After COMMIT | No rollback (data in production) | Updated (processed_at set) |
| Partial promotion (LENIENT mode) | Valid rows committed | Valid: processed, Invalid: skipped |

### 6.4 Post-Promotion Staging Updates

| Field | Update Value | Condition |
|-------|--------------|-----------|
| processing_action | 'insert' | New production record created |
| processing_action | 'update' | Existing production record updated |
| processing_action | 'skipped' | Row not promoted (invalid or filtered) |
| processing_action | 'failed' | Promotion attempted but failed |
| processed_at | now() | Row was processed (success or fail) |
| target_internal_id | production UUID | For dimensions, store resolved ID |

---

## 7. Freeze / Compatibility Gate

### 7.1 Core Table Freeze Confirmation

| Table | Modification | Status |
|-------|--------------|--------|
| workspaces | NONE | FROZEN |
| clients | NONE | FROZEN |
| campaigns | NONE | FROZEN |
| ad_sets | NONE | FROZEN |
| ads | NONE | FROZEN |
| daily_metrics | NONE | FROZEN |
| demographic_metrics | NONE | FROZEN |
| alerts | NONE | FROZEN |
| alert_rules | NONE | FROZEN |
| reports | NONE | FROZEN |
| data_uploads | NONE | FROZEN |

**Confirmation:** This migration adds NEW tables only. No modifications to D4-frozen core tables.

### 7.2 Alert Isolation Confirmation

| Assertion | Verification |
|-----------|--------------|
| Staging writes do not trigger alerts | staging_rows has no FK to alerts, no trigger to alert_rules |
| Alert evaluation does not read staging | D6.6 queries production tables only |
| IngestionCompleteEvent only after promotion | Event emitted post-transaction, not during staging |

### 7.3 D6.7 API Pull Compatibility

| Feature | Compatibility |
|---------|---------------|
| API pull writes to staging | staging_rows accepts all entity types |
| Platform-specific data | platform column supports meta/google/tiktok |
| External ID resolution | staging_id_resolution supports all platforms |
| Incremental sync | upload_id correlation maintained |

### 7.4 D6.6 Alert Evaluation Compatibility

| Feature | Compatibility |
|---------|---------------|
| IngestionCompleteEvent | Emitted after promotion, not during staging |
| Metric availability | Only promoted metrics visible to D6.6 |
| Debounce window | Applies to promoted data only |
| Date range in event | Derived from promoted metrics |

### 7.5 Compatibility Matrix

| Dependency | Compatible | Notes |
|------------|------------|-------|
| D6.4 Ingestion Architecture | YES | Staging is transparent layer |
| D6.5 Execution Blueprint | YES | Staging implements design |
| D6.5.1 Staging Design | YES | This migration implements D6.5.1 |
| D6.6 Alert Evaluation | YES | No staging interaction |
| D6.7.1 Scheduling | YES | Scheduling unaffected |
| D6.7.2 API Pull | YES | API pull uses staging |

---

## 8. Complete Migration Script

### 8.1 Migration File: 008_staging_tables.sql

```sql
-- =============================================================================
-- Migration: 008_staging_tables.sql
-- Purpose: Add staging tables for D6.5.1 Staging & Dry-Run Execution
-- Classification: CONTROLLED SCHEMA DELTA (new tables only)
-- Date: 2024-12-28
-- =============================================================================

-- Transaction wrapper
BEGIN;

-- =============================================================================
-- SECTION 1: ENUM TYPES
-- =============================================================================

-- Row type enum
DO $$ BEGIN
  CREATE TYPE staging_row_type AS ENUM (
    'campaign',
    'ad_set',
    'ad',
    'daily_metric',
    'demographic_metric'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Validation status enum
DO $$ BEGIN
  CREATE TYPE staging_validation_status AS ENUM (
    'pending',
    'valid',
    'invalid',
    'skipped'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Processing action enum
DO $$ BEGIN
  CREATE TYPE staging_processing_action AS ENUM (
    'pending',
    'insert',
    'update',
    'skipped',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Entity type enum (for ID resolution)
DO $$ BEGIN
  CREATE TYPE staging_entity_type AS ENUM (
    'campaign',
    'ad_set',
    'ad'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Resolution status enum
DO $$ BEGIN
  CREATE TYPE staging_resolution_status AS ENUM (
    'pending',
    'resolved_existing',
    'resolved_new',
    'unresolved'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- SECTION 2: STAGING_ROWS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS staging_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  client_id UUID NOT NULL,
  upload_id UUID NOT NULL,
  batch_id UUID,
  request_id UUID,
  platform TEXT NOT NULL CHECK (platform IN ('meta', 'google', 'tiktok')),
  row_type staging_row_type NOT NULL,
  row_number INTEGER NOT NULL CHECK (row_number >= 0),
  entity_external_id TEXT,
  raw_payload JSONB NOT NULL,
  normalized_payload JSONB,
  validation_status staging_validation_status NOT NULL DEFAULT 'pending',
  validation_errors JSONB DEFAULT '[]'::jsonb,
  validation_warnings JSONB DEFAULT '[]'::jsonb,
  processing_action staging_processing_action NOT NULL DEFAULT 'pending',
  processed_at TIMESTAMPTZ,
  target_internal_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE staging_rows IS 'Temporary staging area for ingestion data. Part of D6.5.2 controlled schema delta.';

-- =============================================================================
-- SECTION 3: STAGING_ID_RESOLUTION TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS staging_id_resolution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  client_id UUID NOT NULL,
  upload_id UUID NOT NULL,
  batch_id UUID,
  platform TEXT NOT NULL CHECK (platform IN ('meta', 'google', 'tiktok')),
  entity_type staging_entity_type NOT NULL,
  external_id TEXT NOT NULL,
  internal_id UUID,
  resolution_status staging_resolution_status NOT NULL DEFAULT 'pending',
  resolution_action staging_processing_action,
  parent_external_id TEXT,
  parent_internal_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE staging_id_resolution IS 'Tracks external_id to internal_id mappings during ingestion. Part of D6.5.2 controlled schema delta.';

-- =============================================================================
-- SECTION 4: UNIQUE CONSTRAINTS
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS staging_rows_upload_row_unique
  ON staging_rows(upload_id, row_number, row_type);

CREATE UNIQUE INDEX IF NOT EXISTS staging_id_resolution_unique
  ON staging_id_resolution(upload_id, entity_type, platform, external_id);

-- =============================================================================
-- SECTION 5: INDEXES FOR STAGING_ROWS
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_staging_rows_upload_id
  ON staging_rows(upload_id);

CREATE INDEX IF NOT EXISTS idx_staging_rows_workspace_id
  ON staging_rows(workspace_id);

CREATE INDEX IF NOT EXISTS idx_staging_rows_client_id
  ON staging_rows(client_id);

CREATE INDEX IF NOT EXISTS idx_staging_rows_validation_status
  ON staging_rows(validation_status);

CREATE INDEX IF NOT EXISTS idx_staging_rows_row_type
  ON staging_rows(row_type);

CREATE INDEX IF NOT EXISTS idx_staging_rows_platform
  ON staging_rows(platform);

CREATE INDEX IF NOT EXISTS idx_staging_rows_created_at
  ON staging_rows(created_at);

CREATE INDEX IF NOT EXISTS idx_staging_rows_processed_at
  ON staging_rows(processed_at)
  WHERE processed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_staging_rows_promotion
  ON staging_rows(upload_id, validation_status, row_type)
  WHERE validation_status = 'valid';

CREATE INDEX IF NOT EXISTS idx_staging_rows_invalid
  ON staging_rows(upload_id, created_at)
  WHERE validation_status = 'invalid';

CREATE INDEX IF NOT EXISTS idx_staging_rows_batch_id
  ON staging_rows(batch_id)
  WHERE batch_id IS NOT NULL;

-- =============================================================================
-- SECTION 6: INDEXES FOR STAGING_ID_RESOLUTION
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_staging_id_resolution_upload_id
  ON staging_id_resolution(upload_id);

CREATE INDEX IF NOT EXISTS idx_staging_id_resolution_external_id
  ON staging_id_resolution(external_id);

CREATE INDEX IF NOT EXISTS idx_staging_id_resolution_entity_type
  ON staging_id_resolution(entity_type);

CREATE INDEX IF NOT EXISTS idx_staging_id_resolution_workspace_id
  ON staging_id_resolution(workspace_id);

CREATE INDEX IF NOT EXISTS idx_staging_id_resolution_client_id
  ON staging_id_resolution(client_id);

CREATE INDEX IF NOT EXISTS idx_staging_id_resolution_status
  ON staging_id_resolution(resolution_status);

CREATE INDEX IF NOT EXISTS idx_staging_id_resolution_created_at
  ON staging_id_resolution(created_at);

CREATE INDEX IF NOT EXISTS idx_staging_id_resolution_lookup
  ON staging_id_resolution(upload_id, platform, entity_type, external_id);

CREATE INDEX IF NOT EXISTS idx_staging_id_resolution_unresolved
  ON staging_id_resolution(upload_id, entity_type)
  WHERE resolution_status = 'unresolved';

-- =============================================================================
-- SECTION 7: TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS staging_rows_updated_at ON staging_rows;
CREATE TRIGGER staging_rows_updated_at
  BEFORE UPDATE ON staging_rows
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS staging_id_resolution_updated_at ON staging_id_resolution;
CREATE TRIGGER staging_id_resolution_updated_at
  BEFORE UPDATE ON staging_id_resolution
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SECTION 8: ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS
ALTER TABLE staging_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging_id_resolution ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (idempotent)
DROP POLICY IF EXISTS staging_rows_service_full_access ON staging_rows;
DROP POLICY IF EXISTS staging_rows_workspace_read ON staging_rows;
DROP POLICY IF EXISTS staging_id_resolution_service_full_access ON staging_id_resolution;
DROP POLICY IF EXISTS staging_id_resolution_workspace_read ON staging_id_resolution;

-- Service role full access
CREATE POLICY staging_rows_service_full_access
  ON staging_rows
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY staging_id_resolution_service_full_access
  ON staging_id_resolution
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users read-only (workspace-scoped)
-- Note: This requires workspace_members table to exist
-- If it doesn't exist, these policies will fail silently

CREATE POLICY staging_rows_workspace_read
  ON staging_rows
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = staging_rows.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY staging_id_resolution_workspace_read
  ON staging_id_resolution
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = staging_id_resolution.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

-- =============================================================================
-- SECTION 9: CLEANUP FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_staging_rows()
RETURNS TABLE(
  promoted_deleted INTEGER,
  invalid_deleted INTEGER,
  orphan_deleted INTEGER
) AS $$
DECLARE
  v_promoted_deleted INTEGER := 0;
  v_invalid_deleted INTEGER := 0;
  v_orphan_deleted INTEGER := 0;
  v_batch_size INTEGER := 10000;
BEGIN
  -- Delete old promoted rows (7 days)
  WITH deleted AS (
    DELETE FROM staging_rows
    WHERE processed_at IS NOT NULL
      AND processed_at < now() - INTERVAL '7 days'
      AND created_at < now() - INTERVAL '24 hours'
    LIMIT v_batch_size
    RETURNING id
  )
  SELECT COUNT(*) INTO v_promoted_deleted FROM deleted;

  -- Delete old invalid rows (30 days)
  WITH deleted AS (
    DELETE FROM staging_rows
    WHERE validation_status = 'invalid'
      AND created_at < now() - INTERVAL '30 days'
    LIMIT v_batch_size
    RETURNING id
  )
  SELECT COUNT(*) INTO v_invalid_deleted FROM deleted;

  -- Delete orphan rows (1 day)
  WITH deleted AS (
    DELETE FROM staging_rows
    WHERE processed_at IS NULL
      AND validation_status IN ('pending', 'valid')
      AND created_at < now() - INTERVAL '1 day'
    LIMIT v_batch_size
    RETURNING id
  )
  SELECT COUNT(*) INTO v_orphan_deleted FROM deleted;

  RETURN QUERY SELECT v_promoted_deleted, v_invalid_deleted, v_orphan_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cleanup_staging_id_resolution()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER := 0;
  v_batch_size INTEGER := 10000;
BEGIN
  WITH deleted AS (
    DELETE FROM staging_id_resolution
    WHERE created_at < now() - INTERVAL '7 days'
    LIMIT v_batch_size
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted FROM deleted;

  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Restrict cleanup functions to service_role
REVOKE ALL ON FUNCTION cleanup_staging_rows() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_staging_rows() TO service_role;

REVOKE ALL ON FUNCTION cleanup_staging_id_resolution() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_staging_id_resolution() TO service_role;

-- =============================================================================
-- COMMIT TRANSACTION
-- =============================================================================

COMMIT;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
```

---

## 9. Document Control

| Version | Date | Change |
|---------|------|--------|
| D6.5.2 | 2024-12-28 | Initial staging schema migration plan |

---

## 10. Approval

This migration plan is ready for implementation. Execution requires separate approval.

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Database Architect | | | |
| Security Reviewer | | | |
| Ops Lead | | | |
