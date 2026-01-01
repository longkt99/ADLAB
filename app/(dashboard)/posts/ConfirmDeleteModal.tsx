'use client';

import { useTranslation } from '@/lib/i18n';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  postTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

export default function ConfirmDeleteModal({
  isOpen,
  postTitle,
  onConfirm,
  onCancel,
  isDeleting,
}: ConfirmDeleteModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      style={{
        animation: `fadeIn var(--motion-base) var(--ease-out-premium)`
      }}
    >
      <div
        className="bg-card border border-border/60 rounded-xl shadow-md max-w-md w-full"
        style={{
          animation: `scaleIn var(--motion-slow) var(--ease-out-premium)`
        }}
      >
        {/* Header */}
        <div className="p-6 border-b border-border">
          <h3 className="text-xl font-bold text-foreground">
            {t('deletePost.button')}
          </h3>
          <p className="text-sm text-muted-foreground mt-2">
            Are you sure you want to delete this post? This action cannot be undone.
          </p>
        </div>

        {/* Post Title */}
        <div className="p-6">
          <div className="bg-secondary/50 dark:bg-secondary rounded-lg p-4 border border-border">
            <p className="text-sm font-medium text-foreground line-clamp-2">
              {postTitle}
            </p>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            This will also delete all generated variants for this post.
          </p>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-border bg-secondary/30 flex gap-3 rounded-b-xl">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="btn-secondary flex-1"
          >
            {t('deletePost.cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="btn-destructive flex-1"
          >
            {isDeleting ? (
              <>
                <span className="inline-block animate-spin mr-2">⚙</span>
                {t('deletePost.deleting')}
              </>
            ) : (
              t('deletePost.confirmButton')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
