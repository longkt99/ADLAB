'use client';

// ============================================
// Golden Preview Mini Component
// ============================================
// Compact preview card showing selected template/manifest details
// Helps users understand output structure before writing

import React from 'react';
import { resolveTemplateManifest } from '@/lib/studio/templates/resolveManifest';
import type { TemplateManifest } from '@/lib/studio/templates/templateManifest';

interface GoldenPreviewMiniProps {
  templateId: string | null;
}

// ============================================
// "How to use" Mini Copy (Golden Intent UX)
// ============================================
const HOW_TO_USE_HINTS: Record<string, string> = {
  social_caption_v1: 'Gợi ý: Chỉ cần nói rõ chủ đề + vibe mong muốn. Không cần viết dài.',
  seo_blog_v1: 'Gợi ý: Nhập từ khóa chính và đối tượng đọc. Hệ thống sẽ tự cấu trúc bài.',
  video_script_v1: 'Gợi ý: Nói rõ chủ đề + thời lượng. Kịch bản sẽ chia sẵn theo hook và beat.',
  email_marketing_v1: 'Gợi ý: Nói rõ loại email + mục tiêu. Hệ thống sẽ viết subject, body và CTA.',
};

export const GoldenPreviewMini: React.FC<GoldenPreviewMiniProps> = ({ templateId }) => {
  // Early return if no template selected
  if (!templateId) {
    return null; // Minimal UX: render nothing when no template
  }

  // Resolve manifest
  const manifest = resolveTemplateManifest(templateId);

  // Graceful fallback if manifest not found
  if (!manifest) {
    // Dev-friendly warning (non-blocking)
    if (process.env.NODE_ENV === 'development') {
      return (
        <div className="mb-3 p-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800/50 rounded-lg">
          <p className="text-xs text-yellow-700 dark:text-yellow-400">
            ⚠️ Manifest not found for template: <code className="font-mono">{templateId}</code>
          </p>
        </div>
      );
    }
    return null; // Production: silent fallback
  }

  // Extract output sections (3-5 bullets)
  const sections = extractOutputSections(manifest);

  return (
    <div className="mb-3 p-3 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 rounded-xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-blue-900 dark:text-blue-200 truncate">
            {manifest.name}
          </h4>
          <p className="text-[10px] text-blue-700 dark:text-blue-400 font-mono">
            v{manifest.version}
          </p>
        </div>
        <span className="flex-shrink-0 px-2 py-0.5 text-[9px] font-bold bg-blue-200 dark:bg-blue-900 text-blue-800 dark:text-blue-300 rounded-full">
          XEM TRƯỚC
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed mb-2">
        {manifest.description}
      </p>

      {/* Output Sections */}
      {sections.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-1">
            Cấu trúc đầu ra:
          </p>
          <ul className="space-y-0.5">
            {sections.slice(0, 5).map((section, index) => (
              <li key={index} className="flex items-start gap-1.5 text-[11px] text-blue-900 dark:text-blue-200">
                <span className="flex-shrink-0 text-blue-500 dark:text-blue-400">•</span>
                <span className="flex-1 leading-snug">{section}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Optional: Example snippet (only if manifest includes it) */}
      {manifest.examples && manifest.examples.length > 0 && manifest.examples[0].scenario && (
        <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-800">
          <p className="text-[10px] text-blue-600 dark:text-blue-400 italic">
            Ví dụ: {manifest.examples[0].scenario}
          </p>
        </div>
      )}

      {/* "How to use" Mini Hint */}
      {templateId && HOW_TO_USE_HINTS[templateId] && (
        <div className="mt-2 pt-2 border-t border-blue-200/50 dark:border-blue-800/50">
          <p className="text-[10px] text-blue-600/80 dark:text-blue-400/80 leading-relaxed">
            {HOW_TO_USE_HINTS[templateId]}
          </p>
        </div>
      )}
    </div>
  );
};

/**
 * Extract output sections from manifest for preview
 * Tries multiple sources: outputSpec.sections, constraints, or fallback
 */
function extractOutputSections(manifest: TemplateManifest): string[] {
  const sections: string[] = [];

  // Priority 1: outputSpec.sections (structured data)
  if (manifest.outputSpec?.sections && Array.isArray(manifest.outputSpec.sections)) {
    manifest.outputSpec.sections.forEach((section) => {
      if (section.name) {
        const required = section.required ? '(bắt buộc)' : '(tùy chọn)';
        const desc = section.description ? `: ${section.description}` : '';
        sections.push(`${section.name} ${required}${desc}`);
      }
    });
  }

  // Priority 2: constraints.must (if sections not available)
  if (sections.length === 0 && manifest.constraints?.must && Array.isArray(manifest.constraints.must)) {
    manifest.constraints.must.slice(0, 5).forEach((constraint) => {
      sections.push(constraint);
    });
  }

  // Fallback: Generic message if no structured data
  if (sections.length === 0) {
    sections.push('Cấu trúc nội dung được định sẵn');
    sections.push('Tuân theo quy tắc bắt buộc và tránh');
    sections.push(`Định dạng: ${manifest.outputSpec?.format || 'được chỉ định'}`);
  }

  return sections;
}
