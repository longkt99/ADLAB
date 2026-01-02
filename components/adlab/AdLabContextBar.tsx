'use client';

// ============================================
// AdLab Context Bar
// ============================================
// Shared filter bar for workspace, client, and date range selection.
// Uses URL searchParams for state persistence.

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useState } from 'react';

// ============================================
// Types
// ============================================

interface Client {
  id: string;
  name: string;
}

interface AdLabContextBarProps {
  workspaceName: string;
  clients: Client[];
}

type DateRange = '7d' | '14d' | '30d' | 'custom';

// ============================================
// Date Utilities
// ============================================

function getDateFromRange(range: DateRange): { from: string; to: string } {
  const today = new Date();
  const to = today.toISOString().split('T')[0];

  let daysBack = 7;
  if (range === '14d') daysBack = 14;
  if (range === '30d') daysBack = 30;
  if (range === 'custom') daysBack = 7; // Default for custom

  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - daysBack);
  const from = fromDate.toISOString().split('T')[0];

  return { from, to };
}

function formatDateDisplay(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// ============================================
// Component
// ============================================

export function AdLabContextBar({ workspaceName, clients }: AdLabContextBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse current values from URL
  const currentClient = searchParams.get('client') || 'all';
  const currentRange = (searchParams.get('range') as DateRange) || '7d';
  const currentFrom = searchParams.get('from') || '';
  const currentTo = searchParams.get('to') || '';

  // Local state for custom date inputs
  const [customFrom, setCustomFrom] = useState(currentFrom);
  const [customTo, setCustomTo] = useState(currentTo);
  const [showCustom, setShowCustom] = useState(currentRange === 'custom');

  // Update URL with new params
  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === '' || value === 'all' || (key === 'range' && value === '7d')) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });

      const queryString = params.toString();
      router.replace(`${pathname}${queryString ? `?${queryString}` : ''}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Handle client change
  const handleClientChange = (clientId: string) => {
    updateParams({ client: clientId === 'all' ? null : clientId });
  };

  // Handle range change
  const handleRangeChange = (range: string) => {
    if (range === 'custom') {
      setShowCustom(true);
      // Don't update URL yet - wait for custom dates
    } else {
      setShowCustom(false);
      const { from: _from, to: _to } = getDateFromRange(range as DateRange);
      updateParams({
        range: range === '7d' ? null : range,
        from: null, // Clear custom dates
        to: null,
      });
    }
  };

  // Apply custom date range
  const applyCustomRange = () => {
    if (customFrom && customTo) {
      updateParams({
        range: 'custom',
        from: customFrom,
        to: customTo,
      });
    }
  };

  // Calculate display date range
  const displayRange = currentRange === 'custom' && currentFrom && currentTo
    ? `${formatDateDisplay(currentFrom)} – ${formatDateDisplay(currentTo)}`
    : currentRange === '14d'
      ? 'Last 14 days'
      : currentRange === '30d'
        ? 'Last 30 days'
        : 'Last 7 days';

  return (
    <div className="bg-card border border-border rounded-lg p-3 mb-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Workspace Label */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 bg-primary/10 rounded flex items-center justify-center flex-shrink-0">
            <svg
              className="w-3.5 h-3.5 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <span className="text-sm font-medium text-foreground truncate">
            {workspaceName}
          </span>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-5 bg-border" />

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Client Dropdown */}
          <div className="relative">
            <select
              value={currentClient}
              onChange={(e) => handleClientChange(e.target.value)}
              className="appearance-none bg-secondary border border-border rounded-lg px-3 py-1.5 pr-8 text-sm text-foreground cursor-pointer hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All Clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            <svg
              className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* Date Range Dropdown */}
          <div className="relative">
            <select
              value={showCustom ? 'custom' : currentRange}
              onChange={(e) => handleRangeChange(e.target.value)}
              className="appearance-none bg-secondary border border-border rounded-lg px-3 py-1.5 pr-8 text-sm text-foreground cursor-pointer hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="7d">Last 7 days</option>
              <option value="14d">Last 14 days</option>
              <option value="30d">Last 30 days</option>
              <option value="custom">Custom range</option>
            </select>
            <svg
              className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* Custom Date Inputs */}
          {showCustom && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="bg-secondary border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <span className="text-muted-foreground text-sm">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="bg-secondary border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                onClick={applyCustomRange}
                disabled={!customFrom || !customTo}
                className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply
              </button>
            </div>
          )}
        </div>

        {/* Date Range Display (when not showing custom inputs) */}
        {!showCustom && (
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground ml-auto">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {displayRange}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdLabContextBar;
