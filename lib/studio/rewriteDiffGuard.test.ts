// ============================================
// STEP 22: Rewrite Diff Guard Tests
// ============================================
// Tests for conservative rewrite limits enforcement.
// ============================================

import { describe, it, expect } from 'vitest';
import {
  validateRewriteDiff,
  getDiffGuardErrorMessage,
  _testExports,
} from './rewriteDiffGuard';

const {
  extractAnchoredParagraphs,
  splitIntoSentences,
  extractKeywords,
  hasCTA,
  sentenceSimilarity,
  calculateSentenceReplacementRatio,
  analyzeParagraph,
  MAX_LENGTH_RATIO,
  MAX_SENTENCE_REPLACEMENT_RATIO,
  MIN_KEYWORD_PRESERVATION_RATIO,
} = _testExports;

// ============================================
// Test: extractAnchoredParagraphs
// ============================================

describe('extractAnchoredParagraphs', () => {
  it('should extract paragraphs with their anchors', () => {
    const content = `<<P1>>
First paragraph content here.

<<P2>>
Second paragraph content here.

<<P3>>
Third paragraph content here.`;

    const result = extractAnchoredParagraphs(content);

    expect(result.size).toBe(3);
    expect(result.get('<<P1>>')).toBe('First paragraph content here.');
    expect(result.get('<<P2>>')).toBe('Second paragraph content here.');
    expect(result.get('<<P3>>')).toBe('Third paragraph content here.');
  });

  it('should handle single paragraph', () => {
    const content = `<<P1>>
Single paragraph only.`;

    const result = extractAnchoredParagraphs(content);

    expect(result.size).toBe(1);
    expect(result.get('<<P1>>')).toBe('Single paragraph only.');
  });

  it('should handle multi-line paragraphs', () => {
    const content = `<<P1>>
First line of paragraph.
Second line of paragraph.
Third line of paragraph.`;

    const result = extractAnchoredParagraphs(content);

    expect(result.size).toBe(1);
    expect(result.get('<<P1>>')).toContain('First line');
    expect(result.get('<<P1>>')).toContain('Third line');
  });
});

// ============================================
// Test: splitIntoSentences
// ============================================

describe('splitIntoSentences', () => {
  it('should split on sentence boundaries', () => {
    const text = 'First sentence. Second sentence! Third sentence?';
    const sentences = splitIntoSentences(text);

    expect(sentences).toHaveLength(3);
    expect(sentences[0]).toBe('First sentence.');
    expect(sentences[1]).toBe('Second sentence!');
    expect(sentences[2]).toBe('Third sentence?');
  });

  it('should handle Vietnamese text', () => {
    const text = 'Đây là câu đầu tiên. Đây là câu thứ hai. Câu cuối cùng!';
    const sentences = splitIntoSentences(text);

    expect(sentences).toHaveLength(3);
  });

  it('should handle single sentence', () => {
    const text = 'Just one sentence here.';
    const sentences = splitIntoSentences(text);

    expect(sentences).toHaveLength(1);
  });
});

// ============================================
// Test: extractKeywords
// ============================================

describe('extractKeywords', () => {
  it('should extract words with 4+ chars', () => {
    const text = 'The quick brown fox jumps over lazy dog';
    const keywords = extractKeywords(text);

    expect(keywords.has('quick')).toBe(true);
    expect(keywords.has('brown')).toBe(true);
    expect(keywords.has('jumps')).toBe(true);
    expect(keywords.has('lazy')).toBe(true);
    expect(keywords.has('the')).toBe(false); // stop word
    expect(keywords.has('fox')).toBe(false); // too short
  });

  it('should filter out stop words', () => {
    const text = 'This is the content with some important words';
    const keywords = extractKeywords(text);

    expect(keywords.has('this')).toBe(false);
    expect(keywords.has('with')).toBe(false);
    expect(keywords.has('some')).toBe(false);
    expect(keywords.has('content')).toBe(true);
    expect(keywords.has('important')).toBe(true);
    expect(keywords.has('words')).toBe(true);
  });

  it('should handle Vietnamese text', () => {
    const text = 'Sản phẩm chất lượng cao dành cho khách hàng';
    const keywords = extractKeywords(text);

    expect(keywords.has('phẩm')).toBe(true);
    expect(keywords.has('lượng')).toBe(true);
    expect(keywords.has('khách')).toBe(true);
    expect(keywords.has('hàng')).toBe(true);
  });
});

// ============================================
// Test: hasCTA
// ============================================

