import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import type { ScheduleVariantInput } from '@/lib/types';

// PATCH /api/variants/[id]/schedule
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const body: ScheduleVariantInput = await request.json();
    const { scheduled_at } = body;

    // Validate scheduled_at
    if (!scheduled_at) {
      return NextResponse.json(
        { error: 'scheduled_at is required' },
        { status: 400 }
      );
    }

    // Validate it's a valid date
    const scheduledDate = new Date(scheduled_at);
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format for scheduled_at' },
        { status: 400 }
      );
    }

    // Validate it's in the future
    if (scheduledDate <= new Date()) {
      return NextResponse.json(
        { error: 'scheduled_at must be in the future' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    // Update the variant with scheduled_at and status
    const { data: variant, error } = await supabase
      .from('variants')
      .update({
        scheduled_at,
        status: 'scheduled',
      })
      .eq('id', resolvedParams.id)
      .select()
      .single();

    if (error) {
      console.error('Supabase update error:', error);
      return NextResponse.json(
        { error: 'Failed to schedule variant' },
        { status: 500 }
      );
    }

    if (!variant) {
      return NextResponse.json(
        { error: 'Variant not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      variant,
    });
  } catch (error: any) {
    console.error('Schedule variant error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to schedule variant' },
      { status: 500 }
    );
  }
}
