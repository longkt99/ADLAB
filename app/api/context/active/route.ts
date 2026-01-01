// ============================================
// Active Context API Route
// ============================================
// POST: Set active workspace and client context via cookies
// GET: Get current active context
// ============================================

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE_WORKSPACE_ID, COOKIE_CLIENT_ID } from '@/lib/context/getActiveContext';

// Cookie options for 30 day persistence
const COOKIE_OPTIONS = {
  httpOnly: false, // Client needs to read for optimistic UI
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 30, // 30 days
  path: '/',
};

/**
 * POST /api/context/active
 * Sets the active workspace and/or client context
 * Body: { workspaceId?: string, clientId?: string | 'all' }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { workspaceId, clientId } = body;

    const cookieStore = await cookies();

    // Set workspace cookie if provided
    if (workspaceId !== undefined) {
      if (workspaceId === null) {
        cookieStore.delete(COOKIE_WORKSPACE_ID);
      } else {
        cookieStore.set(COOKIE_WORKSPACE_ID, workspaceId, COOKIE_OPTIONS);
      }
    }

    // Set client cookie if provided
    if (clientId !== undefined) {
      if (clientId === null) {
        cookieStore.delete(COOKIE_CLIENT_ID);
      } else {
        cookieStore.set(COOKIE_CLIENT_ID, clientId, COOKIE_OPTIONS);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Context API error:', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Failed to set context' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/context/active
 * Returns the current active context from cookies
 */
export async function GET() {
  try {
    const cookieStore = await cookies();

    const workspaceId = cookieStore.get(COOKIE_WORKSPACE_ID)?.value || null;
    const clientId = cookieStore.get(COOKIE_CLIENT_ID)?.value || null;

    return NextResponse.json({
      workspaceId,
      clientId,
    });
  } catch (e) {
    console.error('Context API error:', e);
    return NextResponse.json(
      { workspaceId: null, clientId: null },
      { status: 200 } // Fail-open: return nulls instead of error
    );
  }
}
