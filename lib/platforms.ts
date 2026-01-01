// Platform definitions for Content Machine multi-platform engine
// Optimized for Tà Xùa Tour brand

export type Platform =
  | 'twitter_x'
  | 'instagram_post'
  | 'threads'
  | 'bluesky'
  | 'linkedin'
  | 'google'
  | 'pinterest'
  | 'youtube_community';

export const PLATFORMS: Platform[] = [
  'twitter_x',
  'instagram_post',
  'threads',
  'bluesky',
  'linkedin',
  'google',
  'pinterest',
  'youtube_community',
];

export const PLATFORM_CHAR_LIMITS: Record<Platform, number | null> = {
  twitter_x: 280,
  instagram_post: 2200,
  threads: 500,
  bluesky: 300,
  linkedin: 3000,
  google: 1500,
  pinterest: 500,
  youtube_community: 5000,
};

export const PLATFORM_DISPLAY_NAMES: Record<Platform, string> = {
  twitter_x: 'X (Twitter)',
  instagram_post: 'Instagram',
  threads: 'Threads',
  bluesky: 'Bluesky',
  linkedin: 'LinkedIn',
  google: 'Google Post',
  pinterest: 'Pinterest',
  youtube_community: 'YouTube',
};

// Helper function to get character limit for a platform
export function getPlatformCharLimit(platform: Platform): number | null {
  return PLATFORM_CHAR_LIMITS[platform];
}

// Helper function to format platform name for display
export function getPlatformDisplayName(platform: Platform): string {
  return PLATFORM_DISPLAY_NAMES[platform];
}

// Helper function to validate if content fits platform constraints
export function isContentValid(content: string, platform: Platform): boolean {
  const limit = PLATFORM_CHAR_LIMITS[platform];
  if (limit === null) return true;
  return content.length <= limit;
}
