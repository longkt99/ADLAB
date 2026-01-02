'use client';

// ============================================
// AdLab Sales Activation Dashboard
// ============================================
// PHASE D38: Revenue Enablement & Sales Activation.
//
// PROVIDES:
// - Playbook recommendations display
// - Trust timeline visualization
// - ROI analytics (advisory)
// - Bundle-level activation data
//
// INVARIANTS:
// - Read-only display
// - No PII shown
// - Advisory labels on all recommendations
// - No auto-actions
// ============================================

import { useEffect, useState, useCallback } from 'react';
import {
  getActionLabel,
  getAssetLabel,
  getPriorityLabel,
  type RecommendedActionType,
  type RecommendedAssetType,
  type RecommendationPriority,
} from '@/lib/adlab/ops/salesPlaybooks';
import {
  getTimelineEventIcon,
  type TimelineEventType,
} from '@/lib/adlab/ops/trustTimeline';
import {
  getEngagementTierLabel,
  getOutcomeLabel,
  getTimeToActionLabel,
  getEngagementTierColor,
  getOutcomeColor,
  type EngagementTier,
  type BundleOutcome,
  type TimeToActionBucket,
} from '@/lib/adlab/ops/trustROI';
import { getDealStageLabel, type DealStageIndicator } from '@/lib/adlab/ops/salesSignals';

// ============================================
// Types
// ============================================

interface PlaybookRecommendation {
  signal: string;
  confidence: string;
  recommendedAction: string;
  recommendedAsset: string | null;
  priority: string;
  rationale: string;
  talkingPoints: string[];
  doNotAutomate: true;
}

interface BundlePlaybook {
  bundleId: string;
  dealStage: string;
  recommendations: PlaybookRecommendation[];
  urgency: string;
  overallGuidance: string;
}

interface TimelineEntry {
  day: number;
  date: string;
  eventType: string;
  description: string;
  details: string[];
  risk: string;
}

interface TrustTimeline {
  bundleId: string;
  totalDays: number;
  entries: TimelineEntry[];
  currentRisk: string;
  riskSummary: string;
  lastActivityDay: number;
}

interface ROIInsight {
  type: string;
  title: string;
  description: string;
  metric: string;
  evidence: string[];
  advisory: true;
}

interface ROIAnalytics {
  bundleCount: number;
  engagementDistribution: Record<string, number>;
  outcomeDistribution: Record<string, number>;
  timeToFirstViewDistribution: Record<string, number>;
  insights: ROIInsight[];
  summary: {
    avgDaysToFirstView: number | null;
    avgDaysToExport: number | null;
    exportRate: number;
    stalledRate: number;
    deepEngagementRate: number;
  };
}

interface WorkspacePlaybookSummary {
  totalBundles: number;
  byUrgency: Record<string, number>;
  topActions: Array<{ action: string; count: number }>;
  topAssets: Array<{ asset: string; count: number }>;
  criticalBundles: string[];
}

interface BundleActivationData {
  bundleId: string;
  label: string | null;
  createdAt: string;
  expiresAt: string;
  status: 'active' | 'expired' | 'revoked';
  intelligence: {
    engagementScore: number;
    dealStageIndicator: string;
    signals: Array<{ type: string; confidence: string; description: string }>;
  } | null;
  playbook: BundlePlaybook | null;
  timeline: TrustTimeline | null;
}

interface DashboardData {
  summary: {
    totalBundles: number;
    activeBundles: number;
    totalViews: number;
    totalExports: number;
  };
  playbookSummary: WorkspacePlaybookSummary;
  roiAnalytics: ROIAnalytics;
  bundles: BundleActivationData[];
}

// ============================================
// Component
// ============================================

