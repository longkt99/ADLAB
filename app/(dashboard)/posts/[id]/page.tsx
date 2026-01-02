'use client';

// 1. Thêm import 'use'
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getPlatformDisplayName } from '@/lib/platforms';
import { useTranslation, formatDate } from '@/lib/i18n';
import { StatusBadge } from '../posts-ui';
import VariantList from '@/components/posts/VariantList';
import DeletePostButton from '@/components/posts/DeletePostButton';
import GenerateVariantsButton from '@/components/posts/GenerateVariantsButton';
import type { Post, Variant } from '@/lib/types';
import { buttonGroups } from '@/lib/ui/responsive';

interface PostDetailPageProps {
  // 2. Cập nhật kiểu dữ liệu params thành Promise
  params: Promise<{
    id: string;
  }>;
}

export default function PostDetailPage({ params }: PostDetailPageProps) {
  // 3. Unwrap params bằng React.use()
  const { id } = use(params);

  const router = useRouter();
  const { t, language } = useTranslation();
  const [post, setPost] = useState<Post | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Separate function to fetch variants - can be called independently
  const fetchVariants = async () => {
    try {
      const variantsRes = await fetch(`/api/posts/${id}/variants`);

      if (variantsRes.ok) {
        const variantsData = await variantsRes.json();
        setVariants(variantsData.variants || []);
      } else {
        console.warn('Failed to fetch variants, continuing with empty list');
        setVariants([]);
      }
    } catch (error) {
      console.error('Failed to refetch variants:', error);
    }
  };

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch post data
        // 4. Dùng biến 'id' thay cho 'params.id'
        const postRes = await fetch(`/api/posts/${id}`);

        if (!postRes.ok) {
          if (postRes.status === 404) {
            setError('Post not found');
            router.push('/posts');
            return;
          }
          throw new Error(`Failed to fetch post: ${postRes.statusText}`);
        }

        const postData = await postRes.json();

        if (!postData.post) {
          setError('Post not found');
          router.push('/posts');
          return;
        }

        setPost(postData.post);

        // Fetch variants data
        await fetchVariants();

      } catch (error) {
        console.error('Failed to fetch post:', error);
        setError(error instanceof Error ? error.message : 'Failed to load post');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-flex items-center gap-3">
          <svg className="animate-spin w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-muted-foreground">{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">
            {error || 'Post not found'}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            The post you&apos;re looking for doesn&apos;t exist or has been deleted.
          </p>
          <Link
            href="/posts"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-all"
          >
            ← Back to Posts
          </Link>
        </div>
      </div>
    );
  }

  // Calculate variant stats (client-side only, no API calls)
  const variantStats = {
    total: variants.length,
    draft: variants.filter(v => v.status === 'draft').length,
    approved: variants.filter(v => v.status === 'approved').length,
    scheduled: variants.filter(v => v.status === 'scheduled').length,
    published: variants.filter(v => v.status === 'published').length,
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Navigation - lighter touch */}
      <div className="mb-8">
        <Link
          href="/posts"
          className="inline-flex items-center gap-2 px-3.5 py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground bg-transparent hover:bg-secondary/60 rounded-lg transition-colors"
        >
          <span className="text-muted-foreground">←</span>
          {t('postDetail.backToPosts')}
        </Link>
      </div>

      {/* 2-Column Layout: Main Content + Stats Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Post Details Card */}
          <div className="bg-card rounded-xl border border-border">
            {/* Title & Meta Header - more breathing room */}
            <div className="px-6 py-6 border-b border-border">
              <h1 className="text-[22px] font-semibold text-foreground leading-tight tracking-tight">
                {post.title}
              </h1>
              <div className="flex flex-wrap items-center gap-3 mt-4 text-[13px]">
                <StatusBadge status={post.status} />
                <span className="text-muted-foreground">
                  {t('postDetail.createdAt')} {formatDate(post.created_at, 'dateFull', language)}
                </span>
                {post.scheduled_time && (
                  <>
                    <span className="text-muted-foreground/50">·</span>
                    <span className="text-muted-foreground">
                      {t('postDetail.scheduledFor')} {formatDate(post.scheduled_time, 'dateTimeShort', language)}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Cover Image - cleaner presentation */}
            {post.cover_image_url && (
              <div className="px-6 py-5 border-b border-border">
                <img
                  src={post.cover_image_url}
                  alt={post.title}
                  className="w-full max-h-[400px] object-cover rounded-lg"
                />
              </div>
            )}

            {/* Content Section - improved readability */}
            <div className="px-6 py-6 border-b border-border">
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">
                {t('postDetail.content')}
              </h2>
              <div className="bg-secondary/30 dark:bg-secondary/50 rounded-lg px-5 py-4 whitespace-pre-wrap text-[15px] text-foreground leading-[1.7]">
                {post.content}
              </div>
              <div className="mt-4 text-xs text-muted-foreground">
                {t('postDetail.characterCount')} {post.content.length.toLocaleString()}
              </div>
            </div>

            {/* Target Platforms - softer visual weight */}
            {post.platforms && post.platforms.length > 0 && (
              <div className="px-6 py-5 border-b border-border">
                <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  {t('postDetail.targetPlatforms')}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {post.platforms.map((platform) => (
                    <span
                      key={platform}
                      className="px-2.5 py-1 bg-secondary/60 dark:bg-secondary/80 text-foreground/80 text-xs font-medium rounded-md"
                    >
                      {getPlatformDisplayName(platform)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons - subtle background */}
            <div className="px-6 py-5 bg-secondary/20 dark:bg-secondary/30 rounded-b-xl">
              <div className={`${buttonGroups.stack} ${buttonGroups.gap}`}>
                <Link
                  href={`/posts/${post.id}/edit`}
                  className="w-full sm:flex-1 sm:min-w-[180px] px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-all text-center"
                >
                  {t('postDetail.editPost')}
                </Link>
                <GenerateVariantsButton postId={post.id} onVariantsCreated={fetchVariants} />
                <DeletePostButton postId={post.id} />
              </div>
            </div>
          </div>

          {/* Variants Section */}
          <div className="bg-card rounded-xl border border-border">
            <div className="px-6 py-5 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">
                {t('postDetail.generatedVariants')}
              </h2>
              <p className="text-[13px] text-muted-foreground mt-1">
                {variants.length} {variants.length === 1 ? 'variant' : 'variants'} generated
              </p>
            </div>
            <div className="p-6">
              <VariantList variants={variants} onVariantsUpdated={fetchVariants} />
            </div>
          </div>
        </div>

        {/* Stats Sidebar Column - refined rhythm */}
        <div className="lg:col-span-1">
          {/* Quick Stats Card */}
          <div className="bg-card rounded-xl border border-border p-6 sticky top-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-5">
              Variant Statistics
            </h3>

            {/* Total Variants - prominent number */}
            <div className="mb-6 pb-5 border-b border-border/60">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] text-muted-foreground">
                  Total
                </span>
                <span className="text-3xl font-semibold text-foreground tracking-tight">
                  {variantStats.total}
                </span>
              </div>
            </div>

            {/* Status Breakdown - calmer, less boxy */}
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/50"></div>
                  <span className="text-[13px] text-foreground/80">Draft</span>
                </div>
                <span className="text-[15px] font-medium text-foreground tabular-nums">
                  {variantStats.draft}
                </span>
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-foreground/50"></div>
                  <span className="text-[13px] text-foreground/80">Approved</span>
                </div>
                <span className="text-[15px] font-medium text-foreground tabular-nums">
                  {variantStats.approved}
                </span>
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{ background: 'hsl(var(--warm-accent))' }}></div>
                  <span className="text-[13px] text-foreground/80">Scheduled</span>
                </div>
                <span className="text-[15px] font-medium text-foreground tabular-nums">
                  {variantStats.scheduled}
                </span>
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-foreground"></div>
                  <span className="text-[13px] text-foreground/80">Published</span>
                </div>
                <span className="text-[15px] font-medium text-foreground tabular-nums">
                  {variantStats.published}
                </span>
              </div>
            </div>

            {/* Progress Indicator - refined */}
            {variantStats.total > 0 && (
              <div className="mt-6 pt-5 border-t border-border/60">
                <div className="flex items-baseline justify-between mb-3">
                  <span className="text-[13px] text-muted-foreground">
                    Completion
                  </span>
                  <span className="text-lg font-semibold text-foreground tabular-nums">
                    {Math.round((variantStats.published / variantStats.total) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-secondary/60 dark:bg-secondary rounded-full h-1">
                  <div
                    className="bg-foreground/70 h-1 rounded-full transition-all"
                    style={{
                      width: `${Math.round((variantStats.published / variantStats.total) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  {variantStats.published} of {variantStats.total} published
                </p>
              </div>
            )}

            {/* Quick Actions - lighter */}
            <div className={`mt-6 pt-5 border-t border-border/60 ${buttonGroups.stack} ${buttonGroups.gap}`}>
              <Link
                href="/posts"
                className="w-full px-4 py-2 text-center text-[13px] font-medium text-muted-foreground hover:text-foreground bg-transparent border border-border/60 rounded-lg hover:bg-secondary/50 transition-colors"
              >
                ← All Posts
              </Link>
              <Link
                href={`/posts/${post.id}/edit`}
                className="w-full px-4 py-2 text-center text-[13px] font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all"
              >
                Edit Post
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}