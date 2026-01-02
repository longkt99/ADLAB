// ============================================
// AdLab Ingestion Upload API
// ============================================
// Marketing Laboratory v2.0: File Upload Endpoint
//
// POST: Upload a file and create a data_uploads record
// - Stores file content (stub: no actual storage yet)
// - Creates record in data_uploads table
// - Returns upload ID for tracking
//
// Phase 1: Record creation only (no parsing)
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getActiveContextIds } from '@/lib/context/getActiveContext';

// Supported platforms
const VALID_PLATFORMS = ['facebook', 'google', 'tiktok', 'meta', 'linkedin'] as const;
type PlatformType = typeof VALID_PLATFORMS[number];

interface UploadRequest {
  content: string; // CSV content
  fileName: string;
  fileSize: number;
  platform: PlatformType;
  clientId?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const body: UploadRequest = await request.json();

    // Validate required fields
    if (!body.content) {
      return NextResponse.json(
        { error: 'File content is required' },
        { status: 400 }
      );
    }

    if (!body.fileName) {
      return NextResponse.json(
        { error: 'File name is required' },
        { status: 400 }
      );
    }

    if (!body.platform || !VALID_PLATFORMS.includes(body.platform)) {
      return NextResponse.json(
        { error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(', ')}` },
        { status: 400 }
      );
    }

    // Get active context
    const { workspaceId } = await getActiveContextIds();

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'No workspace context. Please select a workspace.' },
        { status: 400 }
      );
    }

    // Count rows in content (for row_count field)
    const lines = body.content.split('\n').filter(line => line.trim());
    const rowCount = Math.max(0, lines.length - 1); // Subtract header row

    // Generate storage path (stub - no actual storage yet)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const storagePath = `/${workspaceId}/${body.platform}/${timestamp}-${body.fileName}`;

    // Create record in data_uploads
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('data_uploads')
      .insert({
        workspace_id: workspaceId,
        client_id: body.clientId || null,
        platform: body.platform,
        filename: body.fileName,
        file_size: body.fileSize || body.content.length,
        row_count: rowCount,
        status: 'pending',
        storage_path: storagePath,
        error_log: [],
        summary: {},
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create upload record:', error);
      return NextResponse.json(
        { error: 'Failed to create upload record' },
        { status: 500 }
      );
    }

    // TODO: Phase 2 - Actually store file content in Supabase Storage
    // For now, we just create the record

    return NextResponse.json({
      success: true,
      upload: {
        id: data.id,
        status: data.status,
        storagePath: data.storage_path,
        rowCount: data.row_count,
      },
      message: `Upload recorded. ${rowCount} data rows detected.`,
    });
  } catch (e) {
    console.error('Ingestion upload error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

/**
 * GET: List recent uploads for the current workspace
 * Fail-open: returns all uploads if no workspace context (demo mode)
 */
export async function GET(_request: NextRequest) {
  try {
    const { workspaceId, clientId } = await getActiveContextIds();

    const supabase = createServerSupabaseClient();

    // Start with base query - order by created_at desc, limit 50
    let query = supabase
      .from('data_uploads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    // Filter by workspace_id IF present (fail-open: show all if no context)
    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }

    // Filter by client_id ONLY when specified AND not 'all'
    if (clientId && clientId !== 'all') {
      query = query.eq('client_id', clientId);
    }

    // No default date filter - show all uploads unless explicitly requested
    // Future: add ?days=7 query param support if needed

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch uploads:', error);
      // Fail-open: return empty array instead of error
      return NextResponse.json({ uploads: [] });
    }

    return NextResponse.json({
      uploads: data || [],
    });
  } catch (e) {
    console.error('Ingestion list error:', e);
    // Fail-open: return empty array on exception
    return NextResponse.json({ uploads: [] });
  }
}
