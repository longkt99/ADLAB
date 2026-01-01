import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import type { UpdateVariantStatusInput, VariantStatus } from '@/lib/types';

// PATCH /api/variants/[id]/status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const body: UpdateVariantStatusInput = await request.json();
    const { status } = body;

    // Validate status
    const validStatuses: VariantStatus[] = ['draft', 'approved', 'published'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be one of: draft, approved, published' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    // Prepare update data
    const updateData: any = { status };

    // If status is being changed to 'published', set published_at timestamp
    if (status === 'published') {
      updateData.published_at = new Date().toISOString();
    }

    // Update the variant
    const { data: variant, error } = await supabase
      .from('variants')
      .update(updateData)
      .eq('id', resolvedParams.id)
      .select()
      .single();

    if (error) {
      console.error('Supabase update error:', error);
      return NextResponse.json(
        { error: 'Failed to update variant status' },
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
    console.error('Update variant status error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update variant status' },
      { status: 500 }
    );
  }
}
