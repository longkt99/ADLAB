import { NextRequest, NextResponse } from 'next/server';
import { getPostById, updatePost, deletePost } from '@/lib/api/posts';
import type { UpdatePostInput } from '@/lib/types';

// GET /api/posts/[id] - Get a single post
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params in Next.js 15+
    const { id } = await params;

    const post = await getPostById(id);

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ post });
  } catch (error: unknown) {
    console.error('Get post error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch post';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

// PATCH /api/posts/[id] - Update a post
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params in Next.js 15+
    const { id } = await params;

    const body = await request.json();

    const input: UpdatePostInput = {};

    if (body.title !== undefined) input.title = body.title;
    if (body.content !== undefined) input.content = body.content;
    if (body.status !== undefined) input.status = body.status;
    if (body.scheduled_time !== undefined) {
      input.scheduled_time = body.scheduled_time;
    }
    if (body.cover_image_url !== undefined) {
      input.cover_image_url = body.cover_image_url;
    }
    if (body.platforms !== undefined) input.platforms = body.platforms;

    const post = await updatePost(id, input);

    return NextResponse.json({ success: true, post });
  } catch (error: unknown) {
    console.error('Update post error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update post';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

// DELETE /api/posts/[id] - Delete a post
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params in Next.js 15+
    const { id } = await params;

    await deletePost(id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Delete post error:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete post';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