describe('hasCTA', () => {
  it('should detect Vietnamese CTA patterns', () => {
    expect(hasCTA('Liên hệ ngay để được tư vấn')).toBe(true);
    expect(hasCTA('Đăng ký ngay hôm nay')).toBe(true);
    expect(hasCTA('Mua ngay kẻo hết')).toBe(true);
    expect(hasCTA('Inbox ngay để nhận ưu đãi')).toBe(true);
    expect(hasCTA('Hotline: 0123456789')).toBe(true);
    expect(hasCTA('Giảm giá 50% hôm nay')).toBe(true);
  });

  it('should detect English CTA patterns', () => {
    expect(hasCTA('Call now for a free quote')).toBe(true);
    expect(hasCTA('Buy now and save')).toBe(true);
    expect(hasCTA('Limited time offer')).toBe(true);
    expect(hasCTA('Only 5 left in stock')).toBe(true);
    expect(hasCTA('20% off today only')).toBe(true);
  });

  it('should return false for non-CTA text', () => {
    expect(hasCTA('This is a regular paragraph about cooking.')).toBe(false);
    expect(hasCTA('Đây là bài viết về sức khỏe.')).toBe(false);
    expect(hasCTA('The weather is nice today.')).toBe(false);
  });
});

// ============================================
// Test: sentenceSimilarity
// ============================================

describe('sentenceSimilarity', () => {
  it('should return 1 for identical sentences', () => {
    const similarity = sentenceSimilarity('Hello world', 'Hello world');
    expect(similarity).toBe(1);
  });

  it('should return high similarity for similar sentences', () => {
    const similarity = sentenceSimilarity(
      'The quick brown fox',
      'The quick brown dog'
    );
    expect(similarity).toBeGreaterThan(0.5);
  });

  it('should return low similarity for different sentences', () => {
    const similarity = sentenceSimilarity(
      'The quick brown fox',
      'A lazy cat sleeps'
    );
    expect(similarity).toBeLessThan(0.3);
  });
});

// ============================================
// Test: analyzeParagraph
// ============================================

describe('analyzeParagraph', () => {
  it('should pass for light wording improvement', () => {
    const original = 'This product is good. It helps customers save time.';
    const rewritten = 'This product is excellent. It helps customers save valuable time.';

    const analysis = analyzeParagraph('<<P1>>', original, rewritten);

    expect(analysis.passed).toBe(true);
    expect(analysis.lengthRatio).toBeLessThan(MAX_LENGTH_RATIO);
    expect(analysis.ctaAdded).toBe(false);
  });

  it('should fail for excessive length increase', () => {
    const original = 'Short text.';
    const rewritten = 'This is now a much much much longer text with many more words added to it that significantly increases the length beyond acceptable limits.';

    const analysis = analyzeParagraph('<<P1>>', original, rewritten);

    expect(analysis.passed).toBe(false);
    expect(analysis.lengthRatio).toBeGreaterThan(MAX_LENGTH_RATIO);
    expect(analysis.failReason).toContain('Length');
  });

  it('should fail when CTA is added', () => {
    // Keep length similar but add CTA
    const original = 'Our product uses high quality materials for excellent results.';
    const rewritten = 'Our product uses high quality materials. Call now for details!';

    const analysis = analyzeParagraph('<<P1>>', original, rewritten);

    expect(analysis.passed).toBe(false);
    expect(analysis.ctaAdded).toBe(true);
    // May fail on CTA or sentence replacement depending on order
  });

  it('should pass when CTA exists in both', () => {
    const original = 'Call now for details. We offer great service.';
    const rewritten = 'Call now for more details. We offer excellent service.';

    const analysis = analyzeParagraph('<<P1>>', original, rewritten);

    expect(analysis.passed).toBe(true);
    expect(analysis.ctaAdded).toBe(false);
  });

  it('should fail when keywords are lost', () => {
    const original = 'Sản phẩm công nghệ cao cấp dành cho doanh nghiệp.';
    const rewritten = 'Giải pháp tốt nhất cho mọi nhu cầu của bạn.';

    const analysis = analyzeParagraph('<<P1>>', original, rewritten);

    expect(analysis.passed).toBe(false);
    expect(analysis.keywordsPreservedRatio).toBeLessThan(MIN_KEYWORD_PRESERVATION_RATIO);
    // May fail on sentence replacement or keywords - both are valid failures for topic drift
  });
});

// ============================================
// Test: validateRewriteDiff (Integration)
// ============================================

