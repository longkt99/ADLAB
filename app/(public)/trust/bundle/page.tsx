// ============================================
// Public Trust Bundle Viewer
// ============================================
// PHASE D36: Sales-Ready Trust Bundle Engine.
//
// PUBLIC CUSTOMER-FACING PAGE
// - Zero authentication
// - Token-based access only
// - Fully read-only
// - No navigation outside bundle scope
// ============================================

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

// ============================================
// Types
// ============================================

interface BundleManifest {
  bundleId: string;
  createdAt: string;
  expiresAt: string;
  profile: string;
  label: string | null;
  includedSections: string[];
  evidenceChecksums: Record<string, string>;
  overallStatus: 'READY' | 'UNAVAILABLE' | 'PARTIAL';
  generatedBy: string;
}

interface QuestionnaireAnswer {
  questionId: string;
  answer: unknown;
  status: 'PASS' | 'WARN' | 'UNAVAILABLE';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  explanation?: string;
}

interface QuestionnaireResult {
  questions: Array<{ id: string; question: string; category: string }>;
  answers: QuestionnaireAnswer[];
  summary: {
    total: number;
    passed: number;
    warned: number;
    unavailable: number;
  };
  generatedAt: string;
  checksum: string;
}

interface AttestationResult {
  profile: string;
  profileName: string;
  timestamp: string;
  overallStatus: 'PASS' | 'WARN' | 'FAIL';
  sections: Array<{
    section: string;
    status: string;
    message: string;
    dataPoints: number;
  }>;
  summary: {
    sectionsTotal: number;
    sectionsPassed: number;
    sectionsFailed: number;
  };
  attestationChecksum: string;
}

interface WhitepaperSection {
  id: string;
  title: string;
  status: 'AVAILABLE' | 'UNAVAILABLE' | 'PARTIAL';
  content: string;
}

interface SecurityWhitepaper {
  metadata: {
    title: string;
    generatedAt: string;
    disclaimer: string;
  };
  sections: Record<string, WhitepaperSection>;
  checksum: string;
}

interface SecuritySummary {
  overview: {
    name: string;
    description: string;
    environment: string;
  };
  sla: {
    rto: string | null;
    rpo: string | null;
    availabilityClass: string | null;
  };
  compliance: {
    profilesSupported: string[];
    currentStatus: string;
  };
  commitments: string[];
  generatedAt: string;
}

interface EvidenceMetadata {
  sources: Array<{ id: string; phase: string; name: string; description: string }>;
  checksums: Record<string, string>;
  collectedAt: string;
  disclaimer: string;
}

interface TrustBundle {
  manifest: BundleManifest;
  contents: {
    questionnaire: QuestionnaireResult | null;
    attestation: AttestationResult | null;
    whitepaper: SecurityWhitepaper | null;
    securitySummary: SecuritySummary | null;
    evidenceMetadata: EvidenceMetadata | null;
  };
  checksum: string;
}

// ============================================
// Bundle Viewer Component
// ============================================

function BundleViewerContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [bundle, setBundle] = useState<TrustBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('summary');

  useEffect(() => {
    if (!token) {
      setError('Access token required');
      setLoading(false);
      return;
    }

    fetchBundle(token);
  }, [token]);

  async function fetchBundle(accessToken: string) {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/adlab/public/trust/bundle?token=${encodeURIComponent(accessToken)}`);

      if (response.status === 404) {
        setError('Bundle not found or access denied');
        setLoading(false);
        return;
      }

      const result = await response.json();

      if (!result.success) {
        setError(result.error || 'Failed to load bundle');
        setLoading(false);
        return;
      }

      setBundle(result.data);
    } catch (_e) {
      setError('Failed to load bundle');
    } finally {
      setLoading(false);
    }
  }

  // Format answer value
  const formatAnswer = (answer: unknown): string => {
    if (answer === null || answer === undefined) return 'N/A';
    if (Array.isArray(answer)) return answer.join(', ');
    if (typeof answer === 'boolean') return answer ? 'Yes' : 'No';
    return String(answer);
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading trust bundle...</p>
        </div>
      </div>
    );
  }

  // Error state (404-style, no info leak)
  if (error || !bundle) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl text-gray-300 mb-4">404</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Bundle Not Found</h1>
          <p className="text-gray-600">
            The requested trust bundle could not be found or you do not have access.
          </p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'summary', label: 'Executive Summary' },
    { id: 'questionnaire', label: 'Security Questionnaire' },
    { id: 'attestation', label: 'Attestation' },
    { id: 'whitepaper', label: 'Security Whitepaper' },
    { id: 'evidence', label: 'Evidence' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-xl font-bold">T</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Trust Bundle</h1>
                  {bundle.manifest.label && (
                    <p className="text-gray-600">{bundle.manifest.label}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                bundle.manifest.overallStatus === 'READY'
                  ? 'bg-green-100 text-green-800'
                  : bundle.manifest.overallStatus === 'PARTIAL'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {bundle.manifest.overallStatus}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {bundle.manifest.profile.replace(/_/g, ' ')}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Bundle Meta */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Created</div>
              <div className="font-medium">{formatDate(bundle.manifest.createdAt)}</div>
            </div>
            <div>
              <div className="text-gray-500">Expires</div>
              <div className="font-medium">{formatDate(bundle.manifest.expiresAt)}</div>
            </div>
            <div>
              <div className="text-gray-500">Sections</div>
              <div className="font-medium">{bundle.manifest.includedSections.length} included</div>
            </div>
            <div>
              <div className="text-gray-500">Bundle ID</div>
              <div className="font-mono text-xs">{bundle.manifest.bundleId.slice(0, 16)}...</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Executive Summary */}
        {activeTab === 'summary' && bundle.contents.securitySummary && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Overview</h2>
              <p className="text-gray-700">{bundle.contents.securitySummary.overview.description}</p>
              <div className="mt-4 text-sm text-gray-500">
                Environment: {bundle.contents.securitySummary.overview.environment}
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border shadow-sm p-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Recovery Time (RTO)</h3>
                <div className="text-2xl font-bold text-gray-900">
                  {bundle.contents.securitySummary.sla.rto || 'N/A'}
                </div>
              </div>
              <div className="bg-white rounded-xl border shadow-sm p-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Recovery Point (RPO)</h3>
                <div className="text-2xl font-bold text-gray-900">
                  {bundle.contents.securitySummary.sla.rpo || 'N/A'}
                </div>
              </div>
              <div className="bg-white rounded-xl border shadow-sm p-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Availability Class</h3>
                <div className="text-2xl font-bold text-gray-900">
                  {bundle.contents.securitySummary.sla.availabilityClass || 'N/A'}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Security Commitments</h2>
              <ul className="space-y-2">
                {bundle.contents.securitySummary.commitments.map((commitment, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span className="text-gray-700">{commitment}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Compliance Profiles</h2>
              <div className="flex flex-wrap gap-2">
                {bundle.contents.securitySummary.compliance.profilesSupported.map((profile, i) => (
                  <span key={i} className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm">
                    {profile}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Questionnaire */}
        {activeTab === 'questionnaire' && bundle.contents.questionnaire && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border shadow-sm p-4 mb-6">
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-gray-900">{bundle.contents.questionnaire.summary.total}</div>
                  <div className="text-sm text-gray-500">Total</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{bundle.contents.questionnaire.summary.passed}</div>
                  <div className="text-sm text-gray-500">Passed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-600">{bundle.contents.questionnaire.summary.warned}</div>
                  <div className="text-sm text-gray-500">Warnings</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-500">{bundle.contents.questionnaire.summary.unavailable}</div>
                  <div className="text-sm text-gray-500">Unavailable</div>
                </div>
              </div>
            </div>

            {bundle.contents.questionnaire.questions.map((q, i) => {
              const answer = bundle.contents.questionnaire!.answers[i];
              return (
                <div key={q.id} className={`bg-white rounded-xl border shadow-sm p-4 border-l-4 ${
                  answer.status === 'PASS' ? 'border-l-green-500' :
                  answer.status === 'WARN' ? 'border-l-amber-500' :
                  'border-l-gray-300'
                }`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="text-xs text-gray-500 mb-1">{q.category}</div>
                      <h3 className="font-medium text-gray-900">{q.question}</h3>
                      <div className="mt-2 text-gray-700">{formatAnswer(answer.answer)}</div>
                      {answer.explanation && (
                        <div className="mt-1 text-sm text-gray-500">{answer.explanation}</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        answer.status === 'PASS' ? 'bg-green-100 text-green-800' :
                        answer.status === 'WARN' ? 'bg-amber-100 text-amber-800' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {answer.status}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        answer.confidence === 'HIGH' ? 'bg-blue-100 text-blue-800' :
                        answer.confidence === 'MEDIUM' ? 'bg-indigo-100 text-indigo-800' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {answer.confidence}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Attestation */}
        {activeTab === 'attestation' && bundle.contents.attestation && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {bundle.contents.attestation.profileName}
                </h2>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  bundle.contents.attestation.overallStatus === 'PASS' ? 'bg-green-100 text-green-800' :
                  bundle.contents.attestation.overallStatus === 'WARN' ? 'bg-amber-100 text-amber-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {bundle.contents.attestation.overallStatus}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-gray-900">{bundle.contents.attestation.summary.sectionsTotal}</div>
                  <div className="text-sm text-gray-500">Total Sections</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{bundle.contents.attestation.summary.sectionsPassed}</div>
                  <div className="text-sm text-gray-500">Passed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">{bundle.contents.attestation.summary.sectionsFailed}</div>
                  <div className="text-sm text-gray-500">Failed</div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {bundle.contents.attestation.sections.map((section, i) => (
                <div key={i} className={`bg-white rounded-xl border shadow-sm p-4 border-l-4 ${
                  section.status === 'PASS' ? 'border-l-green-500' :
                  section.status === 'WARN' ? 'border-l-amber-500' :
                  section.status === 'FAIL' ? 'border-l-red-500' :
                  'border-l-gray-300'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900 capitalize">
                        {section.section.replace(/_/g, ' ')}
                      </h3>
                      <p className="text-sm text-gray-600">{section.message}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">{section.dataPoints} data points</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        section.status === 'PASS' ? 'bg-green-100 text-green-800' :
                        section.status === 'WARN' ? 'bg-amber-100 text-amber-800' :
                        section.status === 'FAIL' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {section.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Whitepaper */}
        {activeTab === 'whitepaper' && bundle.contents.whitepaper && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {bundle.contents.whitepaper.metadata.title}
              </h2>
              <p className="text-sm text-gray-500">
                Generated: {formatDate(bundle.contents.whitepaper.metadata.generatedAt)}
              </p>
            </div>

            {Object.values(bundle.contents.whitepaper.sections).map((section) => (
              <div key={section.id} className={`bg-white rounded-xl border shadow-sm p-6 ${
                section.status === 'UNAVAILABLE' ? 'opacity-50' : ''
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{section.title}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    section.status === 'AVAILABLE' ? 'bg-green-100 text-green-800' :
                    section.status === 'PARTIAL' ? 'bg-amber-100 text-amber-800' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {section.status}
                  </span>
                </div>
                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                  {section.content}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Evidence */}
        {activeTab === 'evidence' && bundle.contents.evidenceMetadata && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Evidence Sources</h2>
              <div className="space-y-3">
                {bundle.contents.evidenceMetadata.sources.map((source) => (
                  <div key={source.id} className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg">
                    <div className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-xs font-medium">
                      {source.phase}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{source.name}</h4>
                      <p className="text-sm text-gray-600">{source.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Artifact Checksums</h2>
              <div className="space-y-2 font-mono text-sm">
                {Object.entries(bundle.contents.evidenceMetadata.checksums).map(([key, checksum]) => (
                  <div key={key} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-gray-600">{key}</span>
                    <span className="text-gray-900">{checksum.slice(0, 16)}...</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-amber-50 rounded-xl border border-amber-200 p-6">
              <h2 className="text-lg font-semibold text-amber-900 mb-2">Disclaimer</h2>
              <p className="text-amber-800">{bundle.contents.evidenceMetadata.disclaimer}</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t">
          <div className="text-sm text-gray-500">
            <div className="flex items-center justify-between">
              <span>Bundle Checksum: <code className="text-xs">{bundle.checksum.slice(0, 32)}...</code></span>
              <span>Generated: {formatDate(bundle.manifest.createdAt)}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ============================================
// Export with Suspense boundary
// ============================================

export default function TrustBundlePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    }>
      <BundleViewerContent />
    </Suspense>
  );
}
