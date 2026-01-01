'use client';

// ============================================
// AdLab Sales Activation Dashboard
// ============================================
// PHASE D37: Sales Activation & Trust Intelligence.
//
// PROVIDES:
// - Trust bundle engagement overview
// - Sales signals distribution
// - Friction point analysis
// - Deal stage indicators
//
// INVARIANTS:
// - Read-only dashboard
// - No raw audit logs exposed
// - No token values shown
// - No identity information
// - Admin/Sales roles only
// ============================================

import { useState, useEffect, useCallback } from 'react';

// ============================================
// Types (mirrored from ops modules for client)
// ============================================

type TrackedSection = 'summary' | 'questionnaire' | 'attestation' | 'whitepaper' | 'evidence';
type DealStageIndicator = 'NO_ACTIVITY' | 'INITIAL_INTEREST' | 'ACTIVE_REVIEW' | 'DEEP_EVALUATION' | 'POTENTIAL_BLOCKER' | 'PROCUREMENT_LIKELY' | 'STALLED';
type SignalConfidence = 'LOW' | 'MEDIUM' | 'HIGH';
type SalesSignalType = 'SECURITY_BLOCKER_SUSPECTED' | 'PROCUREMENT_STAGE_REACHED' | 'SUMMARY_ONLY_CONSUMER' | 'LOW_TRUST_READINESS' | 'DEAL_STALLED' | 'ACTIVE_EVALUATION' | 'DEEP_DIVE_IN_PROGRESS' | 'QUICK_REVIEW_COMPLETED' | 'COMPLIANCE_FOCUS' | 'TECHNICAL_REVIEW' | 'NO_ENGAGEMENT';

interface SalesSignal {
  type: SalesSignalType;
  confidence: SignalConfidence;
  description: string;
  evidence: string[];
  recommendations: string[];
}

interface FrictionPoint {
  section: TrackedSection;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  indicator: string;
  evidence: string;
}

interface BundleSalesIntelligence {
  bundleId: string;
  signals: SalesSignal[];
  primarySignal: SalesSignal | null;
  engagementScore: number;
  frictionPoints: FrictionPoint[];
  dealStageIndicator: DealStageIndicator;
  lastAnalyzedAt: string;
}

interface DashboardData {
  summary: {
    totalBundles: number;
    activeBundles: number;
    totalViews: number;
    totalExports: number;
    averageEngagementScore: number;
  };
  bundlesByStage: Record<DealStageIndicator, number>;
  signalDistribution: Array<{ type: SalesSignalType; count: number }>;
  topFrictionSections: Array<{ section: TrackedSection; count: number }>;
  sectionEngagement: Record<TrackedSection, number>;
  bundles: BundleSalesIntelligence[];
  loading: boolean;
  error: string | null;
}

// ============================================
// Label Helpers
// ============================================

function getSignalLabel(type: SalesSignalType): string {
  const labels: Record<SalesSignalType, string> = {
    SECURITY_BLOCKER_SUSPECTED: 'Security Concerns',
    PROCUREMENT_STAGE_REACHED: 'Procurement',
    SUMMARY_ONLY_CONSUMER: 'Executive Review',
    LOW_TRUST_READINESS: 'Trust Issues',
    DEAL_STALLED: 'Stalled',
    ACTIVE_EVALUATION: 'Active Evaluation',
    DEEP_DIVE_IN_PROGRESS: 'Deep Dive',
    QUICK_REVIEW_COMPLETED: 'Quick Review',
    COMPLIANCE_FOCUS: 'Compliance Focus',
    TECHNICAL_REVIEW: 'Technical Review',
    NO_ENGAGEMENT: 'No Engagement',
  };
  return labels[type];
}

function getDealStageLabel(stage: DealStageIndicator): string {
  const labels: Record<DealStageIndicator, string> = {
    NO_ACTIVITY: 'No Activity',
    INITIAL_INTEREST: 'Initial Interest',
    ACTIVE_REVIEW: 'Active Review',
    DEEP_EVALUATION: 'Deep Evaluation',
    POTENTIAL_BLOCKER: 'Potential Blocker',
    PROCUREMENT_LIKELY: 'Procurement Likely',
    STALLED: 'Stalled',
  };
  return labels[stage];
}

function getSectionLabel(section: TrackedSection): string {
  const labels: Record<TrackedSection, string> = {
    summary: 'Executive Summary',
    questionnaire: 'Security Questionnaire',
    attestation: 'Attestation',
    whitepaper: 'Whitepaper',
    evidence: 'Evidence',
  };
  return labels[section];
}

