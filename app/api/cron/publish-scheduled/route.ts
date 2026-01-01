import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

// GET /api/cron/publish-scheduled
// This endpoint is called by Vercel Cron (every 5 minutes) to auto-publish scheduled variants
// when their scheduled_at time has passed
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const supabase = getServiceSupabase();

  try {
    // ============================================
    // 1. Authentication - Verify CRON_SECRET
    // ============================================
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // For Vercel Cron, authorization header is automatically set
    // For external cron services, require Bearer token
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ Cron auth failed:', { authHeader: authHeader ? 'present' : 'missing' });

      // Log failed attempt to cron_logs
      await supabase.from('cron_logs').insert({
        run_at: new Date().toISOString(),
        variants_found: 0,
        variants_published: 0,
        variants_failed: 0,
        errors: [{ type: 'auth_failed', message: 'Unauthorized access attempt' }],
        duration_ms: Date.now() - startTime,
      });

      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = new Date().toISOString();

    // ============================================
    // 2. Fetch Scheduled Variants
    // ============================================
    const { data: scheduledVariants, error: fetchError } = await supabase
      .from('variants')
      .select('id, base_post_id, platform, content, scheduled_at')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true });

    if (fetchError) {
      console.error('❌ Error fetching scheduled variants:', fetchError);

      // Log error to cron_logs
      await supabase.from('cron_logs').insert({
        run_at: now,
        variants_found: 0,
        variants_published: 0,
        variants_failed: 0,
        errors: [{ type: 'fetch_error', message: fetchError.message, details: JSON.parse(JSON.stringify(fetchError)) }],
        duration_ms: Date.now() - startTime,
      });

      return NextResponse.json(
        { error: 'Failed to fetch scheduled variants' },
        { status: 500 }
      );
    }

    // ============================================
    // 3. No Variants to Publish
    // ============================================
    if (!scheduledVariants || scheduledVariants.length === 0) {
      console.log('ℹ️  No variants to publish at', now);

      // Log successful run with zero variants
      await supabase.from('cron_logs').insert({
        run_at: now,
        variants_found: 0,
        variants_published: 0,
        variants_failed: 0,
        errors: null,
        duration_ms: Date.now() - startTime,
      });

      return NextResponse.json({
        success: true,
        message: 'No variants to publish',
        count: 0,
      });
    }

    console.log(`📅 Found ${scheduledVariants.length} variants ready to publish`);

    // ============================================
    // 4. Publish Each Variant
    // ============================================
    const results = {
      published: [] as string[],
      failed: [] as { id: string; error: string }[],
    };

    for (const variant of scheduledVariants) {
      try {
        // Update variant to published status
        const { error: updateError } = await supabase
          .from('variants')
          .update({
            status: 'published',
            published_at: now,
            published_error: null, // Clear any previous errors
          })
          .eq('id', variant.id);

        if (updateError) {
          throw new Error(updateError.message);
        }

        results.published.push(variant.id);
        console.log(`  ✅ Published variant ${variant.id} (${variant.platform})`);
      } catch (error: any) {
        // Store error in variant record
        await supabase
          .from('variants')
          .update({
            published_error: error.message || 'Unknown error during publishing',
          })
          .eq('id', variant.id);

        results.failed.push({
          id: variant.id,
          error: error.message || 'Unknown error',
        });

        console.error(`  ❌ Failed to publish variant ${variant.id}:`, error.message);
      }
    }

    // ============================================
    // 5. Log Results to cron_logs
    // ============================================
    const logEntry = {
      run_at: now,
      variants_found: scheduledVariants.length,
      variants_published: results.published.length,
      variants_failed: results.failed.length,
      errors: results.failed.length > 0 ? results.failed : null,
      duration_ms: Date.now() - startTime,
    };

    await supabase.from('cron_logs').insert(logEntry);

    // ============================================
    // 6. Return Summary
    // ============================================
    const summary = {
      success: true,
      message: `Published ${results.published.length} of ${scheduledVariants.length} scheduled variants`,
      found: scheduledVariants.length,
      published: results.published.length,
      failed: results.failed.length,
      duration_ms: Date.now() - startTime,
      variants_published: results.published,
      variants_failed: results.failed,
    };

    if (results.failed.length > 0) {
      console.warn(`⚠️  Published ${results.published.length}, failed ${results.failed.length}`);
    } else {
      console.log(`✅ Successfully published ${results.published.length} variants in ${logEntry.duration_ms}ms`);
    }

    return NextResponse.json(summary);
  } catch (error: any) {
    console.error('💥 Cron job critical error:', error);

    // Log critical error
    try {
      await supabase.from('cron_logs').insert({
        run_at: new Date().toISOString(),
        variants_found: 0,
        variants_published: 0,
        variants_failed: 0,
        errors: [{ type: 'critical_error', message: error.message, stack: error.stack }],
        duration_ms: Date.now() - startTime,
      });
    } catch (logError) {
      console.error('Failed to log critical error:', logError);
    }

    return NextResponse.json(
      { error: error.message || 'Failed to process scheduled variants' },
      { status: 500 }
    );
  }
}
