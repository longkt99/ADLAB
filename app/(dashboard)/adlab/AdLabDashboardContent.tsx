'use client';

// ============================================
// AdLab Dashboard Content (Client Component)
// ============================================
// Handles interactive UI elements and rendering.
// ============================================

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AdLabAlert } from '@/lib/adlab/types';

interface PlatformBreakdown {
  platform: string;
  spend: number;
  clicks: number;
  conversions: number;
  revenue: number;
}

interface AdLabDashboardContentProps {
  workspace: { id: string; name: string } | null;
  error: string | null;
  clients: Array<{ id: string; name: string }>;
  counts: {
    clients: number;
    campaigns: number;
    adSets: number;
    ads: number;
    unreadAlerts: number;
    error: string | null;
  } | null;
  summary: {
    totalSpend: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    avgCtr: number;
    avgCpc: number;
    error: string | null;
  } | null;
  dailyMetrics: Array<{
    date: string;
    spend: number;
    clicks: number;
    conversions: number;
    impressions: number;
  }>;
  alerts: AdLabAlert[];
  platformBreakdown: PlatformBreakdown[];
}

// Format currency (VND)
function formatCurrency(n: number): string {
  if (n >= 1000000) {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 1,
      notation: 'compact',
    }).format(n);
  }
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(n);
}

