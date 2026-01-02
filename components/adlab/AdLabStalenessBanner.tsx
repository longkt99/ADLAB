// ============================================
// AdLab Staleness Banner
// ============================================
// PHASE D28: Data Freshness Truth + Staleness Controls.
//
// Shows a prominent non-blocking banner when data is stale
// beyond the safe limit. Does NOT crash the page; does NOT
// block read-only analytics.
//
// Links to /ads/ingestion and /ads/system/compliance.
// ============================================

import Link from 'next/link';
import { getFreshnessDisplayStatus } from '@/lib/adlab/ops/freshnessStatus';

interface AdLabStalenessBannerProps {
  workspaceId: string;
  platform?: string;
  clientId?: string | null;
}

// Extracted JSX rendering to avoid try/catch around JSX
function StalenessBannerContent({
  isFail,
  staleDatasets,
  warnDatasets,
}: {
  isFail: boolean;
  staleDatasets: string[];
  warnDatasets: string[];
}) {
  const bannerStyle = isFail
    ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900'
    : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900';

  const iconColor = isFail
    ? 'text-red-600 dark:text-red-400'
    : 'text-amber-600 dark:text-amber-400';

  const textColor = isFail
    ? 'text-red-800 dark:text-red-200'
    : 'text-amber-800 dark:text-amber-200';

  const linkColor = isFail
    ? 'text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100'
    : 'text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100';

  return (
    <div className={`rounded-lg border p-4 mb-4 ${bannerStyle}`}>
      <div className="flex items-start gap-3">
        {/* Warning Icon */}
        <div className={`flex-shrink-0 ${iconColor}`}>
          {isFail ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className={`text-[13px] font-semibold ${textColor}`}>
            {isFail
              ? 'Data is stale beyond the safe limit'
              : 'Data is approaching staleness'}
          </h3>
          <p className={`text-[12px] mt-1 ${textColor} opacity-90`}>
            {isFail
              ? 'Analytics may be misleading. Consider ingesting fresh data before making decisions.'
              : 'Some datasets are approaching their freshness threshold.'}
          </p>

          {/* Affected datasets */}
          {(staleDatasets.length > 0 || warnDatasets.length > 0) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {staleDatasets.map((dataset) => (
                <span
                  key={dataset}
                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                >
                  {dataset}
                </span>
              ))}
              {warnDatasets.map((dataset) => (
                <span
                  key={dataset}
                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                >
                  {dataset}
                </span>
              ))}
            </div>
          )}

          {/* Links */}
          <div className="mt-3 flex items-center gap-4 text-[11px] font-medium">
            <Link href="/ads/ingestion" className={`underline ${linkColor}`}>
              Ingest Data
            </Link>
            <Link href="/ads/system/compliance" className={`underline ${linkColor}`}>
              View Compliance
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export async function AdLabStalenessBanner({
  workspaceId,
  platform = 'meta',
  clientId,
}: AdLabStalenessBannerProps) {
  // Compute data in try/catch, render JSX outside
  let displayStatus: Awaited<ReturnType<typeof getFreshnessDisplayStatus>> | null = null;

  try {
    displayStatus = await getFreshnessDisplayStatus(
      workspaceId,
      platform,
      clientId || undefined
    );
  } catch {
    // Fail silently - don't block the page for freshness check errors
    return null;
  }

  // Only show banner for fail or warn status
  if (!displayStatus || displayStatus.overallStatus === 'fresh') {
    return null;
  }

  const isFail = displayStatus.overallStatus === 'fail';
  const staleDatasets = displayStatus.datasets
    .filter((d) => d.status === 'fail')
    .map((d) => d.dataset);
  const warnDatasets = displayStatus.datasets
    .filter((d) => d.status === 'warn')
    .map((d) => d.dataset);

  return (
    <StalenessBannerContent
      isFail={isFail}
      staleDatasets={staleDatasets}
      warnDatasets={warnDatasets}
    />
  );
}
