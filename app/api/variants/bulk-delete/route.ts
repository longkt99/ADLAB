import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

// DELETE /api/variants/bulk-delete
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { variant_ids } = body;

    // Validate input
    if (!variant_ids || !Array.isArray(variant_ids) || variant_ids.length === 0) {
      return NextResponse.json(
        { error: 'variant_ids array is required and must not be empty' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    // Perform bulk delete
    const { error } = await supabase
      .from('variants')
      .delete()
      .in('id', variant_ids);

    if (error) {
      console.error('Bulk delete error:', error);
      return NextResponse.json(
        { error: 'Failed to delete variants', details: error.message },
        { status: 500 }
      );
    }

    console.log(`✅ Bulk delete: Deleted ${variant_ids.length} variants`);

    return NextResponse.json({
      success: true,
      deleted_count: variant_ids.length,
    });
  } catch (error: unknown) {
    console.error('Bulk delete error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete variants' },
      { status: 500 }
    );
  }
}
