-- ============================================
-- Migration 022: Make promoted_by nullable in adlab_production_snapshots
-- ============================================
-- PROBLEM: adlab_ingestion_logs.promoted_by can be NULL (dev fallback actor),
-- but adlab_production_snapshots.promoted_by may have NOT NULL constraint,
-- causing snapshot creation to fail with:
-- "null value in column promoted_by violates not-null constraint"
--
-- SOLUTION: Allow NULL in promoted_by for consistency with ingestion_logs.
-- In dev mode, promoted_by is NULL; in production, it's a valid UUID.
--
-- SAFETY:
-- - Uses to_regclass() check to skip if table doesn't exist
-- - Checks is_nullable before attempting ALTER
-- - Idempotent: safe to run multiple times
-- ============================================

DO $$
BEGIN
  -- Only proceed if table exists
  IF to_regclass('public.adlab_production_snapshots') IS NOT NULL THEN
    -- Check if column exists and has NOT NULL constraint
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'adlab_production_snapshots'
        AND column_name = 'promoted_by'
        AND is_nullable = 'NO'
    ) THEN
      ALTER TABLE public.adlab_production_snapshots
        ALTER COLUMN promoted_by DROP NOT NULL;
      RAISE NOTICE 'Dropped NOT NULL constraint from adlab_production_snapshots.promoted_by';
    ELSE
      -- Column is either already nullable or doesn't exist
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'adlab_production_snapshots'
          AND column_name = 'promoted_by'
      ) THEN
        RAISE NOTICE 'promoted_by is already nullable - skipping';
      ELSE
        RAISE NOTICE 'promoted_by column does not exist - skipping';
      END IF;
    END IF;
  ELSE
    RAISE NOTICE 'adlab_production_snapshots table does not exist - skipping migration';
  END IF;
END $$;

-- ============================================
-- Verification
-- ============================================
DO $$
DECLARE
  is_nullable_flag TEXT;
BEGIN
  IF to_regclass('public.adlab_production_snapshots') IS NOT NULL THEN
    SELECT is_nullable INTO is_nullable_flag
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'adlab_production_snapshots'
      AND column_name = 'promoted_by';

    IF is_nullable_flag = 'YES' THEN
      RAISE NOTICE 'OK: promoted_by is now nullable';
    ELSE
      RAISE WARNING 'ISSUE: promoted_by is still NOT NULL';
    END IF;
  END IF;
END $$;

-- ============================================
-- Reload PostgREST schema cache
-- ============================================
NOTIFY pgrst, 'reload schema';