// Format number
function formatNumber(n: number): string {
  if (n >= 1000000) {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat('en-US').format(n);
}

// Format percentage
function formatPercent(n: number): string {
  return `${n.toFixed(2)}%`;
}

// Platform display names and colors
const PLATFORM_CONFIG: Record<string, { name: string; color: string }> = {
  meta: { name: 'Meta', color: 'bg-blue-500' },
  facebook: { name: 'Facebook', color: 'bg-blue-500' },
  google: { name: 'Google', color: 'bg-red-500' },
  tiktok: { name: 'TikTok', color: 'bg-pink-500' },
  linkedin: { name: 'LinkedIn', color: 'bg-sky-600' },
};

export function AdLabDashboardContent({
  workspace,
  error,
  clients: _clients,
  counts,
  summary,
  dailyMetrics,
  alerts,
  platformBreakdown,
}: AdLabDashboardContentProps) {
  const _router = useRouter();

  // Calculate ROAS (reserved for future use)
  const _roas = summary && summary.totalSpend > 0
    ? ((summary.totalConversions * 100000) / summary.totalSpend) // Assume avg order value
    : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AdLab Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {workspace ? `${workspace.name} • Last 30 days` : 'Ad performance analytics'}
          </p>
        </div>
        {workspace && (
          <div className="flex gap-2">
            <Link
              href="/ads/overview"
              className="px-4 py-2 text-sm font-medium bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
            >
              Full Overview
            </Link>
            <Link
              href="/ads/alerts"
              className="px-4 py-2 text-sm font-medium bg-foreground text-background hover:bg-foreground/90 rounded-lg transition-colors"
            >
              View Alerts
            </Link>
          </div>
        )}
      </div>

      {/* Error state - with actionable guidance for connectivity errors */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-800 dark:text-red-200 font-medium mb-2">{error}</p>
          {error.includes('Cannot connect to Supabase') && error.includes('127.0.0.1') && (
            <div className="text-xs text-red-700 dark:text-red-300 space-y-1 mt-3 border-t border-red-200 dark:border-red-800 pt-3">
              <p className="font-semibold">To fix this:</p>
              <p>• <strong>Option A (Local):</strong> Start Docker Desktop, then run: <code className="bg-red-100 dark:bg-red-900/50 px-1 rounded">npx supabase start</code></p>
              <p>• <strong>Option B (Cloud):</strong> Update <code className="bg-red-100 dark:bg-red-900/50 px-1 rounded">.env.local</code> with your Supabase Cloud URL and restart the dev server.</p>
            </div>
          )}
          {error.includes('Cannot connect to Supabase') && error.includes('.supabase.co') && (
            <div className="text-xs text-red-700 dark:text-red-300 space-y-1 mt-3 border-t border-red-200 dark:border-red-800 pt-3">
              <p className="font-semibold">To fix this:</p>
              <p>• Check your internet connection</p>
              <p>• Verify the Supabase project is active and not paused</p>
              <p>• Confirm <code className="bg-red-100 dark:bg-red-900/50 px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> in <code className="bg-red-100 dark:bg-red-900/50 px-1 rounded">.env.local</code> is correct</p>
            </div>
          )}
        </div>
      )}

      {/* No workspace state */}
      {!workspace && !error && (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
            <span className="text-2xl">📊</span>
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">No workspace found</h2>
          <p className="text-sm text-muted-foreground">
            Create a workspace to start tracking ad performance.
          </p>
        </div>
      )}

      {/* Dashboard content */}
      {workspace && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              label="Total Spend"
              value={formatCurrency(summary?.totalSpend || 0)}
              icon="💰"
              trend={null}
            />
            <KPICard
              label="Total Clicks"
              value={formatNumber(summary?.totalClicks || 0)}
              icon="👆"
              subtext={`CTR: ${formatPercent(summary?.avgCtr || 0)}`}
            />
            <KPICard
              label="Conversions"
              value={formatNumber(summary?.totalConversions || 0)}
              icon="🎯"
              subtext={summary && summary.totalClicks > 0
                ? `${((summary.totalConversions / summary.totalClicks) * 100).toFixed(1)}% CVR`
                : undefined}
            />
            <KPICard
              label="Avg CPC"
              value={formatCurrency(summary?.avgCpc || 0)}
              icon="📈"
              trend={null}
            />
          </div>

          {/* Entity Counts */}
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Active Entities</h3>
            <div className="grid grid-cols-5 gap-4">
              <EntityCount label="Clients" count={counts?.clients || 0} href="/ads/clients" />
              <EntityCount label="Campaigns" count={counts?.campaigns || 0} href="/ads/campaigns" />
              <EntityCount label="Ad Sets" count={counts?.adSets || 0} href="/ads/ad-sets" />
              <EntityCount label="Ads" count={counts?.ads || 0} href="/ads/ads" />
              <EntityCount
                label="Alerts"
                count={counts?.unreadAlerts || 0}
                href="/ads/alerts"
                highlight={counts?.unreadAlerts ? counts.unreadAlerts > 0 : false}
              />
            </div>
          </div>

          {/* Two column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Trend Chart */}
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground mb-4">Spend Trend (30 days)</h3>
              {dailyMetrics.length > 0 ? (
                <DailyTrendChart data={dailyMetrics} />
              ) : (
                <EmptyChart message="No metrics data available" />
              )}
            </div>

            {/* Platform Breakdown */}
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground mb-4">Platform Breakdown</h3>
              {platformBreakdown.length > 0 ? (
                <PlatformBreakdownTable data={platformBreakdown} />
              ) : (
                <EmptyChart message="No platform data available" />
              )}
            </div>
          </div>

          {/* Recent Alerts */}
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Recent Alerts</h3>
              <Link
                href="/ads/alerts"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View all →
              </Link>
            </div>
            {alerts.length > 0 ? (
              <AlertsList alerts={alerts} />
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">No unread alerts</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

function KPICard({
  label,
  value,
  icon,
  trend,
  subtext,
}: {
  label: string;
  value: string;
  icon: string;
  trend?: number | null;
  subtext?: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
          {subtext && <p className="text-xs text-muted-foreground mt-0.5">{subtext}</p>}
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
      {trend !== null && trend !== undefined && (
        <div className={`mt-2 text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}% vs previous
        </div>
      )}
    </div>
  );
}

function EntityCount({
  label,
  count,
  href,
  highlight,
}: {
  label: string;
  count: number;
  href: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className="text-center group cursor-pointer"
    >
      <p className={`text-2xl font-bold transition-colors ${highlight ? 'text-amber-500' : 'text-foreground group-hover:text-foreground/80'}`}>
        {formatNumber(count)}
      </p>
      <p className="text-xs text-muted-foreground group-hover:text-muted-foreground/80 transition-colors">
        {label}
      </p>
    </Link>
  );
}

function DailyTrendChart({
  data,
}: {
  data: Array<{ date: string; spend: number; clicks: number }>;
}) {
  // Sort by date and take last 30
  const sorted = [...data]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);

  const maxSpend = Math.max(...sorted.map(d => d.spend), 1);

  return (
    <div>
      <div className="h-40 flex items-end gap-1">
        {sorted.map((day, idx) => {
          const height = (day.spend / maxSpend) * 100;
          return (
            <div
              key={idx}
              className="flex-1 bg-blue-500/70 hover:bg-blue-500 rounded-t transition-colors cursor-pointer group relative"
              style={{ height: `${Math.max(height, 2)}%` }}
            >
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-foreground text-background text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                {day.date}: {formatCurrency(day.spend)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-2">
        <span className="text-[10px] text-muted-foreground">
          {sorted[0]?.date}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {sorted[sorted.length - 1]?.date}
        </span>
      </div>
    </div>
  );
}

function PlatformBreakdownTable({
  data,
}: {
  data: PlatformBreakdown[];
}) {
  const totalSpend = data.reduce((sum, p) => sum + p.spend, 0);

  return (
    <div className="space-y-3">
      {data.map((platform) => {
        const config = PLATFORM_CONFIG[platform.platform] || { name: platform.platform, color: 'bg-gray-500' };
        const percentage = totalSpend > 0 ? (platform.spend / totalSpend) * 100 : 0;

        return (
          <div key={platform.platform}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-foreground">{config.name}</span>
              <span className="text-sm text-muted-foreground">{formatCurrency(platform.spend)}</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full ${config.color} rounded-full transition-all`}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-muted-foreground">
              <span>{formatNumber(platform.clicks)} clicks</span>
              <span>{formatNumber(platform.conversions)} conv.</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AlertsList({ alerts }: { alerts: AdLabAlert[] }) {
  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
      case 'warning':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
    }
  };

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <Link
          key={alert.id}
          href={`/ads/alerts/${alert.id}`}
          className="block p-3 rounded-lg border border-border hover:bg-secondary/30 transition-colors"
        >
          <div className="flex items-start gap-3">
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${getSeverityStyle(alert.severity)}`}>
              {alert.severity}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground truncate">{alert.message}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(alert.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-40 flex items-center justify-center bg-secondary/30 rounded-lg">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
