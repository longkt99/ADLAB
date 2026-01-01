'use client';

// ============================================
// STEP 17: Intent Canon Guard Modal
// ============================================
// Shown when AI output would drift from the editorial intent.
// User can:
// A) Keep intent (reject AI output, keep old text)
// B) Accept drift (apply AI output AND update intent canon)
// C) Cancel / revise instruction (close modal, do not apply)
//
// INVARIANTS:
// - Pure UI, no LLM calls
// - No persistence
// - Consistent with existing modal styling
// ============================================

import React from 'react';
import type {
  IntentCanonDiff,
  IntentGuardDecision,
  EditorialIntentCanon,
  DriftSignal,
  DetectedAnchor,
} from '@/lib/studio/editorialIntentCanon';

// ============================================
// Types
// ============================================

interface IntentCanonGuardModalProps {
  /** The intent canon being protected */
  canon: EditorialIntentCanon;
  /** The computed diff */
  diff: IntentCanonDiff;
  /** The guard decision */
  decision: IntentGuardDecision;
  /** Keep original intent (reject AI output) */
  onKeepIntent: () => void;
  /** Accept drift (apply output + update canon) */
  onAcceptDrift: () => void;
  /** Cancel (close modal, no action) */
  onCancel: () => void;
  /** Language for labels */
  language?: 'vi' | 'en';
}

// ============================================
// Sub-components
// ============================================

/**
 * Severity indicator badge
 */
function SeverityBadge({
  severity,
  language,
}: {
  severity: 'low' | 'medium' | 'high';
  language: 'vi' | 'en';
}) {
  const config = {
    low: {
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      text: 'text-yellow-800 dark:text-yellow-200',
      label: { vi: 'Nhẹ', en: 'Low' },
    },
    medium: {
      bg: 'bg-orange-100 dark:bg-orange-900/30',
      text: 'text-orange-800 dark:text-orange-200',
      label: { vi: 'Trung bình', en: 'Medium' },
    },
    high: {
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-800 dark:text-red-200',
      label: { vi: 'Cao', en: 'High' },
    },
  };

  const c = config[severity];

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label[language]}
    </span>
  );
}

/**
 * Drift signal item
 */
function DriftSignalItem({
  signal,
  language,
}: {
  signal: DriftSignal;
  language: 'vi' | 'en';
}) {
  const icon = getDriftIcon(signal.type);
  const label = getDriftLabel(signal.type, language);

  return (
    <li className="flex items-start gap-2 text-xs">
      <span className="flex-shrink-0 mt-0.5">{icon}</span>
      <div>
        <span className="font-medium text-gray-700 dark:text-gray-300">{label}</span>
        {signal.originalValue && signal.newValue && (
          <span className="text-gray-500 dark:text-gray-400 ml-1">
            ({signal.originalValue} → {signal.newValue})
          </span>
        )}
      </div>
    </li>
  );
}

/**
 * Missing anchor warning
 */
function MissingAnchorItem({
  anchor,
  language,
}: {
  anchor: DetectedAnchor;
  language: 'vi' | 'en';
}) {
  const typeLabel = getAnchorTypeLabel(anchor.type, language);

  return (
    <li className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
      <span>❌</span>
      <span>
        {language === 'vi' ? 'Mất' : 'Missing'} {typeLabel}:{' '}
        <span className="font-mono bg-red-50 dark:bg-red-900/20 px-1 rounded">
          {anchor.value.length > 25 ? `${anchor.value.substring(0, 25)}...` : anchor.value}
        </span>
      </span>
    </li>
  );
}

// ============================================
// Helper Functions
// ============================================

function getDriftIcon(type: DriftSignal['type']): string {
  const icons: Record<DriftSignal['type'], string> = {
    MISSING_ANCHOR: '📍',
    CTA_ESCALATION: '📢',
    TONE_FLIP: '🎭',
    HOOK_STYLE_SHIFT: '⚡',
    AUDIENCE_MISMATCH: '👥',
    GOAL_DRIFT: '🎯',
  };
  return icons[type] || '⚠️';
}

function getDriftLabel(type: DriftSignal['type'], language: 'vi' | 'en'): string {
  const labels: Record<DriftSignal['type'], { vi: string; en: string }> = {
    MISSING_ANCHOR: { vi: 'Thông tin bị mất', en: 'Missing information' },
    CTA_ESCALATION: { vi: 'CTA mạnh hơn', en: 'CTA escalation' },
    TONE_FLIP: { vi: 'Thay đổi phong cách', en: 'Tone change' },
    HOOK_STYLE_SHIFT: { vi: 'Hook quá kích động', en: 'Sensationalist hook' },
    AUDIENCE_MISMATCH: { vi: 'Không phù hợp đối tượng', en: 'Audience mismatch' },
    GOAL_DRIFT: { vi: 'Lệch mục tiêu', en: 'Goal drift' },
  };
  return labels[type]?.[language] || type;
}