export default function SalesActivationPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<string | null>(null);
  const [bundleDetail, setBundleDetail] = useState<BundleActivationData | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'playbooks' | 'roi'>('overview');

  // Fetch dashboard data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/adlab/system/sales/activation');
      const json = await res.json();

      if (!json.success) {
        setError(json.error || 'Failed to load data');
        return;
      }

      setData(json.data);
    } catch {
      setError('Failed to fetch activation data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch single bundle detail
  const fetchBundleDetail = useCallback(async (bundleId: string) => {
    try {
      const res = await fetch(`/api/adlab/system/sales/activation?bundleId=${bundleId}`);
      const json = await res.json();

      if (json.success) {
        setBundleDetail(json.data);
      }
    } catch (e) {
      console.error('Failed to fetch bundle detail:', e);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (selectedBundle) {
      fetchBundleDetail(selectedBundle);
    } else {
      setBundleDetail(null);
    }
  }, [selectedBundle, fetchBundleDetail]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium">Error</h3>
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Sales Activation</h1>
        <p className="text-gray-500 mt-1">
          Revenue enablement insights and recommendations (Advisory Only)
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          label="Active Bundles"
          value={data.summary.activeBundles}
          subtext={`of ${data.summary.totalBundles} total`}
        />
        <SummaryCard
          label="Total Views"
          value={data.summary.totalViews}
          subtext="all time"
        />
        <SummaryCard
          label="Export Rate"
          value={`${data.roiAnalytics.summary.exportRate}%`}
          subtext="bundles exported"
        />
        <SummaryCard
          label="Deep Engagement"
          value={`${data.roiAnalytics.summary.deepEngagementRate}%`}
          subtext="high engagement"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          <TabButton
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </TabButton>
          <TabButton
            active={activeTab === 'playbooks'}
            onClick={() => setActiveTab('playbooks')}
          >
            Playbooks
          </TabButton>
          <TabButton
            active={activeTab === 'roi'}
            onClick={() => setActiveTab('roi')}
          >
            ROI Insights
          </TabButton>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          data={data}
          selectedBundle={selectedBundle}
          onSelectBundle={setSelectedBundle}
          bundleDetail={bundleDetail}
        />
      )}

      {activeTab === 'playbooks' && (
        <PlaybooksTab data={data} />
      )}

      {activeTab === 'roi' && (
        <ROITab data={data} />
      )}

      {/* Advisory Notice */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-800 text-sm">
          <strong>Advisory Notice:</strong> All recommendations and insights are
          informational only. No automated actions are taken. Sales decisions
          should be made by humans based on full context.
        </p>
      </div>
    </div>
  );
}

// ============================================
// Sub-Components
// ============================================

function SummaryCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string | number;
  subtext: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-gray-500 text-sm">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      <p className="text-gray-400 text-xs mt-1">{subtext}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-blue-500 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

function OverviewTab({
  data,
  selectedBundle,
  onSelectBundle,
  bundleDetail,
}: {
  data: DashboardData;
  selectedBundle: string | null;
  onSelectBundle: (id: string | null) => void;
  bundleDetail: BundleActivationData | null;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Bundle List */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-medium text-gray-900">Trust Bundles</h3>
        </div>
        <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
          {data.bundles.map((bundle) => (
            <button
              key={bundle.bundleId}
              onClick={() =>
                onSelectBundle(
                  selectedBundle === bundle.bundleId ? null : bundle.bundleId
                )
              }
              className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                selectedBundle === bundle.bundleId ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-gray-900">
                    {bundle.label || bundle.bundleId.slice(0, 8)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {bundle.intelligence
                      ? getDealStageLabel(bundle.intelligence.dealStageIndicator as DealStageIndicator)
                      : 'No data'}
                  </p>
                </div>
                <StatusBadge status={bundle.status} />
              </div>
              {bundle.intelligence && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    Score: {bundle.intelligence.engagementScore}
                  </span>
                  {bundle.playbook && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        bundle.playbook.urgency === 'CRITICAL'
                          ? 'bg-red-100 text-red-700'
                          : bundle.playbook.urgency === 'HIGH'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {bundle.playbook.urgency}
                    </span>
                  )}
                </div>
              )}
            </button>
          ))}
          {data.bundles.length === 0 && (
            <div className="p-4 text-gray-500 text-sm text-center">
              No bundles found
            </div>
          )}
        </div>
      </div>

      {/* Bundle Detail */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-medium text-gray-900">
            {bundleDetail ? 'Bundle Detail' : 'Select a Bundle'}
          </h3>
        </div>
        {bundleDetail ? (
          <div className="p-4">
            {/* Timeline */}
            {bundleDetail.timeline && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Timeline ({bundleDetail.timeline.totalDays} days)
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {bundleDetail.timeline.entries.map((entry, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-lg">
                        {getTimelineEventIcon(entry.eventType as TimelineEventType)}
                      </span>
                      <div>
                        <p className="text-gray-900">
                          Day {entry.day}: {entry.description}
                        </p>
                        {entry.details.length > 0 && (
                          <p className="text-gray-500 text-xs">
                            {entry.details.join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-sm text-gray-600">
                    <span
                      className={`inline-block w-2 h-2 rounded-full mr-2 ${
                        bundleDetail.timeline.currentRisk === 'HIGH'
                          ? 'bg-red-500'
                          : bundleDetail.timeline.currentRisk === 'MEDIUM'
                          ? 'bg-orange-500'
                          : 'bg-green-500'
                      }`}
                    ></span>
                    {bundleDetail.timeline.riskSummary}
                  </p>
                </div>
              </div>
            )}

            {/* Playbook */}
            {bundleDetail.playbook && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Recommended Actions (Advisory)
                </h4>
                <div className="space-y-3">
                  {bundleDetail.playbook.recommendations.map((rec, i) => (
                    <div
                      key={i}
                      className="bg-gray-50 rounded-lg p-3 text-sm"
                    >
                      <div className="flex justify-between items-start">
                        <p className="font-medium text-gray-900">
                          {getActionLabel(rec.recommendedAction as RecommendedActionType)}
                        </p>
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            rec.priority === 'P0'
                              ? 'bg-red-100 text-red-700'
                              : rec.priority === 'P1'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {getPriorityLabel(rec.priority as RecommendationPriority)}
                        </span>
                      </div>
                      <p className="text-gray-600 mt-1">{rec.rationale}</p>
                      {rec.talkingPoints.length > 0 && (
                        <ul className="mt-2 text-gray-500 text-xs list-disc list-inside">
                          {rec.talkingPoints.map((tp, j) => (
                            <li key={j}>{tp}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 text-gray-500 text-sm text-center">
            Click on a bundle to view details
          </div>
        )}
      </div>
    </div>
  );
}

function PlaybooksTab({ data }: { data: DashboardData }) {
  const ps = data.playbookSummary;

  return (
    <div className="space-y-6">
      {/* Urgency Distribution */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-medium text-gray-900 mb-4">Bundle Urgency Distribution</h3>
        <div className="flex gap-4">
          {Object.entries(ps.byUrgency).map(([urgency, count]) => (
            <div
              key={urgency}
              className={`flex-1 rounded-lg p-4 ${
                urgency === 'CRITICAL'
                  ? 'bg-red-50 border border-red-200'
                  : urgency === 'HIGH'
                  ? 'bg-orange-50 border border-orange-200'
                  : urgency === 'MEDIUM'
                  ? 'bg-yellow-50 border border-yellow-200'
                  : 'bg-gray-50 border border-gray-200'
              }`}
            >
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-sm text-gray-600">{urgency}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Top Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-medium text-gray-900 mb-4">Top Recommended Actions</h3>
          <div className="space-y-3">
            {ps.topActions.map((item, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-sm text-gray-700">
                  {getActionLabel(item.action as RecommendedActionType)}
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {item.count}
                </span>
              </div>
            ))}
            {ps.topActions.length === 0 && (
              <p className="text-gray-500 text-sm">No recommendations yet</p>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-medium text-gray-900 mb-4">Top Recommended Assets</h3>
          <div className="space-y-3">
            {ps.topAssets.map((item, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-sm text-gray-700">
                  {getAssetLabel(item.asset as RecommendedAssetType)}
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {item.count}
                </span>
              </div>
            ))}
            {ps.topAssets.length === 0 && (
              <p className="text-gray-500 text-sm">No asset recommendations yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Critical Bundles */}
      {ps.criticalBundles.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="font-medium text-red-900 mb-2">
            Critical Attention Required
          </h3>
          <p className="text-sm text-red-700 mb-4">
            {ps.criticalBundles.length} bundle(s) need immediate attention
          </p>
          <div className="flex flex-wrap gap-2">
            {ps.criticalBundles.map((id) => (
              <span
                key={id}
                className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm"
              >
                {id.slice(0, 8)}...
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ROITab({ data }: { data: DashboardData }) {
  const roi = data.roiAnalytics;

  return (
    <div className="space-y-6">
      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard
          label="Bundles Analyzed"
          value={roi.bundleCount}
        />
        <MetricCard
          label="Export Rate"
          value={`${roi.summary.exportRate}%`}
        />
        <MetricCard
          label="Stalled Rate"
          value={`${roi.summary.stalledRate}%`}
          warning={roi.summary.stalledRate > 20}
        />
        <MetricCard
          label="Avg Days to View"
          value={roi.summary.avgDaysToFirstView?.toFixed(1) || 'N/A'}
        />
        <MetricCard
          label="Avg Days to Export"
          value={roi.summary.avgDaysToExport?.toFixed(1) || 'N/A'}
        />
      </div>

      {/* Distributions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-medium text-gray-900 mb-4">Engagement Tiers</h3>
          <div className="space-y-2">
            {Object.entries(roi.engagementDistribution).map(([tier, count]) => (
              <DistributionBar
                key={tier}
                label={getEngagementTierLabel(tier as EngagementTier)}
                count={count}
                total={roi.bundleCount}
                color={getEngagementTierColor(tier as EngagementTier)}
              />
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-medium text-gray-900 mb-4">Bundle Outcomes</h3>
          <div className="space-y-2">
            {Object.entries(roi.outcomeDistribution).map(([outcome, count]) => (
              <DistributionBar
                key={outcome}
                label={getOutcomeLabel(outcome as BundleOutcome)}
                count={count}
                total={roi.bundleCount}
                color={getOutcomeColor(outcome as BundleOutcome)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Insights */}
      {roi.insights.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-medium text-gray-900 mb-4">
            Insights (Advisory Only)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roi.insights.map((insight, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-gray-900">{insight.title}</h4>
                  <span className="text-lg font-bold text-blue-600">
                    {insight.metric}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{insight.description}</p>
                <ul className="mt-2 text-xs text-gray-500">
                  {insight.evidence.map((e, j) => (
                    <li key={j}>• {e}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Time to Action */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-medium text-gray-900 mb-4">Time to First View</h3>
        <div className="space-y-2">
          {Object.entries(roi.timeToFirstViewDistribution).map(([bucket, count]) => (
            <DistributionBar
              key={bucket}
              label={getTimeToActionLabel(bucket as TimeToActionBucket)}
              count={count}
              total={roi.bundleCount}
              color="blue"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: 'active' | 'expired' | 'revoked' }) {
  const styles = {
    active: 'bg-green-100 text-green-700',
    expired: 'bg-gray-100 text-gray-700',
    revoked: 'bg-red-100 text-red-700',
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded ${styles[status]}`}>
      {status}
    </span>
  );
}

function MetricCard({
  label,
  value,
  warning,
}: {
  label: string;
  value: string | number;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-lg p-4 ${
        warning ? 'bg-orange-50 border border-orange-200' : 'bg-white border border-gray-200'
      }`}
    >
      <p className="text-sm text-gray-500">{label}</p>
      <p
        className={`text-xl font-bold mt-1 ${
          warning ? 'text-orange-700' : 'text-gray-900'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function DistributionBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;

  const colorMap: Record<string, string> = {
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    yellow: 'bg-yellow-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500',
    gray: 'bg-gray-400',
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 w-32 truncate">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${colorMap[color] || 'bg-blue-500'}`}
          style={{ width: `${pct}%` }}
        ></div>
      </div>
      <span className="text-sm text-gray-700 w-8 text-right">{count}</span>
    </div>
  );
}
