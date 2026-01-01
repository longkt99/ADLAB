// ============================================
// AdLab Ingestion Page
// ============================================
// CSV upload and validation UI.
// PHASE D16A: Dry-run validation only.

import { AdLabPageShell, AdLabEmptyState, AdLabErrorBox, AdLabContextBar } from '@/components/adlab';
import { getAdLabPageContext } from '@/lib/adlab/page-helpers';
import { isIngestionEnabled } from '@/lib/adlab/ingestion';
import { IngestionUploadClient } from './IngestionUploadClient';
import { UploadHistory } from './UploadHistory';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdLabIngestionPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { context, noWorkspace, error: contextError } = await getAdLabPageContext(params);

  // No workspace state
  if (noWorkspace || !context) {
    return (
      <AdLabPageShell
        title="Ingestion"
        description="Upload CSV data to your workspace"
      >
        {contextError ? (
          <AdLabErrorBox
            message={contextError}
            hint="Unable to resolve workspace. Please check your authentication."
          />
        ) : (
          <AdLabEmptyState
            title="No workspace found"
            description="Create a workspace to start uploading data."
          />
        )}
      </AdLabPageShell>
    );
  }

  const { workspace, clients: workspaceClients } = context;
  const enabled = isIngestionEnabled();

  return (
    <AdLabPageShell
      title="Ingestion"
      description="Upload and validate CSV data"
      badge={enabled ? undefined : { label: 'Disabled', variant: 'info' }}
    >
      {/* Context Bar */}
      <AdLabContextBar
        workspaceName={workspace.name}
        clients={workspaceClients}
      />

      {/* Cognitive explanation */}
      <p className="text-[11px] text-muted-foreground/60 -mt-2 mb-4">
        Upload CSV files to validate data before ingestion. This is a dry-run preview only.
      </p>

      {/* Upload Client */}
      <IngestionUploadClient
        workspaceId={workspace.id}
        workspaceName={workspace.name}
        clients={workspaceClients}
        isEnabled={enabled}
      />

      {/* Upload History - Marketing Lab v2.0 */}
      <div className="mt-8">
        <UploadHistory />
      </div>
    </AdLabPageShell>
  );
}
