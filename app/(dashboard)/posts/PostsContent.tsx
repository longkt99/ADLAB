'use client';

import { useState, useMemo } from 'react';
import type { Post, PostStatus, Platform } from '@/lib/types';
import { useTranslation } from '@/lib/i18n';
import {
  PostsFilterBar,
  EmptyState,
  PostsTable,
} from './posts-ui';
import ConfirmDeleteModal from './ConfirmDeleteModal';

interface PostsContentProps {
  initialPosts: Post[];
}

export default function PostsContent({ initialPosts }: PostsContentProps) {
  const { t } = useTranslation();

  // Posts state - track deletions locally
  const [posts, setPosts] = useState<Post[]>(initialPosts);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PostStatus | 'all'>('all');
  const [platformFilter, setPlatformFilter] = useState<Platform | 'all'>('all');

  // Delete modal state
  const [postToDelete, setPostToDelete] = useState<Post | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Memoized filtered posts
  const filteredPosts = useMemo(() => {
    let result = [...posts];

    // Apply search filter (title or content)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (post) =>
          post.title.toLowerCase().includes(query) ||
          post.content.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter((post) => post.status === statusFilter);
    }

    // Apply platform filter
    if (platformFilter !== 'all') {
      result = result.filter((post) =>
        post.platforms?.includes(platformFilter)
      );
    }

    return result;
  }, [posts, searchQuery, statusFilter, platformFilter]);

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Handle delete post
  const handleDeletePost = async () => {
    if (!postToDelete) return;

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/posts/${postToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete post');
      }

      // Remove post from local state (no router.refresh)
      setPosts((prev) => prev.filter((p) => p.id !== postToDelete.id));

      // Show success toast
      showToast(t('posts.toast.deleteSuccess'), 'success');

      // Close modal
      setPostToDelete(null);
    } catch (error) {
      console.error('Delete error:', error);
      showToast(error instanceof Error ? error.message : t('posts.toast.deleteFailed'), 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      {/* Filter Bar */}
      <PostsFilterBar
        postsCount={filteredPosts.length}
        totalPosts={posts.length}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        platformFilter={platformFilter}
        onPlatformChange={setPlatformFilter}
      />

      {/* Posts Table or Empty State */}
      {filteredPosts.length === 0 ? (
        searchQuery || statusFilter !== 'all' || platformFilter !== 'all' ? (
          // STEP 3: Calm filter empty state - no alarm, just guidance
          <div className="text-center py-14 bg-card rounded-xl border border-zinc-200/80 dark:border-border">
            <div className="mx-auto w-11 h-11 bg-zinc-100 dark:bg-secondary rounded-full flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-zinc-400 dark:text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mb-1">
              {t('posts.filters.noResultsTitle')}
            </p>
            <p className="text-[12px] text-zinc-400 dark:text-zinc-500 mb-5">
              {t('posts.filters.noResultsDescription')}
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setPlatformFilter('all');
              }}
              className="text-[12px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-foreground transition-colors"
            >
              {t('common.clearAllFilters')}
            </button>
          </div>
        ) : (
          <EmptyState />
        )
      ) : (
        <PostsTable posts={filteredPosts} onDelete={setPostToDelete} />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!postToDelete}
        postTitle={postToDelete?.title || ''}
        onConfirm={handleDeletePost}
        onCancel={() => setPostToDelete(null)}
        isDeleting={isDeleting}
      />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4">
          <div
            className={`rounded-lg px-6 py-4 shadow-lg border ${
              toast.type === 'success'
                ? 'bg-green-50 dark:bg-green-950/50 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800'
            }`}
          >
            <div className="flex items-center gap-3">
              {toast.type === 'success' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <span className="font-medium">{toast.message}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
