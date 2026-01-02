-- ============================================
-- Migration 021: Ingestion Logs CHECK Constraint
-- ============================================
-- INVARIANT: A frozen log MUST have promoted_at set.
--
-- This prevents the impossible state where:
--   frozen = TRUE AND promoted_at IS NULL
--
-- The promote flow MUST:
--   1. Create snapshot
--   2. Mark log as promoted (sets promoted_at + frozen = true)
--
-- If snapshot creation fails, the log remains unfrozen.
-- This CHECK constraint guarantees DB-level enforcement.
--
-- SAFETY:
-- - Auto-remediates any existing violations BEFORE adding constraint
-- - Idempotent - checks if constraint exists before adding
-- - Never fails due to existing bad data
-- ============================================

DO $$
DECLARE
  violation_count INTEGER;
  remediated_count INTEGER;
BEGIN
  -- Only proceed if table exists
  IF to_regclass('public.adlab_ingestion_logs') IS NOT NULL THEN

    -- ========================================
    -- STEP 1: Auto-remediate any violations
    -- ========================================
    -- Before adding CHECK constraint, fix any rows that violate it.
    -- Safe default: set frozen=false (allows re-promotion attempt)

    SELECT COUNT(*) INTO violation_count
    FROM public.adlab_ingestion_logs
    WHERE frozen = TRUE AND promoted_at IS NULL;

    IF violation_count > 0 THEN
      RAISE NOTICE 'Found % rows with frozen=TRUE but promoted_at IS NULL - auto-remediating...', violation_count;

      UPDATE public.adlab_ingestion_logs
      SET frozen = FALSE,
          updated_at = NOW()
      WHERE frozen = TRUE AND promoted_at IS NULL;

      GET DIAGNOSTICS remediated_count = ROW_COUNT;
      RAISE NOTICE 'Remediated % rows by setting frozen=FALSE', remediated_count;
    ELSE
      RAISE NOTICE 'No violations found - no remediation needed';
    END IF;

    -- ========================================
    -- STEP 2: Add CHECK constraint (idempotent)
    -- ========================================
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE c.conname = 'chk_frozen_requires_promoted'
        AND n.nspname = 'public'
    ) THEN
      -- Add CHECK constraint: if frozen is true, promoted_at must not be null
      ALTER TABLE public.adlab_ingestion_logs
        ADD CONSTRAINT chk_frozen_requires_promoted
        CHECK (frozen = FALSE OR promoted_at IS NOT NULL);
      RAISE NOTICE 'Added CHECK constraint chk_frozen_requires_promoted';
    ELSE
      RAISE NOTICE 'CHECK constraint chk_frozen_requires_promoted already exists - skipping';
    END IF;

  ELSE
    RAISE NOTICE 'adlab_ingestion_logs table does not exist - skipping migration';
  END IF;
END $$;

-- ============================================
-- Verification: Confirm no violations remain
-- ============================================
DO $$
DECLARE
  invalid_count INTEGER;
  constraint_exists BOOLEAN;
BEGIN
  IF to_regclass('public.adlab_ingestion_logs') IS NOT NULL THEN
    -- Check for any remaining violations
    SELECT COUNT(*) INTO invalid_count
    FROM public.adlab_ingestion_logs
    WHERE frozen = TRUE AND promoted_at IS NULL;

    -- Check constraint exists
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'chk_frozen_requires_promoted'
    ) INTO constraint_exists;

    IF invalid_count = 0 AND constraint_exists THEN
      RAISE NOTICE 'OK: CHECK constraint active, no violations';
    ELSIF invalid_count > 0 THEN
      RAISE WARNING 'ISSUE: % violation(s) remain after remediation', invalid_count;
    ELSIF NOT constraint_exists THEN
      RAISE WARNING 'ISSUE: CHECK constraint was not added';
    END IF;
  END IF;
END $$;

-- ============================================
-- Reload PostgREST schema cache
-- ============================================
NOTIFY pgrst, 'reload schema';
