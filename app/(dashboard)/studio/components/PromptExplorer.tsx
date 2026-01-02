'use client';

// ============================================
// PromptExplorer - Browse All Prompts Modal
// ============================================
// Modal for discovering and filtering the full prompt library.
// Opens via "Khám phá prompt" link from PromptGrid.
//
// UX PHILOSOPHY:
// - Intent-driven: "What do you want to do?" not "Filter database"
// - Beginner-friendly: guidance text, simple language
// - Calm, editorial feel - suggestions, not configuration
//
// FLOW:
// User clicks card in Explorer → closes Explorer → opens PromptSheet
// ============================================

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  PROMPT_CARDS,
  type PromptCardData,
  type PromptCategory,
} from '@/lib/studio/promptLibrary';
import PromptCard from './PromptCard';
import { Icon } from '@/components/ui/Icon';

interface PromptExplorerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCard: (card: PromptCardData) => void;
}

// ============================================
// Intent-driven Category Labels (user language, not technical)
// ============================================
const INTENT_LABELS: Record<PromptCategory, string> = {
  social: 'Viết cho mạng xã hội',
  sales: 'Bán hàng',
  email: 'Viết email',
  seo: 'Viết để lên Google',
  video: 'Viết cho video',
  brand: 'Xây thương hiệu',
  strategy: 'Lập kế hoạch',
};

// Order categories by common usage
const CATEGORY_ORDER: PromptCategory[] = [
  'social',
  'sales',
  'video',
  'seo',
  'email',
  'brand',
  'strategy',
];

// ============================================
// Use Cases - Limited to 5 most common per category
// ============================================
const USE_CASES_BY_CATEGORY: Record<PromptCategory, { id: string; label: string }[]> = {
  social: [
    { id: 'caption', label: 'Caption' },
    { id: 'hook', label: 'Hook mở đầu' },
    { id: 'cta', label: 'Kêu gọi hành động' },
    { id: 'engagement', label: 'Tạo tương tác' },
    { id: 'story', label: 'Kể chuyện' },
  ],
  sales: [
    { id: 'product', label: 'Mô tả sản phẩm' },
    { id: 'cta', label: 'Kêu gọi mua' },
    { id: 'benefit', label: 'Lợi ích' },
    { id: 'urgency', label: 'Tạo khan hiếm' },
  ],
  email: [
    { id: 'promo', label: 'Khuyến mãi' },
    { id: 'newsletter', label: 'Bản tin' },
    { id: 'outreach', label: 'Tiếp cận mới' },
    { id: 'followup', label: 'Nhắc nhở' },
  ],
  seo: [
    { id: 'blog', label: 'Bài blog' },
    { id: 'meta', label: 'Meta & Title' },
    { id: 'product', label: 'Mô tả sản phẩm' },
    { id: 'local', label: 'Địa phương' },
  ],
  video: [
    { id: 'script', label: 'Kịch bản' },
    { id: 'hook', label: 'Hook 3 giây' },
    { id: 'cta', label: 'Kết video' },
  ],
  brand: [
    { id: 'tagline', label: 'Slogan' },
    { id: 'story', label: 'Câu chuyện' },
    { id: 'about', label: 'Giới thiệu' },
  ],
  strategy: [
    { id: 'calendar', label: 'Lịch nội dung' },
    { id: 'analysis', label: 'Phân tích' },
    { id: 'planning', label: 'Lên ý tưởng' },
  ],
};

