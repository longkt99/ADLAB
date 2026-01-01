// ============================================
// Trust Changelog Page
// ============================================
// PHASE D50: Trust Snapshot Versioning & Public Change Log.
// PHASE D51: Trust Transparency Badge & Last-Updated Layer.
//
// PUBLIC PAGE - No authentication required.
// Shows trust content version history with customer-safe language.
//
// URL: /trust/changes
// ============================================

import {
  getChangelogEntries,
  getActiveVersion,
  getChangeTypeLabel,
  resolveTrustBadgeData,
  formatLastUpdated,
  type ChangelogEntry,
  type ChangeType,
} from '@/lib/adlab/trust';
import { TrustTransparencyBadge } from '@/components/adlab/TrustTransparencyBadge';

// ============================================
// Metadata
// ============================================

export const metadata = {
  title: 'Trust Changelog | AdLab',
  description: 'View the history of changes to our Trust documentation.',
};

// ============================================
// Helper Components
// ============================================

function ChangeTypeBadge({ type }: { type: ChangeType }) {
  const colors: Record<ChangeType, string> = {
    clarification: 'bg-blue-100 text-blue-800',
    addition: 'bg-green-100 text-green-800',
    'scope-change': 'bg-amber-100 text-amber-800',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[type]}`}
    >
      {getChangeTypeLabel(type)}
    </span>
  );
}

function ActiveBadge() {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
      Current
    </span>
  );
}

function ChangelogEntryCard({
  entry,
  isActive,
}: {
  entry: ChangelogEntry;
  isActive: boolean;
}) {
  return (
    <div className="relative pb-8">
      {/* Timeline connector */}
      <span
        className="absolute top-5 left-5 -ml-px h-full w-0.5 bg-gray-200"
        aria-hidden="true"
      />

      <div className="relative flex items-start space-x-3">
        {/* Timeline dot */}
        <div className="relative">
          <div
            className={`h-10 w-10 rounded-full flex items-center justify-center ring-8 ring-white ${
              isActive ? 'bg-emerald-500' : 'bg-gray-400'
            }`}
          >
            <svg
              className="h-5 w-5 text-white"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <a
                  href={entry.link}
                  className="text-lg font-semibold text-gray-900 hover:text-blue-600"
                >
                  {entry.version}
                </a>
                <ChangeTypeBadge type={entry.type} />
                {isActive && <ActiveBadge />}
              </div>
              <time className="text-sm text-gray-500">{entry.date}</time>
            </div>

            {/* Summary */}
            <p className="text-gray-700 mb-2">{entry.summary}</p>

            {/* Customer Impact */}
            <div className="bg-gray-50 rounded p-3 mt-3">
              <p className="text-sm text-gray-600">
                <span className="font-medium">What this means for you:</span>{' '}
                {entry.customer_impact}
              </p>
            </div>

            {/* View Details Link */}
            <div className="mt-3">
              <a
                href={entry.link}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View full details →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12">
      <svg
        className="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <h3 className="mt-2 text-sm font-medium text-gray-900">
        No changelog entries
      </h3>
      <p className="mt-1 text-sm text-gray-500">
        Trust documentation history will appear here once available.
      </p>
    </div>
  );
}

// ============================================
// Main Page Component
// ============================================

export default function TrustChangelogPage() {
  const entries = getChangelogEntries();
  const activeVersion = getActiveVersion();

  // D51: Resolve badge data from snapshot store
  const badgeData = resolveTrustBadgeData();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Trust Changelog
              </h1>
              <p className="mt-2 text-gray-600">
                A complete history of changes to our Trust documentation.
              </p>
            </div>
            {/* D51: Trust Transparency Badge */}
            <TrustTransparencyBadge
              version={badgeData.version}
              lastUpdated={formatLastUpdated(badgeData.lastUpdated)}
              changeHistoryLink={badgeData.changeHistoryLink}
              available={badgeData.available}
              size="medium"
              showChangeHistory={false}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {entries.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flow-root">
            <ul className="-mb-8">
              {entries.map((entry, index) => (
                <li key={entry.version}>
                  <ChangelogEntryCard
                    entry={entry}
                    isActive={entry.version === activeVersion}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-200 mt-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-sm text-gray-500 text-center">
            Trust documentation is versioned and immutable. Each change is
            logged and visible to customers.
          </p>
        </div>
      </div>
    </div>
  );
}