function getAnchorTypeLabel(type: DetectedAnchor['type'], language: 'vi' | 'en'): string {
  const labels: Record<DetectedAnchor['type'], { vi: string; en: string }> = {
    ADDRESS: { vi: 'Địa chỉ', en: 'Address' },
    PHONE: { vi: 'Số điện thoại', en: 'Phone' },
    PRICE: { vi: 'Giá', en: 'Price' },
    PROMO: { vi: 'Khuyến mãi', en: 'Promo' },
    USP: { vi: 'USP', en: 'USP' },
  };
  return labels[type]?.[language] || type;
}

// ============================================
// Main Component
// ============================================

export function IntentCanonGuardModal({
  canon,
  diff,
  decision,
  onKeepIntent,
  onAcceptDrift,
  onCancel,
  language = 'vi',
}: IntentCanonGuardModalProps) {
  const title = language === 'vi'
    ? 'AI đã thay đổi định hướng nội dung'
    : 'AI changed content direction';

  const description = language === 'vi'
    ? 'Bản chỉnh sửa của AI khác với định hướng ban đầu. Bạn muốn làm gì?'
    : 'The AI edit differs from the original direction. What would you like to do?';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-amber-50 dark:bg-amber-900/20">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <span>🎯</span>
              {title}
            </h3>
            <SeverityBadge severity={decision.severity} language={language} />
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {description}
          </p>
        </div>

        {/* Content */}
        <div className="px-4 py-3 space-y-3 max-h-[300px] overflow-y-auto">
          {/* Original intent summary */}
          <div className="p-2 rounded bg-gray-50 dark:bg-gray-800">
            <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">
              {language === 'vi' ? 'Định hướng ban đầu:' : 'Original direction:'}
            </div>
            <div className="text-xs text-gray-700 dark:text-gray-300">
              {language === 'vi' ? 'Phong cách' : 'Style'}: <span className="font-medium">{canon.toneLabel}</span>
              {' • '}
              CTA: <span className="font-medium">{canon.ctaIntensity}</span>
              {canon.anchors.filter(a => a.critical).length > 0 && (
                <>
                  {' • '}
                  {language === 'vi' ? 'Thông tin quan trọng' : 'Critical info'}: {canon.anchors.filter(a => a.critical).length}
                </>
              )}
            </div>
          </div>

          {/* Drift signals */}
          {diff.signals.length > 0 && (
            <div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">
                {language === 'vi' ? 'Thay đổi phát hiện:' : 'Detected changes:'}
              </div>
              <ul className="space-y-1.5">
                {diff.signals.map((signal, idx) => (
                  <DriftSignalItem key={idx} signal={signal} language={language} />
                ))}
              </ul>
            </div>
          )}

          {/* Missing anchors */}
          {diff.missingAnchors.length > 0 && (
            <div className="p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <div className="text-[10px] text-red-600 dark:text-red-400 mb-1 font-medium">
                {language === 'vi' ? 'Thông tin quan trọng bị mất:' : 'Critical information lost:'}
              </div>
              <ul className="space-y-1">
                {diff.missingAnchors.map((anchor, idx) => (
                  <MissingAnchorItem key={idx} anchor={anchor} language={language} />
                ))}
              </ul>
            </div>
          )}

          {/* Suggestion */}
          {decision.suggestion && (
            <div className="text-[10px] text-gray-500 dark:text-gray-400 italic">
              💡 {decision.suggestion}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-2">
          {/* Primary actions */}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            >
              {language === 'vi' ? 'Sửa lại lệnh' : 'Revise instruction'}
            </button>
            <button
              type="button"
              onClick={onKeepIntent}
              className="px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50 rounded transition-colors"
            >
              {language === 'vi' ? 'Giữ bản gốc' : 'Keep original'}
            </button>
            <button
              type="button"
              onClick={onAcceptDrift}
              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
            >
              {language === 'vi' ? 'Chấp nhận thay đổi' : 'Accept changes'}
            </button>
          </div>

          {/* Hint */}
          <div className="text-[10px] text-gray-400 text-center">
            {language === 'vi'
              ? '"Chấp nhận" sẽ cập nhật định hướng nội dung theo bản mới'
              : '"Accept" will update the content direction to match the new version'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default IntentCanonGuardModal;
