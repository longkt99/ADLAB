// Core type definitions for Content Machine
import type { Platform } from './platforms';

export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';
export type VariantStatus = 'draft' | 'approved' | 'scheduled' | 'published' | 'failed';
export type Language = 'vi' | 'en' | 'both';

// Database models
export interface Post {
  id: string;
  title: string;
  content: string;
  status: PostStatus;
  scheduled_time: string | null;
  cover_image_url: string | null;
  platforms: Platform[] | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Variant {
  id: string;
  base_post_id: string;
  platform: Platform;
  language: Language;
  content: string;
  character_count: number | null;
  status: VariantStatus;
  scheduled_at: string | null;
  published_at: string | null;
  platform_post_url: string | null;
  created_at: string;
}

// Composite types
export interface PostWithVariants extends Post {
  variants: Variant[];
}

// API input types
export interface CreatePostInput {
  title: string;
  content: string;
  status?: PostStatus;
  scheduled_time?: string | null;
  cover_image_url?: string | null;
  platforms?: Platform[] | null;
}

export interface UpdatePostInput {
  title?: string;
  content?: string;
  status?: PostStatus;
  scheduled_time?: string | null;
  cover_image_url?: string | null;
  platforms?: Platform[] | null;
}

export interface CreateVariantInput {
  base_post_id: string;
  platform: Platform;
  language: Language;
  content: string;
  character_count?: number | null;
  status?: VariantStatus;
  scheduled_at?: string | null;
  published_at?: string | null;
  platform_post_url?: string | null;
}

export interface UpdateVariantStatusInput {
  status: VariantStatus;
}

export interface ScheduleVariantInput {
  scheduled_at: string; // ISO datetime string
}

// API request/response types
export interface GenerateVariantsRequest {
  platforms?: Platform[];
  languages?: Language[];
}

export interface GenerateVariantsResponse {
  success: boolean;
  variants?: Variant[];
  error?: string;
}

export interface GeneratedVariantData {
  platform: Platform;
  language: Language;
  content: string;
  approx_char_count: number;
}

// Form state types
export interface PostFormData {
  title: string;
  content: string;
  status: PostStatus;
  scheduled_time: string;
  cover_image_url: string;
  platforms: Platform[];
}

// Export Platform type for convenience
export type { Platform };
