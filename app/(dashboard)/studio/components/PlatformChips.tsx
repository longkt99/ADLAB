// ============================================
// Platform Chips Component
// ============================================
// Enhanced platform display with icons and better styling

import React from 'react';

interface PlatformChipsProps {
  platforms: string[];
  limit?: number;
  size?: 'sm' | 'md';
}

export function PlatformChips({ platforms, limit, size = 'sm' }: PlatformChipsProps) {
  const displayPlatforms = limit ? platforms.slice(0, limit) : platforms;
  const remaining = limit && platforms.length > limit ? platforms.length - limit : 0;

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
  };

  const platformColors: Record<string, string> = {
    instagram: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
    facebook: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    linkedin: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
    tiktok: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    youtube: 'bg-red-500/10 text-red-600 border-red-500/20',
    twitter: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
  };

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, string> = {
      instagram: '📷',
      facebook: '👥',
      linkedin: '💼',
      tiktok: '🎵',
      youtube: '📺',
      twitter: '🐦',
    };
    return icons[platform.toLowerCase()] || '🌐';
  };

  return (
    <div className="inline-flex flex-wrap items-center gap-1">
      {displayPlatforms.map((platform) => {
        const colorClass =
          platformColors[platform.toLowerCase()] ||
          'bg-gray-500/10 text-gray-600 border-gray-500/20';

        return (
          <div
            key={platform}
            className={`inline-flex items-center gap-0.5 rounded border font-medium capitalize ${sizeClasses[size]} ${colorClass}`}
          >
            <span>{getPlatformIcon(platform)}</span>
            <span>{platform}</span>
          </div>
        );
      })}
      {remaining > 0 && (
        <div
          className={`inline-flex items-center rounded bg-gray-500/10 text-gray-600 border border-gray-500/20 font-medium ${sizeClasses[size]}`}
          title={`${remaining} more platform${remaining > 1 ? 's' : ''}`}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
