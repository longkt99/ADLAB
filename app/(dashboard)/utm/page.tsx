// ============================================
// UTM Tracking Page
// ============================================
// Marketing Laboratory v2.0: UTM Builder + Library + Analytics
//
// Tabs:
// 1. Builder - Create new UTM links
// 2. Library - Browse and search existing links
// 3. Analytics - Aggregate performance by source/medium/campaign
// ============================================

import { resolveWorkspace } from '@/lib/supabase/server';
import { getUtmLinksWithStats, getUtmAnalyticsSummary, getUtmDailyAnalytics, getUtmTemplates, getUtmFilterOptions } from '@/lib/utm/queries';
import { UtmPageContent } from './UtmPageContent';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function UtmPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { workspace, error: workspaceError } = await resolveWorkspace();

  // Parse active tab from URL
  const activeTab = (params.tab as string) || 'builder';

  // If no workspace, show with empty state
  if (!workspace) {
    return (
      <UtmPageContent
        activeTab={activeTab}
        workspace={null}
        error={workspaceError}
        links={[]}
        templates={[]}
        analyticsSummary={[]}
        dailyAnalytics={[]}
        filterOptions={{ sources: [], mediums: [], campaigns: [] }}
      />
    );
  }

  // Fetch all data in parallel
  const [
    { data: links },
    { data: templates },
    { data: analyticsSummary },
    { data: dailyAnalytics },
    filterOptions,
  ] = await Promise.all([
    getUtmLinksWithStats(workspace.id),
    getUtmTemplates(workspace.id),
    getUtmAnalyticsSummary(workspace.id, 30),
    getUtmDailyAnalytics(workspace.id, 30),
    getUtmFilterOptions(workspace.id),
  ]);

  return (
    <UtmPageContent
      activeTab={activeTab}
      workspace={workspace}
      error={null}
      links={links}
      templates={templates}
      analyticsSummary={analyticsSummary}
      dailyAnalytics={dailyAnalytics}
      filterOptions={filterOptions}
    />
  );
}