function getDealStageColor(stage: DealStageIndicator): string {
  switch (stage) {
    case 'PROCUREMENT_LIKELY':
      return 'bg-green-100 text-green-800';
    case 'ACTIVE_REVIEW':
    case 'DEEP_EVALUATION':
      return 'bg-blue-100 text-blue-800';
    case 'INITIAL_INTEREST':
      return 'bg-gray-100 text-gray-800';
    case 'POTENTIAL_BLOCKER':
      return 'bg-orange-100 text-orange-800';
    case 'STALLED':
      return 'bg-red-100 text-red-800';
    case 'NO_ACTIVITY':
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function getConfidenceColor(confidence: SignalConfidence): string {
  switch (confidence) {
    case 'HIGH':
      return 'bg-green-100 text-green-800';
    case 'MEDIUM':
      return 'bg-yellow-100 text-yellow-800';
    case 'LOW':
      return 'bg-gray-100 text-gray-600';
  }
}

function getSeverityColor(severity: 'LOW' | 'MEDIUM' | 'HIGH'): string {
  switch (severity) {
    case 'HIGH':
      return 'bg-red-100 text-red-800';
    case 'MEDIUM':
      return 'bg-yellow-100 text-yellow-800';
    case 'LOW':
      return 'bg-gray-100 text-gray-600';
  }
}

// ============================================
// Component
// ============================================

export default function SalesActivationDashboard() {
  const [data, setData] = useState<DashboardData>({
    summary: {
      totalBundles: 0,
      activeBundles: 0,
      totalViews: 0,
      totalExports: 0,
      averageEngagementScore: 0,
    },
    bundlesByStage: {
      NO_ACTIVITY: 0,
      INITIAL_INTEREST: 0,
      ACTIVE_REVIEW: 0,
      DEEP_EVALUATION: 0,
      POTENTIAL_BLOCKER: 0,
      PROCUREMENT_LIKELY: 0,
      STALLED: 0,
    },
    signalDistribution: [],
    topFrictionSections: [],
    sectionEngagement: {
      summary: 0,
      questionnaire: 0,
      attestation: 0,
      whitepaper: 0,
      evidence: 0,
    },
    bundles: [],
    loading: true,
    error: null,
  });

  const [selectedBundle, setSelectedBundle] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      const response = await fetch('/api/adlab/system/sales/trust-intelligence');
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Access denied. Admin or Sales role required.');
        }
        throw new Error('Failed to fetch dashboard data');
      }
      const result = await response.json();
      if (result.success) {
        setData({
          ...result.data,
          loading: false,
          error: null,
        });
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      setData((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load dashboard',
      }));
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    // Refresh every 5 minutes
    const interval = setInterval(fetchDashboardData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const selectedBundleData = data.bundles.find((b) => b.bundleId === selectedBundle);

  if (data.loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-gray-500">Loading sales intelligence...</div>
        </div>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Access Error</h2>
          <p className="text-red-600">{data.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Sales Trust Intelligence</h1>
        <p className="text-gray-600 mt-1">
          Engagement insights and deal signals from trust bundles
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-gray-900">{data.summary.totalBundles}</div>
          <div className="text-sm text-gray-500">Total Bundles</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-green-600">{data.summary.activeBundles}</div>
          <div className="text-sm text-gray-500">Active Bundles</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-blue-600">{data.summary.totalViews}</div>
          <div className="text-sm text-gray-500">Total Views</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-purple-600">{data.summary.totalExports}</div>
          <div className="text-sm text-gray-500">Total Exports</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-indigo-600">
            {Math.round(data.summary.averageEngagementScore)}
          </div>
          <div className="text-sm text-gray-500">Avg. Engagement</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        {/* Deal Stage Distribution */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Bundles by Stage</h2>
          <div className="space-y-3">
            {(Object.entries(data.bundlesByStage) as [DealStageIndicator, number][])
              .filter(([, count]) => count > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([stage, count]) => (
                <div key={stage} className="flex items-center justify-between">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getDealStageColor(stage)}`}>
                    {getDealStageLabel(stage)}
                  </span>
                  <span className="text-gray-900 font-semibold">{count}</span>
                </div>
              ))}
            {Object.values(data.bundlesByStage).every((v) => v === 0) && (
              <p className="text-gray-500 text-sm">No bundle activity yet</p>
            )}
          </div>
        </div>

        {/* Top Signals */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Signals</h2>
          <div className="space-y-3">
            {data.signalDistribution.slice(0, 5).map(({ type, count }) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{getSignalLabel(type)}</span>
                <span className="text-gray-900 font-semibold">{count}</span>
              </div>
            ))}
            {data.signalDistribution.length === 0 && (
              <p className="text-gray-500 text-sm">No signals detected yet</p>
            )}
          </div>
        </div>

        {/* Section Engagement */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Section Engagement</h2>
          <div className="space-y-3">
            {(Object.entries(data.sectionEngagement) as [TrackedSection, number][])
              .sort((a, b) => b[1] - a[1])
              .map(([section, views]) => {
                const maxViews = Math.max(...Object.values(data.sectionEngagement), 1);
                const width = (views / maxViews) * 100;
                return (
                  <div key={section}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700">{getSectionLabel(section)}</span>
                      <span className="text-gray-500">{views}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-indigo-500 h-2 rounded-full"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Friction Points */}
      <div className="bg-white rounded-lg border p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Friction Sections</h2>
        {data.topFrictionSections.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {data.topFrictionSections.map(({ section, count }) => (
              <span
                key={section}
                className="px-3 py-1.5 bg-orange-50 text-orange-800 rounded-full text-sm"
              >
                {getSectionLabel(section)} ({count} friction points)
              </span>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No significant friction points detected</p>
        )}
      </div>

      {/* Bundle List */}
      <div className="bg-white rounded-lg border">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Bundle Intelligence</h2>
        </div>
        <div className="divide-y">
          {data.bundles.length > 0 ? (
            data.bundles.map((bundle) => (
              <div
                key={bundle.bundleId}
                className={`px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedBundle === bundle.bundleId ? 'bg-indigo-50' : ''
                }`}
                onClick={() => setSelectedBundle(
                  selectedBundle === bundle.bundleId ? null : bundle.bundleId
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-mono text-sm text-gray-600">
                        {bundle.bundleId.slice(0, 20)}...
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getDealStageColor(bundle.dealStageIndicator)}`}>
                          {getDealStageLabel(bundle.dealStageIndicator)}
                        </span>
                        {bundle.primarySignal && (
                          <span className={`px-2 py-0.5 rounded text-xs ${getConfidenceColor(bundle.primarySignal.confidence)}`}>
                            {getSignalLabel(bundle.primarySignal.type)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-lg font-semibold text-gray-900">
                        {bundle.engagementScore}
                      </div>
                      <div className="text-xs text-gray-500">Engagement</div>
                    </div>
                    <div className="text-gray-400">
                      {selectedBundle === bundle.bundleId ? '▼' : '▶'}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {selectedBundle === bundle.bundleId && selectedBundleData && (
                  <div className="mt-4 pt-4 border-t">
                    {/* Signals */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Detected Signals</h4>
                      {selectedBundleData.signals.length > 0 ? (
                        <div className="space-y-2">
                          {selectedBundleData.signals.map((signal, idx) => (
                            <div key={idx} className="bg-gray-50 rounded p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">
                                  {getSignalLabel(signal.type)}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-xs ${getConfidenceColor(signal.confidence)}`}>
                                  {signal.confidence}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600">{signal.description}</p>
                              <div className="mt-2">
                                <div className="text-xs text-gray-500 mb-1">Evidence:</div>
                                <ul className="text-xs text-gray-600 list-disc list-inside">
                                  {signal.evidence.map((e, i) => (
                                    <li key={i}>{e}</li>
                                  ))}
                                </ul>
                              </div>
                              <div className="mt-2">
                                <div className="text-xs text-gray-500 mb-1">Recommendations:</div>
                                <ul className="text-xs text-gray-600 list-disc list-inside">
                                  {signal.recommendations.map((r, i) => (
                                    <li key={i}>{r}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No signals detected</p>
                      )}
                    </div>

                    {/* Friction Points */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Friction Points</h4>
                      {selectedBundleData.frictionPoints.length > 0 ? (
                        <div className="space-y-2">
                          {selectedBundleData.frictionPoints.map((fp, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(fp.severity)}`}>
                                {fp.severity}
                              </span>
                              <span className="text-sm text-gray-700">
                                {getSectionLabel(fp.section)}:
                              </span>
                              <span className="text-sm text-gray-600">{fp.indicator}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No friction points detected</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="px-6 py-8 text-center text-gray-500">
              No bundles with engagement data yet
            </div>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800">
          <strong>Advisory Only:</strong> All signals are heuristic indicators derived from
          engagement patterns. They do not represent conclusions about customer intent or
          commitment. Use as supplementary intelligence alongside direct customer communication.
        </p>
      </div>
    </div>
  );
}
