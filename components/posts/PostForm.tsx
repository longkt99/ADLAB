'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import _ImageUploader from './ImageUploader';
import { PLATFORMS, getPlatformDisplayName } from '@/lib/platforms';
import type { PostFormData, PostStatus, Platform } from '@/lib/types';
import { useTranslation } from '@/lib/i18n';

interface PostFormProps {
  mode: 'create' | 'edit';
  initialData?: Partial<PostFormData>;
  postId?: string;
}

export default function PostForm({ mode, initialData, postId }: PostFormProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [activePreviewPlatform, setActivePreviewPlatform] = useState<Platform | 'generic'>('generic');

  // TODO: Phase 17 – extend backend to support multiple media URLs (media_urls: string[])
  // Currently using local state for UI preview only, backend still uses single cover_image_url
  const [mediaImages, setMediaImages] = useState<string[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Autosave: Generate unique key for localStorage based on mode and postId
  const autosaveKey = mode === 'create' ? 'post-draft-new' : `post-draft-${postId}`;

  const [formData, setFormData] = useState<PostFormData>(() => {
    // Restore from localStorage if creating new post and draft exists
    if (mode === 'create' && typeof window !== 'undefined') {
      const savedDraft = localStorage.getItem(autosaveKey);
      if (savedDraft) {
        try {
          return JSON.parse(savedDraft);
        } catch {
          // If parsing fails, use default values
        }
      }
    }
    return {
      title: initialData?.title || '',
      content: initialData?.content || '',
      status: initialData?.status || 'draft',
      scheduled_time: initialData?.scheduled_time || '',
      cover_image_url: initialData?.cover_image_url || '',
      platforms: initialData?.platforms || [],
    };
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const url = mode === 'create'
        ? '/api/posts'
        : `/api/posts/${postId}`;

      const method = mode === 'create' ? 'POST' : 'PATCH';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          content: formData.content,
          status: formData.status,
          scheduled_time: formData.scheduled_time || null,
          cover_image_url: formData.cover_image_url || null,
          platforms: formData.platforms.length > 0 ? formData.platforms : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('postForm.error.failedToSave'));
      }

      const data = await response.json();

      // Clear autosaved draft on successful submit
      if (typeof window !== 'undefined') {
        localStorage.removeItem(autosaveKey);
      }

      // Show success flash
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);

      // Navigate after brief delay to show success state
      setTimeout(() => {
        if (mode === 'create') {
          router.push(`/posts/${data.post.id}`);
        } else {
          router.push(`/posts/${postId}`);
        }
      }, 500);
    } catch (err: unknown) {
      console.error('Form submission error:', err);
      const errorMessage = err instanceof Error ? err.message : t('postForm.error.failedToSave');
      setError(errorMessage);
      setSubmitting(false);
    }
  };

  const handlePlatformToggle = (platform: Platform) => {
    setFormData((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter((p) => p !== platform)
        : [...prev.platforms, platform],
    }));
  };

  // Autosave: Debounced save to localStorage (1.5s delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(autosaveKey, JSON.stringify(formData));
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [formData, autosaveKey]);

  // Prefill from Studio approved draft (Phase 10)
  useEffect(() => {
    // Only run once on mount for create mode
    if (mode !== 'create' || typeof window === 'undefined') return;

    // Only prefill if form is currently empty
    if (formData.title.trim() || formData.content.trim()) return;

    try {
      const studioDraft = localStorage.getItem('studio_approved_draft_v1');
      if (!studioDraft) return;

      const parsed = JSON.parse(studioDraft);
      if (!parsed.content) return;

      // Derive title from content
      const rawContent = parsed.content.trim();
      let derivedTitle = 'Bản nháp từ Studio'; // Fallback

      if (rawContent) {
        const firstLineMatch = rawContent.split('\n')[0];
        if (firstLineMatch && firstLineMatch.trim()) {
          // Use first line, truncated to 80 chars
          derivedTitle = firstLineMatch.trim().substring(0, 80);
        } else {
          // No clear line break, use first 80 chars
          derivedTitle = rawContent.substring(0, 80);
        }
      }

      // Prefill form
      setFormData((prev) => ({
        ...prev,
        title: derivedTitle,
        content: rawContent,
      }));

      // Clear the draft from localStorage
      localStorage.removeItem('studio_approved_draft_v1');

      console.log('✅ Prefilled post from Studio approved content');
    } catch (error) {
      console.error('❌ Failed to load Studio draft:', error);
      // Clear invalid draft
      if (typeof window !== 'undefined') {
        localStorage.removeItem('studio_approved_draft_v1');
      }
    }
  }, []); // Run only once on mount

  // Textarea auto-resize
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [formData.content]);

  // Update active preview platform based on selected platforms
  useEffect(() => {
    if (formData.platforms.length === 0) {
      setActivePreviewPlatform('generic');
    } else if (formData.platforms.length === 1) {
      setActivePreviewPlatform(formData.platforms[0]);
    } else {
      // Multiple platforms: keep current if still valid, otherwise use first
      if (activePreviewPlatform === 'generic' || !formData.platforms.includes(activePreviewPlatform as Platform)) {
        setActivePreviewPlatform(formData.platforms[0]);
      }
    }
  }, [formData.platforms]);

  // Initialize mediaImages from cover_image_url on mount
  useEffect(() => {
    if (formData.cover_image_url && mediaImages.length === 0) {
      setMediaImages([formData.cover_image_url]);
    }
  }, []);

  // Sync cover_image_url with first media image
  useEffect(() => {
    const firstImage = mediaImages.length > 0 ? mediaImages[0] : '';
    if (firstImage !== formData.cover_image_url) {
      setFormData((prev) => ({ ...prev, cover_image_url: firstImage }));
    }
  }, [mediaImages]);

  // Handlers for multi-image management
  const handleAddMedia = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Convert FileList to array and create object URLs for preview
    const newImages = Array.from(files).map((file) => URL.createObjectURL(file));
    setMediaImages((prev) => [...prev, ...newImages]);

    // Reset input
    e.target.value = '';
  };

  const handleRemoveMedia = (index: number) => {
    setMediaImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Platform-specific preview renderers
  const renderFacebookPreview = () => {
    const imageCount = mediaImages.length;

    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {/* Facebook Header */}
        <div className="flex items-center gap-3 p-3 border-b border-gray-200 dark:border-gray-700">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
            U
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('postForm.preview.userName')}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{t('postForm.preview.justNow')} · {t('postForm.preview.world')}</div>
          </div>
        </div>

        {/* Post Content with "See more" truncation */}
        {formData.content && (
          <div className="px-3 pt-3 pb-2">
            <p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed">
              {formData.content.length > 200 ? (
                <>
                  {formData.content.substring(0, 200)}...{' '}
                  <button className="text-gray-600 dark:text-gray-400 hover:underline font-medium">{t('postForm.preview.seeMore')}</button>
                </>
              ) : (
                formData.content
              )}
            </p>
          </div>
        )}

        {/* Media Grid */}
        {imageCount > 0 && (
          <div className="bg-gray-100 dark:bg-gray-800">
            {imageCount === 1 && (
              // Single image: full width
              <img
                src={mediaImages[0]}
                alt="Facebook preview"
                className="w-full object-cover max-h-96"
              />
            )}

            {imageCount === 2 && (
              // Two images: side by side
              <div className="grid grid-cols-2 gap-0.5">
                {mediaImages.slice(0, 2).map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt={`Facebook preview ${i + 1}`}
                    className="w-full h-64 object-cover"
                  />
                ))}
              </div>
            )}

            {imageCount >= 3 && (
              // Three or more: mosaic layout
              <div className="grid grid-cols-2 gap-0.5">
                {/* First image takes full left column */}
                <img
                  src={mediaImages[0]}
                  alt="Facebook preview 1"
                  className="w-full h-full min-h-[256px] object-cover"
                />

                {/* Right column: 2 images stacked */}
                <div className="grid grid-rows-2 gap-0.5">
                  <div className="relative">
                    <img
                      src={mediaImages[1]}
                      alt="Facebook preview 2"
                      className="w-full h-full min-h-[128px] object-cover"
                    />
                  </div>
                  <div className="relative">
                    <img
                      src={mediaImages[2]}
                      alt="Facebook preview 3"
                      className="w-full h-full min-h-[128px] object-cover"
                    />
                    {/* +N overlay if more than 3 images */}
                    {imageCount > 3 && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                        <span className="text-white text-3xl font-bold">+{imageCount - 3}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Engagement bar */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-2 flex items-center justify-around text-xs text-gray-600 dark:text-gray-400">
          <button className="flex items-center gap-1 hover:bg-gray-100 dark:hover:bg-gray-800 px-3 py-1.5 rounded transition-colors">
            <span>👍</span> {t('postForm.preview.like')}
          </button>
          <button className="flex items-center gap-1 hover:bg-gray-100 dark:hover:bg-gray-800 px-3 py-1.5 rounded transition-colors">
            <span>💬</span> {t('postForm.preview.comment')}
          </button>
          <button className="flex items-center gap-1 hover:bg-gray-100 dark:hover:bg-gray-800 px-3 py-1.5 rounded transition-colors">
            <span>↗️</span> {t('postForm.preview.share')}
          </button>
        </div>
      </div>
    );
  };

  const renderInstagramPreview = () => (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden max-w-sm mx-auto">
      {/* Instagram Header */}
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
            U
          </div>
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('postForm.preview.username')}</div>
        </div>
        <button className="text-gray-900 dark:text-gray-100">⋯</button>
      </div>

      {/* Main Media Image (square, first image only) */}
      {mediaImages.length > 0 && (
        <div className="relative">
          <img
            src={mediaImages[0]}
            alt="Instagram preview"
            className="w-full aspect-square object-cover"
          />
          {/* Carousel indicator for multiple images */}
          {mediaImages.length > 1 && (
            <>
              {/* Image counter badge */}
              <div className="absolute top-3 right-3 px-2 py-1 bg-black/60 text-white text-xs rounded-full font-medium">
                1/{mediaImages.length}
              </div>
              {/* Carousel dots */}
              <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex items-center gap-1.5">
                {mediaImages.slice(0, 5).map((_, index) => (
                  <div
                    key={index}
                    className={`w-1.5 h-1.5 rounded-full ${
                      index === 0 ? 'bg-white' : 'bg-white/50'
                    }`}
                  />
                ))}
                {mediaImages.length > 5 && (
                  <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-4 text-lg">
          <button>❤️</button>
          <button>💬</button>
          <button>📤</button>
        </div>
        <button>🔖</button>
      </div>

      {/* Caption */}
      {formData.content && (
        <div className="px-3 pt-2 pb-2">
          <p className="text-sm text-gray-900 dark:text-gray-100">
            <span className="font-semibold">{t('postForm.preview.username')}</span>{' '}
            {formData.content.substring(0, 100)}
            {formData.content.length > 100 && <span className="text-gray-500 dark:text-gray-400">... {t('postForm.preview.more')}</span>}
          </p>
        </div>
      )}

      {/* Thumbnail strip for additional images with custom scrollbar */}
      {mediaImages.length > 1 && (
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2 overflow-x-auto thumbnail-scroll">
            {mediaImages.slice(1).map((imageUrl, index) => (
              <div key={index} className="flex-shrink-0">
                <img
                  src={imageUrl}
                  alt={`Thumbnail ${index + 2}`}
                  className="w-14 h-14 rounded-md object-cover border border-gray-200 dark:border-gray-700"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderTwitterPreview = () => (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Twitter/X Header */}
      <div className="flex items-start gap-3 p-3">
        <div className="w-10 h-10 bg-gray-700 dark:bg-gray-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
          U
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{t('postForm.preview.userName')}</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">@{t('postForm.preview.username')} · 1m</span>
          </div>

          {/* Tweet Content */}
          {formData.content && (
            <p className="text-sm text-gray-900 dark:text-gray-100 mt-1 leading-relaxed">
              {formData.content}
            </p>
          )}

          {/* Media (landscape aspect ratio) */}
          {mediaImages.length > 0 && (
            <div className="mt-3 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
              <img
                src={mediaImages[0]}
                alt="Twitter preview"
                className="w-full aspect-[16/9] object-cover"
              />
            </div>
          )}

          {/* Engagement row */}
          <div className="flex items-center justify-between mt-3 text-gray-500 dark:text-gray-400 text-xs">
            <button className="flex items-center gap-1 hover:text-blue-500 transition-colors">
              <span>💬</span> <span>{t('postForm.preview.reply')}</span>
            </button>
            <button className="flex items-center gap-1 hover:text-green-500 transition-colors">
              <span>🔁</span> <span>{t('postForm.preview.repost')}</span>
            </button>
            <button className="flex items-center gap-1 hover:text-red-500 transition-colors">
              <span>❤️</span> <span>{t('postForm.preview.like')}</span>
            </button>
            <button className="flex items-center gap-1 hover:text-blue-500 transition-colors">
              <span>📊</span> <span>{t('postForm.preview.view')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Helper function to get localized status label
  const getStatusLabel = (status: PostStatus) => {
    switch (status) {
      case 'draft':
        return t('status.draft');
      case 'scheduled':
        return t('status.scheduled');
      case 'published':
        return t('status.published');
      case 'failed':
        return t('status.failed');
      default:
        return status;
    }
  };

  const renderLinkedInPreview = () => (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* LinkedIn Header */}
      <div className="flex items-start gap-3 p-4">
        <div className="w-12 h-12 bg-blue-700 rounded-full flex items-center justify-center text-white font-semibold">
          U
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('postForm.preview.userName')}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{t('postForm.preview.professionalTitle')}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">1h · 🌐</div>
        </div>
        <button className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">⋯</button>
      </div>

      {/* Post Content */}
      {formData.content && (
        <div className="px-4 pb-3">
          <p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed">
            {formData.content.substring(0, 150)}
            {formData.content.length > 150 && (
              <button className="text-blue-700 dark:text-blue-500 hover:underline ml-1">{t('postForm.preview.seeMoreLinkedIn')}</button>
            )}
          </p>
        </div>
      )}

      {/* Media (wide landscape) */}
      {mediaImages.length > 0 && (
        <div className="px-0">
          <img
            src={mediaImages[0]}
            alt="LinkedIn preview"
            className="w-full aspect-[2/1] object-cover"
          />
        </div>
      )}

      {/* Engagement bar */}
      <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
        <button className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 px-3 py-1.5 rounded transition-colors">
          <span>👍</span> <span>{t('postForm.preview.like')}</span>
        </button>
        <button className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 px-3 py-1.5 rounded transition-colors">
          <span>💬</span> <span>{t('postForm.preview.comment')}</span>
        </button>
        <button className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 px-3 py-1.5 rounded transition-colors">
          <span>↗️</span> <span>{t('postForm.preview.share')}</span>
        </button>
      </div>
    </div>
  );

  const renderGenericPreview = () => (
    <div className="space-y-3">
      {/* Title Preview */}
      {formData.title && (
        <div>
          <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {formData.title}
          </h4>
        </div>
      )}

      {/* Main Media Image (first image only) */}
      {mediaImages.length > 0 && (
        <div>
          <img
            src={mediaImages[0]}
            alt="Preview"
            className="w-full rounded-lg object-cover max-h-48"
          />
          {/* Thumbnail strip for additional images */}
          {mediaImages.length > 1 && (
            <div className="mt-2 flex items-center gap-2 overflow-x-auto thumbnail-scroll">
              {mediaImages.slice(1).map((imageUrl, index) => (
                <div key={index} className="flex-shrink-0">
                  <img
                    src={imageUrl}
                    alt={`Thumbnail ${index + 2}`}
                    className="w-16 h-16 rounded object-cover border border-gray-200 dark:border-gray-700"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content Preview */}
      {formData.content && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
            {formData.content}
          </p>
        </div>
      )}

      {/* Platforms Preview */}
      {formData.platforms.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">{t('postForm.preview.targetPlatforms')}</p>
          <div className="flex flex-wrap gap-1.5">
            {formData.platforms.map((platform) => (
              <span
                key={platform}
                className="px-2 py-1 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 text-[10px] font-medium rounded"
              >
                {getPlatformDisplayName(platform)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="pt-3 border-t border-gray-200 dark:border-gray-700 text-[10px] text-gray-500 dark:text-gray-400 space-y-1">
        <div>{t('postForm.preview.status')} <span className="font-medium">{getStatusLabel(formData.status)}</span></div>
        {formData.scheduled_time && (
          <div>{t('postForm.preview.scheduled')} <span className="font-medium">{new Date(formData.scheduled_time).toLocaleString()}</span></div>
        )}
        <div>{t('postForm.preview.characters')} <span className="font-medium">{formData.content.length}</span></div>
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="relative">
      {/* Component-scoped scrollbar styles */}
      <style jsx>{`
        /* Custom scrollbar for preview panel and thumbnail strips */
        :global(.preview-scroll)::-webkit-scrollbar,
        :global(.thumbnail-scroll)::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        :global(.preview-scroll)::-webkit-scrollbar-track,
        :global(.thumbnail-scroll)::-webkit-scrollbar-track {
          background: transparent;
        }

        :global(.preview-scroll)::-webkit-scrollbar-thumb,
        :global(.thumbnail-scroll)::-webkit-scrollbar-thumb {
          background-color: rgb(156 163 175);
          border-radius: 3px;
        }

        :global(.preview-scroll)::-webkit-scrollbar-thumb:hover,
        :global(.thumbnail-scroll)::-webkit-scrollbar-thumb:hover {
          background-color: rgb(107 114 128);
        }

        /* Dark mode scrollbar */
        :global(.dark .preview-scroll)::-webkit-scrollbar-thumb,
        :global(.dark .thumbnail-scroll)::-webkit-scrollbar-thumb {
          background-color: rgb(75 85 99);
        }

        :global(.dark .preview-scroll)::-webkit-scrollbar-thumb:hover,
        :global(.dark .thumbnail-scroll)::-webkit-scrollbar-thumb:hover {
          background-color: rgb(107 114 128);
        }

        /* Firefox scrollbar support */
        :global(.preview-scroll),
        :global(.thumbnail-scroll) {
          scrollbar-width: thin;
          scrollbar-color: rgb(156 163 175) transparent;
        }

        :global(.dark .preview-scroll),
        :global(.dark .thumbnail-scroll) {
          scrollbar-color: rgb(75 85 99) transparent;
        }
      `}</style>

      {/* Toolbar - Compact on mobile, comfortable on desktop */}
      <div className="bg-card border-b border-border px-3 sm:px-6 py-2 sm:py-3 -mx-6 sm:-mx-8 -mt-6 sm:-mt-8 mb-4 sm:mb-5">
        <div className="flex items-center justify-between gap-2">
          {/* Left: Title + metadata */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <h3 className="text-xs sm:text-sm font-medium text-foreground truncate">
              {mode === 'create' ? t('postForm.toolbar.newPost') : t('postForm.toolbar.editPost')}
            </h3>
            <div className="hidden sm:block h-4 w-px bg-border"></div>
            <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground">
              <span>{formData.content.length.toLocaleString()} {t('postForm.toolbar.charactersCount')}</span>
              {mode === 'create' && (
                <>
                  <span className="hidden sm:inline">·</span>
                  <span className="hidden sm:inline">{t('postForm.toolbar.autoSaved')}</span>
                </>
              )}
            </div>
          </div>
          {/* Right: Actions - Primary CTA hidden on mobile (moved to bottom) */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-muted-foreground hover:text-foreground bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
            >
              <span className="sm:hidden">{showPreview ? 'Ẩn' : 'Xem'}</span>
              <span className="hidden sm:inline">{showPreview ? t('postForm.toolbar.hidePreview') : t('postForm.toolbar.showPreview')}</span>
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-muted-foreground hover:text-foreground border border-border hover:bg-secondary rounded-lg transition-colors"
              disabled={submitting}
            >
              {t('postForm.toolbar.cancel')}
            </button>
            {/* Desktop only: Primary CTA in header */}
            <button
              type="submit"
              disabled={submitting}
              className={`hidden sm:inline-flex px-4 py-1.5 text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                saveSuccess
                  ? 'bg-primary text-primary-foreground'
                  : submitting
                  ? 'bg-primary/80 text-primary-foreground'
                  : 'bg-primary text-primary-foreground hover:opacity-90'
              }`}
            >
              {saveSuccess ? t('postForm.toolbar.saved') : submitting ? t('postForm.toolbar.saving') : mode === 'create' ? t('postForm.toolbar.createPost') : t('postForm.toolbar.saveChanges')}
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive mb-4">
          {error}
        </div>
      )}

      {/* Main Content: Editor + Preview/Settings Split */}
      <div className="grid gap-5 lg:grid-cols-[1.6fr,1fr]">
        {/* Left Column: Content Editor */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">
              {t('postForm.sections.content')}
            </h3>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              {t('postEditor.titleLabel')}
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              className="w-full px-4 py-3 border border-border bg-card text-sm text-foreground rounded-lg focus:ring-2 focus:ring-ring/20 focus:border-border transition-all dark:bg-secondary"
              placeholder={t('postEditor.titlePlaceholder')}
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              {t('postEditor.contentLabel')}
            </label>
            <textarea
              ref={textareaRef}
              required
              value={formData.content}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, content: e.target.value }))
              }
              rows={10}
              className="w-full px-4 py-3 border border-border bg-card text-sm text-foreground rounded-lg focus:ring-2 focus:ring-ring/20 focus:border-border resize-none overflow-y-auto leading-relaxed transition-all dark:bg-secondary"
              placeholder={t('postEditor.contentPlaceholder')}
              style={{ minHeight: '160px', maxHeight: '260px' }}
            />
          </div>

          {/* Multi-Media Upload */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              {t('postForm.sections.media')}
            </label>

            {/* Add Media Button */}
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleAddMedia}
                className="hidden"
                id="media-upload"
              />
              <label
                htmlFor="media-upload"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-card border border-border text-muted-foreground rounded-lg hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-medium">{t('postForm.sections.addMedia')}</span>
              </label>
            </div>

            {/* Thumbnail Row */}
            {mediaImages.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {mediaImages.map((imageUrl, index) => (
                  <div
                    key={index}
                    className="relative group w-20 h-20 rounded-lg overflow-hidden border border-border"
                  >
                    <img
                      src={imageUrl}
                      alt={`Media ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {/* Remove Button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveMedia(index)}
                      className="absolute top-1 right-1 w-5 h-5 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={t('accessibility.removeImage')}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    {/* First image badge */}
                    {index === 0 && (
                      <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-primary text-primary-foreground text-[10px] font-medium rounded">
                        {t('postForm.sections.cover')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Helper text */}
            <p className="mt-2 text-xs text-muted-foreground">
              {t('postForm.sections.multiImageHelp')}
            </p>
          </div>

          {/* Target Platforms Section */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-medium text-foreground mb-1">
                {t('postForm.sections.targetPlatforms')}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t('postForm.sections.targetPlatformsDescription')}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PLATFORMS.map((platform) => (
                <label
                  key={platform}
                  className={`flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer transition-colors ${
                    formData.platforms.includes(platform)
                      ? 'border-foreground/60 bg-secondary/70'
                      : 'border-border hover:border-border hover:bg-secondary/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.platforms.includes(platform)}
                    onChange={() => handlePlatformToggle(platform)}
                    className="w-3.5 h-3.5 text-foreground rounded border-border focus:ring-1 focus:ring-ring/15"
                  />
                  <span className="text-sm font-medium text-foreground">
                    {getPlatformDisplayName(platform)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Publishing Settings Section */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div>
              <h3 className="text-sm font-medium text-foreground mb-0.5">
                {t('postForm.sections.publishingSettings')}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t('postForm.sections.publishingSettingsDescription')}
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  {t('postEditor.statusLabel')}
                </label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      status: e.target.value as PostStatus,
                    }))
                  }
                  className="w-full px-3.5 py-2.5 border border-border bg-card text-sm text-foreground rounded-lg focus:ring-1 focus:ring-ring/15 focus:border-border transition-all dark:bg-secondary"
                >
                  <option value="draft">{t('status.draft')}</option>
                  <option value="scheduled">{t('status.scheduled')}</option>
                  <option value="published">{t('status.published')}</option>
                  <option value="failed">{t('status.failed')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  {t('postEditor.scheduledTimeLabel')}
                  {formData.status === 'scheduled' && (
                    <span className="text-destructive ml-1">*</span>
                  )}
                </label>
                <input
                  type="datetime-local"
                  value={formData.scheduled_time}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      scheduled_time: e.target.value,
                    }))
                  }
                  className="w-full px-3.5 py-2.5 border border-border bg-card text-sm text-foreground rounded-lg focus:ring-1 focus:ring-ring/15 focus:border-border transition-all dark:bg-secondary"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Preview Only */}
        <div className="lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-100px)] lg:overflow-y-auto preview-scroll">
          {/* Live Preview Panel */}
          {showPreview && (
            <div className="bg-secondary/50 border border-border rounded-lg overflow-hidden">
              {/* Preview Header */}
              <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
                <h3 className="text-sm font-medium text-foreground">{t('postForm.sections.livePreview')}</h3>
                <span className="text-xs px-1.5 py-0.5 bg-card text-muted-foreground rounded font-medium border border-border">
                  {t('postForm.sections.realTime')}
                </span>
              </div>

              {/* Platform Tabs (show only if multiple platforms selected) */}
              {formData.platforms.length > 1 && (
                <div className="flex items-center gap-1 px-3.5 py-2 bg-card border-b border-border">
                  {formData.platforms.map((platform) => (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => setActivePreviewPlatform(platform)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                        activePreviewPlatform === platform
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-muted-foreground hover:bg-secondary hover:text-foreground'
                      }`}
                    >
                      {getPlatformDisplayName(platform)}
                    </button>
                  ))}
                </div>
              )}

              {/* Preview Content */}
              <div className="p-3.5">
                {(activePreviewPlatform as string) === 'facebook' && renderFacebookPreview()}
                {(activePreviewPlatform as string) === 'instagram' && renderInstagramPreview()}
                {(activePreviewPlatform as string) === 'twitter' && renderTwitterPreview()}
                {(activePreviewPlatform as string) === 'linkedin' && renderLinkedInPreview()}
                {(activePreviewPlatform === 'generic' ||
                  ((activePreviewPlatform as string) !== 'facebook' &&
                   (activePreviewPlatform as string) !== 'instagram' &&
                   (activePreviewPlatform as string) !== 'twitter' &&
                   (activePreviewPlatform as string) !== 'linkedin')) &&
                  renderGenericPreview()}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Mobile: Sticky bottom CTA */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border px-4 py-3 safe-area-pb">
        <button
          type="submit"
          disabled={submitting}
          className={`w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            saveSuccess
              ? 'bg-primary text-primary-foreground'
              : submitting
              ? 'bg-primary/80 text-primary-foreground'
              : 'bg-primary text-primary-foreground hover:opacity-90'
          }`}
        >
          {saveSuccess ? t('postForm.toolbar.saved') : submitting ? t('postForm.toolbar.saving') : mode === 'create' ? t('postForm.toolbar.createPost') : t('postForm.toolbar.saveChanges')}
        </button>
      </div>
      {/* Spacer for mobile sticky bottom CTA */}
      <div className="sm:hidden h-16" />
    </form>
  );
}
