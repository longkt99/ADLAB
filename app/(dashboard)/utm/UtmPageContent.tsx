'use client';

// ============================================
// UTM Page Content (Client Component)
// ============================================
// Handles tab switching and interactive UI elements.
// ============================================

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { UtmLinkWithStats, UtmTemplate, UtmAnalyticsSummary } from '@/lib/utm/queries';

interface UtmPageContentProps {
  activeTab: string;
  workspace: { id: string; name: string } | null;
  error: string | null;
  links: UtmLinkWithStats[];
  templates: UtmTemplate[];
  analyticsSummary: UtmAnalyticsSummary[];
  dailyAnalytics: { day: string; clicks: number; sessions: number; conversions: number; revenue: number }[];
  filterOptions: { sources: string[]; mediums: string[]; campaigns: string[] };
}

// Tab definitions
const TABS = [
  { id: 'builder', label: 'Builder', icon: '🔗' },
  { id: 'library', label: 'Library', icon: '📚' },
  { id: 'analytics', label: 'Analytics', icon: '📊' },
];

export function UtmPageContent({
  activeTab,
  workspace,
  error,
  links,
  templates,
  analyticsSummary,
  dailyAnalytics,
  filterOptions,
}: UtmPageContentProps) {
  const router = useRouter();

  // Handle tab change
  const handleTabChange = (tabId: string) => {
    router.push(`/utm?tab=${tabId}`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">UTM Tracking</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Build, track, and analyze your marketing campaign URLs
        </p>
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
            <span className="text-2xl">🔗</span>
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">No workspace found</h2>
          <p className="text-sm text-muted-foreground">
            Create a workspace to start building UTM links.
          </p>
        </div>
      )}

      {/* Main content */}
      {workspace && (
        <>
          {/* Tabs */}
          <div className="border-b border-border mb-6">
            <nav className="flex gap-6" aria-label="Tabs">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`
                    pb-3 px-1 text-sm font-medium border-b-2 transition-colors
                    ${activeTab === tab.id
                      ? 'border-foreground text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50'
                    }
                  `}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab content */}
          {activeTab === 'builder' && (
            <UtmBuilder workspaceId={workspace.id} templates={templates} />
          )}
          {activeTab === 'library' && (
            <UtmLibrary links={links} filterOptions={filterOptions} />
          )}
          {activeTab === 'analytics' && (
            <UtmAnalytics
              summary={analyticsSummary}
              dailyData={dailyAnalytics}
            />
          )}
        </>
      )}
    </div>
  );
}

// ============================================
// UTM Builder Tab
// ============================================