export default function PromptExplorer({
  isOpen,
  onClose,
  onSelectCard,
}: PromptExplorerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PromptCategory | 'all'>('all');
  const [selectedUseCase, setSelectedUseCase] = useState<string>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Reset filters when opening
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset filters when modal opens
      setSearchQuery('');
      setSelectedCategory('all');
      setSelectedUseCase('all');
      // Focus search input after animation
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Reset use case when category changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Derived state reset when category changes
    setSelectedUseCase('all');
  }, [selectedCategory]);

  // Filter cards
  const filteredCards = useMemo(() => {
    let result = PROMPT_CARDS;

    // Category filter
    if (selectedCategory !== 'all') {
      result = result.filter(card => card.category === selectedCategory);
    }

    // Use case filter (simple keyword matching in title/description)
    if (selectedUseCase !== 'all' && selectedCategory !== 'all') {
      const useCaseKeywords: Record<string, string[]> = {
        // Social
        caption: ['caption', 'bài đăng', 'post'],
        hook: ['hook', 'thu hút'],
        cta: ['cta', 'kêu gọi'],
        story: ['story', 'kể chuyện'],
        engagement: ['tương tác', 'comment', 'câu hỏi'],
        // Sales
        product: ['sản phẩm', 'product', 'mô tả'],
        urgency: ['khan hiếm', 'urgency', 'flash'],
        benefit: ['lợi ích', 'benefit'],
        // Email
        promo: ['khuyến mãi', 'promo'],
        newsletter: ['newsletter', 'bản tin'],
        outreach: ['cold', 'outreach', 'tiếp cận'],
        followup: ['follow', 'nhắc'],
        // SEO
        blog: ['blog', 'bài viết', 'mở bài'],
        meta: ['meta', 'description'],
        local: ['local', 'địa phương'],
        // Video
        script: ['script', 'kịch bản'],
        // Brand
        tagline: ['tagline', 'slogan'],
        about: ['about', 'giới thiệu'],
        // Strategy
        calendar: ['calendar', 'lịch'],
        analysis: ['phân tích', 'analysis', 'competitor'],
        planning: ['kế hoạch', 'plan', 'pillar'],
      };

      const keywords = useCaseKeywords[selectedUseCase] || [];
      if (keywords.length > 0) {
        result = result.filter(card => {
          const text = `${card.title} ${card.description}`.toLowerCase();
          return keywords.some(kw => text.includes(kw.toLowerCase()));
        });
      }
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(card => {
        const text = `${card.title} ${card.description} ${card.platform || ''}`.toLowerCase();
        return text.includes(query);
      });
    }

    return result;
  }, [selectedCategory, selectedUseCase, searchQuery]);

  // Get available use cases for current category
  const availableUseCases = selectedCategory !== 'all'
    ? USE_CASES_BY_CATEGORY[selectedCategory]
    : [];

  // Handle card selection
  const handleCardClick = (card: PromptCardData) => {
    onClose();
    // Small delay to allow close animation
    setTimeout(() => {
      onSelectCard(card);
    }, 100);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 backdrop-blur-[2px] animate-[fadeIn_0.2s_ease-out]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="fixed inset-x-0 bottom-0 sm:inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 animate-[slideUp_0.3s_cubic-bezier(0.16,1,0.3,1)] sm:animate-[fadeIn_0.2s_ease-out]">
        <div
          className="w-full sm:max-w-2xl bg-white dark:bg-zinc-900 rounded-t-[20px] sm:rounded-[16px] shadow-2xl max-h-[90vh] sm:max-h-[80vh] overflow-hidden flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-labelledby="explorer-title"
        >
          {/* Header */}
          <div className="flex-shrink-0 px-5 sm:px-6 pt-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
            {/* Drag handle - mobile only */}
            <div className="flex justify-center mb-3 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-zinc-200 dark:bg-zinc-700" />
            </div>

            {/* Close button - top right */}
            <div className="flex justify-end mb-2">
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 -mr-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                aria-label="Đóng"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            {/* Guidance layer - conversational, intent-driven */}
            <div className="mb-4">
              <h2
                id="explorer-title"
                className="text-[17px] font-medium text-zinc-900 dark:text-zinc-100 mb-1"
              >
                Bạn muốn viết gì hôm nay?
              </h2>
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                Chọn mục đích, mình sẽ gợi ý cách viết phù hợp.
              </p>
            </div>

            {/* Category Filter - intent-driven labels */}
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 text-[12px] rounded-lg border transition-all duration-150 ${
                  selectedCategory === 'all'
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent'
                    : 'bg-transparent border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                }`}
              >
                Tất cả
              </button>
              {CATEGORY_ORDER.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 text-[12px] rounded-lg border transition-all duration-150 ${
                    selectedCategory === cat
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent'
                      : 'bg-transparent border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }`}
                >
                  {INTENT_LABELS[cat]}
                </button>
              ))}
            </div>

            {/* Use Case Filter - contextual, only when category selected */}
            {selectedCategory !== 'all' && availableUseCases.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500 mr-1 py-1">
                  Cụ thể hơn:
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedUseCase('all')}
                  className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${
                    selectedUseCase === 'all'
                      ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200'
                      : 'text-zinc-500 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  Tất cả
                </button>
                {availableUseCases.map(uc => (
                  <button
                    key={uc.id}
                    type="button"
                    onClick={() => setSelectedUseCase(uc.id)}
                    className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${
                      selectedUseCase === uc.id
                        ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200'
                        : 'text-zinc-500 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                    }`}
                  >
                    {uc.label}
                  </button>
                ))}
              </div>
            )}

            {/* Search - tertiary, subtle, clearly optional */}
            <div className="relative">
              <Icon
                name="search"
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300 dark:text-zinc-600"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Hoặc gõ từ khóa bất kỳ..."
                className="w-full pl-8 pr-4 py-2 text-[13px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-300 dark:placeholder:text-zinc-600 bg-zinc-50/50 dark:bg-zinc-800/30 border border-zinc-200/40 dark:border-zinc-700/30 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-300 dark:focus:ring-zinc-600 focus:border-transparent focus:bg-zinc-50 dark:focus:bg-zinc-800/40 transition-all duration-150"
              />
            </div>
          </div>

          {/* Cards Grid - scrollable */}
          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4">
            {filteredCards.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mb-2">
                  Chưa có gợi ý nào khớp
                </p>
                <p className="text-[12px] text-zinc-400 dark:text-zinc-500 mb-3">
                  Thử chọn mục đích khác hoặc xóa bộ lọc
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('all');
                    setSelectedUseCase('all');
                    setSearchQuery('');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors"
                >
                  Xem tất cả gợi ý
                </button>
              </div>
            ) : (
              <>
                {/* Result count - subtle */}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                    {filteredCards.length} gợi ý
                  </p>
                  {selectedCategory !== 'all' && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory('all');
                        setSelectedUseCase('all');
                      }}
                      className="text-[11px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400"
                    >
                      Xem tất cả
                    </button>
                  )}
                </div>
                <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-2">
                  {filteredCards.map((card) => (
                    <PromptCard
                      key={card.id}
                      card={card}
                      onSelect={handleCardClick}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
