// ============================================
// AdLab Compliance Snapshot Export API
// ============================================
// PHASE D27: Release Hardening & External Integration.
//
// EXPORTS:
// - Readiness status
// - Active snapshots
// - Last 24h audit summary
//
// USE CASES:
// - External audit
// - Security review
// - Post-incident report
//
// INVARIANTS:
// - Read-only endpoint
// - Audited access
// - No sensitive data exposed
// ============================================

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkProductionReadiness } from '@/lib/adlab/safety';
import { appendAuditLog } from '@/lib/adlab/audit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ============================================
// Types
// ============================================

interface ComplianceExport {
  exportedAt: string;
  exportVersion: string;
  readiness: {
    status: string;
    summary: {
      total: number;
      passed: number;
      failed: number;
      warnings: number;
    };
    checks: Array<{
      name: string;
      category: string;
      status: string;
      message: string;
    }>;
  };
  activeSnapshots: Array<{
    id: string;
    platform: string;
    dataset: string;
    createdAt: string;
    isActive: boolean;
  }>;
  auditSummary: {
    periodStart: string;
    periodEnd: string;
    totalEvents: number;
    byScope: Record<string, number>;
    complianceEvents: {
      pass: number;
      warn: number;
      fail: number;
    };
    goLiveGates: {
      pass: number;
      fail: number;
    };
    incidents: {
      opened: number;
      resolved: number;
    };
  };
  metadata: {
    environment: string;
    region?: string;
  };
}

// ============================================
// Supabase Client
// ============================================

function createExportClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ============================================
// Data Fetchers
// ============================================

async function getActiveSnapshots() {
  try {
    const supabase = createExportClient();

    const { data } = await supabase
      .from('adlab_production_snapshots')
      .select('id, platform, dataset, created_at, is_active')
      .eq('is_active', true)
      .order('platform')
      .order('dataset');

    return (data || []).map((s) => ({
      id: s.id,
      platform: s.platform,
      dataset: s.dataset,
      createdAt: s.created_at,
      isActive: s.is_active,
    }));
  } catch {
    return [];
  }
}

async function getAuditSummary() {
  try {
    const supabase = createExportClient();

    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - 24 * 60 * 60 * 1000);

    // Get all audit events from last 24 hours
    const { data } = await supabase
      .from('adlab_audit_logs')
      .select('scope_dataset, metadata')
      .gte('created_at', periodStart.toISOString())
      .lte('created_at', periodEnd.toISOString());

    const events = data || [];

    // Count by scope
    const byScope: Record<string, number> = {};
    for (const event of events) {
      const scope = event.scope_dataset || 'unknown';
      byScope[scope] = (byScope[scope] || 0) + 1;
    }

    // Count compliance events
    const complianceEvents = { pass: 0, warn: 0, fail: 0 };
    const goLiveGates = { pass: 0, fail: 0 };
    const incidents = { opened: 0, resolved: 0 };

    for (const event of events) {
      const metadata = event.metadata as Record<string, unknown> | null;
      if (!metadata) continue;

      // Compliance events
      if (metadata.complianceEvent === 'COMPLIANCE_PASS') complianceEvents.pass++;
      if (metadata.complianceEvent === 'COMPLIANCE_WARN') complianceEvents.warn++;
      if (metadata.complianceEvent === 'COMPLIANCE_FAIL') complianceEvents.fail++;

      // Go-live gates
      if (metadata.gateResult === 'PASS') goLiveGates.pass++;
      if (metadata.gateResult === 'FAIL') goLiveGates.fail++;

      // Incidents
      if (metadata.autoResponseTriggered) incidents.opened++;
      if (metadata.incidentResolved) incidents.resolved++;
    }

    return {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      totalEvents: events.length,
      byScope,
      complianceEvents,
      goLiveGates,
      incidents,
    };
  } catch {
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - 24 * 60 * 60 * 1000);

    return {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      totalEvents: 0,
      byScope: {},
      complianceEvents: { pass: 0, warn: 0, fail: 0 },
      goLiveGates: { pass: 0, fail: 0 },
      incidents: { opened: 0, resolved: 0 },
    };
  }
}

// ============================================
// Main Handler
// ============================================

export async function GET(): Promise<NextResponse<ComplianceExport>> {
  try {
    // Fetch all data in parallel
    const [readiness, activeSnapshots, auditSummary] = await Promise.all([
      checkProductionReadiness(),
      getActiveSnapshots(),
      getAuditSummary(),
    ]);

    const exportData: ComplianceExport = {
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0.0',
      readiness: {
        status: readiness.status,
        summary: readiness.summary,
        checks: readiness.checks.map((c) => ({
          name: c.name,
          category: c.category,
          status: c.status,
          message: c.message,
        })),
      },
      activeSnapshots,
      auditSummary,
      metadata: {
        environment: process.env.NODE_ENV || 'development',
        region: process.env.VERCEL_REGION,
      },
    };

    // Audit the export access
    await appendAuditLog({
      context: {
        workspaceId: 'system',
        actorId: 'compliance-export',
        actorRole: 'owner',
      },
      action: 'VALIDATE',
      entityType: 'dataset',
      entityId: 'compliance-export',
      scope: {
        platform: 'system',
        dataset: 'compliance_export',
      },
      metadata: {
        exportVersion: exportData.exportVersion,
        snapshotCount: activeSnapshots.length,
        auditEventCount: auditSummary.totalEvents,
        timestamp: exportData.exportedAt,
      },
    });

    return NextResponse.json(exportData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (e) {
    console.error('Compliance export error:', e);

    return NextResponse.json(
      {
        exportedAt: new Date().toISOString(),
        exportVersion: '1.0.0',
        readiness: {
          status: 'ERROR',
          summary: { total: 0, passed: 0, failed: 0, warnings: 0 },
          checks: [],
        },
        activeSnapshots: [],
        auditSummary: {
          periodStart: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          periodEnd: new Date().toISOString(),
          totalEvents: 0,
          byScope: {},
          complianceEvents: { pass: 0, warn: 0, fail: 0 },
          goLiveGates: { pass: 0, fail: 0 },
          incidents: { opened: 0, resolved: 0 },
        },
        metadata: {
          environment: process.env.NODE_ENV || 'development',
          error: e instanceof Error ? e.message : 'Export failed',
        },
      } as ComplianceExport,
      { status: 500 }
    );
  }
}
