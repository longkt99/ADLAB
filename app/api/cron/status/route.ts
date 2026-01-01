import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

// GET /api/cron/status
// Returns the status of recent cron job runs
// Useful for monitoring and debugging
export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceSupabase();

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // ============================================
    // 1. Fetch Recent Cron Logs
    // ============================================
    const { data: recentLogs, error: logsError } = await supabase
      .from('cron_logs')
      .select('*')
      .order('run_at', { ascending: false })
      .limit(Math.min(limit, 100)); // Max 100 logs

    if (logsError) {
      console.error('Error fetching cron logs:', logsError);
      return NextResponse.json(
        { error: 'Failed to fetch cron logs' },
        { status: 500 }
      );
    }

    // ============================================
    // 2. Calculate Summary Statistics
    // ============================================
    const totalRuns = recentLogs?.length || 0;
    const totalPublished = recentLogs?.reduce((sum, log) => sum + (log.variants_published || 0), 0) || 0;
    const totalFailed = recentLogs?.reduce((sum, log) => sum + (log.variants_failed || 0), 0) || 0;
    const totalFound = recentLogs?.reduce((sum, log) => sum + (log.variants_found || 0), 0) || 0;

    const lastRun = recentLogs && recentLogs.length > 0 ? recentLogs[0] : null;
    const avgDuration = totalRuns > 0
      ? Math.round(recentLogs.reduce((sum, log) => sum + (log.duration_ms || 0), 0) / totalRuns)
      : 0;

    // Check if cron is running (last run within 10 minutes)
    const isHealthy = lastRun
      ? new Date().getTime() - new Date(lastRun.run_at).getTime() < 10 * 60 * 1000
      : false;

    // ============================================
    // 3. Count Currently Scheduled Variants
    // ============================================
    const now = new Date().toISOString();
    const { count: scheduledCount, error: countError } = await supabase
      .from('variants')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'scheduled')
      .lte('scheduled_at', now);

    if (countError) {
      console.error('Error counting scheduled variants:', countError);
    }

    // ============================================
    // 4. Count Upcoming Scheduled Variants
    // ============================================
    const { count: upcomingCount, error: upcomingError } = await supabase
      .from('variants')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'scheduled')
      .gt('scheduled_at', now);

    if (upcomingError) {
      console.error('Error counting upcoming variants:', upcomingError);
    }

    // ============================================
    // 5. Return Status Response
    // ============================================
    const response = {
      healthy: isHealthy,
      last_run: lastRun ? {
        run_at: lastRun.run_at,
        variants_found: lastRun.variants_found,
        variants_published: lastRun.variants_published,
        variants_failed: lastRun.variants_failed,
        duration_ms: lastRun.duration_ms,
        had_errors: (lastRun.variants_failed || 0) > 0,
      } : null,
      statistics: {
        total_runs: totalRuns,
        total_variants_found: totalFound,
        total_variants_published: totalPublished,
        total_variants_failed: totalFailed,
        average_duration_ms: avgDuration,
        success_rate: totalFound > 0
          ? Math.round((totalPublished / totalFound) * 100)
          : 100,
      },
      current_queue: {
        ready_to_publish: scheduledCount || 0,
        upcoming_scheduled: upcomingCount || 0,
      },
      recent_runs: recentLogs || [],
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Cron status error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch cron status' },
      { status: 500 }
    );
  }
}
