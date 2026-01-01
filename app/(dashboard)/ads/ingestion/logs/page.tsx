// ============================================
// AdLab Ingestion Logs Page
// ============================================
// View ingestion log history.
// PHASE D16A: Read-only log viewer.

import Link from 'next/link';
import { AdLabPageShell, AdLabEmptyState, AdLabTable, AdLabErrorBox, AdLabContextBar } from '@/components/adlab';
import { getAdLabPageContext } from '@/lib/adlab/page-helpers';
import {
  getIngestionLogs,
  getDatasetLabel,
  getPlatformLabel,
  getStatusColor,
  getStatusBgColor,
  type IngestionLog,
} from '@/lib/adlab/ingestion';

export const dynamic = 'force-dynamic';

// Format date for display
function formatDateTime(dateString: string): string {
  try {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const color = getStatusColor(status as 'pass' | 'warn' | 'fail');
  const bgColor = getStatusBgColor(status as 'pass' | 'warn' | 'fail');

  return (
    <span className={`px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded ${color} ${bgColor}`}>
      {status}
    </span>
  );
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdLabIngestionLogsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { context, noWorkspace, error: contextError } = await getAdLabPageContext(params);

  // No workspace state
  if (noWorkspace || !context) {
    return (
      <AdLabPageShell
        title="Ingestion Logs"
        description="View ingestion history"
      >
        {contextError ? (
          <AdLabErrorBox
            message={contextError}
            hint="Unable to resolve workspace. Please check your authentication."
          />
        ) : (
          <AdLabEmptyState
            title="No workspace found"
            description="Create a workspace to view ingestion logs."
          />
        )}
      </AdLabPageShell>
    );
  }

  const { workspace, clients: workspaceClients, filters } = context;

  // Fetch ingestion logs
  const { data: logs, error, count } = await getIngestionLogs(
    filters.workspaceId,
    filters.clientId,
    50
  );

  const columns = [
    {
      key: 'created_at',
      header: 'Time',
      render: (item: IngestionLog) => (
        <span className="text-[12px] text-muted-foreground whitespace-nowrap">
          {formatDateTime(item.created_at)}
        </span>
      ),
    },
    {
      key: 'platform',
      header: 'Platform',
      render: (item: IngestionLog) => (
        <span className="px-2 py-0.5 text-[10px] bg-secondary text-secondary-foreground rounded">
          {getPlatformLabel(item.platform)}
        </span>
      ),
    },
    {
      key: 'dataset',
      header: 'Dataset',
      render: (item: IngestionLog) => (
        <span className="text-[12px] text-foreground font-medium">
          {getDatasetLabel(item.dataset)}
        </span>
      ),
    },
    {
      key: 'file_name',
      header: 'File',
      render: (item: IngestionLog) => (
        <div className="max-w-[150px]">
          <span className="text-[12px] text-foreground truncate block" title={item.file_name}>
            {item.file_name}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {formatFileSize(item.file_size)}
          </span>
        </div>
      ),
    },
    {
      key: 'rows_parsed',
      header: 'Rows',
      render: (item: IngestionLog) => (
        <div className="text-[12px]">
          <span className="text-foreground font-medium">{item.valid_rows}</span>
          <span className="text-muted-foreground">/{item.rows_parsed}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: IngestionLog) => <StatusBadge status={item.status} />,
    },
    {
      key: 'message',
      header: 'Message',
      render: (item: IngestionLog) => (
        <span className="text-[11px] text-muted-foreground truncate max-w-[200px] block" title={item.message}>
          {item.message}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (item: IngestionLog) => (
        <Link
          href={`/ads/ingestion/logs/${item.id}`}
          className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
        >
          Details
        </Link>
      ),
    },
  ];

  return (
    <AdLabPageShell
      title="Ingestion Logs"
      description={`${count} ingestion log${count !== 1 ? 's' : ''} in your workspace`}
      actions={
        <Link
          href="/ads/ingestion"
          className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          New Upload
        </Link>
      }
    >
      {/* Context Bar */}
      <AdLabContextBar
        workspaceName={workspace.name}
        clients={workspaceClients}
      />

      {error && (
        <AdLabErrorBox
          message={error}
          hint="This may be due to RLS policies or the table not existing yet."
        />
      )}

      {/* Cognitive explanation */}
      <p className="text-[11px] text-muted-foreground/60 -mt-2 mb-4">
        History of CSV validation attempts and their results.
      </p>

      {logs.length === 0 && !error ? (
        <AdLabEmptyState
          title="No ingestion logs yet"
          description="Upload a CSV file to see validation results here."
          icon={
            <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          }
        />
      ) : (
        <AdLabTable
          columns={columns}
          data={logs}
          keyField="id"
          emptyMessage="No ingestion logs found"
        />
      )}
    </AdLabPageShell>
  );
}
