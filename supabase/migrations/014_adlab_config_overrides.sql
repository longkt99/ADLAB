-- ============================================
-- AdLab Config Overrides
-- ============================================
-- PHASE D29: Compliance Control Panel + Safe Overrides.
--
-- CORE PRINCIPLE:
-- Runtime configuration overrides for workspace-level settings
-- that affect compliance, freshness policies, and operational controls.
--
-- HARD RULES:
-- - All overrides require human reason (accountability)
-- - All changes logged via audit trail
-- - Workspace-scoped (no global overrides here)
-- - Owner-only for mutations (enforced at API + membership policy)
-- - Immutable via standard deletion (soft-delete possible)
--
-- USE CASES:
-- - Override freshness thresholds per workspace
-- - Temporarily extend SLAs for known maintenance
-- - Custom compliance configurations
-- ============================================

-- Use public schema by default
SET search_path = public;

-- ============================================
-- Config Overrides Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.adlab_config_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scope: always workspace-level
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  -- Configuration key (namespaced)
  -- Examples: 'freshness.daily_metrics.warn_minutes', 'freshness.campaigns.fail_minutes'
  key TEXT NOT NULL,

  -- JSON value (allows complex configurations)
  value_json JSONB NOT NULL,

  -- Human-readable reason (required for accountability)
  reason TEXT NOT NULL,

  -- Who set this override
  set_by TEXT NOT NULL, -- User ID (string for flexibility)

  -- Active/disabled flag (soft-delete pattern)
  enabled BOOLEAN NOT NULL DEFAULT true,

  -- Optional expiration (auto-disable after this time)
  expires_at TIMESTAMPTZ NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Unique constraint: one key per workspace
  CONSTRAINT unique_workspace_key UNIQUE (workspace_id, key)
);

-- ============================================
-- Indexes
-- ============================================

-- Fast lookup by workspace
CREATE INDEX IF NOT EXISTS idx_config_overrides_workspace
  ON public.adlab_config_overrides(workspace_id);

-- Fast lookup for active overrides
CREATE INDEX IF NOT EXISTS idx_config_overrides_enabled
  ON public.adlab_config_overrides(workspace_id, enabled)
  WHERE enabled = true;

-- Fast lookup by key pattern (for freshness.* lookups)
CREATE INDEX IF NOT EXISTS idx_config_overrides_key
  ON public.adlab_config_overrides(key);

-- Expiration cleanup index
CREATE INDEX IF NOT EXISTS idx_config_overrides_expires
  ON public.adlab_config_overrides(expires_at)
  WHERE expires_at IS NOT NULL AND enabled = true;

-- ============================================
-- Updated At Trigger
-- ============================================

CREATE OR REPLACE FUNCTION public.update_config_override_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF to_regclass('public.adlab_config_overrides') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trigger_config_override_updated_at ON public.adlab_config_overrides;';
    EXECUTE 'CREATE TRIGGER trigger_config_override_updated_at
             BEFORE UPDATE ON public.adlab_config_overrides
             FOR EACH ROW
             EXECUTE FUNCTION public.update_config_override_updated_at();';
  END IF;
END $$;

-- ============================================
-- Expiration Auto-Disable Function
-- ============================================

-- Function to disable expired overrides (called by cron or on-demand)
CREATE OR REPLACE FUNCTION public.disable_expired_config_overrides()
RETURNS INTEGER AS $$
DECLARE
  disabled_count INTEGER := 0;
BEGIN
  -- Safe on fresh DBs: if table doesn't exist, return 0 instead of error
  IF to_regclass('public.adlab_config_overrides') IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.adlab_config_overrides
  SET enabled = false
  WHERE enabled = true
    AND expires_at IS NOT NULL
    AND expires_at < now();

  GET DIAGNOSTICS disabled_count = ROW_COUNT;
  RETURN disabled_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Row-Level Security
-- ============================================

ALTER TABLE IF EXISTS public.adlab_config_overrides ENABLE ROW LEVEL SECURITY;

-- Policies must NOT reference missing tables at parse-time.
-- IMPORTANT FIX (Step A): use the real memberships table name:
-- public.adlab_workspace_memberships (NOT workspace_memberships)

