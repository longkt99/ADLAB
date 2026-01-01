// ============================================
// AdLab Trust Token System
// ============================================
// PHASE D33: Public Trust Portal.
//
// PROVIDES:
// - Signed, time-limited tokens for public trust access
// - Token creation, verification, and revocation
// - Scope-limited access (profile + sections)
// - Full audit trail for all token operations
//
// INVARIANTS:
// - No raw token storage (hash only)
// - Expiration required
// - All operations audited
// - Zero-auth verification
// ============================================

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { appendAuditLog } from '@/lib/adlab/audit';
import type { AttestationProfile, EvidenceSection } from './attestationProfiles';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Secret for signing tokens - MUST be set in production
const TOKEN_SECRET = process.env.ADLAB_TRUST_TOKEN_SECRET || 'dev-secret-do-not-use-in-production';

// ============================================
// Types
// ============================================

export interface TrustTokenScope {
  profile: AttestationProfile;
  sections?: EvidenceSection[];
}

export interface TrustTokenPayload {
  tokenId: string;
  workspaceId: string;
  scope: TrustTokenScope;
  expiresAt: string;
  issuedAt: string;
  issuedBy: string;
}

export interface TrustToken {
  id: string;
  workspaceId: string;
  tokenHash: string;
  profile: AttestationProfile;
  allowedSections: EvidenceSection[] | null;
  expiresAt: string;
  issuedAt: string;
  issuedBy: string;
  revokedAt: string | null;
  revokedBy: string | null;
  usageCount: number;
  lastAccessedAt: string | null;
  label: string | null;
}

export interface CreateTokenInput {
  workspaceId: string;
  profile: AttestationProfile;
  sections?: EvidenceSection[];
  expiresAt: string;
  issuedBy: string;
  label?: string;
}

export interface CreateTokenResult {
  success: boolean;
  token?: string;
  tokenId?: string;
  expiresAt?: string;
  error?: string;
}

export interface VerifyTokenResult {
  valid: boolean;
  payload?: TrustTokenPayload;
  tokenRecord?: TrustToken;
  error?: string;
}

export interface RevokeTokenResult {
  success: boolean;
  error?: string;
}

// ============================================
// Supabase Client
// ============================================

function createTrustClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ============================================
// Token Generation & Verification
// ============================================

function generateTokenId(): string {
  return crypto.randomUUID();
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signPayload(payload: TrustTokenPayload): string {
  const payloadStr = JSON.stringify(payload);
  const payloadBase64 = Buffer.from(payloadStr).toString('base64url');

  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(payloadBase64)
    .digest('base64url');

  return `${payloadBase64}.${signature}`;
}

function verifySignature(token: string): TrustTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadBase64, signature] = parts;

  const expectedSignature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(payloadBase64)
    .digest('base64url');

  // Constant-time comparison
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return null;
  }

  try {
    const payloadStr = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
    return JSON.parse(payloadStr) as TrustTokenPayload;
  } catch {
    return null;
  }
}

// ============================================
// Token Operations
// ============================================

/**
 * Creates a new trust token for public access.
 * Token is signed and time-limited.
 * Only the hash is stored; the raw token is returned once.
 */
