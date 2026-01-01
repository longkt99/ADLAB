-- ============================================
-- D17A: Production Snapshot & Rollback Control
-- ============================================
-- Introduces snapshot abstraction for production data.
-- Enables safe rollback by snapshot switching (no data deletion).
--
-- INVARIANTS:
-- 1. At most ONE active snapshot per (workspace_id, platform, dataset)
-- 2. Data is NEVER deleted - rollback switches active snapshot only
-- 3. Production truth is defined ONLY by the active snapshot
-- ============================================

-- ============================================
-- Safe adds for ingestion logs (ONLY if table exists)
-- ============================================
DO $$
BEGIN
  -- If the table doesn't exist, skip this whole block (prevents SQLSTATE 42P01)
  IF to_regclass('public.adlab_ingestion_logs') IS NULL THEN
    RAISE NOTICE 'Skipping: public.adlab_ingestion_logs does not exist (D17A optional block).';
    RETURN;
  END IF;

  -- Add new columns to adlab_ingestion_logs if not exist
  -- (These may already exist from D16B, but safe to re-run)
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'adlab_ingestion_logs'
      AND column_name  = 'validated_rows_json'
  ) THEN
    ALTER TABLE public.adlab_ingestion_logs
      ADD COLUMN validated_rows_json JSONB;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'adlab_ingestion_logs'
      AND column_name  = 'promoted_at'
  ) THEN
    ALTER TABLE public.adlab_ingestion_logs
      ADD COLUMN promoted_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'adlab_ingestion_logs'
      AND column_name  = 'promoted_by'
  ) THEN
    ALTER TABLE public.adlab_ingestion_logs
      ADD COLUMN promoted_by TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'adlab_ingestion_logs'
      AND column_name  = 'frozen'
  ) THEN
    ALTER TABLE public.adlab_ingestion_logs
      ADD COLUMN frozen BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- ============================================
-- Production Snapshots Table
-- ============================================
-- Each snapshot represents a point-in-time view of promoted data.
-- Only ONE snapshot can be active per (workspace, platform, dataset).

CREATE TABLE IF NOT EXISTS public.adlab_production_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scope: exactly one active snapshot per this combination
  workspace_id UUID NOT NULL,
  platform     TEXT NOT NULL,
  dataset      TEXT NOT NULL,

  -- Link to the source ingestion log (nullable if ingestion table doesn't exist yet)
  ingestion_log_id UUID,

  -- Promotion audit trail
  promoted_at TIMESTAMPTZ NOT NULL,
  promoted_by TEXT NOT NULL,

  -- Active flag - only ONE per scope can be true
  is_active BOOLEAN DEFAULT FALSE,

  -- Rollback tracking (populated when THIS snapshot is rolled back FROM)
  rolled_back_at  TIMESTAMPTZ,
  rollback_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Add FK to ingestion logs ONLY if that table exists
-- (Prevents failure on fresh DB where adlab_ingestion_logs isn't created)
-- ============================================
DO $$
BEGIN
  IF to_regclass('public.adlab_ingestion_logs') IS NULL THEN
    RAISE NOTICE 'Skipping FK: public.adlab_ingestion_logs does not exist.';
    RETURN;
  END IF;

  -- Add FK constraint only if not present
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.contype = 'f'
      AND c.conname = 'adlab_production_snapshots_ingestion_log_id_fkey'
      AND n.nspname = 'public'
      AND t.relname = 'adlab_production_snapshots'
  ) THEN
    ALTER TABLE public.adlab_production_snapshots
      ADD CONSTRAINT adlab_production_snapshots_ingestion_log_id_fkey
      FOREIGN KEY (ingestion_log_id)
      REFERENCES public.adlab_ingestion_logs(id);
  END IF;
END $$;

-- ============================================
-- Partial Unique Index: Enforce Single Active Snapshot
-- ============================================
-- This index ensures at most ONE active snapshot exists
-- per (workspace_id, platform, dataset) combination.
-- Key invariant for production truth.

CREATE UNIQUE INDEX IF NOT EXISTS idx_adlab_snapshots_single_active
  ON public.adlab_production_snapshots (workspace_id, platform, dataset)
  WHERE is_active = true;

-- ============================================
-- Additional Indexes for Query Performance
-- ============================================

-- Fast lookup by ingestion log
CREATE INDEX IF NOT EXISTS idx_adlab_snapshots_ingestion_log
  ON public.adlab_production_snapshots (ingestion_log_id);

-- Fast lookup for workspace snapshots (history view)
CREATE INDEX IF NOT EXISTS idx_adlab_snapshots_workspace
  ON public.adlab_production_snapshots (workspace_id, created_at DESC);

-- Fast lookup for active snapshots by scope
CREATE INDEX IF NOT EXISTS idx_adlab_snapshots_scope
  ON public.adlab_production_snapshots (workspace_id, platform, dataset, is_active);

-- ============================================
-- Comments for Documentation
-- ============================================

COMMENT ON TABLE public.adlab_production_snapshots IS
'Production snapshot registry. Each snapshot points to an ingestion log that was promoted. Only ONE snapshot can be active per (workspace, platform, dataset). Rollback switches active snapshot, never deletes data.';

COMMENT ON COLUMN public.adlab_production_snapshots.is_active IS
'TRUE = this snapshot defines current production truth for its scope. Enforced unique by partial index.';

COMMENT ON COLUMN public.adlab_production_snapshots.rolled_back_at IS
'Populated when this snapshot was deactivated via rollback. NULL if never rolled back from.';

COMMENT ON COLUMN public.adlab_production_snapshots.rollback_reason IS
'Optional reason provided when rolling back FROM this snapshot.';
