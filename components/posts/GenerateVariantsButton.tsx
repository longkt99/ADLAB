'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PLATFORMS, getPlatformDisplayName } from '@/lib/platforms';
import type { Platform, Language } from '@/lib/types';
import { useTranslation } from '@/lib/i18n';

interface GenerateVariantsButtonProps {
  postId: string;
  onVariantsCreated?: () => Promise<void>;
}

export default function GenerateVariantsButton({
  postId,
  onVariantsCreated,
}: GenerateVariantsButtonProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [showDialog, setShowDialog] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [language, setLanguage] = useState<Language>('both');
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setError(null);
    setGenerating(true);

    try {
      const response = await fetch(`/api/posts/${postId}/generate-variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platforms: selectedPlatforms.length > 0 ? selectedPlatforms : undefined,
          languages: [language],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate variants');
      }

      const data = await response.json();

      // Close dialog and refresh variants
      setShowDialog(false);

      // Call the callback to refetch variants
      if (onVariantsCreated) {
        await onVariantsCreated();
      }

      router.refresh();

      alert(t('generateVariants.success').replace('{count}', data.count.toString()));
    } catch (err: unknown) {
      console.error('Generate variants error:', err);
      setError(err instanceof Error ? err.message : t('generateVariants.error'));
    } finally {
      setGenerating(false);
    }
  };

  const togglePlatform = (platform: Platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  const selectAllPlatforms = () => {
    setSelectedPlatforms(PLATFORMS);
  };

  const clearAllPlatforms = () => {
    setSelectedPlatforms([]);
  };

  if (!showDialog) {
    return (
      <button
        onClick={() => setShowDialog(true)}
        className="px-5 py-2.5 bg-card text-foreground text-sm font-medium border border-border rounded-lg hover:bg-secondary transition-colors"
      >
        {t('generateVariants.button')}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-border">
        <div className="p-5 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {t('generateVariants.title')}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('generateVariants.subtitle')}
          </p>
        </div>

        <div className="p-5 space-y-5">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Language Selection */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              {t('generateVariants.language.label')}
            </label>
            <div className="flex gap-3">
              {(['vi', 'en', 'both'] as Language[]).map((lang) => (
                <label
                  key={lang}
                  className={`flex-1 p-3 border rounded-lg cursor-pointer transition-colors ${
                    language === lang
                      ? 'border-foreground/50 bg-secondary/70'
                      : 'border-border hover:border-border-medium hover:bg-secondary/30'
                  }`}
                >
                  <input
                    type="radio"
                    name="language"
                    value={lang}
                    checked={language === lang}
                    onChange={(e) => setLanguage(e.target.value as Language)}
                    className="sr-only"
                  />
                  <div className="text-center">
                    <div className="text-sm font-medium text-foreground">
                      {lang === 'vi' && t('generateVariants.language.vi')}
                      {lang === 'en' && t('generateVariants.language.en')}
                      {lang === 'both' && t('generateVariants.language.both')}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {lang === 'both' && t('generateVariants.language.bothDescription')}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Platform Selection */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-medium text-muted-foreground">
                {t('generateVariants.platforms.label')} ({selectedPlatforms.length} {t('generateVariants.platforms.selected')})
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllPlatforms}
                  className="text-xs text-foreground hover:text-foreground/80 font-medium"
                >
                  {t('generateVariants.platforms.selectAll')}
                </button>
                <button
                  type="button"
                  onClick={clearAllPlatforms}
                  className="text-xs text-muted-foreground hover:text-foreground font-medium"
                >
                  {t('generateVariants.platforms.clear')}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-80 overflow-y-auto p-1">
              {PLATFORMS.map((platform) => (
                <label
                  key={platform}
                  className={`flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer transition-colors ${
                    selectedPlatforms.includes(platform)
                      ? 'border-foreground/50 bg-secondary/70'
                      : 'border-border hover:border-border-medium hover:bg-secondary/30'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedPlatforms.includes(platform)}
                    onChange={() => togglePlatform(platform)}
                    className="w-3.5 h-3.5 text-foreground rounded border-border focus:ring-ring/20"
                  />
                  <span className="text-sm font-medium text-foreground">
                    {getPlatformDisplayName(platform)}
                  </span>
                </label>
              ))}
            </div>
            {selectedPlatforms.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {t('generateVariants.platforms.noSelectionHint')}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="p-5 border-t border-border bg-secondary/30 flex gap-3 rounded-b-xl">
          <button
            onClick={() => setShowDialog(false)}
            disabled={generating}
            className="px-4 py-2.5 border border-border text-foreground bg-card text-sm font-medium rounded-lg hover:bg-secondary transition-colors"
          >
            {t('generateVariants.cancel')}
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <span className="inline-block animate-spin mr-2">⚙️</span>
                {t('generateVariants.generating')}
              </>
            ) : (
              t('generateVariants.submit')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
