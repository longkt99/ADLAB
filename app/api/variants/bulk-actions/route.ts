import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import type { VariantStatus } from '@/lib/types';

// PATCH /api/variants/bulk-actions
// Perform bulk operations on multiple variants
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { variant_ids, action, scheduled_at } = body;

    // Validate input
    if (!variant_ids || !Array.isArray(variant_ids) || variant_ids.length === 0) {
      return NextResponse.json(
        { error: 'variant_ids array is required and must not be empty' },
        { status: 400 }
      );
    }

    if (!action || !['approve', 'schedule', 'publish'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be one of: approve, schedule, publish' },
        { status: 400 }
      );
    }

    // Validate scheduled_at for schedule action
    if (action === 'schedule') {
      if (!scheduled_at) {
        return NextResponse.json(
          { error: 'scheduled_at is required for schedule action' },
          { status: 400 }
        );
      }

      const scheduledDate = new Date(scheduled_at);
      if (isNaN(scheduledDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid date format for scheduled_at' },
          { status: 400 }
        );
      }

      if (scheduledDate <= new Date()) {
        return NextResponse.json(
          { error: 'scheduled_at must be in the future' },
          { status: 400 }
        );
      }
    }

    const supabase = getServiceSupabase();
    const now = new Date().toISOString();

    // ============================================
    // Prepare Update Data Based on Action
    // ============================================
    let updateData: any = {};
    let newStatus: VariantStatus;

    switch (action) {
      case 'approve':
        newStatus = 'approved';
        updateData = {
          status: newStatus,
        };
        break;

      case 'schedule':
        newStatus = 'scheduled';
        updateData = {
          status: newStatus,
          scheduled_at,
        };
        break;

      case 'publish':
        newStatus = 'published';
        updateData = {
          status: newStatus,
          published_at: now,
          published_error: null, // Clear any previous errors
        };
        break;
    }

    // ============================================
    // Perform Bulk Update
    // ============================================
    const { data: updatedVariants, error: updateError } = await supabase
      .from('variants')
      .update(updateData)
      .in('id', variant_ids)
      .select('id, platform, status, scheduled_at, published_at');

    if (updateError) {
      console.error('Bulk update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update variants', details: updateError.message },
        { status: 500 }
      );
    }

    if (!updatedVariants || updatedVariants.length === 0) {
      return NextResponse.json(
        { error: 'No variants were updated. Check if variant IDs are valid.' },
        { status: 404 }
      );
    }

    // ============================================
    // Log Success
    // ============================================
    console.log(`✅ Bulk ${action}: Updated ${updatedVariants.length} variants`);

    return NextResponse.json({
      success: true,
      action,
      updated_count: updatedVariants.length,
      variants: updatedVariants,
    });
  } catch (error: any) {
    console.error('Bulk action error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to perform bulk action' },
      { status: 500 }
    );
  }
}
