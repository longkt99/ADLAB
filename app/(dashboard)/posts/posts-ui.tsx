'use client';

import Link from 'next/link';
import { useTranslation, formatDate } from '@/lib/i18n';
import { getPlatformDisplayName, type Platform } from '@/lib/platforms';
import type { Post, PostStatus } from '@/lib/types';
import { buttonGroups } from '@/lib/ui/responsive';

// ============================================
// UI Components - Warm Professional Style
// ============================================

export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();

  // Neutral badges with readable contrast
  const styles = {
    draft: 'bg-secondary text-secondary-foreground',
    scheduled: 'bg-secondary text-foreground',
    published: 'bg-secondary text-foreground',
    failed: 'bg-destructive/10 text-destructive',
  };

  // Use translation for status label
  const statusLabel = t(`status.${status}`) || status;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md ${
        styles[status as keyof typeof styles] || styles.draft
      }`}
    >
      {statusLabel}
    </span>
  );
}

export function PlatformPills({ platforms }: { platforms: Platform[] | null }) {
  const { t } = useTranslation();

  if (!platforms || platforms.length === 0) {
    return <span className="text-xs text-muted-foreground">{t('posts.platformPills.noPlatforms')}</span>;
  }

  const displayPlatforms = platforms.slice(0, 2);
  const remaining = platforms.length - 2;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {displayPlatforms.map((platform) => (
        <span
          key={platform}
          className="inline-flex items-center px-2 py-0.5 text-xs bg-secondary text-secondary-foreground rounded"
        >
          {getPlatformDisplayName(platform)}
        </span>
      ))}
      {remaining > 0 && (
        <span className="inline-flex items-center px-2 py-0.5 text-xs text-muted-foreground border border-border rounded">
          +{remaining}
        </span>
      )}
    </div>
  );
}

// STEP 3: Calm empty state - gentle guidance, no urgency
export function EmptyState() {
  const { t } = useTranslation();

  return (
    <div className="text-center py-16 bg-card rounded-xl border border-zinc-200/80 dark:border-border">
      <div className="mx-auto w-12 h-12 bg-zinc-100 dark:bg-secondary rounded-full flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-zinc-400 dark:text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mb-1">
        {t('posts.empty.title')}
      </p>
      <p className="text-[12px] text-zinc-400 dark:text-zinc-500 mb-6 max-w-xs mx-auto">
        {t('posts.empty.description')}
      </p>
      <Link
        href="/posts/new"
        className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 dark:bg-foreground text-white dark:text-primary-foreground text-[13px] font-medium rounded-lg hover:bg-zinc-700 dark:hover:opacity-90 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        {t('posts.empty.cta')}
      </Link>
    </div>
  );
}

interface PostsTableProps {
  posts: Post[];
  onDelete?: (post: Post) => void;
}

export function PostsTable({ posts, onDelete }: PostsTableProps) {
  const { t, language } = useTranslation();

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-secondary/60">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t('posts.table.title')}
              </th>
              <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t('posts.table.status')}
              </th>
              <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t('posts.table.platforms')}
              </th>
              <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t('posts.table.created')}
              </th>
              <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t('posts.table.scheduled')}
              </th>
              <th scope="col" className="relative px-4 py-3">
                <span className="sr-only">{t('posts.table.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {posts.map((post) => (
              <tr key={post.id} className="hover:bg-secondary/40 transition-colors">
                <td className="px-4 py-3.5">
                  <Link href={`/posts/${post.id}`} className="group">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground group-hover:text-foreground transition-colors line-clamp-1">
                          {post.title}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {post.content}
                        </p>
                      </div>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <StatusBadge status={post.status} />
                </td>
                <td className="px-4 py-3.5">
                  <PlatformPills platforms={post.platforms} />
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap text-sm text-muted-foreground">
                  {formatDate(post.created_at, 'dateFull', language)}
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap text-sm text-muted-foreground">
                  {post.scheduled_time ? (
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {formatDate(post.scheduled_time, 'dateShort', language)}
                    </div>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link
                      href={`/posts/${post.id}`}
                      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {t('posts.actions.view')}
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                    {onDelete && (
                      <button
                        onClick={() => onDelete(post)}
                        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-destructive transition-colors"
                      >
                        {t('common.delete')}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PostsHeader({ postsCount }: { postsCount: number }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">{t('posts.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('posts.description')} {postsCount} {postsCount === 1 ? t('posts.post') : t('posts.postPlural')}
        </p>
      </div>
      <div className={`${buttonGroups.stack} ${buttonGroups.gap}`}>
        <Link
          href="/calendar"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-card border border-border text-foreground text-sm font-medium rounded-lg hover:bg-secondary transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {t('posts.actions.viewCalendar')}
        </Link>
        <Link
          href="/posts/new"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('posts.actions.newPost')}
        </Link>
      </div>
    </div>
  );
}

interface PostsFilterBarProps {
  postsCount: number;
  totalPosts: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: PostStatus | 'all';
  onStatusChange: (status: PostStatus | 'all') => void;
  platformFilter: Platform | 'all';
  onPlatformChange: (platform: Platform | 'all') => void;
}

export function PostsFilterBar({
  postsCount,
  totalPosts,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  platformFilter,
  onPlatformChange,
}: PostsFilterBarProps) {
  const { t } = useTranslation();

  const statuses = ['draft', 'scheduled', 'published', 'failed'];
  const platforms = [
    'twitter_x',
    'instagram_post',
    'threads',
    'bluesky',
    'linkedin',
    'google',
    'pinterest',
    'youtube_community',
  ];

  const platformDisplayNames: Record<string, string> = {
    twitter_x: 'X (Twitter)',
    instagram_post: 'Instagram',
    threads: 'Threads',
    bluesky: 'Bluesky',
    linkedin: 'LinkedIn',
    google: 'Google Post',
    pinterest: 'Pinterest',
    youtube_community: 'YouTube',
  };

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || platformFilter !== 'all';
  const isFiltered = postsCount !== totalPosts;

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 sm:flex-initial">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('posts.filters.searchPlaceholder')}
              className="w-full sm:w-60 pl-9 pr-3 py-2.5 border border-border bg-card text-foreground placeholder:text-muted-foreground rounded-lg text-sm focus:ring-2 focus:ring-ring/20 focus:border-border transition-all dark:bg-secondary"
            />
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value as PostStatus | 'all')}
            className="w-full sm:w-auto px-3 py-2.5 border border-border bg-card text-foreground rounded-lg text-sm focus:ring-2 focus:ring-ring/20 focus:border-border transition-all dark:bg-secondary"
          >
            <option value="all">{t('posts.filters.allStatuses')}</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {t(`status.${status}`)}
              </option>
            ))}
          </select>

          {/* Platform Filter */}
          <select
            value={platformFilter}
            onChange={(e) => onPlatformChange(e.target.value as Platform | 'all')}
            className="w-full sm:w-auto px-3 py-2.5 border border-border bg-card text-foreground rounded-lg text-sm focus:ring-2 focus:ring-ring/20 focus:border-border transition-all dark:bg-secondary"
          >
            <option value="all">{t('posts.filters.allPlatforms')}</option>
            {platforms.map((platform) => (
              <option key={platform} value={platform}>
                {platformDisplayNames[platform]}
              </option>
            ))}
          </select>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={() => {
                onSearchChange('');
                onStatusChange('all');
                onPlatformChange('all');
              }}
              className="w-full sm:w-auto px-3 py-2 text-sm text-muted-foreground hover:text-foreground whitespace-nowrap transition-colors"
            >
              {t('common.clearAllFilters')}
            </button>
          )}
        </div>

        {/* Results Count */}
        <div className="text-sm text-muted-foreground text-center lg:text-right">
          {isFiltered ? (
            <>
              {postsCount} of {totalPosts} {totalPosts === 1 ? t('posts.post') : t('posts.postPlural')}
            </>
          ) : (
            <>
              {postsCount} {postsCount === 1 ? t('posts.post') : t('posts.postPlural')}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
