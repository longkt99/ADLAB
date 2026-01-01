// ============================================
// Project Switcher Server Component
// ============================================
// Server-side wrapper that fetches context and renders the client switcher.
// Use this in Server Components like layouts.
// ============================================

import { getActiveContext } from '@/lib/context/getActiveContext';
import { ProjectSwitcher } from './ProjectSwitcher';

interface ProjectSwitcherServerProps {
  /** Compact mode shows only icons on mobile */
  compact?: boolean;
}

export async function ProjectSwitcherServer({ compact = false }: ProjectSwitcherServerProps) {
  const { context, availableWorkspaces, availableClients } = await getActiveContext();

  return (
    <ProjectSwitcher
      currentWorkspaceId={context.workspaceId}
      currentWorkspaceName={context.workspaceName}
      currentClientId={context.clientId}
      currentClientName={context.clientName}
      availableWorkspaces={availableWorkspaces}
      availableClients={availableClients}
      compact={compact}
    />
  );
}

export default ProjectSwitcherServer;
