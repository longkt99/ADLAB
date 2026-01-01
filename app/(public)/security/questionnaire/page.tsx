// ============================================
// Public Security Questionnaire Page
// ============================================
// PHASE D35: Customer Security Questionnaire Engine.
//
// PUBLIC CUSTOMER-FACING PAGE
// - Zero-auth access
// - Evidence-derived answers only
// - Export capabilities
// - No internal navigation
// ============================================

'use client';

import { useState, useEffect } from 'react';

// ============================================
// Types
// ============================================

type AnswerStatus = 'PASS' | 'WARN' | 'UNAVAILABLE';
type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

interface EvidenceReference {
  source: string;
  reference: string;
  phase?: string;
}

interface SecurityQuestion {
  id: string;
  category: string;
  question: string;
  expectedType: string;
}

interface ResolvedAnswer {
  questionId: string;
  answer: string | number | boolean | string[] | null;
  status: AnswerStatus;
  confidence: ConfidenceLevel;
  evidence: EvidenceReference[];
  explanation?: string;
}

interface QuestionnaireSummary {
  total: number;
  passed: number;
  warned: number;
  unavailable: number;
  confidenceBreakdown: {
    high: number;
    medium: number;
    low: number;
  };
}

interface QuestionnaireData {
  questions: SecurityQuestion[];
  answers: ResolvedAnswer[];
  summary: QuestionnaireSummary;
  generatedAt: string;
  checksum: string;
}

// ============================================
// Component
// ============================================

