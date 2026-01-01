'use client';

import { useStudio } from '@/lib/studio/studioContext';

export default function UseCaseSelector() {
  const { useCases, selectedUseCase, handleUseCaseSelect, setSelectedUseCase } = useStudio();

  if (useCases.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
        Hãy thử một trong những trường hợp sử dụng dưới đây
      </h3>

      {/* Use Case Cards - Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {useCases.map((useCase) => {
          const isSelected = selectedUseCase?.id === useCase.id;

          return (
            <button
              key={useCase.id}
              onClick={() => {
                if (isSelected) {
                  setSelectedUseCase(null);
                } else {
                  handleUseCaseSelect(useCase);
                }
              }}
              className={`
                relative p-4 rounded-lg border-2 transition-all text-left
                ${isSelected
                  ? `border-${useCase.color}-500 bg-${useCase.color}-50 dark:bg-${useCase.color}-950/30`
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600'
                }
              `}
              style={{
                borderColor: isSelected
                  ? useCase.color === 'purple' ? '#a855f7'
                    : useCase.color === 'blue' ? '#3b82f6'
                    : useCase.color === 'green' ? '#10b981'
                    : '#f97316'
                  : undefined,
                backgroundColor: isSelected
                  ? useCase.color === 'purple' ? 'rgba(168, 85, 247, 0.1)'
                    : useCase.color === 'blue' ? 'rgba(59, 130, 246, 0.1)'
                    : useCase.color === 'green' ? 'rgba(16, 185, 129, 0.1)'
                    : 'rgba(249, 115, 22, 0.1)'
                  : undefined
              }}
            >
              {/* Icon */}
              <div className="text-2xl mb-2">{useCase.icon}</div>

              {/* Title */}
              <h4 className={`text-sm font-semibold mb-1 ${
                isSelected
                  ? `text-${useCase.color}-900 dark:text-${useCase.color}-200`
                  : 'text-gray-900 dark:text-gray-100'
              }`}>
                {useCase.title}
              </h4>

              {/* Description */}
              <p className={`text-xs ${
                isSelected
                  ? `text-${useCase.color}-700 dark:text-${useCase.color}-300`
                  : 'text-gray-600 dark:text-gray-400'
              }`}>
                {useCase.description}
              </p>

              {/* Selected Indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"
                    style={{
                      color: useCase.color === 'purple' ? '#a855f7'
                        : useCase.color === 'blue' ? '#3b82f6'
                        : useCase.color === 'green' ? '#10b981'
                        : '#f97316'
                    }}
                  >
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Use Case Info */}
      {selectedUseCase && selectedUseCase.placeholder && (
        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            <span className="font-semibold">Gợi ý:</span> {selectedUseCase.placeholder}
          </p>
        </div>
      )}
    </div>
  );
}
