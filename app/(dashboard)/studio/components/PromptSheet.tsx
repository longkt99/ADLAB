'use client';

// ============================================
// PromptSheet - Centered Modal (Novera)
// ============================================
// Quick topic input modal that appears centered.
// Opens when user selects a PromptCard.
//
// FLOW:
// 1. User clicks card → modal opens centered
// 2. User fills topic (required) + tone (optional)
// 3. Press "Viết ngay" → generates structured prompt → AI responds
//
// DESIGN:
// - Centered modal with overlay
// - Novera warm professional tokens
// - Mobile-safe padding
// - PART 1: Enhanced light-mode label readability
// - PART 2: Custom tone dropdown with modern styling
// ============================================

import { useState, useRef, useEffect } from 'react';
import type { PromptCardData } from '@/lib/studio/promptLibrary';
import { CATEGORY_LABELS } from '@/lib/studio/promptLibrary';
import { BRAND_TONES } from '@/lib/studio/tones';
import { Icon } from '@/components/ui/Icon';
// STEP 5: Soft preference memory
import {
  recordToneUsage,
  getInferredTone,
  softResetTonePreference,
  recordCategoryUsage,
} from '@/lib/studio/preferenceMemory';

interface PromptSheetProps {
  card: PromptCardData | null;
  onClose: () => void;
  onSubmit: (structuredPrompt: string, card: PromptCardData, toneId?: string) => void;
}

/**
 * Build structured prompt for AI
 */
function buildStructuredPrompt(
  card: PromptCardData,
  topic: string,
  toneName?: string
): string {
  const lines: string[] = [];

  // Use case header
  lines.push(`[USE CASE]: ${card.title}`);

  // Platform if available
  if (card.platform) {
    lines.push(`[PLATFORM]: ${card.platform}`);
  }

  // Category
  lines.push(`[CATEGORY]: ${CATEGORY_LABELS[card.category]}`);

  // Tone
  if (toneName) {
    lines.push(`[TONE]: ${toneName}`);
  }

  // User context (the main input)
  lines.push(`[CONTEXT]: ${topic}`);

  // Output instruction based on category
  const outputHints: Record<string, string> = {
    social: 'Tạo bài đăng hoàn chỉnh với caption, hashtags phù hợp',
    sales: 'Viết copy bán hàng chuyển đổi cao, súc tích',
    email: 'Viết email hoàn chỉnh với subject line và body',
    seo: 'Tối ưu SEO, sử dụng từ khóa tự nhiên',
    video: 'Viết kịch bản với hook-content-CTA rõ ràng',
    brand: 'Thể hiện bản sắc thương hiệu nhất quán',
    strategy: 'Đưa ra gợi ý chiến lược cụ thể, actionable',
  };
  lines.push(`[OUTPUT]: ${outputHints[card.category] || 'Tạo nội dung chất lượng cao'}`);

  return lines.join('\n');
}

