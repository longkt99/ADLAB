// ============================================
// Tone Chips Component
// ============================================
// Enhanced tone display with better styling

import React from 'react';

interface ToneChipsProps {
  tones: string[];
  limit?: number;
  size?: 'sm' | 'md';
}

export function ToneChips({ tones, limit, size = 'sm' }: ToneChipsProps) {
  const displayTones = limit ? tones.slice(0, limit) : tones;
  const remaining = limit && tones.length > limit ? tones.length - limit : 0;

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
  };

  const toneColors: Record<string, string> = {
    professional: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
    friendly: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    genz: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
    conversational: 'bg-green-500/10 text-green-600 border-green-500/20',
    inspirational: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    storytelling: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
    journalistic: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
  };

  const getToneIcon = (tone: string) => {
    const icons: Record<string, string> = {
      professional: '💼',
      friendly: '😊',
      genz: '✨',
      conversational: '💬',
      inspirational: '🌟',
      storytelling: '📖',
      journalistic: '📰',
    };
    return icons[tone.toLowerCase()] || '🎭';
  };

  return (
    <div className="inline-flex flex-wrap items-center gap-1">
      {displayTones.map((tone) => {
        const colorClass =
          toneColors[tone.toLowerCase()] ||
          'bg-gray-500/10 text-gray-600 border-gray-500/20';

        return (
          <div
            key={tone}
            className={`inline-flex items-center gap-0.5 rounded border font-medium capitalize ${sizeClasses[size]} ${colorClass}`}
          >
            <span>{getToneIcon(tone)}</span>
            <span>{tone}</span>
          </div>
        );
      })}
      {remaining > 0 && (
        <div
          className={`inline-flex items-center rounded bg-gray-500/10 text-gray-600 border border-gray-500/20 font-medium ${sizeClasses[size]}`}
          title={`${remaining} more tone${remaining > 1 ? 's' : ''}`}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
