import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

// GET /api/posts/[id]/variants - Get all variants for a post
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params in Next.js 15+
    const { id } = await params;

    console.log('📦 Fetching variants for post:', id);

    const supabase = getServiceSupabase();

    // Query variants for this post
    const { data: variants, error } = await supabase
      .from('variants')
      .select('*')
      .eq('base_post_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch variants:', error);
      return NextResponse.json(
        { error: 'Failed to fetch variants', details: error.message },
        { status: 500 }
      );
    }

    console.log(`✅ Found ${variants?.length || 0} variants`);

    return NextResponse.json({
      success: true,
      variants: variants || [],
    });
  } catch (error: unknown) {
    console.error('Get variants error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch variants' },
      { status: 500 }
    );
  }
}
