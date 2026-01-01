'use client';

import { BRAND_TONES, type BrandTone } from '@/lib/studio/tones';
import { useStudio } from '@/lib/studio/studioContext';

export default function TonePicker() {
  const { selectedTone, handleToneSelect } = useStudio();

  return (
    <div className="mb-4">
      {/* Label */}
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Brand Voice
      </label>

      {/* Tone Chips - Horizontal scroll on mobile, wrap on larger screens */}
      <div className="overflow-x-auto pb-2 -mx-1">
        <div className="flex flex-nowrap sm:flex-wrap gap-2 px-1 min-w-max sm:min-w-0">
          {BRAND_TONES.map((tone) => {
            const isSelected = selectedTone?.id === tone.id;

            return (
              <button
                key={tone.id}
                type="button"
                onClick={() => handleToneSelect(tone)}
                className={`
                  flex-shrink-0 px-3 py-2 rounded-lg text-sm font-medium
                  transition-all duration-200
                  border-2
                  ${
                    isSelected
                      ? 'bg-blue-600 dark:bg-blue-500 text-white border-blue-600 dark:border-blue-500 shadow-sm'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30'
                  }
                `}
                title={tone.description}
              >
                <span className="flex items-center gap-1.5">
                  {tone.icon && <span className="text-base">{tone.icon}</span>}
                  <span className="whitespace-nowrap">{tone.name}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Tone Description */}
      {selectedTone && (
        <div className="mt-3 px-3 py-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-xs text-blue-700 dark:text-blue-400">
            {selectedTone.icon} <strong>{selectedTone.name}:</strong> {selectedTone.description}
          </p>
        </div>
      )}
    </div>
  );
}
