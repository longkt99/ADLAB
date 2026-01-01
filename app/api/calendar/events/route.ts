import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import type { VariantStatus } from '@/lib/types';
import type { Platform } from '@/lib/platforms';

// GET /api/calendar/events
// Returns calendar events for scheduled and published variants
// Supports filtering by month, platform, and status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Get filter parameters
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString(), 10);
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString(), 10);
    const platformParam = searchParams.get('platform'); // Optional platform filter ('all' or specific platform)
    const platform = platformParam && platformParam !== 'all' ? (platformParam as Platform) : null;
    const status = searchParams.get('status') as VariantStatus | null; // Optional: 'scheduled', 'published', null = both

    console.log('📅 Calendar API request:', { year, month, platform, status });

    // ============================================
    // 1. Validate Input
    // ============================================
    if (isNaN(year) || year < 2020 || year > 2100) {
      return NextResponse.json(
        { error: 'Invalid year parameter' },
        { status: 400 }
      );
    }

    if (isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { error: 'Invalid month parameter (must be 1-12)' },
        { status: 400 }
      );
    }

    // ============================================
    // 2. Calculate Date Range for Month
    // ============================================
    // Get first day of month at 00:00:00 UTC
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));

    // Get first day of next month at 00:00:00 UTC
    const endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0));

    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();

    console.log('📅 Date range:', { startISO, endISO });

    // ============================================
    // 3. Build Supabase Query
    // ============================================
    const supabase = getServiceSupabase();

    try {
      // Start with base query
      let query = supabase
        .from('variants')
        .select(`
          id,
          base_post_id,
          platform,
          content,
          status,
          scheduled_at,
          published_at,
          created_at,
          posts (
            id,
            title
          )
        `);

      // ============================================
      // Build date and status filter
      // ============================================
      // If status filter is applied, only query that status
      if (status === 'scheduled') {
        query = query
          .eq('status', 'scheduled')
          .gte('scheduled_at', startISO)
          .lt('scheduled_at', endISO);
      } else if (status === 'published') {
        query = query
          .eq('status', 'published')
          .gte('published_at', startISO)
          .lt('published_at', endISO);
      } else {
        // No status filter: get both scheduled and published
        query = query.or(
          `and(status.eq.scheduled,scheduled_at.gte.${startISO},scheduled_at.lt.${endISO}),and(status.eq.published,published_at.gte.${startISO},published_at.lt.${endISO})`
        );
      }

      // Apply platform filter if specified
      if (platform) {
        query = query.eq('platform', platform);
      }

      // Order by created_at to ensure consistent results
      query = query.order('created_at', { ascending: false });

      // ============================================
      // 4. Execute Query
      // ============================================
      const { data: variants, error: fetchError } = await query;

      if (fetchError) {
        console.error('CALENDAR_EVENTS_ERROR - Supabase query failed:', {
          error: fetchError,
          message: fetchError.message,
          details: fetchError.details,
          hint: fetchError.hint,
          code: fetchError.code,
        });
        return NextResponse.json(
          {
            error: 'Failed to fetch calendar events',
            details: fetchError.message,
            code: fetchError.code,
            hint: fetchError.hint,
          },
          { status: 500 }
        );
      }

      console.log(`✅ Found ${variants?.length || 0} variants for calendar`);

      if (variants && variants.length > 0) {
        console.log('Sample variant:', {
          id: variants[0].id,
          platform: variants[0].platform,
          status: variants[0].status,
          scheduled_at: variants[0].scheduled_at,
          published_at: variants[0].published_at,
        });
      }

      // ============================================
      // 5. Transform to Calendar Events
      // ============================================
      const events = (variants || []).map((variant: any) => {
        // Use scheduled_at for scheduled variants, published_at for published
        const eventDate = variant.status === 'scheduled'
          ? variant.scheduled_at
          : variant.published_at;

        return {
          id: variant.id,
          post_id: variant.base_post_id,
          post_title: variant.posts?.title || 'Untitled Post',
          platform: variant.platform,
          status: variant.status,
          content: variant.content,
          date: eventDate,
          scheduled_at: variant.scheduled_at,
          published_at: variant.published_at,
        };
      });

      // ============================================
      // 6. Group Events by Day
      // ============================================
      const eventsByDay: { [key: string]: typeof events } = {};

      events.forEach((event) => {
        if (!event.date) return;

        // Extract YYYY-MM-DD from ISO date
        const dayKey = event.date.split('T')[0];

        if (!eventsByDay[dayKey]) {
          eventsByDay[dayKey] = [];
        }

        eventsByDay[dayKey].push(event);
      });

      console.log(`📊 Grouped into ${Object.keys(eventsByDay).length} days`);

      // ============================================
      // 7. Return Response
      // ============================================
      return NextResponse.json({
        success: true,
        year,
        month,
        start_date: startISO,
        end_date: endISO,
        total_events: events.length,
        events,
        events_by_day: eventsByDay,
        filters: {
          platform: platform || 'all',
          status: status || 'all',
        },
      });
    } catch (queryError: any) {
      console.error('CALENDAR_EVENTS_ERROR - Query execution failed:', {
        error: queryError,
        message: queryError.message,
        stack: queryError.stack,
      });
      return NextResponse.json(
        {
          error: 'Database query failed',
          details: queryError.message,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('CALENDAR_EVENTS_ERROR - Unexpected error:', {
      error,
      message: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      {
        error: 'Failed to fetch calendar events',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
