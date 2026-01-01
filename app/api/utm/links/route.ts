// ============================================
// UTM Links API Route
// ============================================
// POST: Create a new UTM link
// ============================================

import { NextResponse } from 'next/server';
import { createUtmLink, type CreateUtmLinkInput } from '@/lib/utm/queries';
import { getSupabaseConnectivityError, toApiError } from '@/lib/utils/supabaseError';

export async function POST(request: Request) {
  // Check connectivity state first - return 503 if unreachable
  const cachedError = getSupabaseConnectivityError();
  if (cachedError) {
    return NextResponse.json(toApiError(cachedError), { status: 503 });
  }

  try {
    const body = await request.json();

    // Validate required fields
    const { workspace_id, base_url, utm_source, utm_medium, utm_campaign } = body;

    if (!workspace_id) {
      return NextResponse.json(
        { error: 'workspace_id is required' },
        { status: 400 }
      );
    }

    if (!base_url) {
      return NextResponse.json(
        { error: 'base_url is required' },
        { status: 400 }
      );
    }

    if (!utm_source) {
      return NextResponse.json(
        { error: 'utm_source is required' },
        { status: 400 }
      );
    }

    if (!utm_medium) {
      return NextResponse.json(
        { error: 'utm_medium is required' },
        { status: 400 }
      );
    }

    if (!utm_campaign) {
      return NextResponse.json(
        { error: 'utm_campaign is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(base_url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid base_url format' },
        { status: 400 }
      );
    }

    const input: CreateUtmLinkInput = {
      workspace_id,
      name: body.name || undefined,
      base_url,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content: body.utm_content || undefined,
      utm_term: body.utm_term || undefined,
      tags: body.tags || [],
    };

    const { data, error } = await createUtmLink(input);

    if (error) {
      // Check if this is a connectivity error
      if (error.includes('Cannot connect to Supabase')) {
        return NextResponse.json({ ok: false, error }, { status: 503 });
      }
      return NextResponse.json(
        { error },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal server error';
    // Check if this is a connectivity error
    if (msg.includes('fetch failed') || msg.includes('ECONNREFUSED')) {
      return NextResponse.json({ ok: false, error: msg }, { status: 503 });
    }
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
