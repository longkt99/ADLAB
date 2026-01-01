-- ============================================
-- AdLab Workspace Memberships
-- ============================================
-- PHASE D21: Server-derived actor resolution.
--
-- CORE PRINCIPLE:
-- Membership is the source of truth for role.
-- Role NEVER comes from client payload.
--
-- HARD RULES:
-- - user_id + workspace_id determines role
-- - is_active must be true for access
-- - Only service_role can mutate memberships
-- - Client can only read own membership
-- ============================================

-- ============================================
-- Workspace Memberships Table
-- ============================================

CREATE TABLE IF NOT EXISTS adlab_workspace_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'operator', 'viewer')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  invited_by UUID NULL,
  invited_at TIMESTAMPTZ NULL,
  accepted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Each user can only have one membership per workspace
  CONSTRAINT unique_workspace_user UNIQUE (workspace_id, user_id)
);

-- ============================================
-- Indexes
-- ============================================

-- Fast lookup by workspace and role (for listing workspace members)
CREATE INDEX IF NOT EXISTS idx_memberships_workspace_role
  ON adlab_workspace_memberships(workspace_id, role)
  WHERE is_active = true;

-- Fast lookup by user (for resolving user's workspaces)
CREATE INDEX IF NOT EXISTS idx_memberships_user
  ON adlab_workspace_memberships(user_id)
  WHERE is_active = true;

-- Fast lookup for actor resolution (workspace + user + active)
CREATE INDEX IF NOT EXISTS idx_memberships_actor_lookup
  ON adlab_workspace_memberships(workspace_id, user_id)
  WHERE is_active = true;

-- ============================================
-- Updated At Trigger
-- ============================================

CREATE OR REPLACE FUNCTION update_membership_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_membership_updated_at ON adlab_workspace_memberships;
CREATE TRIGGER trigger_membership_updated_at
  BEFORE UPDATE ON adlab_workspace_memberships
  FOR EACH ROW
  EXECUTE FUNCTION update_membership_updated_at();

-- ============================================
-- Row-Level Security
-- ============================================

ALTER TABLE adlab_workspace_memberships ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (for idempotency)
DROP POLICY IF EXISTS "memberships_select_own" ON adlab_workspace_memberships;
DROP POLICY IF EXISTS "memberships_select_workspace_members" ON adlab_workspace_memberships;
DROP POLICY IF EXISTS "memberships_insert_service_only" ON adlab_workspace_memberships;
DROP POLICY IF EXISTS "memberships_update_service_only" ON adlab_workspace_memberships;
DROP POLICY IF EXISTS "memberships_delete_service_only" ON adlab_workspace_memberships;

-- SELECT: Users can read their own membership
-- INTENT: Actor resolution needs to look up user's own membership
CREATE POLICY "memberships_select_own"
ON adlab_workspace_memberships
FOR SELECT
USING (
  auth.uid() = user_id OR auth.role() = 'service_role'
);

-- SELECT: Workspace owners/admins can read all memberships in their workspace
-- INTENT: Admins need to see who is in their workspace
-- This is implemented via service_role in the API for now
-- (Can be enhanced later with workspace admin check)

-- INSERT: Only service role can create memberships
-- INTENT: Membership changes are admin operations through API
CREATE POLICY "memberships_insert_service_only"
ON adlab_workspace_memberships
FOR INSERT
WITH CHECK (
  auth.role() = 'service_role'
);

-- UPDATE: Only service role can modify memberships
-- INTENT: Role changes, deactivation must go through API
CREATE POLICY "memberships_update_service_only"
ON adlab_workspace_memberships
FOR UPDATE
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- DELETE: Only service role can delete memberships
-- INTENT: Hard deletes are admin operations (prefer is_active = false)
CREATE POLICY "memberships_delete_service_only"
ON adlab_workspace_memberships
FOR DELETE
USING (auth.role() = 'service_role');

-- ============================================
-- Comments for Documentation
-- ============================================

COMMENT ON TABLE adlab_workspace_memberships IS
  'D21: Workspace membership defines user role. Source of truth for actor resolution.';

COMMENT ON COLUMN adlab_workspace_memberships.role IS
  'D21: Role is NEVER from client. Always from this table via server lookup.';

COMMENT ON COLUMN adlab_workspace_memberships.is_active IS
  'D21: Inactive memberships are denied access. Soft-delete for audit trail.';

COMMENT ON POLICY "memberships_select_own" ON adlab_workspace_memberships IS
  'D21: Users can only read their own membership for role display in UI';

COMMENT ON POLICY "memberships_insert_service_only" ON adlab_workspace_memberships IS
  'D21: Only server can create memberships - prevents client-side role injection';

COMMENT ON POLICY "memberships_update_service_only" ON adlab_workspace_memberships IS
  'D21: Only server can update memberships - prevents client-side role elevation';

-- ============================================
-- Development Seed Data (Optional)
-- ============================================
-- Uncomment to seed development data. Uses a deterministic UUID for testing.

-- Insert test membership for development
-- This creates an owner membership for a test user in the first workspace
-- INSERT INTO adlab_workspace_memberships (workspace_id, user_id, role, is_active)
-- SELECT
--   w.id,
--   'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, -- Test user UUID
--   'owner',
--   true
-- FROM workspaces w
-- ORDER BY w.created_at DESC
-- LIMIT 1
-- ON CONFLICT (workspace_id, user_id) DO NOTHING;