export async function createTrustToken(input: CreateTokenInput): Promise<CreateTokenResult> {
  const supabase = createTrustClient();
  const tokenId = generateTokenId();
  const issuedAt = new Date().toISOString();

  // Validate expiry is in the future
  const expiresAtDate = new Date(input.expiresAt);
  if (expiresAtDate <= new Date()) {
    return { success: false, error: 'Expiration must be in the future' };
  }

  // Max expiry: 90 days
  const maxExpiry = new Date();
  maxExpiry.setDate(maxExpiry.getDate() + 90);
  if (expiresAtDate > maxExpiry) {
    return { success: false, error: 'Maximum token expiry is 90 days' };
  }

  // Build payload
  const payload: TrustTokenPayload = {
    tokenId,
    workspaceId: input.workspaceId,
    scope: {
      profile: input.profile,
      sections: input.sections,
    },
    expiresAt: input.expiresAt,
    issuedAt,
    issuedBy: input.issuedBy,
  };

  // Sign the token
  const token = signPayload(payload);
  const tokenHash = hashToken(token);

  // Store token record (hash only)
  const { error: insertError } = await supabase
    .from('adlab_trust_tokens')
    .insert({
      id: tokenId,
      workspace_id: input.workspaceId,
      token_hash: tokenHash,
      profile: input.profile,
      allowed_sections: input.sections || null,
      expires_at: input.expiresAt,
      issued_at: issuedAt,
      issued_by: input.issuedBy,
      label: input.label || null,
      usage_count: 0,
      last_accessed_at: null,
      revoked_at: null,
      revoked_by: null,
    });

  if (insertError) {
    console.error('D33: Failed to create trust token:', insertError);
    return { success: false, error: 'Failed to create token' };
  }

  // Audit token creation
  await appendAuditLog({
    context: {
      workspaceId: input.workspaceId,
      actorId: input.issuedBy,
      actorRole: 'owner', // Token creation requires owner
    },
    action: 'CREATE',
    entityType: 'trust_token',
    entityId: tokenId,
    scope: {
      platform: 'system',
      dataset: 'trust_tokens',
    },
    metadata: {
      trustAction: 'TRUST_TOKEN_CREATED',
      profile: input.profile,
      sections: input.sections || null,
      expiresAt: input.expiresAt,
      label: input.label || null,
    },
  });

  return {
    success: true,
    token,
    tokenId,
    expiresAt: input.expiresAt,
  };
}

/**
 * Verifies a trust token.
 * Returns the token payload and record if valid.
 * Updates usage count and last access time.
 */
export async function verifyTrustToken(token: string): Promise<VerifyTokenResult> {
  // Verify signature
  const payload = verifySignature(token);
  if (!payload) {
    return { valid: false, error: 'Invalid token signature' };
  }

  // Check expiry
  const expiresAt = new Date(payload.expiresAt);
  if (expiresAt <= new Date()) {
    return { valid: false, error: 'Token expired' };
  }

  // Lookup token record
  const supabase = createTrustClient();
  const tokenHash = hashToken(token);

  const { data: tokenRecord, error: lookupError } = await supabase
    .from('adlab_trust_tokens')
    .select('*')
    .eq('id', payload.tokenId)
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (lookupError || !tokenRecord) {
    return { valid: false, error: 'Token not found' };
  }

  // Check if revoked
  if (tokenRecord.revoked_at) {
    return { valid: false, error: 'Token revoked' };
  }

  // Update usage count and last access
  const now = new Date().toISOString();
  await supabase
    .from('adlab_trust_tokens')
    .update({
      usage_count: tokenRecord.usage_count + 1,
      last_accessed_at: now,
    })
    .eq('id', payload.tokenId);

  // Audit token usage
  await appendAuditLog({
    context: {
      workspaceId: payload.workspaceId,
      actorId: 'public',
      actorRole: 'viewer',
    },
    action: 'VALIDATE',
    entityType: 'trust_token',
    entityId: payload.tokenId,
    scope: {
      platform: 'system',
      dataset: 'trust_tokens',
    },
    metadata: {
      trustAction: 'TRUST_TOKEN_USED',
      profile: payload.scope.profile,
      usageCount: tokenRecord.usage_count + 1,
    },
  });

  // Map to TrustToken type
  const mappedRecord: TrustToken = {
    id: tokenRecord.id,
    workspaceId: tokenRecord.workspace_id,
    tokenHash: tokenRecord.token_hash,
    profile: tokenRecord.profile,
    allowedSections: tokenRecord.allowed_sections,
    expiresAt: tokenRecord.expires_at,
    issuedAt: tokenRecord.issued_at,
    issuedBy: tokenRecord.issued_by,
    revokedAt: tokenRecord.revoked_at,
    revokedBy: tokenRecord.revoked_by,
    usageCount: tokenRecord.usage_count + 1,
    lastAccessedAt: now,
    label: tokenRecord.label,
  };

  return {
    valid: true,
    payload,
    tokenRecord: mappedRecord,
  };
}

/**
 * Revokes a trust token.
 * Revoked tokens are immediately invalid.
 */