function UtmBuilder({
  workspaceId,
  templates,
}: {
  workspaceId: string;
  templates: UtmTemplate[];
}) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    base_url: '',
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    utm_content: '',
    utm_term: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Build final URL preview
  const buildPreviewUrl = () => {
    if (!formData.base_url || !formData.utm_source || !formData.utm_medium || !formData.utm_campaign) {
      return '';
    }
    try {
      const url = new URL(formData.base_url);
      url.searchParams.set('utm_source', formData.utm_source);
      url.searchParams.set('utm_medium', formData.utm_medium);
      url.searchParams.set('utm_campaign', formData.utm_campaign);
      if (formData.utm_content) url.searchParams.set('utm_content', formData.utm_content);
      if (formData.utm_term) url.searchParams.set('utm_term', formData.utm_term);
      return url.toString();
    } catch {
      return '';
    }
  };

  const previewUrl = buildPreviewUrl();
  const isValid = formData.base_url && formData.utm_source && formData.utm_medium && formData.utm_campaign;

  // Apply template
  const handleApplyTemplate = (template: UtmTemplate) => {
    const defaults = template.defaults as Record<string, string>;
    setFormData(prev => ({
      ...prev,
      utm_source: defaults.utm_source || prev.utm_source,
      utm_medium: defaults.utm_medium || prev.utm_medium,
      utm_campaign: defaults.utm_campaign || prev.utm_campaign,
      utm_content: defaults.utm_content || prev.utm_content,
      utm_term: defaults.utm_term || prev.utm_term,
    }));
  };

  // Handle save
  const handleSave = async () => {
    if (!isValid) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/utm/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          ...formData,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create UTM link');
      }

      setSuccess(true);
      setFormData({
        name: '',
        base_url: '',
        utm_source: '',
        utm_medium: '',
        utm_campaign: '',
        utm_content: '',
        utm_term: '',
      });

      // Refresh page to show new link
      setTimeout(() => {
        router.refresh();
        setSuccess(false);
      }, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Create UTM Link</h2>

        {/* Templates quick-apply */}
        {templates.length > 0 && (
          <div className="mb-6">
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              Quick Templates
            </label>
            <div className="flex flex-wrap gap-2">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleApplyTemplate(template)}
                  className="px-3 py-1.5 text-xs bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
                >
                  {template.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* Name (optional) */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Link Name <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Summer Sale Banner"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Base URL (required) */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Base URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={formData.base_url}
              onChange={(e) => setFormData(prev => ({ ...prev, base_url: e.target.value }))}
              placeholder="https://example.com/landing-page"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* UTM Source (required) */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              utm_source <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.utm_source}
              onChange={(e) => setFormData(prev => ({ ...prev, utm_source: e.target.value }))}
              placeholder="facebook, google, newsletter"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-[10px] text-muted-foreground/60 mt-1">Identifies which site sent the traffic</p>
          </div>

          {/* UTM Medium (required) */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              utm_medium <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.utm_medium}
              onChange={(e) => setFormData(prev => ({ ...prev, utm_medium: e.target.value }))}
              placeholder="cpc, paid_social, email"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-[10px] text-muted-foreground/60 mt-1">Marketing medium (cpc, banner, email)</p>
          </div>

          {/* UTM Campaign (required) */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              utm_campaign <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.utm_campaign}
              onChange={(e) => setFormData(prev => ({ ...prev, utm_campaign: e.target.value }))}
              placeholder="summer_sale_2024"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-[10px] text-muted-foreground/60 mt-1">Campaign name, promo code, or slogan</p>
          </div>

          {/* UTM Content (optional) */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              utm_content <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <input
              type="text"
              value={formData.utm_content}
              onChange={(e) => setFormData(prev => ({ ...prev, utm_content: e.target.value }))}
              placeholder="banner_top, cta_button"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-[10px] text-muted-foreground/60 mt-1">Differentiate ads or links in same campaign</p>
          </div>

          {/* UTM Term (optional) */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              utm_term <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <input
              type="text"
              value={formData.utm_term}
              onChange={(e) => setFormData(prev => ({ ...prev, utm_term: e.target.value }))}
              placeholder="running+shoes"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-[10px] text-muted-foreground/60 mt-1">Paid search keywords</p>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-3">
              <p className="text-xs text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Success message */}
          {success && (
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg p-3">
              <p className="text-xs text-green-800 dark:text-green-200">UTM link created successfully!</p>
            </div>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={!isValid || saving}
            className={`
              w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-colors
              ${isValid && !saving
                ? 'bg-foreground text-background hover:bg-foreground/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
              }
            `}
          >
            {saving ? 'Saving...' : 'Create UTM Link'}
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Preview</h2>

        {previewUrl ? (
          <div className="space-y-4">
            <div className="bg-secondary/50 rounded-lg p-4 break-all">
              <p className="text-sm font-mono text-foreground">{previewUrl}</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(previewUrl)}
                className="flex-1 py-2 px-4 text-sm font-medium bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
              >
                Copy URL
              </button>
            </div>

            <div className="border-t border-border pt-4 mt-4">
              <h3 className="text-xs font-medium text-muted-foreground mb-3">Parameters Breakdown</h3>
              <div className="space-y-2">
                {[
                  { key: 'utm_source', value: formData.utm_source },
                  { key: 'utm_medium', value: formData.utm_medium },
                  { key: 'utm_campaign', value: formData.utm_campaign },
                  { key: 'utm_content', value: formData.utm_content },
                  { key: 'utm_term', value: formData.utm_term },
                ].filter(p => p.value).map((param) => (
                  <div key={param.key} className="flex justify-between text-xs">
                    <span className="text-muted-foreground font-mono">{param.key}</span>
                    <span className="text-foreground">{param.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-secondary/30 rounded-lg p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Fill in the required fields to see your UTM link preview
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// UTM Library Tab
// ============================================

function UtmLibrary({
  links,
  filterOptions,
}: {
  links: UtmLinkWithStats[];
  filterOptions: { sources: string[]; mediums: string[]; campaigns: string[] };
}) {
  const [search, setSearch] = useState('');

  // Filter links by search
  const filteredLinks = links.filter(link => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      link.name?.toLowerCase().includes(searchLower) ||
      link.base_url.toLowerCase().includes(searchLower) ||
      link.utm_source.toLowerCase().includes(searchLower) ||
      link.utm_medium.toLowerCase().includes(searchLower) ||
      link.utm_campaign.toLowerCase().includes(searchLower)
    );
  });

  // Format number
  const formatNumber = (n: number) => new Intl.NumberFormat('en-US').format(n);

  // Format currency (VND)
  const formatCurrency = (n: number) => new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(n);

  return (
    <div>
      {/* Search and filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, URL, or campaign..."
            className="w-full px-4 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Links count */}
      <p className="text-xs text-muted-foreground mb-4">
        {filteredLinks.length} link{filteredLinks.length !== 1 ? 's' : ''}
        {search && ` matching "${search}"`}
      </p>

      {/* Empty state */}
      {filteredLinks.length === 0 && (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
            <span className="text-2xl">📚</span>
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">
            {search ? 'No matching links' : 'No UTM links yet'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {search
              ? 'Try adjusting your search terms'
              : 'Create your first UTM link in the Builder tab.'}
          </p>
        </div>
      )}

      {/* Links table */}
      {filteredLinks.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Link</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Source</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Medium</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Campaign</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Clicks</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Conversions</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredLinks.map((link) => (
                <tr key={link.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground truncate max-w-[200px]">
                        {link.name || 'Untitled'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {link.base_url}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 rounded">
                      {link.utm_source}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 rounded">
                      {link.utm_medium}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-foreground">{link.utm_campaign}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium text-foreground">
                      {formatNumber(link.total_clicks)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium text-foreground">
                      {formatNumber(link.total_conversions)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium text-foreground">
                      {formatCurrency(link.total_revenue)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================
// UTM Analytics Tab
// ============================================

function UtmAnalytics({
  summary,
  dailyData,
}: {
  summary: UtmAnalyticsSummary[];
  dailyData: { day: string; clicks: number; sessions: number; conversions: number; revenue: number }[];
}) {
  // Calculate totals
  const totals = summary.reduce(
    (acc, s) => ({
      clicks: acc.clicks + s.total_clicks,
      sessions: acc.sessions + s.total_sessions,
      conversions: acc.conversions + s.total_conversions,
      revenue: acc.revenue + s.total_revenue,
    }),
    { clicks: 0, sessions: 0, conversions: 0, revenue: 0 }
  );

  // Format number
  const formatNumber = (n: number) => new Intl.NumberFormat('en-US').format(n);

  // Format currency (VND)
  const formatCurrency = (n: number) => new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(n);

  // Calculate conversion rate
  const conversionRate = totals.sessions > 0
    ? ((totals.conversions / totals.sessions) * 100).toFixed(2)
    : '0.00';

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Clicks</p>
          <p className="text-2xl font-bold text-foreground mt-1">{formatNumber(totals.clicks)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sessions</p>
          <p className="text-2xl font-bold text-foreground mt-1">{formatNumber(totals.sessions)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Conversions</p>
          <p className="text-2xl font-bold text-foreground mt-1">{formatNumber(totals.conversions)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{conversionRate}% rate</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Revenue</p>
          <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(totals.revenue)}</p>
        </div>
      </div>

      {/* Empty state */}
      {summary.length === 0 && (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
            <span className="text-2xl">📊</span>
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">No analytics data yet</h2>
          <p className="text-sm text-muted-foreground">
            Analytics will appear here once your UTM links start receiving traffic.
          </p>
        </div>
      )}

      {/* Performance by Campaign Table */}
      {summary.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Performance by Campaign</h3>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </div>
          <table className="w-full">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Campaign</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Source</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Medium</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Clicks</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Conversions</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {summary.map((row, idx) => (
                <tr key={idx} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-foreground">{row.utm_campaign}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 rounded">
                      {row.utm_source}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 rounded">
                      {row.utm_medium}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium text-foreground">{formatNumber(row.total_clicks)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium text-foreground">{formatNumber(row.total_conversions)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium text-foreground">{formatCurrency(row.total_revenue)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Daily Trend (simple bar representation) */}
      {dailyData.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">Daily Clicks Trend</h3>
          <div className="h-40 flex items-end gap-1">
            {dailyData.slice(-30).map((day, idx) => {
              const maxClicks = Math.max(...dailyData.map(d => d.clicks), 1);
              const height = (day.clicks / maxClicks) * 100;
              return (
                <div
                  key={idx}
                  className="flex-1 bg-blue-500/70 hover:bg-blue-500 rounded-t transition-colors cursor-pointer group relative"
                  style={{ height: `${Math.max(height, 2)}%` }}
                  title={`${day.day}: ${formatNumber(day.clicks)} clicks`}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-foreground text-background text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                    {day.day.split('-').slice(1).join('/')}: {formatNumber(day.clicks)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[10px] text-muted-foreground">
              {dailyData[0]?.day.split('-').slice(1).join('/')}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {dailyData[dailyData.length - 1]?.day.split('-').slice(1).join('/')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
