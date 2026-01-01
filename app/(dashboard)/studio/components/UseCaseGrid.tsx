'use client';

// ============================================
// Use Case Grid Component
// ============================================
// Scenario selection cards with calmer trust-first styling
// Uses zinc-based neutrals with subtle colored accents

import { useStudio } from '@/lib/studio/studioContext';
import { STUDIO_USE_CASES } from '@/lib/studio/useCases';
import type { UseCase } from '@/types/studio';
import { useTranslation } from '@/lib/i18n';
import { Icon } from '@/components/ui/Icon';

export default function UseCaseGrid() {
  const { t } = useTranslation();
  const { selectedUseCase, handleUseCaseSelect } = useStudio();

  const getColorClasses = (color: UseCase['color'], isSelected: boolean) => {
    // Base: subtle border + smooth transitions
    const baseClasses = 'border transition-all duration-150 ease-out';

    if (isSelected) {
      // Selected: zinc dark background, subtle colored left accent
      const accentBorder = {
        blue: 'border-l-blue-500 dark:border-l-blue-400',
        purple: 'border-l-purple-500 dark:border-l-purple-400',
        green: 'border-l-green-500 dark:border-l-green-400',
        orange: 'border-l-orange-500 dark:border-l-orange-400',
      }[color];

      return `${baseClasses} border-l-4 ${accentBorder} border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800`;
    }

    // Unselected: very subtle border, hover reveals
    return `${baseClasses} border-zinc-200/70 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-800/30 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-700`;
  };

  const getCheckmarkColor = (color: UseCase['color']) => {
    switch (color) {
      case 'blue':
        return 'text-blue-600 dark:text-blue-400';
      case 'purple':
        return 'text-purple-600 dark:text-purple-400';
      case 'green':
        return 'text-green-600 dark:text-green-400';
      case 'orange':
        return 'text-orange-600 dark:text-orange-400';
    }
  };

  return (
    <div>
      {/* Section Label */}
      <div className="mb-3.5">
        <span className="text-[13px] font-medium tracking-wide text-zinc-500 dark:text-zinc-400">
          {t('studio.scenarios.title')}
        </span>
      </div>

      {/* Scenario Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-3.5">
        {STUDIO_USE_CASES.map((useCase) => {
          const isSelected = selectedUseCase?.id === useCase.id;

          return (
            <button
              key={useCase.id}
              onClick={() => handleUseCaseSelect(useCase)}
              className={`
                relative px-3.5 py-3 sm:px-4 sm:py-3.5 rounded-lg text-left cursor-pointer
                ${getColorClasses(useCase.color, isSelected)}
                active:scale-[0.98]
              `}
            >
              {/* Checkmark indicator */}
              {isSelected && (
                <div className={`absolute top-3 right-3 ${getCheckmarkColor(useCase.color)}`}>
                  <Icon name="check" size={16} />
                </div>
              )}

              {/* Icon */}
              <div className="text-xl sm:text-2xl mb-2 leading-none">{useCase.icon}</div>

              {/* Title */}
              <h3 className="text-[13px] sm:text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1 leading-snug">
                {t(`studio.useCases.${useCase.id}.title` as any)}
              </h3>

              {/* Description */}
              <p className="text-[11px] text-zinc-500 dark:text-zinc-500 line-clamp-2 leading-relaxed">
                {t(`studio.useCases.${useCase.id}.description` as any)}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
