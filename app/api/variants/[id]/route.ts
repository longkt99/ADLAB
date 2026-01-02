import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

// DELETE /api/variants/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getServiceSupabase();

    const { error } = await supabase
      .from('variants')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase delete error:', error);
      return NextResponse.json(
        { error: 'Failed to delete variant' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Variant deleted successfully',
    });
  } catch (error: unknown) {
    console.error('Delete variant error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete variant' },
      { status: 500 }
    );
  }
}
