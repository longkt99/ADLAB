// ============================================
// AdLab Error Box
// ============================================
// Displays query errors in a non-alarming way.
// Matches the calm error styling from messageStyles.

import React from 'react';

interface AdLabErrorBoxProps {
  message: string;
  hint?: string;
}

export function AdLabErrorBox({ message, hint }: AdLabErrorBoxProps) {
  return (
    <div className="mb-4 py-3 px-4 border-l-2 border-amber-400/70 dark:border-amber-500 bg-secondary/50 rounded-r">
      <p className="text-[12px] text-foreground leading-relaxed">
        {message}
      </p>
      {hint && (
        <p className="text-[11px] text-muted-foreground mt-1">
          {hint}
        </p>
      )}
    </div>
  );
}

export default AdLabErrorBox;
