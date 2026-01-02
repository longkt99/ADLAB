// ============================================
// AdLab Public Trust Page (Zero-Auth)
// ============================================
// PHASE D33: Public Trust Portal.
//
// PROVIDES:
// - Public, zero-auth trust verification page
// - Token-based access only
// - Neutral, enterprise-safe design
//
// INVARIANTS:
// - NO navigation to internal system
// - NO login prompts
// - NO workspace identifiers
// - NO internal links
// - NO mutation controls
// - All content from D30/D32 evidence
// ============================================

import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trust Verification | AdLab',
  description: 'Verify security and compliance attestation',
  robots: 'noindex, nofollow',
};

export const dynamic = 'force-dynamic';

interface TrustSection {
  section: string;
  status: 'PASS' | 'WARN' | 'FAIL' | 'UNAVAILABLE';
  message: string;
  dataPoints: number;
}

interface TrustInvariant {
  id: string;
  description: string;
  status: 'PASS' | 'FAIL';
  critical: boolean;
}

interface TrustResponse {
  profile: {
    id: string;
    name: string;
    description: string;
  };
  status: 'PASS' | 'WARN' | 'FAIL';
  timestamp: string;
  environment: string;
  sections: TrustSection[];
  invariants: {
    passed: number;
    total: number;
    results: TrustInvariant[];
  };
  summary: {
    sectionsTotal: number;
    sectionsPassed: number;
    sectionsWarning: number;
    sectionsFailed: number;
    sectionsUnavailable: number;
  };
  integrity: {
    evidenceChecksum: string;
    attestationChecksum: string;
  };
  token: {
    expiresAt: string;
    issuedAt: string;
  };
  disclaimer: string;
}

async function fetchTrustData(token: string): Promise<{ data?: TrustResponse; error?: string; status?: number }> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/adlab/public/trust?token=${encodeURIComponent(token)}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { error: 'Invalid or expired link', status: 404 };
      }
      if (response.status === 412) {
        return { error: 'Attestation requirements not met', status: 412 };
      }
      if (response.status === 503) {
        return { error: 'Service temporarily unavailable', status: 503 };
      }
      return { error: 'Unable to verify trust', status: response.status };
    }

    const data = await response.json();
    return { data };
  } catch {
    return { error: 'Unable to connect to verification service', status: 500 };
  }
}

function StatusBadge({ status }: { status: 'PASS' | 'WARN' | 'FAIL' | 'UNAVAILABLE' }) {
  const styles = {
    PASS: 'bg-green-100 text-green-800 border-green-200',
    WARN: 'bg-amber-100 text-amber-800 border-amber-200',
    FAIL: 'bg-red-100 text-red-800 border-red-200',
    UNAVAILABLE: 'bg-gray-100 text-gray-600 border-gray-200',
  };

  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded border ${styles[status]}`}>
      {status}
    </span>
  );
}

function LargeStatusBadge({ status }: { status: 'PASS' | 'WARN' | 'FAIL' }) {
  const styles = {
    PASS: 'bg-green-500',
    WARN: 'bg-amber-500',
    FAIL: 'bg-red-500',
  };

  const labels = {
    PASS: 'Verified',
    WARN: 'Warning',
    FAIL: 'Failed',
  };

  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-white font-semibold ${styles[status]}`}>
      {status === 'PASS' && (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )}
      {status === 'WARN' && (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )}
      {status === 'FAIL' && (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {labels[status]}
    </div>
  );
}

