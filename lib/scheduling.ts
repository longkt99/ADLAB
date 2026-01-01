// Scheduling utilities for Content Machine
// This module handles scheduling logic for posts and variants

import { getScheduledPosts } from './api/posts';
import { getScheduledVariants, updateVariant } from './api/variants';
import { scheduleVariantToMetricool } from './integrations/metricool';
import type { Post, Variant } from './types';

/**
 * Get all posts that are due for publishing
 * @param now Current date/time (defaults to now)
 * @returns Array of posts scheduled before the given time
 */
export async function getDuePostsForPublish(now: Date = new Date()): Promise<Post[]> {
  return await getScheduledPosts(now);
}

/**
 * Get all variants that are due for publishing
 * @param now Current date/time (defaults to now)
 * @returns Array of variants scheduled before the given time
 */
export async function getDueVariantsForPublish(now: Date = new Date()): Promise<Variant[]> {
  return await getScheduledVariants(now);
}

/**
 * Mark a variant as published
 * @param id Variant ID
 */
export async function markVariantAsPublished(id: string): Promise<void> {
  await updateVariant(id, {
    status: 'published',
  });
}

/**
 * Mark a variant as failed
 * @param id Variant ID
 */
export async function markVariantAsFailed(id: string): Promise<void> {
  await updateVariant(id, {
    status: 'failed',
  });
}

/**
 * Process a single variant for publishing
 * This is where the actual publishing logic would happen
 * @param variant The variant to publish
 * @returns Success status
 */
export async function processVariantPublish(variant: Variant): Promise<boolean> {
  try {
    // TODO: Implement actual publishing logic
    // For now, we'll just call the Metricool integration stub
    const result = await scheduleVariantToMetricool(variant);

    if (result.ok) {
      await markVariantAsPublished(variant.id);
      return true;
    } else {
      await markVariantAsFailed(variant.id);
      return false;
    }
  } catch (error) {
    console.error(`Failed to publish variant ${variant.id}:`, error);
    await markVariantAsFailed(variant.id);
    return false;
  }
}

/**
 * Main scheduling worker function
 * This should be called by a cron job or background worker
 *
 * Example usage:
 * - Vercel Cron: Create /api/cron/publish route
 * - Node worker: setInterval(runScheduledPublishing, 60000)
 * - External cron: Call API endpoint every minute
 */
export async function runScheduledPublishing(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const now = new Date();
  const dueVariants = await getDueVariantsForPublish(now);

  let succeeded = 0;
  let failed = 0;

  for (const variant of dueVariants) {
    const success = await processVariantPublish(variant);
    if (success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  return {
    processed: dueVariants.length,
    succeeded,
    failed,
  };
}

/**
 * Helper to format scheduled time for display
 */
export function formatScheduledTime(scheduledTime: string | null): string {
  if (!scheduledTime) return 'Not scheduled';

  const date = new Date(scheduledTime);
  const now = new Date();

  if (date < now) {
    return `Overdue (${date.toLocaleString()})`;
  }

  return date.toLocaleString();
}

/**
 * Helper to check if a post/variant is overdue
 */
export function isOverdue(scheduledTime: string | null): boolean {
  if (!scheduledTime) return false;
  return new Date(scheduledTime) < new Date();
}
