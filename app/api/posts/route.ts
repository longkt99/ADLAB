import { NextRequest, NextResponse } from 'next/server';
import { createPost } from '@/lib/api/posts';
import type { CreatePostInput } from '@/lib/types';

// POST /api/posts - Create a new post
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const input: CreatePostInput = {
      title: body.title,
      content: body.content,
      status: body.status || 'draft',
      scheduled_time: body.scheduled_time || null,
      cover_image_url: body.cover_image_url || null,
      platforms: body.platforms || null,
    };

    // Validate required fields
    if (!input.title || !input.content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      );
    }

    const post = await createPost(input);

    return NextResponse.json(
      { success: true, post },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('Create post error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create post' },
      { status: 500 }
    );
  }
}
