// Data access layer for posts
import { createServerClient } from '../supabase';
import type { Post, CreatePostInput, UpdatePostInput } from '../types';

// Get all posts with optional filtering
export async function getAllPosts(options?: {
  status?: string;
  limit?: number;
  orderBy?: 'created_at' | 'updated_at';
  order?: 'asc' | 'desc';
}): Promise<Post[]> {
  const supabase = createServerClient();

  let query = supabase
    .from('posts')
    .select('*');

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  const orderBy = options?.orderBy || 'created_at';
  const order = options?.order || 'desc';
  query = query.order(orderBy, { ascending: order === 'asc' });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch posts: ${error.message}`);
  }

  return (data as Post[]) || [];
}

// Get a single post by ID
export async function getPostById(id: string): Promise<Post | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Post not found
    }
    throw new Error(`Failed to fetch post: ${error.message}`);
  }

  return data as Post;
}

// Create a new post
export async function createPost(input: CreatePostInput): Promise<Post> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('posts')
    .insert({
      title: input.title,
      content: input.content,
      status: input.status || 'draft',
      scheduled_time: input.scheduled_time || null,
      cover_image_url: input.cover_image_url || null,
      platforms: input.platforms || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create post: ${error.message}`);
  }

  return data as Post;
}

// Update an existing post
export async function updatePost(
  id: string,
  input: UpdatePostInput
): Promise<Post> {
  const supabase = createServerClient();

  const updateData: Record<string, any> = {};

  if (input.title !== undefined) updateData.title = input.title;
  if (input.content !== undefined) updateData.content = input.content;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.scheduled_time !== undefined) {
    updateData.scheduled_time = input.scheduled_time;
  }
  if (input.cover_image_url !== undefined) {
    updateData.cover_image_url = input.cover_image_url;
  }
  if (input.platforms !== undefined) updateData.platforms = input.platforms;

  const { data, error } = await supabase
    .from('posts')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update post: ${error.message}`);
  }

  return data as Post;
}

// Delete a post (variants will be cascade deleted)
export async function deletePost(id: string): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase.from('posts').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete post: ${error.message}`);
  }
}

// Get posts scheduled for publishing
export async function getScheduledPosts(before?: Date): Promise<Post[]> {
  const supabase = createServerClient();

  let query = supabase
    .from('posts')
    .select('*')
    .eq('status', 'scheduled')
    .not('scheduled_time', 'is', null);

  if (before) {
    query = query.lte('scheduled_time', before.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch scheduled posts: ${error.message}`);
  }

  return (data as Post[]) || [];
}
