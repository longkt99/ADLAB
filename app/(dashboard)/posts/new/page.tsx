'use client';

import PostForm from '@/components/posts/PostForm';
import { useTranslation } from '@/lib/i18n';
import { typography, containerSpacing } from '@/lib/ui/responsive';

export default function NewPostPage() {
  const { t } = useTranslation();

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">{t('postEditor.newTitle')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('postEditor.newSubtitle')}
        </p>
      </div>

      <div className="bg-card rounded-xl p-6 sm:p-8 border border-border">
        <PostForm mode="create" />
      </div>
    </div>
  );
}
