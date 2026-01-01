// ============================================
// UTM Tracking Queries
// ============================================
// Marketing Laboratory v2.0: UTM Builder + Library + Analytics
//
// PATTERNS:
// - Workspace-scoped queries only
// - Fail-open: return empty arrays on error
// - Server component compatible
// ============================================

import { createClient } from '@supabase/supabase-js';
import {
  normalizeSupabaseError,
  markSupabaseReachable,
  markSupabaseUnreachable,
  getSupabaseConnectivityError,
} from '@/lib/utils/supabaseError';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ============================================
// Error Handling Helper
// ============================================
// Uses shared utility for consistent error handling across the app.

function normalizeErrorMessage(error: unknown): string {
  const normalized = normalizeSupabaseError(error);
  if (normalized.kind === 'SUPABASE_UNREACHABLE') {
    return `${normalized.message}. ${normalized.actionableHint.split('\n')[0]}`;
  }
  return normalized.message;
}

// ============================================
// Types
// ============================================

export interface UtmLink {
  id: string;
  workspace_id: string;
  name: string | null;
  base_url: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string | null;
  utm_term: string | null;
  final_url: string;
  short_url: string | null;
  qr_url: string | null;
  tags: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface UtmTemplate {
  id: string;
  workspace_id: string;
  name: string;
  platform: string | null;
  defaults: Record<string, string>;
  created_at: string;
}

export interface UtmAnalytics {
  id: string;
  utm_link_id: string;
  day: string;
  clicks: number;
  sessions: number;
  conversions: number;
  revenue: number;
  created_at: string;
}

export interface UtmLinkWithStats extends UtmLink {
  total_clicks: number;
  total_sessions: number;
  total_conversions: number;
  total_revenue: number;
}

export interface UtmAnalyticsSummary {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  total_clicks: number;
  total_sessions: number;
  total_conversions: number;
  total_revenue: number;
  link_count: number;
}

export interface QueryResult<T> {
  data: T;
  error: string | null;
}

export interface CreateUtmLinkInput {
  workspace_id: string;
  name?: string;
  base_url: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content?: string;
  utm_term?: string;
  tags?: string[];
}

// ============================================
// Client
// ============================================

function createUtmClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ============================================
// URL Building
// ============================================

export function buildFinalUrl(input: {
  base_url: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content?: string;
  utm_term?: string;
}): string {
  try {
    const url = new URL(input.base_url);
    url.searchParams.set('utm_source', input.utm_source);
    url.searchParams.set('utm_medium', input.utm_medium);
    url.searchParams.set('utm_campaign', input.utm_campaign);
    if (input.utm_content) {
      url.searchParams.set('utm_content', input.utm_content);
    }
    if (input.utm_term) {
      url.searchParams.set('utm_term', input.utm_term);
    }
    return url.toString();
  } catch {
    // If URL parsing fails, do simple string concatenation
    const params = new URLSearchParams();
    params.set('utm_source', input.utm_source);
    params.set('utm_medium', input.utm_medium);
    params.set('utm_campaign', input.utm_campaign);
    if (input.utm_content) {
      params.set('utm_content', input.utm_content);
    }
    if (input.utm_term) {
      params.set('utm_term', input.utm_term);
    }
    const separator = input.base_url.includes('?') ? '&' : '?';
    return `${input.base_url}${separator}${params.toString()}`;
  }
}

// ============================================
// UTM Links Queries
// ============================================

export async function getUtmLinks(
  workspaceId: string,
  filters?: {
    search?: string;
    source?: string;
    medium?: string;
    campaign?: string;
  },
  limit = 50
): Promise<QueryResult<UtmLink[]>> {
  // Check cached connectivity state - skip query if recently unreachable
  const cachedError = getSupabaseConnectivityError();
  if (cachedError) {
    return {
      data: [],
      error: `${cachedError.message}. ${cachedError.actionableHint.split('\n')[0]}`,
    };
  }

  try {
    const supabase = createUtmClient();
    let query = supabase
      .from('utm_links')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (filters?.source) {
      query = query.eq('utm_source', filters.source);
    }
    if (filters?.medium) {
      query = query.eq('utm_medium', filters.medium);
    }
    if (filters?.campaign) {
      query = query.eq('utm_campaign', filters.campaign);
    }
    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,base_url.ilike.%${filters.search}%,utm_campaign.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;

    if (error) {
      // Check if connection error
      const normalized = normalizeSupabaseError(error);
      if (normalized.kind === 'SUPABASE_UNREACHABLE') {
        markSupabaseUnreachable(error);
      }
      // Graceful degradation for missing table
      if (normalized.kind === 'TABLE_NOT_FOUND') {
        return { data: [], error: null };
      }
      return { data: [], error: normalized.message };
    }

    // Success - mark Supabase as reachable
    markSupabaseReachable();
    return { data: data || [], error: null };
  } catch (e) {
    const normalized = normalizeSupabaseError(e);
    if (normalized.kind === 'SUPABASE_UNREACHABLE') {
      markSupabaseUnreachable(e);
    }
    return { data: [], error: normalizeErrorMessage(e) };
  }
}

export async function getUtmLinksWithStats(
  workspaceId: string,
  limit = 50
): Promise<QueryResult<UtmLinkWithStats[]>> {
  // Check cached connectivity state - skip query if recently unreachable
  const cachedError = getSupabaseConnectivityError();
  if (cachedError) {
    return {
      data: [],
      error: `${cachedError.message}. ${cachedError.actionableHint.split('\n')[0]}`,
    };
  }

  try {
    const supabase = createUtmClient();

    // First get links
    const { data: links, error: linksError } = await supabase
      .from('utm_links')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (linksError) {
      if (linksError.code?.startsWith('PGRST') || linksError.message?.includes('does not exist')) {
        return { data: [], error: null };
      }
      return { data: [], error: linksError.message };
    }

    if (!links || links.length === 0) {
      return { data: [], error: null };
    }

    // Get analytics aggregated by link
    const linkIds = links.map(l => l.id);
    const { data: analytics } = await supabase
      .from('utm_analytics')
      .select('utm_link_id, clicks, sessions, conversions, revenue')
      .in('utm_link_id', linkIds);

    // Aggregate stats per link
    const statsMap = new Map<string, { clicks: number; sessions: number; conversions: number; revenue: number }>();
    (analytics || []).forEach(a => {
      const existing = statsMap.get(a.utm_link_id) || { clicks: 0, sessions: 0, conversions: 0, revenue: 0 };
      statsMap.set(a.utm_link_id, {
        clicks: existing.clicks + (a.clicks || 0),
        sessions: existing.sessions + (a.sessions || 0),
        conversions: existing.conversions + (a.conversions || 0),
        revenue: existing.revenue + (a.revenue || 0),
      });
    });

    const linksWithStats: UtmLinkWithStats[] = links.map(link => {
      const stats = statsMap.get(link.id) || { clicks: 0, sessions: 0, conversions: 0, revenue: 0 };
      return {
        ...link,
        total_clicks: stats.clicks,
        total_sessions: stats.sessions,
        total_conversions: stats.conversions,
        total_revenue: stats.revenue,
      };
    });

    // Success - mark Supabase as reachable
    markSupabaseReachable();
    return { data: linksWithStats, error: null };
  } catch (e) {
    const normalized = normalizeSupabaseError(e);
    if (normalized.kind === 'SUPABASE_UNREACHABLE') {
      markSupabaseUnreachable(e);
    }
    return { data: [], error: normalizeErrorMessage(e) };
  }
}

export async function createUtmLink(input: CreateUtmLinkInput): Promise<QueryResult<UtmLink | null>> {
  try {
    const supabase = createUtmClient();
    const finalUrl = buildFinalUrl(input);

    const { data, error } = await supabase
      .from('utm_links')
      .insert({
        workspace_id: input.workspace_id,
        name: input.name || null,
        base_url: input.base_url,
        utm_source: input.utm_source,
        utm_medium: input.utm_medium,
        utm_campaign: input.utm_campaign,
        utm_content: input.utm_content || null,
        utm_term: input.utm_term || null,
        final_url: finalUrl,
        tags: input.tags || [],
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (e) {
    return { data: null, error: normalizeErrorMessage(e) };
  }
}

// ============================================
// UTM Templates Queries
// ============================================

export async function getUtmTemplates(workspaceId: string): Promise<QueryResult<UtmTemplate[]>> {
  try {
    const supabase = createUtmClient();
    const { data, error } = await supabase
      .from('utm_templates')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('name', { ascending: true });

    if (error) {
      if (error.code?.startsWith('PGRST') || error.message?.includes('does not exist')) {
        return { data: [], error: null };
      }
      return { data: [], error: error.message };
    }

    return { data: data || [], error: null };
  } catch (e) {
    return { data: [], error: normalizeErrorMessage(e) };
  }
}

// ============================================
// UTM Analytics Queries
// ============================================

export async function getUtmAnalyticsSummary(
  workspaceId: string,
  days = 30
): Promise<QueryResult<UtmAnalyticsSummary[]>> {
  // Check cached connectivity state - skip query if recently unreachable
  const cachedError = getSupabaseConnectivityError();
  if (cachedError) {
    return {
      data: [],
      error: `${cachedError.message}. ${cachedError.actionableHint.split('\n')[0]}`,
    };
  }

  try {
    const supabase = createUtmClient();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // First get links for this workspace
    const { data: links, error: linksError } = await supabase
      .from('utm_links')
      .select('id, utm_source, utm_medium, utm_campaign')
      .eq('workspace_id', workspaceId);

    if (linksError) {
      if (linksError.code?.startsWith('PGRST') || linksError.message?.includes('does not exist')) {
        return { data: [], error: null };
      }
      return { data: [], error: linksError.message };
    }

    if (!links || links.length === 0) {
      return { data: [], error: null };
    }

    // Get analytics for these links
    const linkIds = links.map(l => l.id);
    const { data: analytics, error: analyticsError } = await supabase
      .from('utm_analytics')
      .select('utm_link_id, clicks, sessions, conversions, revenue')
      .in('utm_link_id', linkIds)
      .gte('day', startDate.toISOString().split('T')[0]);

    if (analyticsError) {
      if (analyticsError.code?.startsWith('PGRST') || analyticsError.message?.includes('does not exist')) {
        return { data: [], error: null };
      }
      return { data: [], error: analyticsError.message };
    }

    // Build link -> utm params map
    const linkMap = new Map<string, { source: string; medium: string; campaign: string }>();
    links.forEach(l => {
      linkMap.set(l.id, { source: l.utm_source, medium: l.utm_medium, campaign: l.utm_campaign });
    });

    // Aggregate by source/medium/campaign
    const summaryMap = new Map<string, UtmAnalyticsSummary>();
    const linkCountMap = new Map<string, Set<string>>();

    (analytics || []).forEach(a => {
      const linkInfo = linkMap.get(a.utm_link_id);
      if (!linkInfo) return;

      const key = `${linkInfo.source}|${linkInfo.medium}|${linkInfo.campaign}`;
      const existing = summaryMap.get(key) || {
        utm_source: linkInfo.source,
        utm_medium: linkInfo.medium,
        utm_campaign: linkInfo.campaign,
        total_clicks: 0,
        total_sessions: 0,
        total_conversions: 0,
        total_revenue: 0,
        link_count: 0,
      };

      existing.total_clicks += a.clicks || 0;
      existing.total_sessions += a.sessions || 0;
      existing.total_conversions += a.conversions || 0;
      existing.total_revenue += a.revenue || 0;
      summaryMap.set(key, existing);

      // Track unique links
      if (!linkCountMap.has(key)) {
        linkCountMap.set(key, new Set());
      }
      linkCountMap.get(key)!.add(a.utm_link_id);
    });

    // Add link counts
    const result: UtmAnalyticsSummary[] = [];
    summaryMap.forEach((summary, key) => {
      summary.link_count = linkCountMap.get(key)?.size || 0;
      result.push(summary);
    });

    // Sort by total clicks descending
    result.sort((a, b) => b.total_clicks - a.total_clicks);

    // Success - mark Supabase as reachable
    markSupabaseReachable();
    return { data: result, error: null };
  } catch (e) {
    const normalized = normalizeSupabaseError(e);
    if (normalized.kind === 'SUPABASE_UNREACHABLE') {
      markSupabaseUnreachable(e);
    }
    return { data: [], error: normalizeErrorMessage(e) };
  }
}

export async function getUtmDailyAnalytics(
  workspaceId: string,
  days = 30
): Promise<QueryResult<{ day: string; clicks: number; sessions: number; conversions: number; revenue: number }[]>> {
  // Check cached connectivity state - skip query if recently unreachable
  const cachedError = getSupabaseConnectivityError();
  if (cachedError) {
    return {
      data: [],
      error: `${cachedError.message}. ${cachedError.actionableHint.split('\n')[0]}`,
    };
  }

  try {
    const supabase = createUtmClient();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // First get links for this workspace
    const { data: links, error: linksError } = await supabase
      .from('utm_links')
      .select('id')
      .eq('workspace_id', workspaceId);

    if (linksError) {
      if (linksError.code?.startsWith('PGRST') || linksError.message?.includes('does not exist')) {
        return { data: [], error: null };
      }
      return { data: [], error: linksError.message };
    }

    if (!links || links.length === 0) {
      return { data: [], error: null };
    }

    // Get analytics aggregated by day
    const linkIds = links.map(l => l.id);
    const { data: analytics, error: analyticsError } = await supabase
      .from('utm_analytics')
      .select('day, clicks, sessions, conversions, revenue')
      .in('utm_link_id', linkIds)
      .gte('day', startDate.toISOString().split('T')[0])
      .order('day', { ascending: true });

    if (analyticsError) {
      if (analyticsError.code?.startsWith('PGRST') || analyticsError.message?.includes('does not exist')) {
        return { data: [], error: null };
      }
      return { data: [], error: analyticsError.message };
    }

    // Aggregate by day
    const dayMap = new Map<string, { clicks: number; sessions: number; conversions: number; revenue: number }>();
    (analytics || []).forEach(a => {
      const existing = dayMap.get(a.day) || { clicks: 0, sessions: 0, conversions: 0, revenue: 0 };
      dayMap.set(a.day, {
        clicks: existing.clicks + (a.clicks || 0),
        sessions: existing.sessions + (a.sessions || 0),
        conversions: existing.conversions + (a.conversions || 0),
        revenue: existing.revenue + (a.revenue || 0),
      });
    });

    const result = Array.from(dayMap.entries()).map(([day, stats]) => ({
      day,
      ...stats,
    }));

    // Success - mark Supabase as reachable
    markSupabaseReachable();
    return { data: result, error: null };
  } catch (e) {
    const normalized = normalizeSupabaseError(e);
    if (normalized.kind === 'SUPABASE_UNREACHABLE') {
      markSupabaseUnreachable(e);
    }
    return { data: [], error: normalizeErrorMessage(e) };
  }
}

// ============================================
// Filter Options
// ============================================

export async function getUtmFilterOptions(workspaceId: string): Promise<{
  sources: string[];
  mediums: string[];
  campaigns: string[];
}> {
  try {
    const supabase = createUtmClient();
    const { data, error } = await supabase
      .from('utm_links')
      .select('utm_source, utm_medium, utm_campaign')
      .eq('workspace_id', workspaceId);

    if (error || !data) {
      return { sources: [], mediums: [], campaigns: [] };
    }

    const sources = [...new Set(data.map(d => d.utm_source))].sort();
    const mediums = [...new Set(data.map(d => d.utm_medium))].sort();
    const campaigns = [...new Set(data.map(d => d.utm_campaign))].sort();

    return { sources, mediums, campaigns };
  } catch {
    return { sources: [], mediums: [], campaigns: [] };
  }
}
