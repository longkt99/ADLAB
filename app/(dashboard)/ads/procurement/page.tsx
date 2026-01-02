'use client';

// ============================================
// Procurement Response Dashboard
// ============================================
// PHASE D44: Procurement & Security Response Layer.
//
// PURPOSE:
// Internal dashboard for generating and reviewing
// procurement-ready security responses, boundary
// documentation, and visibility matrices.
//
// FEATURES:
// - Security answer overview
// - RFP response pack generation
// - Boundary sheet viewer
// - Visibility matrix explorer
// - Evidence package generation
//
// ACCESS:
// - Admin/Owner roles only
// - Read-only operations
// - Full audit logging
// ============================================

import React, { useState, useEffect, useCallback } from 'react';

// ============================================
// Types
// ============================================

interface DashboardSummary {
  totalQuestions: number;
  answeredQuestions: number;
  partialQuestions: number;
  unavailableQuestions: number;
  completionPercentage: number;
}

interface SupportedFormat {
  format: string;
  label: string;
  description: string;
}

interface DashboardData {
  summary: DashboardSummary;
  supportedFormats: SupportedFormat[];
  capabilities: {
    securityAnswers: boolean;
    rfpGeneration: boolean;
    boundarySheet: boolean;
    visibilityMatrix: boolean;
    evidencePackage: boolean;
  };
}

interface SecurityAnswer {
  questionId: string;
  category: string;
  question: string;
  answer: string;
  status: 'ANSWERED' | 'PARTIAL' | 'UNAVAILABLE';
  evidenceReferences: string[];
}

interface AnswerResult {
  answers: SecurityAnswer[];
  summary: {
    totalQuestions: number;
    answered: number;
    partial: number;
    unavailable: number;
    completionPercentage: number;
  };
  byCategory: Record<
    string,
    {
      total: number;
      answered: number;
      partial: number;
      unavailable: number;
    }
  >;
}

interface BoundaryItem {
  id: string;
  category: string;
  capability: string;
  status: 'IN_SCOPE' | 'OUT_OF_SCOPE' | 'PARTIAL' | 'ROADMAP';
  explanation: string;
  whatWeProvide: string | null;
  whatWeDoNotProvide: string | null;
  technicalReason: string | null;
  verificationMethod: string | null;
}

interface BoundarySheet {
  metadata: {
    sheetId: string;
    generatedAt: string;
    version: string;
  };
  executiveSummary: string;
  trustStatement: string;
  items: BoundaryItem[];
}

interface VisibilityRule {
  category: string;
  categoryLabel: string;
  description: string;
  visibilityByStakeholder: Record<string, string>;
}

interface VisibilityMatrix {
  metadata: {
    matrixId: string;
    generatedAt: string;
  };
  rules: VisibilityRule[];
  summaryStatement: string;
}

type ViewMode = 'overview' | 'answers' | 'boundary' | 'visibility' | 'rfp';

// ============================================
// Component
// ============================================

