'use client';

// ============================================
// Studio Hero Component - Compact Layout
// ============================================
// Minimal hero section with trust-first zinc styling

import { useTranslation } from '@/lib/i18n';

export default function StudioHero() {
  const { t } = useTranslation();

  return (
    <section className="text-center pt-12 sm:pt-16 pb-8 sm:pb-10">
      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-zinc-900 dark:text-zinc-50 mb-3.5 tracking-tight">
        {t('studio.hero.title')}
      </h1>
      <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed">
        {t('studio.hero.subtitle')} {t('studio.hero.subtitleCta')}
      </p>
    </section>
  );
}