export default function PromptSheet({ card, onClose, onSubmit }: PromptSheetProps) {
  const [topic, setTopic] = useState('');
  const [selectedToneId, setSelectedToneId] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Focus textarea when sheet opens
  // STEP 5: Apply inferred tone preference if no card default
  useEffect(() => {
    if (card) {
      setTopic('');
      // STEP 5: Use card default first, then inferred preference, then empty
      const defaultTone = card.defaultToneId || getInferredTone() || '';
      setSelectedToneId(defaultTone);
      setIsDropdownOpen(false);
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [card]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && card) {
        if (isDropdownOpen) {
          setIsDropdownOpen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [card, onClose, isDropdownOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);

  // Handle submit
  // STEP 5: Record tone and category usage for preference memory
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (topic.trim() && card) {
      const selectedTone = BRAND_TONES.find(t => t.id === selectedToneId);
      const structuredPrompt = buildStructuredPrompt(card, topic.trim(), selectedTone?.name);

      // STEP 5: Record usage for soft preference inference
      if (selectedToneId) {
        recordToneUsage(selectedToneId);
      }
      recordCategoryUsage(card.category);

      onSubmit(structuredPrompt, card, selectedToneId || undefined);
      onClose();
    }
  };

  // Handle Enter key (submit on Enter, newline on Shift+Enter)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (topic.trim() && card) {
        const selectedTone = BRAND_TONES.find(t => t.id === selectedToneId);
        const structuredPrompt = buildStructuredPrompt(card, topic.trim(), selectedTone?.name);

        // STEP 5: Record usage for soft preference inference
        if (selectedToneId) {
          recordToneUsage(selectedToneId);
        }
        recordCategoryUsage(card.category);

        onSubmit(structuredPrompt, card, selectedToneId || undefined);
        onClose();
      }
    }
  };

  // Handle tone selection
  // STEP 5: Record tone change to adjust preference decay
  const handleToneSelect = (toneId: string) => {
    // If user explicitly changes from inferred preference, soft-reset
    const inferred = getInferredTone();
    if (inferred && toneId !== inferred) {
      softResetTonePreference(toneId);
    }
    setSelectedToneId(toneId);
    setIsDropdownOpen(false);
  };

  if (!card) return null;

  const hasContent = topic.trim().length > 0;
  const selectedTone = BRAND_TONES.find(t => t.id === selectedToneId);

  return (
    <>
      {/* Backdrop - full overlay, centered modal */}
      <div
        className="fixed inset-0 z-40 bg-black/40 dark:bg-black/60 backdrop-blur-[2px]"
        style={{
          animation: `fadeIn var(--motion-base) var(--ease-out-premium)`
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container - truly centered */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="w-full max-w-lg bg-card border border-border/60 text-foreground rounded-2xl shadow-md pointer-events-auto max-h-[85vh] flex flex-col"
          style={{
            animation: `scaleIn var(--motion-slow) var(--ease-out-premium)`
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="sheet-title"
        >
          {/* Header - PART 1: Enhanced readability */}
          <div className="px-6 py-5 border-b border-border/60 flex-shrink-0">
            <div className="flex items-start justify-between">
              <div className="flex-1 pr-4">
                <h2 id="sheet-title" className="text-[16px] font-semibold text-foreground leading-snug">
                  {card.title}
                </h2>
                {/* PART 1: Description - near-black in light mode */}
                <p className="mt-1.5 text-[13px] text-neutral-700 dark:text-muted-foreground/80 leading-relaxed font-medium">
                  {card.description}
                </p>
                {card.platform && (
                  <span className="inline-block mt-2 px-2 py-0.5 text-[11px] bg-secondary text-neutral-600 dark:text-muted-foreground rounded font-medium">
                    {card.platform}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="btn-ghost p-2 -mr-2 -mt-1"
                aria-label="Đóng"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
          </div>

          {/* Content - scrollable */}
          <div className="px-6 py-6 overflow-y-auto flex-1">
            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Topic Textarea - PART 1: Enhanced label readability */}
              <div>
                <label
                  htmlFor="topic-input"
                  className="block text-[11px] font-semibold text-neutral-800 dark:text-muted-foreground/80 uppercase tracking-wide mb-2.5"
                >
                  Chủ đề / Ngữ cảnh <span className="text-destructive/80">*</span>
                </label>
                <textarea
                  ref={textareaRef}
                  id="topic-input"
                  rows={3}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={card.topicPlaceholder}
                  className="w-full px-4 py-3 text-[15px] leading-relaxed text-foreground placeholder:text-neutral-400 dark:placeholder:text-muted-foreground bg-secondary/40 dark:bg-secondary/60 border border-border/60 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all duration-150 resize-none"
                />
              </div>

              {/* STEP 2.5: Tone Dropdown - polished spacing, calmer hover, better reading comfort */}
              <div ref={dropdownRef} className="relative">
                <label
                  className="block text-[11px] font-semibold text-zinc-700 dark:text-muted-foreground/80 uppercase tracking-wide mb-2"
                >
                  Giọng văn <span className="normal-case font-medium text-zinc-400 dark:text-muted-foreground">(tùy chọn)</span>
                </label>

                {/* Custom Dropdown Trigger - calmer visual */}
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className={`
                    w-full px-4 py-3 text-[14px] text-left
                    bg-zinc-50 dark:bg-secondary/60
                    border border-zinc-200/80 dark:border-border/60 rounded-xl
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30
                    focus-visible:ring-offset-2 focus-visible:ring-offset-background
                    cursor-pointer transition-all duration-150
                    flex items-center justify-between gap-2
                    ${isDropdownOpen ? 'ring-2 ring-zinc-300/50 dark:ring-ring/20 border-zinc-300 dark:border-border' : ''}
                  `}
                  aria-expanded={isDropdownOpen}
                  aria-haspopup="listbox"
                >
                  <span className={selectedTone ? 'text-zinc-700 dark:text-foreground' : 'text-zinc-400 dark:text-muted-foreground'}>
                    {selectedTone ? selectedTone.name : 'Mặc định'}
                  </span>
                  <Icon
                    name="chevronDown"
                    size={16}
                    className={`text-zinc-300 dark:text-muted-foreground transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {/* Custom Dropdown Menu - improved spacing and hover */}
                {isDropdownOpen && (
                  <div
                    className="absolute z-10 mt-2 w-full bg-card border border-zinc-200/80 dark:border-border/60 rounded-xl shadow-lg overflow-hidden"
                    style={{
                      animation: 'fadeIn 150ms ease-out'
                    }}
                    role="listbox"
                  >
                    <div className="py-2 max-h-64 overflow-y-auto">
                      {/* Default option */}
                      <button
                        type="button"
                        onClick={() => handleToneSelect('')}
                        className={`
                          w-full px-4 py-2.5 text-left text-[14px] flex items-center gap-3
                          transition-colors duration-150
                          ${selectedToneId === ''
                            ? 'bg-zinc-100 dark:bg-primary/10 text-zinc-700 dark:text-foreground font-medium'
                            : 'text-zinc-600 dark:text-foreground hover:bg-zinc-50 dark:hover:bg-secondary/40'
                          }
                        `}
                        role="option"
                        aria-selected={selectedToneId === ''}
                      >
                        <span className="w-4 flex-shrink-0">
                          {selectedToneId === '' && (
                            <Icon name="check" size={14} className="text-zinc-500 dark:text-primary" />
                          )}
                        </span>
                        <span>Mặc định</span>
                      </button>

                      {/* Divider - softer */}
                      <div className="mx-4 my-2 border-t border-zinc-100 dark:border-border/40" />

                      {/* Tone options - improved spacing */}
                      {BRAND_TONES.map((tone) => (
                        <button
                          key={tone.id}
                          type="button"
                          onClick={() => handleToneSelect(tone.id)}
                          className={`
                            w-full px-4 py-2.5 text-left flex items-center gap-3
                            transition-colors duration-150
                            ${selectedToneId === tone.id
                              ? 'bg-zinc-100 dark:bg-primary/10'
                              : 'hover:bg-zinc-50 dark:hover:bg-secondary/40'
                            }
                          `}
                          role="option"
                          aria-selected={selectedToneId === tone.id}
                        >
                          <span className="w-4 flex-shrink-0">
                            {selectedToneId === tone.id && (
                              <Icon name="check" size={14} className="text-zinc-500 dark:text-primary" />
                            )}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className={`text-[14px] ${selectedToneId === tone.id ? 'font-medium text-zinc-700 dark:text-foreground' : 'text-zinc-600 dark:text-foreground'}`}>
                              {tone.name}
                            </div>
                            <div className="text-[11px] text-zinc-400 dark:text-muted-foreground mt-0.5 line-clamp-1">
                              {tone.description}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions - Cancel left, Submit right */}
              <div className="flex items-center gap-3 pt-4 border-t border-border/60">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary h-10"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!hasContent}
                  className={`flex-1 h-10 ${
                    hasContent
                      ? 'btn-primary'
                      : 'bg-secondary/60 text-muted-foreground cursor-not-allowed rounded-lg px-4 text-sm font-medium'
                  }`}
                >
                  Viết ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
