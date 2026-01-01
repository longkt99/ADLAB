'use client';

// ============================================
// Pass Indicator - Frozen Spec v2.1
// ============================================
// PASS state: Single-line, static, success indicator
// No expand affordance, no buttons, no actions

import React from 'react';

export const PassIndicator: React.FC = () => {
  return (
    <div className="px-3 py-2 bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30 rounded-lg">
      <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
        <span>✓</span>
        <span>Ready.</span>
      </div>
    </div>
  );
};

export default PassIndicator;