export default function SecurityQuestionnairePage() {
  const [data, setData] = useState<QuestionnaireData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    fetchQuestionnaire();
  }, []);

  async function fetchQuestionnaire() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/adlab/public/security/questionnaire');
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to load questionnaire');
      }

      setData(result.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load questionnaire');
    } finally {
      setLoading(false);
    }
  }

  async function handleExport(format: string) {
    if (!data) return;

    try {
      setExporting(format);

      const response = await fetch('/api/adlab/public/security/questionnaire/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format }),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `security-questionnaire.${format === 'html' ? 'html' : format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export error:', e);
    } finally {
      setExporting(null);
    }
  }

  // Get unique categories
  const categories = data
    ? ['ALL', ...new Set(data.questions.map(q => q.category))]
    : [];

  // Filter questions by category
  const filteredQuestions = data
    ? selectedCategory === 'ALL'
      ? data.questions
      : data.questions.filter(q => q.category === selectedCategory)
    : [];

  // Get answer for question
  const getAnswer = (questionId: string): ResolvedAnswer | undefined => {
    return data?.answers.find(a => a.questionId === questionId);
  };

  // Format category name
  const formatCategory = (cat: string) => {
    if (cat === 'ALL') return 'All Categories';
    return cat
      .split('_')
      .map(w => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' ');
  };

  // Format answer value
  const formatAnswer = (answer: ResolvedAnswer['answer']): string => {
    if (answer === null || answer === undefined) return 'N/A';
    if (Array.isArray(answer)) return answer.join(', ');
    if (typeof answer === 'boolean') return answer ? 'Yes' : 'No';
    return String(answer);
  };

  // Status styling
  const statusStyles: Record<AnswerStatus, { bg: string; text: string; icon: string }> = {
    PASS: { bg: 'bg-green-100', text: 'text-green-800', icon: 'check_circle' },
    WARN: { bg: 'bg-amber-100', text: 'text-amber-800', icon: 'warning' },
    UNAVAILABLE: { bg: 'bg-gray-100', text: 'text-gray-600', icon: 'help_outline' },
  };

  // Confidence styling
  const confidenceStyles: Record<ConfidenceLevel, { bg: string; text: string }> = {
    HIGH: { bg: 'bg-blue-100', text: 'text-blue-800' },
    MEDIUM: { bg: 'bg-indigo-100', text: 'text-indigo-800' },
    LOW: { bg: 'bg-gray-100', text: 'text-gray-600' },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading questionnaire...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-5xl mb-4">!</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Questionnaire</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchQuestionnaire}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-xl">Q</span>
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Security Questionnaire</h1>
              </div>
              <p className="text-gray-600">
                Auto-generated security responses derived from production evidence
              </p>
            </div>
            <div className="flex gap-2">
              {['json', 'markdown', 'csv', 'html'].map(format => (
                <button
                  key={format}
                  onClick={() => handleExport(format)}
                  disabled={!!exporting}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exporting === format ? 'Exporting...' : format.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 border shadow-sm">
            <div className="text-3xl font-bold text-gray-900">{data.summary.total}</div>
            <div className="text-sm text-gray-500">Total Questions</div>
          </div>
          <div className="bg-white rounded-xl p-4 border shadow-sm">
            <div className="text-3xl font-bold text-green-600">{data.summary.passed}</div>
            <div className="text-sm text-gray-500">Passed</div>
          </div>
          <div className="bg-white rounded-xl p-4 border shadow-sm">
            <div className="text-3xl font-bold text-amber-600">{data.summary.warned}</div>
            <div className="text-sm text-gray-500">Warnings</div>
          </div>
          <div className="bg-white rounded-xl p-4 border shadow-sm">
            <div className="text-3xl font-bold text-gray-500">{data.summary.unavailable}</div>
            <div className="text-sm text-gray-500">Unavailable</div>
          </div>
        </div>

        {/* Confidence Breakdown */}
        <div className="bg-white rounded-xl border shadow-sm mb-8 p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Confidence Distribution</h2>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex h-4 rounded-full overflow-hidden bg-gray-200">
                <div
                  className="bg-blue-500"
                  style={{ width: `${(data.summary.confidenceBreakdown.high / data.summary.total) * 100}%` }}
                />
                <div
                  className="bg-indigo-400"
                  style={{ width: `${(data.summary.confidenceBreakdown.medium / data.summary.total) * 100}%` }}
                />
                <div
                  className="bg-gray-400"
                  style={{ width: `${(data.summary.confidenceBreakdown.low / data.summary.total) * 100}%` }}
                />
              </div>
            </div>
            <div className="flex gap-4 text-sm">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-blue-500"></span>
                High ({data.summary.confidenceBreakdown.high})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-indigo-400"></span>
                Medium ({data.summary.confidenceBreakdown.medium})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-gray-400"></span>
                Low ({data.summary.confidenceBreakdown.low})
              </span>
            </div>
          </div>
        </div>

        {/* Category Filter */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 border hover:bg-gray-50'
                }`}
              >
                {formatCategory(cat)}
                {cat !== 'ALL' && (
                  <span className="ml-1 text-xs opacity-75">
                    ({data.questions.filter(q => q.category === cat).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-4">
          {filteredQuestions.map(question => {
            const answer = getAnswer(question.id);
            if (!answer) return null;

            const status = statusStyles[answer.status];
            const confidence = confidenceStyles[answer.confidence];

            return (
              <div
                key={question.id}
                className="bg-white rounded-xl border shadow-sm overflow-hidden"
              >
                <div className={`border-l-4 ${
                  answer.status === 'PASS' ? 'border-green-500' :
                  answer.status === 'WARN' ? 'border-amber-500' :
                  'border-gray-300'
                }`}>
                  <div className="p-4">
                    {/* Question Header */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            {formatCategory(question.category)}
                          </span>
                          <span className="text-xs text-gray-400">{question.id}</span>
                        </div>
                        <h3 className="text-base font-medium text-gray-900">
                          {question.question}
                        </h3>
                      </div>
                      <div className="flex gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${status.bg} ${status.text}`}>
                          {answer.status}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${confidence.bg} ${confidence.text}`}>
                          {answer.confidence}
                        </span>
                      </div>
                    </div>

                    {/* Answer */}
                    <div className="bg-gray-50 rounded-lg p-3 mb-3">
                      <div className="text-sm text-gray-500 mb-1">Answer:</div>
                      <div className="text-gray-900 font-medium">
                        {formatAnswer(answer.answer)}
                      </div>
                    </div>

                    {/* Explanation */}
                    {answer.explanation && (
                      <div className="text-sm text-gray-600 mb-3">
                        <span className="font-medium">Explanation:</span> {answer.explanation}
                      </div>
                    )}

                    {/* Evidence */}
                    {answer.evidence.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {answer.evidence.map((e, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded"
                          >
                            {e.phase && <span className="font-medium">{e.phase}:</span>}
                            {e.source}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t">
          <div className="text-sm text-gray-500">
            <p className="mb-2">
              <strong>Disclaimer:</strong> This questionnaire was auto-generated from production
              system evidence. All answers are derived from live system state and governance
              artifacts. No claims are manually authored.
            </p>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Generated: {new Date(data.generatedAt).toLocaleString()}</span>
              <span className="font-mono">Checksum: {data.checksum.substring(0, 16)}...</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