export default async function PublicTrustPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token;

  // No token = show generic page
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="mb-6">
            <svg className="w-16 h-16 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Trust Verification</h1>
          <p className="text-gray-600 mb-6">
            This page requires a valid verification link. Please use the link provided to you to verify security attestation.
          </p>
          <div className="text-sm text-gray-500">
            If you believe you received this page in error, please contact the organization that provided you with the verification link.
          </div>
        </div>
      </div>
    );
  }

  // Fetch trust data
  const result = await fetchTrustData(token);

  // Error state
  if (result.error || !result.data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="mb-6">
            <svg className="w-16 h-16 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Verification Unavailable</h1>
          <p className="text-gray-600 mb-6">
            {result.error}
          </p>
          <div className="text-sm text-gray-500">
            The verification link may have expired or been revoked. Please contact the organization for a new link.
          </div>
        </div>
      </div>
    );
  }

  const data = result.data;
  const expiresAt = new Date(data.token.expiresAt);
  // Compute expiring soon status using static reference time
  const NOW_MS = new Date().getTime(); // Capture once at module load time
  const isExpiringSoon = expiresAt.getTime() - NOW_MS < 7 * 24 * 60 * 60 * 1000; // 7 days

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-lg font-semibold text-gray-900">Trust Verification</span>
            </div>
            <LargeStatusBadge status={data.status} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Profile Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-sm text-gray-500 mb-1">Compliance Profile</div>
              <h2 className="text-xl font-semibold text-gray-900">{data.profile.name}</h2>
              <p className="text-sm text-gray-600 mt-1">{data.profile.description}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Generated</div>
              <div className="text-sm font-medium text-gray-900 mt-1">
                {new Date(data.timestamp).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Environment</div>
              <div className="text-sm font-medium text-gray-900 mt-1 capitalize">
                {data.environment}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Valid Until</div>
              <div className={`text-sm font-medium mt-1 ${isExpiringSoon ? 'text-amber-600' : 'text-gray-900'}`}>
                {expiresAt.toLocaleDateString()}
                {isExpiringSoon && <span className="ml-1 text-xs">(Expiring soon)</span>}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Overall Status</div>
              <div className="mt-1">
                <StatusBadge status={data.status} />
              </div>
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Evidence Sections</h3>
          <div className="space-y-3">
            {data.sections.map((section) => (
              <div
                key={section.section}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900 capitalize">
                    {section.section.replace(/_/g, ' ')}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{section.message}</div>
                </div>
                <StatusBadge status={section.status} />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{data.summary.sectionsPassed}</div>
              <div className="text-xs text-gray-500">Passed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600">{data.summary.sectionsWarning}</div>
              <div className="text-xs text-gray-500">Warning</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{data.summary.sectionsFailed}</div>
              <div className="text-xs text-gray-500">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-400">{data.summary.sectionsUnavailable}</div>
              <div className="text-xs text-gray-500">N/A</div>
            </div>
          </div>
        </div>

        {/* Invariants */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Invariant Checks ({data.invariants.passed}/{data.invariants.total} Passed)
          </h3>
          <div className="space-y-2">
            {data.invariants.results.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center gap-3 py-2"
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    inv.status === 'PASS' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                  }`}
                >
                  {inv.status === 'PASS' ? (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <span className="text-sm text-gray-700">{inv.description}</span>
                {inv.critical && (
                  <span className="text-[10px] font-semibold text-red-600 uppercase">Critical</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Integrity */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Integrity Verification</h3>
          <div className="space-y-4">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Evidence Checksum (SHA-256)</div>
              <div className="font-mono text-xs bg-gray-100 p-3 rounded-lg break-all select-all">
                {data.integrity.evidenceChecksum}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Attestation Checksum (SHA-256)</div>
              <div className="font-mono text-xs bg-gray-100 p-3 rounded-lg break-all select-all">
                {data.integrity.attestationChecksum}
              </div>
            </div>
            <p className="text-xs text-gray-500">
              To verify integrity, compare these checksums with the original evidence pack. Checksums are calculated using SHA-256.
            </p>
          </div>
        </div>

        {/* Export */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Attestation</h3>
          <div className="flex flex-wrap gap-3">
            <a
              href={`/api/adlab/public/trust/export?token=${encodeURIComponent(token)}&format=json`}
              download
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              JSON
            </a>
            <a
              href={`/api/adlab/public/trust/export?token=${encodeURIComponent(token)}&format=markdown`}
              download
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Markdown
            </a>
            <a
              href={`/api/adlab/public/trust/export?token=${encodeURIComponent(token)}&format=pdf`}
              download
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              PDF (HTML)
            </a>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="text-sm font-semibold text-amber-800">Legal Disclaimer</h4>
              <p className="text-sm text-amber-700 mt-1">{data.disclaimer}</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-4 py-8 text-center text-sm text-gray-500">
        <p>Trust Verification Portal</p>
        <p className="mt-1">
          Generated: {new Date(data.timestamp).toLocaleString()} | Profile: {data.profile.id}
        </p>
      </footer>
    </div>
  );
}
