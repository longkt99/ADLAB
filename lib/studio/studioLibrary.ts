// ============================================
// AI Studio Library Service Layer
// ============================================
// Manages saved AI-generated content from the Studio
// Provides CRUD operations for studio_saved_posts table
//
// TYPESCRIPT NOTE:
// If you see TypeScript errors like "Argument of type '...' is not assignable to parameter of type 'never'",
// this is because the Supabase generated types don't include the studio_saved_posts table yet.
//
// SOLUTION (Recommended):
// 1. Run the SQL migration to create the table (see migration script in docs)
// 2. Regenerate Supabase types:
//    npx supabase gen types typescript --project-id <YOUR_PROJECT_ID> > lib/database.types.ts
//    OR if using linked project:
//    npx supabase gen types typescript --linked > lib/database.types.ts
// 3. Import and use the Database type from lib/database.types.ts
//
// TEMPORARY WORKAROUND (if you can't regenerate types yet):
// Use type assertion: .from('studio_saved_posts' as any)
// This is safe at runtime but bypasses type checking.

import { supabase } from '@/lib/supabase';

/**
 * Helper: Check if error is due to missing table
 * Checks both PostgREST error codes and error messages for robustness
 */
function isMissingTableError(error: { code?: string; message?: string }): boolean {
  // Check PostgREST error codes that indicate missing table/schema issues
  if (error.code && (
    error.code === 'PGRST106' || // PostgREST schema cache errors
    error.code === 'PGRST204' ||
    error.code === 'PGRST205' ||
    error.code === '42P01'       // PostgreSQL: undefined_table
  )) {
    return true;
  }

  // Fallback to message check for cases where error code isn't set
  if (error.message && typeof error.message === 'string') {
    return (
      error.message.includes('Could not find the table') ||
      error.message.includes('schema cache') ||
      (error.message.includes('relation') && error.message.includes('does not exist'))
    );
  }

  return false;
}

/**
 * Represents a saved post from the AI Studio
 */
export type StudioSavedPost = {
  id: string;
  created_by?: string | null;
  title: string;
  preview: string;
  content: string;
  source: 'studio' | 'template' | 'imported';
  meta?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/**
 * Save AI-generated content to the library
 *
 * @param args.content - Full AI-generated content (required)
 * @param args.title - Custom title (optional, derived from content if not provided)
 * @param args.meta - Metadata like toneId, useCaseId, language, platforms, etc.
 * @returns The saved post with all fields
 */
export async function saveStudioPost(args: {
  content: string;
  title?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase Json type requires any
  meta?: Record<string, any>;
}): Promise<StudioSavedPost> {
  const { content, title, meta } = args;

  // Validate required fields
  if (!content || !content.trim()) {
    throw new Error('Content is required to save a post');
  }

  // Auto-generate title from first 60 characters if not provided
  const derivedTitle = title?.trim() || deriveTitle(content);

  // Generate preview from first 160-200 characters
  const preview = derivePreview(content);

  // Prepare insert payload
  const insertPayload = {
    title: derivedTitle,
    preview,
    content: content.trim(),
    source: 'studio' as const,
    meta: meta || {},
  };

  // Insert into database
  const { data, error } = await supabase
    .from('studio_saved_posts')
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    // Graceful handling for missing table during development
    if (isMissingTableError(error)) {
      console.warn('[Studio Library] Table studio_saved_posts does not exist yet. Run the SQL migration to create it.');
      throw new Error('Cannot save post: Database table not yet created. Please run the migration.');
    }
    console.error('[Studio Library] Error saving post:', error);
    throw new Error(`Failed to save post: ${error.message}`);
  }

  if (!data) {
    throw new Error('Failed to save post: No data returned');
  }

  return data as StudioSavedPost;
}

/**
 * List saved posts from the library
 *
 * @param args.limit - Maximum number of posts to return (default: 20)
 * @param args.source - Filter by source type (optional)
 * @returns Array of saved posts ordered by created_at DESC
 */
export async function listStudioPosts(args?: {
  limit?: number;
  source?: 'studio' | 'template' | 'imported';
}): Promise<StudioSavedPost[]> {
  const limit = args?.limit || 20;
  const source = args?.source;

  // Build query
  let query = supabase
    .from('studio_saved_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  // Apply source filter if provided
  if (source) {
    query = query.eq('source', source);
  }

  // Execute query
  const { data, error } = await query;

  if (error) {
    // Graceful handling for missing table during development
    if (isMissingTableError(error)) {
      console.warn('[Studio Library] Table studio_saved_posts does not exist yet. Returning empty array. Run the SQL migration to create it.');
      return [];
    }
    console.error('[Studio Library] Error listing posts:', error);
    throw new Error(`Failed to list posts: ${error.message}`);
  }

  return (data || []) as StudioSavedPost[];
}

/**
 * Get a single saved post by ID
 *
 * @param id - UUID of the saved post
 * @returns The saved post or null if not found
 */
export async function getStudioPost(id: string): Promise<StudioSavedPost | null> {
  if (!id || !id.trim()) {
    throw new Error('Post ID is required');
  }

  const { data, error } = await supabase
    .from('studio_saved_posts')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    // If not found, return null instead of throwing
    if (error.code === 'PGRST116') {
      return null;
    }
    // Graceful handling for missing table during development
    if (isMissingTableError(error)) {
      console.warn('[Studio Library] Table studio_saved_posts does not exist yet. Run the SQL migration to create it.');
      return null;
    }
    console.error('[Studio Library] Error fetching post:', error);
    throw new Error(`Failed to fetch post: ${error.message}`);
  }

  return data as StudioSavedPost;
}

/**
 * Delete a saved post by ID
 *
 * @param id - UUID of the saved post to delete
 * @returns Success status
 */
export async function deleteStudioPost(id: string): Promise<{ success: boolean }> {
  if (!id || !id.trim()) {
    throw new Error('Post ID is required');
  }

  const { error } = await supabase
    .from('studio_saved_posts')
    .delete()
    .eq('id', id);

  if (error) {
    // Graceful handling for missing table during development
    if (isMissingTableError(error)) {
      console.warn('[Studio Library] Table studio_saved_posts does not exist yet. Run the SQL migration to create it.');
      throw new Error('Cannot delete post: Database table not yet created. Please run the migration.');
    }
    console.error('[Studio Library] Error deleting post:', error);
    throw new Error(`Failed to delete post: ${error.message}`);
  }

  return { success: true };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Derive a title from content (first 60 characters)
 */
function deriveTitle(content: string): string {
  const cleaned = content.trim().replace(/\n+/g, ' ').replace(/\s+/g, ' ');

  if (cleaned.length <= 60) {
    return cleaned;
  }

  // Try to cut at word boundary
  const truncated = cleaned.substring(0, 60);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > 40) {
    return truncated.substring(0, lastSpace) + '...';
  }

  return truncated + '...';
}

/**
 * Derive a preview from content (first 160-200 characters)
 */
function derivePreview(content: string): string {
  const cleaned = content.trim().replace(/\n+/g, ' ').replace(/\s+/g, ' ');

  if (cleaned.length <= 200) {
    return cleaned;
  }

  // Try to cut at word boundary between 160-200 chars
  const truncated = cleaned.substring(0, 200);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > 160) {
    return truncated.substring(0, lastSpace) + '...';
  }

  return truncated + '...';
}
