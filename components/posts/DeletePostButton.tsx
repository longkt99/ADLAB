'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';

interface DeletePostButtonProps {
  postId: string;
}

export default function DeletePostButton({ postId }: DeletePostButtonProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);

    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete post');
      }

      router.push('/posts');
    } catch (error) {
      console.error('Delete error:', error);
      alert(t('deletePost.error'));
      setDeleting(false);
      setShowConfirm(false);
    }
  };

  if (showConfirm) {
    return (
      <div className="flex gap-2">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-4 py-2.5 bg-destructive text-destructive-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
        >
          {deleting ? t('deletePost.deleting') : t('deletePost.confirmButton')}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          disabled={deleting}
          className="px-4 py-2.5 border border-border text-foreground bg-card text-sm font-medium rounded-lg hover:bg-secondary transition-colors"
        >
          {t('deletePost.cancel')}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="px-4 py-2.5 border border-destructive/30 text-destructive bg-card text-sm font-medium rounded-lg hover:bg-destructive/10 transition-colors"
    >
      {t('deletePost.button')}
    </button>
  );
}
