'use client';

// ============================================
// Upload History Component
// ============================================
// Marketing Laboratory v2.0: Upload History UI
//
// Displays recent uploads with status and retry functionality.
// Fetches data from /api/adlab/ingestion/upload endpoint.
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';

// ============================================
// Types
// ============================================

interface Upload {
  id: string;
  workspace_id: string;
  client_id: string | null;
  platform: string;
  filename: string | null;
  file_size: number | null;
  row_count: number | null;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'seeded' | 'retrying';
  error_message: string | null;
  storage_path: string | null;
  summary: Record<string, unknown> | null;
  created_at: string;
  processed_at: string | null;
}

interface UploadHistoryProps {
  /** Initial data from server (if any) */
  initialData?: Upload[];
}

// ============================================
// Helpers
// ============================================

function getStatusColor(status: Upload['status']): string {
  switch (status) {
    case 'completed':
      return 'text-green-600 dark:text-green-400';
    case 'failed':
      return 'text-red-600 dark:text-red-400';
    case 'processing':
    case 'retrying':
      return 'text-blue-600 dark:text-blue-400';
    case 'pending':
      return 'text-amber-600 dark:text-amber-400';
    case 'seeded':
      return 'text-purple-600 dark:text-purple-400';
    default:
      return 'text-muted-foreground';
  }
}

function getStatusBg(status: Upload['status']): string {
  switch (status) {
    case 'completed':
      return 'bg-green-50 dark:bg-green-950/30';
    case 'failed':
      return 'bg-red-50 dark:bg-red-950/30';
    case 'processing':
    case 'retrying':
      return 'bg-blue-50 dark:bg-blue-950/30';
    case 'pending':
      return 'bg-amber-50 dark:bg-amber-950/30';
    case 'seeded':
      return 'bg-purple-50 dark:bg-purple-950/30';
    default:
      return 'bg-secondary';
  }
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: string): string {
  try {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return date;
  }
}

function getPlatformLabel(platform: string): string {
  const labels: Record<string, string> = {
    meta: 'Meta',
    facebook: 'Facebook',
    google: 'Google',
    tiktok: 'TikTok',
    linkedin: 'LinkedIn',
  };
  return labels[platform] || platform;
}

// ============================================
// Component
// ============================================

export function UploadHistory({ initialData }: UploadHistoryProps) {
  const router = useRouter();
  const [uploads, setUploads] = useState<Upload[]>(initialData || []);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  // Fetch uploads
  const fetchUploads = useCallback(async () => {
    try {
      const response = await fetch('/api/adlab/ingestion/upload');
      if (response.ok) {
        const data = await response.json();
        setUploads(data.uploads || []);
        setError(null);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to fetch uploads');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch uploads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialData) {
      fetchUploads();
    }
  }, [initialData, fetchUploads]);

  // Retry a failed upload
  const handleRetry = async (uploadId: string) => {
    setRetrying(uploadId);
    try {
      const response = await fetch('/api/adlab/ingestion/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId }),
      });

      if (response.ok) {
        // Refresh uploads after short delay
        setTimeout(() => {
          fetchUploads();
          setRetrying(null);
        }, 500);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to retry upload');
        setRetrying(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to retry upload');
      setRetrying(null);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Loading upload history...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-4">
        <div className="flex items-center gap-3">
          <Icon name="alert" size={16} className="text-red-600 dark:text-red-400" />
          <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              fetchUploads();
            }}
            className="ml-auto text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (uploads.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
          <Icon name="upload" size={20} className="text-muted-foreground" />
        </div>
        <h3 className="text-sm font-semibold text-foreground mb-2">No uploads yet</h3>
        <p className="text-[12px] text-muted-foreground">
          Upload a CSV file to see it appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Upload History</h3>
        <button
          onClick={fetchUploads}
          className="p-1.5 rounded-md hover:bg-secondary transition-colors"
          title="Refresh"
        >
          <Icon name="refresh" size={14} className="text-muted-foreground" />
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-secondary/30">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">File</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Platform</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Size</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Rows</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Date</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {uploads.map((upload) => (
              <tr key={upload.id} className="hover:bg-secondary/20">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Icon name="document" size={14} className="text-muted-foreground" />
                    <span className="text-foreground truncate max-w-[150px]" title={upload.filename || ''}>
                      {upload.filename || 'Unknown'}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-foreground">
                  {getPlatformLabel(upload.platform)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatBytes(upload.file_size)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {upload.row_count ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${getStatusColor(upload.status)} ${getStatusBg(upload.status)}`}>
                    {(upload.status === 'processing' || upload.status === 'retrying') && (
                      <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                    )}
                    {upload.status}
                  </span>
                  {upload.error_message && (
                    <div className="text-[10px] text-red-600 dark:text-red-400 mt-1 truncate max-w-[150px]" title={upload.error_message}>
                      {upload.error_message}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {formatDate(upload.created_at)}
                </td>
                <td className="px-4 py-3">
                  {upload.status === 'failed' && (
                    <button
                      onClick={() => handleRetry(upload.id)}
                      disabled={retrying === upload.id}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors disabled:opacity-50"
                    >
                      {retrying === upload.id ? (
                        <>
                          <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                          Retrying...
                        </>
                      ) : (
                        <>
                          <Icon name="refresh" size={12} />
                          Retry
                        </>
                      )}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default UploadHistory;