DO $$
BEGIN
  -- Only run policy operations if the table exists
  IF to_regclass('public.adlab_config_overrides') IS NULL THEN
    RETURN;
  END IF;

  -- Drop existing policies (idempotent) - wrapped to avoid relation errors
  EXECUTE 'DROP POLICY IF EXISTS "config_overrides_select" ON public.adlab_config_overrides;';
  EXECUTE 'DROP POLICY IF EXISTS "config_overrides_insert_service_only" ON public.adlab_config_overrides;';
  EXECUTE 'DROP POLICY IF EXISTS "config_overrides_update_service_only" ON public.adlab_config_overrides;';
  EXECUTE 'DROP POLICY IF EXISTS "config_overrides_delete_denied" ON public.adlab_config_overrides;';

  -- SELECT policy:
  -- If memberships table exists => workspace-scoped read for authenticated users
  -- Else => service_role only (safe default; avoids failing migration)
  IF to_regclass('public.adlab_workspace_memberships') IS NOT NULL THEN
    EXECUTE $POL$
      CREATE POLICY "config_overrides_select"
      ON public.adlab_config_overrides
      FOR SELECT
      USING (
        auth.role() = 'service_role'
        OR (
          auth.role() = 'authenticated'
          AND workspace_id IN (
            SELECT workspace_id
            FROM public.adlab_workspace_memberships
            WHERE user_id = auth.uid()
          )
        )
      );
    $POL$;
  ELSE
    EXECUTE $POL$
      CREATE POLICY "config_overrides_select"
      ON public.adlab_config_overrides
      FOR SELECT
      USING (
        auth.role() = 'service_role'
      );
    $POL$;
  END IF;

  -- INSERT: service_role only
  EXECUTE $POL$
    CREATE POLICY "config_overrides_insert_service_only"
    ON public.adlab_config_overrides
    FOR INSERT
    WITH CHECK (
      auth.role() = 'service_role'
    );
  $POL$;

  -- UPDATE: service_role only
  EXECUTE $POL$
    CREATE POLICY "config_overrides_update_service_only"
    ON public.adlab_config_overrides
    FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
  $POL$;

  -- DELETE: denied (soft-delete via enabled=false)
  EXECUTE $POL$
    CREATE POLICY "config_overrides_delete_denied"
    ON public.adlab_config_overrides
    FOR DELETE
    USING (false);
  $POL$;

END $$;

-- ============================================
-- Comments for Documentation (guarded)
-- ============================================

DO $$
BEGIN
  IF to_regclass('public.adlab_config_overrides') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE $C$
    COMMENT ON TABLE public.adlab_config_overrides IS
      'D29: Runtime configuration overrides for workspace-level settings';
  $C$;

  EXECUTE $C$ COMMENT ON COLUMN public.adlab_config_overrides.key IS
    'D29: Namespaced config key (e.g., freshness.daily_metrics.warn_minutes)'; $C$;

  EXECUTE $C$ COMMENT ON COLUMN public.adlab_config_overrides.value_json IS
    'D29: JSON value for the override (allows complex configurations)'; $C$;

  EXECUTE $C$ COMMENT ON COLUMN public.adlab_config_overrides.reason IS
    'D29: Required human-readable reason for the override (accountability)'; $C$;

  EXECUTE $C$ COMMENT ON COLUMN public.adlab_config_overrides.set_by IS
    'D29: User ID who set this override'; $C$;

  EXECUTE $C$ COMMENT ON COLUMN public.adlab_config_overrides.enabled IS
    'D29: Soft-delete pattern - disabled overrides are preserved for audit'; $C$;

  EXECUTE $C$ COMMENT ON COLUMN public.adlab_config_overrides.expires_at IS
    'D29: Optional auto-expiration timestamp'; $C$;

  -- COMMENT ON POLICY has no IF EXISTS, so guard via pg_policies
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'adlab_config_overrides'
      AND policyname = 'config_overrides_select'
  ) THEN
    EXECUTE $C$
      COMMENT ON POLICY "config_overrides_select" ON public.adlab_config_overrides IS
        'D29: Users can read overrides for workspaces they belong to (service_role always allowed)';
    $C$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'adlab_config_overrides'
      AND policyname = 'config_overrides_delete_denied'
  ) THEN
    EXECUTE $C$
      COMMENT ON POLICY "config_overrides_delete_denied" ON public.adlab_config_overrides IS
        'D29: Override records are audit trail - deletion is NEVER allowed';
    $C$;
  END IF;

  EXECUTE $C$
    COMMENT ON FUNCTION public.disable_expired_config_overrides() IS
      'D29: Function to auto-disable expired overrides (call via cron)';
  $C$;

END $$;