export async function revokeTrustToken(
  tokenId: string,
  revokedBy: string,
  workspaceId: string
): Promise<RevokeTokenResult> {
  const supabase = createTrustClient();
  const now = new Date().toISOString();

  // Check token exists and belongs to workspace
  const { data: tokenRecord, error: lookupError } = await supabase
    .from('adlab_trust_tokens')
    .select('id, workspace_id, revoked_at, profile')
    .eq('id', tokenId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (lookupError || !tokenRecord) {
    return { success: false, error: 'Token not found' };
  }

  if (tokenRecord.revoked_at) {
    return { success: false, error: 'Token already revoked' };
  }

  // Revoke
  const { error: updateError } = await supabase
    .from('adlab_trust_tokens')
    .update({
      revoked_at: now,
      revoked_by: revokedBy,
    })
    .eq('id', tokenId);

  if (updateError) {
    return { success: false, error: 'Failed to revoke token' };
  }

  // Audit revocation
  await appendAuditLog({
    context: {
      workspaceId,
      actorId: revokedBy,
      actorRole: 'owner',
    },
    action: 'DELETE',
    entityType: 'trust_token',
    entityId: tokenId,
    scope: {
      platform: 'system',
      dataset: 'trust_tokens',
    },
    metadata: {
      trustAction: 'TRUST_TOKEN_REVOKED',
      profile: tokenRecord.profile,
      revokedAt: now,
    },
  });

  return { success: true };
}

/**
 * Lists all trust tokens for a workspace.
 * For owner/admin use only.
 */
export async function listTrustTokens(workspaceId: string): Promise<{
  success: boolean;
  tokens?: TrustToken[];
  error?: string;
}> {
  const supabase = createTrustClient();

  const { data, error } = await supabase
    .from('adlab_trust_tokens')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('issued_at', { ascending: false });

  if (error) {
    return { success: false, error: 'Failed to list tokens' };
  }

  const tokens: TrustToken[] = (data || []).map((t) => ({
    id: t.id,
    workspaceId: t.workspace_id,
    tokenHash: t.token_hash,
    profile: t.profile,
    allowedSections: t.allowed_sections,
    expiresAt: t.expires_at,
    issuedAt: t.issued_at,
    issuedBy: t.issued_by,
    revokedAt: t.revoked_at,
    revokedBy: t.revoked_by,
    usageCount: t.usage_count,
    lastAccessedAt: t.last_accessed_at,
    label: t.label,
  }));

  return { success: true, tokens };
}

/**
 * Gets a single trust token by ID.
 */
export async function getTrustToken(
  tokenId: string,
  workspaceId: string
): Promise<{
  success: boolean;
  token?: TrustToken;
  error?: string;
}> {
  const supabase = createTrustClient();

  const { data, error } = await supabase
    .from('adlab_trust_tokens')
    .select('*')
    .eq('id', tokenId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error || !data) {
    return { success: false, error: 'Token not found' };
  }

  const token: TrustToken = {
    id: data.id,
    workspaceId: data.workspace_id,
    tokenHash: data.token_hash,
    profile: data.profile,
    allowedSections: data.allowed_sections,
    expiresAt: data.expires_at,
    issuedAt: data.issued_at,
    issuedBy: data.issued_by,
    revokedAt: data.revoked_at,
    revokedBy: data.revoked_by,
    usageCount: data.usage_count,
    lastAccessedAt: data.last_accessed_at,
    label: data.label,
  };

  return { success: true, token };
}

/**
 * Cleans up expired tokens.
 * For scheduled cleanup jobs.
 */
export async function cleanupExpiredTokens(): Promise<{
  success: boolean;
  deletedCount?: number;
  error?: string;
}> {
  const supabase = createTrustClient();
  const now = new Date().toISOString();

  // Delete tokens expired more than 30 days ago
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const { data, error } = await supabase
    .from('adlab_trust_tokens')
    .delete()
    .lt('expires_at', cutoff.toISOString())
    .select('id');

  if (error) {
    return { success: false, error: 'Failed to cleanup tokens' };
  }

  return { success: true, deletedCount: data?.length || 0 };
}
