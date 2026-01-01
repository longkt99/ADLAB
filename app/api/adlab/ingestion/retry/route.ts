// ============================================
// AdLab Ingestion Retry API
// ============================================
// Marketing Laboratory v2.0: Retry Failed Uploads
//
// POST: Retry a failed upload
// - Updates status to 'retrying'
// - (Phase 2: Re-processes the file)
// - Returns updated status
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getActiveContextIds } from '@/lib/context/getActiveContext';

interface RetryRequest {
  uploadId: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RetryRequest = await request.json();

    if (!body.uploadId) {
      return NextResponse.json(
        { error: 'Upload ID is required' },
        { status: 400 }
      );
    }

    const { workspaceId } = await getActiveContextIds();

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'No workspace context' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    // First, verify the upload exists and belongs to this workspace
    const { data: existing, error: fetchError } = await supabase
      .from('data_uploads')
      .select('id, status, workspace_id')
      .eq('id', body.uploadId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Upload not found' },
        { status: 404 }
      );
    }

    // Verify workspace ownership
    if (existing.workspace_id !== workspaceId) {
      return NextResponse.json(
        { error: 'Upload not found in current workspace' },
        { status: 404 }
      );
    }

    // Only allow retry for failed uploads
    if (existing.status !== 'failed') {
      return NextResponse.json(
        { error: `Cannot retry upload with status '${existing.status}'. Only failed uploads can be retried.` },
        { status: 400 }
      );
    }

    // Update status to 'retrying'
    const { data, error } = await supabase
      .from('data_uploads')
      .update({
        status: 'retrying',
        error_message: null,
        error_log: [],
        processed_at: null,
      })
      .eq('id', body.uploadId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update upload status:', error);
      return NextResponse.json(
        { error: 'Failed to initiate retry' },
        { status: 500 }
      );
    }

    // TODO: Phase 2 - Actually re-process the file
    // For now, we just mark it as retrying and simulate completion

    // Simulate processing (in Phase 2, this would be actual parsing)
    // For now, mark as completed after "retry"
    setTimeout(async () => {
      try {
        await supabase
          .from('data_uploads')
          .update({
            status: 'completed',
            processed_at: new Date().toISOString(),
            summary: { retried: true, message: 'Retry successful (simulated)' },
          })
          .eq('id', body.uploadId);
      } catch (e) {
        console.error('Failed to complete retry simulation:', e);
      }
    }, 2000);

    return NextResponse.json({
      success: true,
      upload: {
        id: data.id,
        status: data.status,
      },
      message: 'Retry initiated. Processing will complete shortly.',
    });
  } catch (e) {
    console.error('Ingestion retry error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Retry failed' },
      { status: 500 }
    );
  }
}