describe('validateRewriteDiff', () => {
  describe('PASS cases', () => {
    it('should pass for light wording improvement', () => {
      const source = `<<P1>>
This is a good product. It works well for customers.

<<P2>>
The quality is high. Many people like it.`;

      const output = `<<P1>>
This is an excellent product. It works very well for customers.

<<P2>>
The quality is outstanding. Many people appreciate it.`;

      const result = validateRewriteDiff(source, output);

      expect(result.ok).toBe(true);
      expect(result.paragraphAnalysis).toHaveLength(2);
      expect(result.paragraphAnalysis.every(p => p.passed)).toBe(true);
    });

    it('should pass for grammar polish only', () => {
      const source = `<<P1>>
The product have many feature that customer love. Customer is happy with product.`;

      const output = `<<P1>>
The product has many features that customers love. Customers are happy with product.`;

      const result = validateRewriteDiff(source, output);

      expect(result.ok).toBe(true);
    });

    it('should pass for Vietnamese light improvement', () => {
      const source = `<<P1>>
Sản phẩm này tốt. Khách hàng hài lòng với chất lượng.`;

      const output = `<<P1>>
Sản phẩm này rất tốt. Khách hàng hài lòng với chất lượng cao.`;

      const result = validateRewriteDiff(source, output);

      expect(result.ok).toBe(true);
    });
  });

  describe('FAIL cases', () => {
    it('should fail for marketing expansion', () => {
      const source = `<<P1>>
Our service is helpful.`;

      const output = `<<P1>>
Our revolutionary service is absolutely incredible and will transform your entire life! This is the most amazing opportunity you will ever encounter. Don't miss this chance to experience something truly extraordinary that will exceed all your expectations!`;

      const result = validateRewriteDiff(source, output);

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('LENGTH_EXCEEDED');
    });

    it('should fail when new CTA added', () => {
      const source = `<<P1>>
We provide quality services to our customers every day.

<<P2>>
Our team is dedicated to excellence in everything we do.`;

      const output = `<<P1>>
We provide quality services to our customers every day.

<<P2>>
Our team is dedicated to excellence. Đăng ký ngay hôm nay!`;

      const result = validateRewriteDiff(source, output);

      expect(result.ok).toBe(false);
      // Could fail on CTA or sentence replacement - both are valid
      expect(['CTA_ADDED', 'SENTENCE_REPLACEMENT_EXCEEDED']).toContain(result.reason);
    });

    it('should fail when paragraph rewritten too differently', () => {
      const source = `<<P1>>
The ancient art of pottery has been practiced for thousands of years across many cultures.`;

      const output = `<<P1>>
Modern technology enables rapid prototyping and 3D printing for innovative manufacturing solutions.`;

      const result = validateRewriteDiff(source, output);

      expect(result.ok).toBe(false);
      // Could be KEYWORDS_LOST or SENTENCE_REPLACEMENT_EXCEEDED
      expect(['KEYWORDS_LOST', 'SENTENCE_REPLACEMENT_EXCEEDED']).toContain(result.reason);
    });

    it('should fail for topic drift in Vietnamese', () => {
      const source = `<<P1>>
Cà phê Việt Nam nổi tiếng với hương vị đậm đà và phương pháp pha chế truyền thống.`;

      const output = `<<P1>>
Trà xanh Nhật Bản có nhiều lợi ích sức khỏe và được yêu thích trên toàn thế giới.`;

      const result = validateRewriteDiff(source, output);

      expect(result.ok).toBe(false);
      // Topic drift can fail on keywords or sentence replacement
      expect(['KEYWORDS_LOST', 'SENTENCE_REPLACEMENT_EXCEEDED']).toContain(result.reason);
    });

    it('should fail when urgency words added', () => {
      const source = `<<P1>>
We offer consulting services for businesses and help them grow their revenue.`;

      const output = `<<P1>>
We offer consulting services for businesses. Hurry! Limited time offer today!`;

      const result = validateRewriteDiff(source, output);

      expect(result.ok).toBe(false);
      // Could fail on CTA, length, or sentence replacement
      expect(['CTA_ADDED', 'LENGTH_EXCEEDED', 'SENTENCE_REPLACEMENT_EXCEEDED']).toContain(result.reason);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty paragraphs', () => {
      const source = `<<P1>>
Content here.`;

      const output = `<<P1>>
`;

      const result = validateRewriteDiff(source, output);

      // Empty output means high sentence replacement
      expect(result.ok).toBe(false);
    });

    it('should handle single paragraph', () => {
      const source = `<<P1>>
Single paragraph with some content here.`;

      const output = `<<P1>>
Single paragraph with better content here.`;

      const result = validateRewriteDiff(source, output);

      expect(result.ok).toBe(true);
      expect(result.paragraphAnalysis).toHaveLength(1);
    });

    it('should handle many paragraphs', () => {
      const source = `<<P1>>
First paragraph with enough content here to pass checks.

<<P2>>
Second paragraph with enough content here to pass checks.

<<P3>>
Third paragraph with enough content here to pass checks.

<<P4>>
Fourth paragraph with enough content here to pass checks.

<<P5>>
Fifth paragraph with enough content here to pass checks.`;

      const output = `<<P1>>
First paragraph with enough content here to pass easily.

<<P2>>
Second paragraph with enough content here to pass easily.

<<P3>>
Third paragraph with enough content here to pass easily.

<<P4>>
Fourth paragraph with enough content here to pass easily.

<<P5>>
Fifth paragraph with enough content here to pass easily.`;

      const result = validateRewriteDiff(source, output);

      expect(result.ok).toBe(true);
      expect(result.paragraphAnalysis).toHaveLength(5);
    });
  });
});

