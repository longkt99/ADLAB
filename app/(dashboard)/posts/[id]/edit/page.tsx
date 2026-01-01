'use client';

import React, { useEffect, useState } from 'react'; // 1. Thêm React vào đây
import { notFound } from 'next/navigation';
import PostForm from '@/components/posts/PostForm';
import type { PostFormData, Post } from '@/lib/types';
import { useTranslation } from '@/lib/i18n';

interface EditPostPageProps {
  // 2. Cập nhật params thành Promise theo chuẩn Next.js 15
  params: Promise<{
    id: string;
  }>;
}

export default function EditPostPage({ params }: EditPostPageProps) {
  const { t } = useTranslation();
  
  // 3. Sử dụng React.use() để lấy id từ Promise params
  const resolvedParams = React.use(params);
  const postId = resolvedParams.id;

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPost() {
      try {
        // 4. Sử dụng postId thay vì params.id
        const response = await fetch(`/api/posts/${postId}`);
        const data = await response.json();

        if (!data.post) {
          notFound();
        }

        setPost(data.post);
      } catch (error) {
        console.error('Failed to fetch post:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchPost();
  }, [postId]); // 5. Dependency array dùng postId

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  if (!post) {
    notFound();
  }

  // Prepare initial form data
  const initialData: Partial<PostFormData> = {
    title: post.title,
    content: post.content,
    status: post.status,
    scheduled_time: post.scheduled_time
      ? new Date(post.scheduled_time).toISOString().slice(0, 16)
      : '',
    cover_image_url: post.cover_image_url || '',
    platforms: (post.platforms as any[]) || [],
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">{t('postEditor.editTitle')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('postEditor.editSubtitle')}
        </p>
      </div>

      <div className="bg-card rounded-xl p-6 sm:p-8 border border-border">
        <PostForm mode="edit" initialData={initialData} postId={postId} />
      </div>
    </div>
  );
}