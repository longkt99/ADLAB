'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import type { AlertStatusFilter, AlertSeverityFilter, AlertPlatformFilter } from '@/lib/adlab/types';

// ============================================
// Filter Options Configuration
// ============================================

const STATUS_OPTIONS: { value: AlertStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
  { value: 'resolved', label: 'Resolved' },
];

const SEVERITY_OPTIONS: { value: AlertSeverityFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' },
];

const PLATFORM_OPTIONS: { value: AlertPlatformFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'meta', label: 'Meta' },
  { value: 'google', label: 'Google' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'linkedin', label: 'LinkedIn' },
];

// ============================================
// Filter Chip Component
// ============================================

interface FilterChipProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

function FilterChip<T extends string>({ label, value, options, onChange }: FilterChipProps<T>) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="px-2 py-1 text-[11px] bg-secondary text-foreground border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer appearance-none pr-6"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 4px center',
          backgroundSize: '14px',
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

interface AlertsFiltersProps {
  status: AlertStatusFilter;
  severity: AlertSeverityFilter;
  platform: AlertPlatformFilter;
}

export function AlertsFilters({ status, severity, platform }: AlertsFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Check if any filter is active (not default)
  const hasActiveFilters = status !== 'all' || severity !== 'all' || platform !== 'all';

  // Update URL with new filter value
  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());

      if (value === 'all') {
        // Remove param if it's the default
        params.delete(key);
      } else {
        params.set(key, value);
      }

      const queryString = params.toString();
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;

      // Use replace to avoid building up browser history
      router.replace(newUrl);
    },
    [pathname, router, searchParams]
  );

  // Reset all filters
  const resetFilters = useCallback(() => {
    router.replace(pathname);
  }, [pathname, router]);

  return (
    <div className="flex flex-wrap items-center gap-4 pb-4">
      <FilterChip
        label="Status"
        value={status}
        options={STATUS_OPTIONS}
        onChange={(v) => updateFilter('status', v)}
      />

      <FilterChip
        label="Severity"
        value={severity}
        options={SEVERITY_OPTIONS}
        onChange={(v) => updateFilter('severity', v)}
      />

      <FilterChip
        label="Platform"
        value={platform}
        options={PLATFORM_OPTIONS}
        onChange={(v) => updateFilter('platform', v)}
      />

      {hasActiveFilters && (
        <button
          onClick={resetFilters}
          className="ml-2 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground bg-transparent hover:bg-secondary/50 rounded transition-colors"
        >
          Reset
        </button>
      )}
    </div>
  );
}
