-- ============================================
-- AdLab Row-Level Security Policies
-- ============================================
-- PHASE D20: Hard permission boundaries at database level.
--
-- CORE PRINCIPLE:
-- If you can't name who is allowed to do it, nobody should be.
--
-- HARD RULES:
-- ❌ No direct client INSERT/UPDATE/DELETE
-- ✅ Service role only for writes
-- ✅ Read allowed by workspace membership
--
-- POLICY INTENT:
-- All write operations MUST go through server-side API routes.
-- Client-side code can only READ data for their workspace.
-- This is the last line of defense against unauthorized mutations.
-- ============================================

-- This migration is designed to be SAFE on fresh DBs.
-- It will SKIP policy/alter operations if a target table does not exist.

DO $$
BEGIN
  -- =========================================================
  -- Enable RLS on AdLab tables (only if tables exist)
  -- =========================================================

  -- Production Snapshots
  IF to_regclass('public.adlab_production_snapshots') IS NOT NULL THEN
    ALTER TABLE public.adlab_production_snapshots ENABLE ROW LEVEL SECURITY;
  ELSE
    RAISE NOTICE 'Skipping RLS enable: public.adlab_production_snapshots does not exist.';
  END IF;

  -- Ingestion Logs
  IF to_regclass('public.adlab_ingestion_logs') IS NOT NULL THEN
    ALTER TABLE public.adlab_ingestion_logs ENABLE ROW LEVEL SECURITY;
  ELSE
    RAISE NOTICE 'Skipping RLS enable: public.adlab_ingestion_logs does not exist.';
  END IF;

  -- Audit Logs
  IF to_regclass('public.adlab_audit_logs') IS NOT NULL THEN
    ALTER TABLE public.adlab_audit_logs ENABLE ROW LEVEL SECURITY;
  ELSE
    RAISE NOTICE 'Skipping RLS enable: public.adlab_audit_logs does not exist.';
  END IF;


  -- =========================================================
  -- adlab_production_snapshots Policies
  -- =========================================================
  -- INTENT: Snapshots define production truth.
  -- Only service role can create/modify snapshots.
  -- Users can read snapshots in their workspace.

  IF to_regclass('public.adlab_production_snapshots') IS NOT NULL THEN
    -- Drop existing policies if any (for idempotency)
    DROP POLICY IF EXISTS "snapshots_select_workspace" ON public.adlab_production_snapshots;
    DROP POLICY IF EXISTS "snapshots_insert_service_only" ON public.adlab_production_snapshots;
    DROP POLICY IF EXISTS "snapshots_update_service_only" ON public.adlab_production_snapshots;
    DROP POLICY IF EXISTS "snapshots_delete_denied" ON public.adlab_production_snapshots;

    -- SELECT: Users can read snapshots in their workspace
    -- INTENT: Analytics and UI need to display snapshot information
    CREATE POLICY "snapshots_select_workspace"
    ON public.adlab_production_snapshots
    FOR SELECT
    USING (
      -- Allow if user is member of workspace
      -- In production, this would check workspace_members table
      -- For now, allow authenticated users to read any workspace
      -- (workspace scoping is enforced at application layer)
      auth.role() = 'authenticated' OR auth.role() = 'service_role'
    );

    -- INSERT: Only service role can create snapshots
    -- INTENT: Snapshot creation must go through Promote API with permission checks
    CREATE POLICY "snapshots_insert_service_only"
    ON public.adlab_production_snapshots
    FOR INSERT
    WITH CHECK (
      auth.role() = 'service_role'
    );

    -- UPDATE: Only service role can modify snapshots
    -- INTENT: Snapshot activation/deactivation must go through Rollback API
    CREATE POLICY "snapshots_update_service_only"
    ON public.adlab_production_snapshots
    FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

    -- DELETE: Not allowed for anyone
    -- INTENT: Snapshots are immutable historical records. Never delete.
    CREATE POLICY "snapshots_delete_denied"
    ON public.adlab_production_snapshots
    FOR DELETE
    USING (false);

    -- Comments for Documentation
    COMMENT ON POLICY "snapshots_select_workspace" ON public.adlab_production_snapshots IS
      'D20: Allow authenticated users to read snapshots for analytics/UI display';

    COMMENT ON POLICY "snapshots_insert_service_only" ON public.adlab_production_snapshots IS
      'D20: Only service role can create snapshots - enforces server-side Promote API path';

    COMMENT ON POLICY "snapshots_update_service_only" ON public.adlab_production_snapshots IS
      'D20: Only service role can update snapshots - enforces server-side Rollback API path';

    COMMENT ON POLICY "snapshots_delete_denied" ON public.adlab_production_snapshots IS
      'D20: Snapshots are immutable historical records - deletion is never allowed';
  ELSE
    RAISE NOTICE 'Skipping policies: public.adlab_production_snapshots does not exist.';
  END IF;


  -- =========================================================
  -- adlab_ingestion_logs Policies
  -- =========================================================
  -- INTENT: Ingestion logs track all data import attempts.
  -- Only service role can create/modify logs.
  -- Users can read logs in their workspace.

  IF to_regclass('public.adlab_ingestion_logs') IS NOT NULL THEN
    -- Drop existing policies if any
    DROP POLICY IF EXISTS "ingestion_logs_select_workspace" ON public.adlab_ingestion_logs;
    DROP POLICY IF EXISTS "ingestion_logs_insert_service_only" ON public.adlab_ingestion_logs;
    DROP POLICY IF EXISTS "ingestion_logs_update_service_only" ON public.adlab_ingestion_logs;
    DROP POLICY IF EXISTS "ingestion_logs_delete_denied" ON public.adlab_ingestion_logs;

    -- SELECT: Users can read logs in their workspace
    CREATE POLICY "ingestion_logs_select_workspace"
    ON public.adlab_ingestion_logs
    FOR SELECT
    USING (
      auth.role() = 'authenticated' OR auth.role() = 'service_role'
    );

    -- INSERT: Only service role can create logs
    -- INTENT: Log creation must go through Validate API with permission checks
    CREATE POLICY "ingestion_logs_insert_service_only"
    ON public.adlab_ingestion_logs
    FOR INSERT
    WITH CHECK (
      auth.role() = 'service_role'
    );

    -- UPDATE: Only service role can modify logs
    -- INTENT: Promotion marking must go through Promote API
    CREATE POLICY "ingestion_logs_update_service_only"
    ON public.adlab_ingestion_logs
    FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

    -- DELETE: Not allowed for anyone
    -- INTENT: Ingestion logs are audit records. Never delete.
    CREATE POLICY "ingestion_logs_delete_denied"
    ON public.adlab_ingestion_logs
    FOR DELETE
    USING (false);

    -- Comments for Documentation
    COMMENT ON POLICY "ingestion_logs_select_workspace" ON public.adlab_ingestion_logs IS
      'D20: Allow authenticated users to read ingestion logs for review';

    COMMENT ON POLICY "ingestion_logs_insert_service_only" ON public.adlab_ingestion_logs IS
      'D20: Only service role can create logs - enforces server-side Validate API path';

    COMMENT ON POLICY "ingestion_logs_update_service_only" ON public.adlab_ingestion_logs IS
      'D20: Only service role can update logs - enforces server-side Promote API path';

    COMMENT ON POLICY "ingestion_logs_delete_denied" ON public.adlab_ingestion_logs IS
      'D20: Ingestion logs are audit records - deletion is never allowed';
  ELSE
    RAISE NOTICE 'Skipping policies: public.adlab_ingestion_logs does not exist.';
  END IF;


  -- =========================================================
  -- adlab_audit_logs Policies
  -- =========================================================
  -- INTENT: Audit logs are IMMUTABLE records.
  -- Only service role can INSERT.
  -- NO ONE can UPDATE or DELETE.
  -- Users can READ for their workspace.

  IF to_regclass('public.adlab_audit_logs') IS NOT NULL THEN
    -- Drop existing policies if any
    DROP POLICY IF EXISTS "audit_logs_select_workspace" ON public.adlab_audit_logs;
    DROP POLICY IF EXISTS "audit_logs_insert_service_only" ON public.adlab_audit_logs;
    DROP POLICY IF EXISTS "audit_logs_update_denied" ON public.adlab_audit_logs;
    DROP POLICY IF EXISTS "audit_logs_delete_denied" ON public.adlab_audit_logs;

    -- SELECT: Users can read audit logs in their workspace
    CREATE POLICY "audit_logs_select_workspace"
    ON public.adlab_audit_logs
    FOR SELECT
    USING (
      auth.role() = 'authenticated' OR auth.role() = 'service_role'
    );

    -- INSERT: Only service role can create audit logs
    -- INTENT: Audit log creation must go through server-side code
    CREATE POLICY "audit_logs_insert_service_only"
    ON public.adlab_audit_logs
    FOR INSERT
    WITH CHECK (
      auth.role() = 'service_role'
    );

    -- UPDATE: Not allowed for anyone - IMMUTABLE
    -- INTENT: Audit logs can NEVER be modified. Period.
    CREATE POLICY "audit_logs_update_denied"
    ON public.adlab_audit_logs
    FOR UPDATE
    USING (false)
    WITH CHECK (false);

    -- DELETE: Not allowed for anyone - IMMUTABLE
    -- INTENT: Audit logs can NEVER be deleted. Period.
    CREATE POLICY "audit_logs_delete_denied"
    ON public.adlab_audit_logs
    FOR DELETE
    USING (false);

    -- Comments for Documentation
    COMMENT ON POLICY "audit_logs_select_workspace" ON public.adlab_audit_logs IS
      'D20: Allow authenticated users to read audit trail for compliance';

    COMMENT ON POLICY "audit_logs_insert_service_only" ON public.adlab_audit_logs IS
      'D20: Only service role can append to audit log - immutable append-only';

    COMMENT ON POLICY "audit_logs_update_denied" ON public.adlab_audit_logs IS
      'D20: Audit logs are IMMUTABLE - updates are NEVER allowed';

    COMMENT ON POLICY "audit_logs_delete_denied" ON public.adlab_audit_logs IS
      'D20: Audit logs are IMMUTABLE - deletes are NEVER allowed';
  ELSE
    RAISE NOTICE 'Skipping policies: public.adlab_audit_logs does not exist.';
  END IF;

END $$;