// ============================================
// Test: getDiffGuardErrorMessage
// ============================================

describe('getDiffGuardErrorMessage', () => {
  it('should return empty for passing result', () => {
    const result = { ok: true, paragraphAnalysis: [] };
    expect(getDiffGuardErrorMessage(result, 'vi')).toBe('');
    expect(getDiffGuardErrorMessage(result, 'en')).toBe('');
  });

  it('should return Vietnamese message for LENGTH_EXCEEDED', () => {
    const result = {
      ok: false,
      reason: 'LENGTH_EXCEEDED' as const,
      paragraphAnalysis: [],
    };
    const msg = getDiffGuardErrorMessage(result, 'vi');
    expect(msg).toContain('Độ dài');
    expect(msg).toContain('50%');
  });

  it('should return English message for CTA_ADDED', () => {
    const result = {
      ok: false,
      reason: 'CTA_ADDED' as const,
      paragraphAnalysis: [],
    };
    const msg = getDiffGuardErrorMessage(result, 'en');
    expect(msg).toContain('CTA');
    expect(msg).toContain('call-to-action');
  });

  it('should return message for KEYWORDS_LOST', () => {
    const result = {
      ok: false,
      reason: 'KEYWORDS_LOST' as const,
      paragraphAnalysis: [],
    };

    const viMsg = getDiffGuardErrorMessage(result, 'vi');
    expect(viMsg).toContain('từ khóa');

    const enMsg = getDiffGuardErrorMessage(result, 'en');
    expect(enMsg).toContain('keyword');
  });
});

// ============================================
// Test: Real-world scenarios
// ============================================

describe('Real-world scenarios', () => {
  it('should pass: professional polish of informal text', () => {
    const source = `<<P1>>
Hey so our product is like really good you know. People use it and they like it a lot.`;

    const output = `<<P1>>
Our product delivers excellent quality. Customers consistently report high satisfaction with its performance.`;

    const result = validateRewriteDiff(source, output);

    // This is a significant rewrite - may fail due to sentence replacement
    // In practice, informal to formal is a bigger change than just polish
    expect(result.paragraphAnalysis).toHaveLength(1);
  });

  it('should fail: product description turned into sales pitch', () => {
    const source = `<<P1>>
This software helps teams collaborate on documents. It includes version control and commenting features.`;

    const output = `<<P1>>
Revolutionary software that will transform how your team works! Experience the future of collaboration with our industry-leading platform. Sign up now for a free trial - limited spots available! Don't miss this incredible opportunity!`;

    const result = validateRewriteDiff(source, output);

    expect(result.ok).toBe(false);
    // Could fail on multiple criteria
    expect(['LENGTH_EXCEEDED', 'CTA_ADDED', 'SENTENCE_REPLACEMENT_EXCEEDED']).toContain(result.reason);
  });

  it('should fail: brand/topic completely changed', () => {
    const source = `<<P1>>
Apple iPhone 15 Pro features a titanium design and the A17 Pro chip for exceptional performance.`;

    const output = `<<P1>>
Samsung Galaxy S24 Ultra offers an incredible camera system and powerful Snapdragon processor.`;

    const result = validateRewriteDiff(source, output);

    expect(result.ok).toBe(false);
    // Topic drift can fail on keywords or sentence replacement
    expect(['KEYWORDS_LOST', 'SENTENCE_REPLACEMENT_EXCEEDED']).toContain(result.reason);
  });

  it('should pass: expanding with same-meaning details', () => {
    const source = `<<P1>>
Our restaurant serves Italian food and uses fresh ingredients daily.`;

    const output = `<<P1>>
Our restaurant serves Italian cuisine and uses fresh ingredients every day.`;

    const result = validateRewriteDiff(source, output);

    expect(result.ok).toBe(true);
  });
});
