// Data access layer for variants
import { createServerClient } from '../supabase';
import type { Variant, CreateVariantInput, Platform } from '../types';

// Get all variants for a post
export async function getVariantsByPostId(
  postId: string
): Promise<Variant[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('variants')
    .select('*')
    .eq('base_post_id', postId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch variants: ${error.message}`);
  }

  return (data as Variant[]) || [];
}

// Get a single variant by ID
export async function getVariantById(id: string): Promise<Variant | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('variants')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Variant not found
    }
    throw new Error(`Failed to fetch variant: ${error.message}`);
  }

  return data as Variant;
}

// Create a new variant
export async function createVariant(
  input: CreateVariantInput
): Promise<Variant> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('variants')
    .insert({
      base_post_id: input.base_post_id,
      platform: input.platform,
      language: input.language,
      content: input.content,
      character_count: input.character_count || input.content.length,
      status: input.status || 'draft',
      scheduled_at: input.scheduled_at || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create variant: ${error.message}`);
  }

  return data as Variant;
}

// Create multiple variants at once
export async function createVariants(
  inputs: CreateVariantInput[]
): Promise<Variant[]> {
  const supabase = createServerClient();

  const insertData = inputs.map((input) => ({
    base_post_id: input.base_post_id,
    platform: input.platform,
    language: input.language,
    content: input.content,
    character_count: input.character_count || input.content.length,
    status: input.status || 'draft',
    scheduled_at: input.scheduled_at || null,
  }));

  const { data, error } = await supabase
    .from('variants')
    .insert(insertData)
    .select();

  if (error) {
    throw new Error(`Failed to create variants: ${error.message}`);
  }

  return (data as Variant[]) || [];
}

// Update a variant
export async function updateVariant(
  id: string,
  updates: Partial<Omit<Variant, 'id' | 'base_post_id' | 'created_at'>>
): Promise<Variant> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('variants')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update variant: ${error.message}`);
  }

  return data as Variant;
}

// Delete a variant
export async function deleteVariant(id: string): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase.from('variants').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete variant: ${error.message}`);
  }
}

// Get variants by platform
export async function getVariantsByPlatform(
  platform: Platform
): Promise<Variant[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('variants')
    .select('*')
    .eq('platform', platform)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch variants by platform: ${error.message}`);
  }

  return (data as Variant[]) || [];
}

// Get scheduled variants ready for publishing
export async function getScheduledVariants(before?: Date): Promise<Variant[]> {
  const supabase = createServerClient();

  let query = supabase
    .from('variants')
    .select('*')
    .eq('status', 'scheduled')
    .not('scheduled_time', 'is', null);

  if (before) {
    query = query.lte('scheduled_time', before.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch scheduled variants: ${error.message}`);
  }

  return (data as Variant[]) || [];
}

// Group variants by platform for display
export function groupVariantsByPlatform(
  variants: Variant[]
): Record<Platform, Variant[]> {
  return variants.reduce((acc, variant) => {
    const platform = variant.platform as Platform;
    if (!acc[platform]) {
      acc[platform] = [];
    }
    acc[platform].push(variant);
    return acc;
  }, {} as Record<Platform, Variant[]>);
}
