// ============================================
// AdLab Data Freshness Badge
// ============================================
// Shows last ingestion time and staleness status.
// PHASE D16A: Data freshness indicator.

import Link from 'next/link';
import {
  getLatestSuccessfulIngestion,
  calculateDataFreshness,
} from '@/lib/adlab/ingestion';

interface AdLabDataFreshnessProps {
  workspaceId: string;
  clientId?: string | null;
}

export async function AdLabDataFreshness({ workspaceId, clientId }: AdLabDataFreshnessProps) {
  const { data: log } = await getLatestSuccessfulIngestion(workspaceId, clientId);
  const freshness = calculateDataFreshness(log);

  // Determine badge styling
  const getBadgeStyle = () => {
    if (!log) {
      return 'bg-secondary text-muted-foreground';
    }
    if (freshness.isStale) {
      return 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300';
    }
    return 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300';
  };

  const getIcon = () => {
    if (!log) {
      return (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }
    if (freshness.isStale) {
      return (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    }
    return (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
      </svg>
    );
  };

  return (
    <Link
      href="/ads/ingestion/logs"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors hover:opacity-80 ${getBadgeStyle()}`}
      title={freshness.lastIngestion ? `Last ingestion: ${freshness.lastIngestion.toLocaleString()}` : 'No ingestion data'}
    >
      {getIcon()}
      <span>{freshness.message}</span>
    </Link>
  );
}
