// ============================================
// Trust Version Viewer Page
// ============================================
// PHASE D50: Trust Snapshot Versioning & Public Change Log.
// PHASE D51: Trust Transparency Badge & Last-Updated Layer.
//
// PUBLIC PAGE - No authentication required.
// Shows specific trust version with content and diff.
//
// URL: /trust/versions/{version}
// ============================================

import { notFound } from 'next/navigation';
import {
  getSnapshot,
  getActiveVersion,
  getDiffFromPrevious,
  formatChangeList,
  getDiffSummary,
  getChangelogEntry,
  getChangeTypeLabel,
  hasChanges,
  resolveTrustBadgeData,
  formatLastUpdated,
  type TrustVersion,
  type TrustSection,
  type SectionDiff,
  type DiffLine,
  isValidVersion,
} from '@/lib/adlab/trust';
import { TrustBadgeInline } from '@/components/adlab/TrustTransparencyBadge';

// ============================================
// Types
// ============================================

interface PageProps {
  params: Promise<{ version: string }>;
}

// ============================================
// Helper Components
// ============================================

function StatusBadge({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800">
        Active Version
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
      Historical Version
    </span>
  );
}

function SectionCard({ section }: { section: TrustSection }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">{section.title}</h3>
        <p className="text-sm text-gray-500">{section.lines.length} lines</p>
      </div>
      <div className="p-4">
        <div className="prose prose-sm max-w-none">
          {section.lines.map((line, index) => (
            <p key={index} className="mb-2 text-gray-700">
              {line}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

function DiffLineComponent({ line }: { line: DiffLine }) {
  const bgColor =
    line.type === 'added'
      ? 'bg-green-50'
      : line.type === 'removed'
      ? 'bg-red-50'
      : '';

  const textColor =
    line.type === 'added'
      ? 'text-green-800'
      : line.type === 'removed'
      ? 'text-red-800'
      : 'text-gray-600';

  const prefix =
    line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';

  if (line.type === 'unchanged') return null;

  return (
    <div className={`${bgColor} px-4 py-1 font-mono text-sm ${textColor}`}>
      <span className="inline-block w-6">{prefix}</span>
      <span>{line.content}</span>
    </div>
  );
}

function SectionDiffCard({ diff }: { diff: SectionDiff }) {
  const hasVisibleChanges = diff.lines.some((l) => l.type !== 'unchanged');

  if (!hasVisibleChanges && !diff.added && !diff.removed) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div
        className={`px-4 py-3 border-b ${
          diff.added
            ? 'bg-green-50 border-green-200'
            : diff.removed
            ? 'bg-red-50 border-red-200'
            : 'bg-gray-50 border-gray-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">{diff.title}</h3>
          {diff.added && (
            <span className="text-sm font-medium text-green-600">
              New Section
            </span>
          )}
          {diff.removed && (
            <span className="text-sm font-medium text-red-600">
              Removed Section
            </span>
          )}
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {diff.lines.map((line, index) => (
          <DiffLineComponent key={index} line={line} />
        ))}
      </div>
    </div>
  );
}

function VersionNotFound({ version }: { version: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Version Not Found
        </h1>
        <p className="text-gray-600 mb-6">
          The version "{version}" does not exist in our records.
        </p>
        <a
          href="/trust/changes"
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          ← Back to Changelog
        </a>
      </div>
    </div>
  );
}

// ============================================
// Main Page Component
// ============================================

export default async function TrustVersionPage({ params }: PageProps) {
  const { version } = await params;

  // Validate version format
  if (!isValidVersion(version)) {
    return <VersionNotFound version={version} />;
  }

  const snapshot = getSnapshot(version as TrustVersion);

  if (!snapshot) {
    return <VersionNotFound version={version} />;
  }

  const activeVersion = getActiveVersion();
  const isActive = snapshot.version === activeVersion;
  const diff = getDiffFromPrevious(version as TrustVersion);
  const changelogEntry = getChangelogEntry(version as TrustVersion);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-4">
            <a
              href="/trust/changes"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              ← Back to Changelog
            </a>
            <StatusBadge isActive={isActive} />
          </div>

          <h1 className="text-3xl font-bold text-gray-900">{snapshot.version}</h1>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <span>Released: {snapshot.released_at}</span>
            <span>•</span>
            <span>Author: {snapshot.author.role}</span>
            <span>•</span>
            <span>{snapshot.sections.length} sections</span>
          </div>

          <p className="mt-4 text-gray-600">{snapshot.summary}</p>

          {/* Changelog Info */}
          {changelogEntry && (
            <div className="mt-6 bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium text-blue-900">
                  {getChangeTypeLabel(changelogEntry.type)}
                </span>
                <span className="text-blue-700">•</span>
                <span className="text-blue-700">{changelogEntry.date}</span>
              </div>
              <p className="text-blue-800">{changelogEntry.summary}</p>
              <p className="text-sm text-blue-700 mt-2">
                <span className="font-medium">Customer impact:</span>{' '}
                {changelogEntry.customer_impact}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Diff Section */}
        {diff && hasChanges(diff) && (
          <div className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Changes from {diff.fromVersion}
            </h2>

            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
              <p className="text-gray-600">{getDiffSummary(diff)}</p>
              <div className="mt-2 flex gap-4 text-sm">
                <span className="text-green-600">
                  +{diff.stats.linesAdded} lines
                </span>
                <span className="text-red-600">
                  -{diff.stats.linesRemoved} lines
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {diff.sections.map((sectionDiff) => (
                <SectionDiffCard key={sectionDiff.sectionId} diff={sectionDiff} />
              ))}
            </div>
          </div>
        )}

        {/* Full Content */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Full Content</h2>

          <div className="space-y-6">
            {snapshot.sections.map((section) => (
              <SectionCard key={section.id} section={section} />
            ))}
          </div>
        </div>
      </div>

      {/* Footer with D51 Badge */}
      <div className="bg-white border-t border-gray-200 mt-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              This version is immutable and cannot be modified. View the{' '}
              <a href="/trust/changes" className="text-blue-600 hover:text-blue-800">
                full changelog
              </a>{' '}
              for all versions.
            </p>
            {/* D51: Inline Trust Badge */}
            <TrustBadgeInline
              version={activeVersion}
              changeHistoryLink="/trust/changes"
              available={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Metadata
// ============================================

export async function generateMetadata({ params }: PageProps) {
  const { version } = await params;
  const snapshot = isValidVersion(version)
    ? getSnapshot(version as TrustVersion)
    : null;

  if (!snapshot) {
    return {
      title: 'Version Not Found | Trust',
    };
  }

  return {
    title: `${snapshot.version} | Trust Documentation`,
    description: snapshot.summary,
  };
}