export default function ProcurementDashboard() {
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [answers, setAnswers] = useState<AnswerResult | null>(null);
  const [boundarySheet, setBoundarySheet] = useState<BoundarySheet | null>(null);
  const [visibilityMatrix, setVisibilityMatrix] = useState<VisibilityMatrix | null>(null);

  // Fetch states
  const [generating, setGenerating] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<string>('json');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // ============================================
  // Data Fetching
  // ============================================

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/adlab/system/procurement?view=dashboard');
      const data = await res.json();
      if (data.success) {
        setDashboardData(data.data);
      } else {
        setError(data.error || 'Failed to load dashboard');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAnswers = useCallback(async (category?: string) => {
    try {
      setLoading(true);
      const url =
        category && category !== 'all'
          ? `/api/adlab/system/procurement?view=answers&category=${category}`
          : '/api/adlab/system/procurement?view=answers';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setAnswers(data.data);
      } else {
        setError(data.error || 'Failed to load answers');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBoundarySheet = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/adlab/system/procurement?view=boundary');
      const data = await res.json();
      if (data.success) {
        setBoundarySheet(data.data);
      } else {
        setError(data.error || 'Failed to load boundary sheet');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchVisibilityMatrix = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/adlab/system/procurement?view=visibility');
      const data = await res.json();
      if (data.success) {
        setVisibilityMatrix(data.data);
      } else {
        setError(data.error || 'Failed to load visibility matrix');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, []);

  const generateRFPPack = useCallback(async (format: string) => {
    try {
      setGenerating(true);
      const res = await fetch(`/api/adlab/system/procurement?view=rfp&format=${format}`);

      if (format === 'json') {
        const data = await res.json();
        if (data.success) {
          // Download as file
          const blob = new Blob([JSON.stringify(data.data.pack, null, 2)], {
            type: 'application/json',
          });
          downloadBlob(blob, data.data.filename);
        } else {
          setError(data.error || 'Failed to generate pack');
        }
      } else {
        // Markdown or CSV - direct download
        const blob = await res.blob();
        const filename =
          format === 'markdown'
            ? `security-response-${Date.now()}.md`
            : `security-response-${Date.now()}.csv`;
        downloadBlob(blob, filename);
      }
    } catch {
      setError('Failed to generate RFP pack');
    } finally {
      setGenerating(false);
    }
  }, []);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Initial load
  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // View mode change
  useEffect(() => {
    if (viewMode === 'answers' && !answers) {
      fetchAnswers();
    } else if (viewMode === 'boundary' && !boundarySheet) {
      fetchBoundarySheet();
    } else if (viewMode === 'visibility' && !visibilityMatrix) {
      fetchVisibilityMatrix();
    }
  }, [viewMode, answers, boundarySheet, visibilityMatrix, fetchAnswers, fetchBoundarySheet, fetchVisibilityMatrix]);

  // ============================================
  // Render Helpers
  // ============================================

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'ANSWERED':
      case 'IN_SCOPE':
        return '#22c55e';
      case 'PARTIAL':
        return '#f59e0b';
      case 'UNAVAILABLE':
      case 'OUT_OF_SCOPE':
        return '#6b7280';
      case 'ROADMAP':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'ANSWERED':
        return 'Answered';
      case 'PARTIAL':
        return 'Partial';
      case 'UNAVAILABLE':
        return 'Unavailable';
      case 'IN_SCOPE':
        return 'Supported';
      case 'OUT_OF_SCOPE':
        return 'Not Supported';
      case 'ROADMAP':
        return 'Planned';
      default:
        return status;
    }
  };

  const getVisibilityColor = (level: string): string => {
    switch (level) {
      case 'FULL':
        return '#22c55e';
      case 'SUMMARY':
        return '#3b82f6';
      case 'METADATA':
        return '#f59e0b';
      case 'AUDIT_ONLY':
        return '#8b5cf6';
      case 'NONE':
        return '#6b7280';
      default:
        return '#6b7280';
    }
  };

  // ============================================
  // Render Sections
  // ============================================

  const renderNavigation = () => (
    <div style={styles.nav}>
      {[
        { key: 'overview', label: 'Overview' },
        { key: 'answers', label: 'Security Answers' },
        { key: 'boundary', label: 'Boundary Sheet' },
        { key: 'visibility', label: 'Visibility Matrix' },
        { key: 'rfp', label: 'Generate RFP Pack' },
      ].map((item) => (
        <button
          key={item.key}
          onClick={() => setViewMode(item.key as ViewMode)}
          style={{
            ...styles.navButton,
            ...(viewMode === item.key ? styles.navButtonActive : {}),
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );

  const renderOverview = () => {
    if (!dashboardData) return null;

    return (
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Procurement Response Overview</h2>

        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{dashboardData.summary.totalQuestions}</div>
            <div style={styles.statLabel}>Total Questions</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statValue, color: '#22c55e' }}>
              {dashboardData.summary.answeredQuestions}
            </div>
            <div style={styles.statLabel}>Fully Answered</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statValue, color: '#f59e0b' }}>
              {dashboardData.summary.partialQuestions}
            </div>
            <div style={styles.statLabel}>Partial</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statValue, color: '#6b7280' }}>
              {dashboardData.summary.unavailableQuestions}
            </div>
            <div style={styles.statLabel}>Unavailable</div>
          </div>
        </div>

        <div style={styles.progressContainer}>
          <div style={styles.progressLabel}>
            Completion: {dashboardData.summary.completionPercentage}%
          </div>
          <div style={styles.progressBar}>
            <div
              style={{
                ...styles.progressFill,
                width: `${dashboardData.summary.completionPercentage}%`,
              }}
            />
          </div>
        </div>

        <div style={styles.capabilitiesSection}>
          <h3 style={styles.subsectionTitle}>Available Capabilities</h3>
          <div style={styles.capabilitiesGrid}>
            {Object.entries(dashboardData.capabilities).map(([key, enabled]) => (
              <div key={key} style={styles.capabilityItem}>
                <span style={{ color: enabled ? '#22c55e' : '#6b7280' }}>
                  {enabled ? '✓' : '✗'}
                </span>
                <span style={styles.capabilityLabel}>
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderAnswers = () => {
    if (!answers) return <div style={styles.loading}>Loading answers...</div>;

    const categories = Object.keys(answers.byCategory);

    return (
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Security Question Answers</h2>

        <div style={styles.filterBar}>
          <label style={styles.filterLabel}>Category:</label>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              fetchAnswers(e.target.value);
            }}
            style={styles.select}
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.answersList}>
          {answers.answers.map((answer) => (
            <div key={answer.questionId} style={styles.answerCard}>
              <div style={styles.answerHeader}>
                <span
                  style={{
                    ...styles.statusBadge,
                    backgroundColor: getStatusColor(answer.status),
                  }}
                >
                  {getStatusLabel(answer.status)}
                </span>
                <span style={styles.categoryBadge}>
                  {answer.category.replace(/_/g, ' ')}
                </span>
              </div>
              <div style={styles.questionText}>{answer.question}</div>
              <div style={styles.answerText}>{answer.answer}</div>
              {answer.evidenceReferences.length > 0 && (
                <div style={styles.evidenceSection}>
                  <strong>Evidence:</strong>
                  <ul style={styles.evidenceList}>
                    {answer.evidenceReferences.map((ref, idx) => (
                      <li key={idx}>{ref}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderBoundarySheet = () => {
    if (!boundarySheet) return <div style={styles.loading}>Loading boundary sheet...</div>;

    return (
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>System Capability Boundary Sheet</h2>

        <div style={styles.metadataBox}>
          <div>Sheet ID: {boundarySheet.metadata.sheetId}</div>
          <div>Generated: {new Date(boundarySheet.metadata.generatedAt).toLocaleString()}</div>
          <div>Version: {boundarySheet.metadata.version}</div>
        </div>

        <div style={styles.summaryBox}>
          <h3 style={styles.subsectionTitle}>Executive Summary</h3>
          <p>{boundarySheet.executiveSummary}</p>
        </div>

        <div style={styles.trustBox}>
          <h3 style={styles.subsectionTitle}>Trust Statement</h3>
          <p style={styles.trustText}>{boundarySheet.trustStatement}</p>
        </div>

        <h3 style={styles.subsectionTitle}>Capability Boundaries</h3>
        <div style={styles.boundaryList}>
          {boundarySheet.items.map((item) => (
            <div key={item.id} style={styles.boundaryCard}>
              <div style={styles.boundaryHeader}>
                <span
                  style={{
                    ...styles.statusBadge,
                    backgroundColor: getStatusColor(item.status),
                  }}
                >
                  {getStatusLabel(item.status)}
                </span>
                <span style={styles.categoryBadge}>{item.category.replace(/_/g, ' ')}</span>
              </div>
              <div style={styles.capabilityName}>{item.capability}</div>
              <div style={styles.explanationText}>{item.explanation}</div>

              {item.whatWeProvide && (
                <div style={styles.detailRow}>
                  <strong style={{ color: '#22c55e' }}>What we provide:</strong>{' '}
                  {item.whatWeProvide}
                </div>
              )}
              {item.whatWeDoNotProvide && (
                <div style={styles.detailRow}>
                  <strong style={{ color: '#ef4444' }}>What we do NOT provide:</strong>{' '}
                  {item.whatWeDoNotProvide}
                </div>
              )}
              {item.technicalReason && (
                <div style={styles.detailRow}>
                  <strong>Technical reason:</strong> {item.technicalReason}
                </div>
              )}
              {item.verificationMethod && (
                <div style={styles.detailRow}>
                  <strong>Verification:</strong> {item.verificationMethod}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderVisibilityMatrix = () => {
    if (!visibilityMatrix)
      return <div style={styles.loading}>Loading visibility matrix...</div>;

    const stakeholders = [
      'BUYER_PROCUREMENT',
      'BUYER_SECURITY',
      'BUYER_LEGAL',
      'SELLER_SALES',
      'SELLER_ADMIN',
      'SELLER_COMPLIANCE',
      'EXTERNAL_AUDITOR',
    ];

    const stakeholderLabels: Record<string, string> = {
      BUYER_PROCUREMENT: 'Buyer Procurement',
      BUYER_SECURITY: 'Buyer Security',
      BUYER_LEGAL: 'Buyer Legal',
      SELLER_SALES: 'Seller Sales',
      SELLER_ADMIN: 'Seller Admin',
      SELLER_COMPLIANCE: 'Seller Compliance',
      EXTERNAL_AUDITOR: 'External Auditor',
    };

    return (
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Data Visibility Matrix</h2>

        <div style={styles.metadataBox}>
          <div>Matrix ID: {visibilityMatrix.metadata.matrixId}</div>
          <div>Generated: {new Date(visibilityMatrix.metadata.generatedAt).toLocaleString()}</div>
        </div>

        <div style={styles.summaryBox}>
          <p>{visibilityMatrix.summaryStatement}</p>
        </div>

        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.tableHeader}>Data Category</th>
                {stakeholders.map((s) => (
                  <th key={s} style={styles.tableHeader}>
                    {stakeholderLabels[s]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibilityMatrix.rules.map((rule) => (
                <tr key={rule.category}>
                  <td style={styles.tableCell}>
                    <strong>{rule.categoryLabel}</strong>
                    <div style={styles.cellDescription}>{rule.description}</div>
                  </td>
                  {stakeholders.map((s) => (
                    <td key={s} style={styles.tableCell}>
                      <span
                        style={{
                          ...styles.visibilityBadge,
                          backgroundColor: getVisibilityColor(
                            rule.visibilityByStakeholder[s]
                          ),
                        }}
                      >
                        {rule.visibilityByStakeholder[s]?.replace(/_/g, ' ') || 'N/A'}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={styles.legendSection}>
          <h4 style={styles.legendTitle}>Legend</h4>
          <div style={styles.legendGrid}>
            {[
              { level: 'FULL', label: 'Full Access' },
              { level: 'SUMMARY', label: 'Summary Only' },
              { level: 'METADATA', label: 'Metadata Only' },
              { level: 'AUDIT_ONLY', label: 'Audit Trail Only' },
              { level: 'NONE', label: 'Not Available' },
            ].map((item) => (
              <div key={item.level} style={styles.legendItem}>
                <span
                  style={{
                    ...styles.legendDot,
                    backgroundColor: getVisibilityColor(item.level),
                  }}
                />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderRFPGeneration = () => {
    const formats = dashboardData?.supportedFormats || [];

    return (
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Generate RFP Response Pack</h2>

        <p style={styles.description}>
          Generate a complete security response pack suitable for RFP submissions,
          vendor assessments, and procurement reviews. All responses are derived from
          evidence and include legal disclaimers.
        </p>

        <div style={styles.formatSection}>
          <h3 style={styles.subsectionTitle}>Select Export Format</h3>

          <div style={styles.formatGrid}>
            {formats.map((format) => (
              <div
                key={format.format}
                onClick={() => setSelectedFormat(format.format)}
                style={{
                  ...styles.formatCard,
                  ...(selectedFormat === format.format ? styles.formatCardSelected : {}),
                }}
              >
                <div style={styles.formatLabel}>{format.label}</div>
                <div style={styles.formatDescription}>{format.description}</div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => generateRFPPack(selectedFormat)}
          disabled={generating}
          style={{
            ...styles.generateButton,
            ...(generating ? styles.generateButtonDisabled : {}),
          }}
        >
          {generating ? 'Generating...' : `Generate ${selectedFormat.toUpperCase()} Pack`}
        </button>

        <div style={styles.disclaimerBox}>
          <h4>Important Notes</h4>
          <ul>
            <li>Generated packs include legal disclaimers and timestamps</li>
            <li>Answers are derived from documented evidence only</li>
            <li>
              &quot;PARTIAL&quot; answers indicate areas where documentation is incomplete
            </li>
            <li>&quot;UNAVAILABLE&quot; answers indicate areas outside current scope</li>
            <li>All pack generations are logged for audit purposes</li>
          </ul>
        </div>
      </div>
    );
  };

  // ============================================
  // Main Render
  // ============================================

  if (loading && !dashboardData) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading procurement dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          <h3>Error</h3>
          <p>{error}</p>
          <button onClick={() => window.location.reload()} style={styles.retryButton}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Procurement Response Center</h1>
        <p style={styles.subtitle}>
          Generate RFP-ready security documentation and evidence packages
        </p>
      </header>

      {renderNavigation()}

      <main style={styles.main}>
        {viewMode === 'overview' && renderOverview()}
        {viewMode === 'answers' && renderAnswers()}
        {viewMode === 'boundary' && renderBoundarySheet()}
        {viewMode === 'visibility' && renderVisibilityMatrix()}
        {viewMode === 'rfp' && renderRFPGeneration()}
      </main>

      <footer style={styles.footer}>
        <p>
          All outputs are advisory and evidence-derived. No PII is collected or exposed.
        </p>
      </footer>
    </div>
  );
}

// ============================================
// Styles
// ============================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0a0a0a',
    color: '#e5e5e5',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: {
    padding: '2rem',
    borderBottom: '1px solid #262626',
  },
  title: {
    fontSize: '1.875rem',
    fontWeight: 600,
    margin: 0,
    color: '#fff',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#a3a3a3',
    marginTop: '0.5rem',
  },
  nav: {
    display: 'flex',
    gap: '0.5rem',
    padding: '1rem 2rem',
    borderBottom: '1px solid #262626',
    backgroundColor: '#0f0f0f',
    overflowX: 'auto',
  },
  navButton: {
    padding: '0.5rem 1rem',
    backgroundColor: 'transparent',
    border: '1px solid #404040',
    borderRadius: '0.375rem',
    color: '#a3a3a3',
    cursor: 'pointer',
    fontSize: '0.875rem',
    whiteSpace: 'nowrap',
  },
  navButtonActive: {
    backgroundColor: '#262626',
    borderColor: '#525252',
    color: '#fff',
  },
  main: {
    padding: '2rem',
  },
  section: {
    maxWidth: '1200px',
    margin: '0 auto',
  },
  sectionTitle: {
    fontSize: '1.5rem',
    fontWeight: 600,
    marginBottom: '1.5rem',
    color: '#fff',
  },
  subsectionTitle: {
    fontSize: '1.125rem',
    fontWeight: 500,
    marginBottom: '1rem',
    color: '#e5e5e5',
  },
  loading: {
    textAlign: 'center',
    padding: '3rem',
    color: '#a3a3a3',
  },
  error: {
    textAlign: 'center',
    padding: '3rem',
    color: '#ef4444',
  },
  retryButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#262626',
    border: '1px solid #404040',
    borderRadius: '0.375rem',
    color: '#fff',
    cursor: 'pointer',
    marginTop: '1rem',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem',
  },
  statCard: {
    padding: '1.5rem',
    backgroundColor: '#171717',
    borderRadius: '0.5rem',
    border: '1px solid #262626',
    textAlign: 'center',
  },
  statValue: {
    fontSize: '2rem',
    fontWeight: 700,
    color: '#fff',
  },
  statLabel: {
    fontSize: '0.875rem',
    color: '#a3a3a3',
    marginTop: '0.5rem',
  },
  progressContainer: {
    marginBottom: '2rem',
  },
  progressLabel: {
    fontSize: '0.875rem',
    color: '#a3a3a3',
    marginBottom: '0.5rem',
  },
  progressBar: {
    height: '0.5rem',
    backgroundColor: '#262626',
    borderRadius: '0.25rem',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#22c55e',
    transition: 'width 0.3s ease',
  },
  capabilitiesSection: {
    marginTop: '2rem',
  },
  capabilitiesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '0.75rem',
  },
  capabilityItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem',
    backgroundColor: '#171717',
    borderRadius: '0.375rem',
  },
  capabilityLabel: {
    fontSize: '0.875rem',
    textTransform: 'capitalize',
  },
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1.5rem',
  },
  filterLabel: {
    fontSize: '0.875rem',
    color: '#a3a3a3',
  },
  select: {
    padding: '0.5rem',
    backgroundColor: '#171717',
    border: '1px solid #404040',
    borderRadius: '0.375rem',
    color: '#fff',
    fontSize: '0.875rem',
  },
  answersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  answerCard: {
    padding: '1.25rem',
    backgroundColor: '#171717',
    borderRadius: '0.5rem',
    border: '1px solid #262626',
  },
  answerHeader: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '0.75rem',
  },
  statusBadge: {
    padding: '0.25rem 0.5rem',
    borderRadius: '0.25rem',
    fontSize: '0.75rem',
    fontWeight: 500,
    color: '#fff',
  },
  categoryBadge: {
    padding: '0.25rem 0.5rem',
    borderRadius: '0.25rem',
    fontSize: '0.75rem',
    backgroundColor: '#262626',
    color: '#a3a3a3',
    textTransform: 'capitalize',
  },
  questionText: {
    fontSize: '1rem',
    fontWeight: 500,
    color: '#fff',
    marginBottom: '0.5rem',
  },
  answerText: {
    fontSize: '0.875rem',
    color: '#d4d4d4',
    lineHeight: 1.6,
  },
  evidenceSection: {
    marginTop: '0.75rem',
    paddingTop: '0.75rem',
    borderTop: '1px solid #262626',
    fontSize: '0.875rem',
  },
  evidenceList: {
    margin: '0.5rem 0 0 1.25rem',
    padding: 0,
    color: '#a3a3a3',
  },
  metadataBox: {
    padding: '1rem',
    backgroundColor: '#171717',
    borderRadius: '0.375rem',
    marginBottom: '1.5rem',
    fontSize: '0.875rem',
    color: '#a3a3a3',
    display: 'flex',
    gap: '2rem',
    flexWrap: 'wrap',
  },
  summaryBox: {
    padding: '1.25rem',
    backgroundColor: '#171717',
    borderRadius: '0.5rem',
    marginBottom: '1.5rem',
    lineHeight: 1.6,
  },
  trustBox: {
    padding: '1.25rem',
    backgroundColor: '#0f2922',
    border: '1px solid #166534',
    borderRadius: '0.5rem',
    marginBottom: '2rem',
  },
  trustText: {
    fontStyle: 'italic',
    lineHeight: 1.6,
  },
  boundaryList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  boundaryCard: {
    padding: '1.25rem',
    backgroundColor: '#171717',
    borderRadius: '0.5rem',
    border: '1px solid #262626',
  },
  boundaryHeader: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '0.75rem',
  },
  capabilityName: {
    fontSize: '1rem',
    fontWeight: 500,
    color: '#fff',
    marginBottom: '0.5rem',
  },
  explanationText: {
    fontSize: '0.875rem',
    color: '#d4d4d4',
    marginBottom: '0.75rem',
    lineHeight: 1.6,
  },
  detailRow: {
    fontSize: '0.875rem',
    marginTop: '0.5rem',
    color: '#a3a3a3',
  },
  tableContainer: {
    overflowX: 'auto',
    marginBottom: '2rem',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.875rem',
  },
  tableHeader: {
    padding: '0.75rem',
    backgroundColor: '#171717',
    borderBottom: '1px solid #262626',
    textAlign: 'left',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  tableCell: {
    padding: '0.75rem',
    borderBottom: '1px solid #262626',
    verticalAlign: 'top',
  },
  cellDescription: {
    fontSize: '0.75rem',
    color: '#737373',
    marginTop: '0.25rem',
  },
  visibilityBadge: {
    padding: '0.25rem 0.5rem',
    borderRadius: '0.25rem',
    fontSize: '0.7rem',
    fontWeight: 500,
    color: '#fff',
    textTransform: 'capitalize',
  },
  legendSection: {
    padding: '1rem',
    backgroundColor: '#171717',
    borderRadius: '0.5rem',
  },
  legendTitle: {
    fontSize: '0.875rem',
    fontWeight: 500,
    marginBottom: '0.75rem',
  },
  legendGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.875rem',
  },
  legendDot: {
    width: '0.75rem',
    height: '0.75rem',
    borderRadius: '0.25rem',
  },
  description: {
    fontSize: '0.875rem',
    color: '#a3a3a3',
    lineHeight: 1.6,
    marginBottom: '2rem',
  },
  formatSection: {
    marginBottom: '2rem',
  },
  formatGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '1rem',
  },
  formatCard: {
    padding: '1.25rem',
    backgroundColor: '#171717',
    borderRadius: '0.5rem',
    border: '1px solid #404040',
    cursor: 'pointer',
    transition: 'border-color 0.2s, background-color 0.2s',
  },
  formatCardSelected: {
    borderColor: '#22c55e',
    backgroundColor: '#0f2922',
  },
  formatLabel: {
    fontSize: '1rem',
    fontWeight: 500,
    color: '#fff',
    marginBottom: '0.5rem',
  },
  formatDescription: {
    fontSize: '0.875rem',
    color: '#a3a3a3',
  },
  generateButton: {
    padding: '0.75rem 2rem',
    backgroundColor: '#22c55e',
    border: 'none',
    borderRadius: '0.375rem',
    color: '#fff',
    fontSize: '1rem',
    fontWeight: 500,
    cursor: 'pointer',
    marginBottom: '2rem',
  },
  generateButtonDisabled: {
    backgroundColor: '#404040',
    cursor: 'not-allowed',
  },
  disclaimerBox: {
    padding: '1.25rem',
    backgroundColor: '#1c1c1e',
    border: '1px solid #3f3f46',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    color: '#a3a3a3',
  },
  footer: {
    padding: '2rem',
    borderTop: '1px solid #262626',
    textAlign: 'center',
    fontSize: '0.75rem',
    color: '#737373',
  },
};
