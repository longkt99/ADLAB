// ============================================
// AdLab Alerting Integrations
// ============================================
// PHASE D27: Release Hardening & External Integration.
//
// INTEGRATIONS:
// - Slack (webhook)
// - PagerDuty (events API v2)
// - Generic Webhook
//
// MAPPING:
// - COMPLIANCE_WARN → notify (no page)
// - COMPLIANCE_FAIL → page on-call
//
// INVARIANTS:
// - All delivery attempts audited
// - Retry with exponential backoff
// - Fail-safe: never block core operations
// ============================================

import { appendAuditLog } from '@/lib/adlab/audit';
import type { ComplianceStatus, DriftItem } from './complianceMonitor';

// ============================================
// Types
// ============================================

export type AlertSeverity = 'INFO' | 'WARN' | 'CRITICAL';
export type IntegrationType = 'slack' | 'pagerduty' | 'webhook';
export type DeliveryStatus = 'PENDING' | 'SENT' | 'FAILED' | 'RETRYING';

export interface AlertPayload {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  source: string;
  timestamp: string;
  workspaceId?: string;
  incidentId?: string;
  driftItems?: DriftItem[];
  metadata?: Record<string, unknown>;
}

export interface DeliveryAttempt {
  integration: IntegrationType;
  timestamp: string;
  status: DeliveryStatus;
  statusCode?: number;
  error?: string;
  retryCount: number;
}

export interface AlertDeliveryResult {
  alertId: string;
  attempts: DeliveryAttempt[];
  finalStatus: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  successfulIntegrations: IntegrationType[];
  failedIntegrations: IntegrationType[];
}

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

// ============================================
// Configuration
// ============================================

const RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

function getSlackWebhookUrl(): string | undefined {
  return process.env.ADLAB_SLACK_WEBHOOK_URL;
}

function getPagerDutyConfig(): { routingKey?: string; apiUrl?: string } {
  return {
    routingKey: process.env.ADLAB_PAGERDUTY_ROUTING_KEY,
    apiUrl: process.env.ADLAB_PAGERDUTY_API_URL || 'https://events.pagerduty.com/v2/enqueue',
  };
}

function getGenericWebhookUrl(): string | undefined {
  return process.env.ADLAB_ALERT_WEBHOOK_URL;
}

// ============================================
// Retry Logic
// ============================================

function calculateBackoff(retryCount: number, config: RetryConfig): number {
  const delay = config.baseDelayMs * Math.pow(2, retryCount);
  return Math.min(delay, config.maxDelayMs);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  config: RetryConfig
): Promise<{ ok: boolean; status: number; error?: string; retries: number }> {
  let lastError: string | undefined;
  let retries = 0;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return { ok: true, status: response.status, retries };
      }

      lastError = `HTTP ${response.status}`;

      // Don't retry on client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        return { ok: false, status: response.status, error: lastError, retries };
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'Unknown error';
    }

    retries = attempt + 1;

    if (attempt < config.maxRetries) {
      const delay = calculateBackoff(attempt, config);
      await sleep(delay);
    }
  }

  return { ok: false, status: 0, error: lastError, retries };
}

// ============================================
// Slack Integration
// ============================================

function buildSlackPayload(alert: AlertPayload): Record<string, unknown> {
  const emoji = alert.severity === 'CRITICAL' ? '🚨' : alert.severity === 'WARN' ? '⚠️' : 'ℹ️';
  const color = alert.severity === 'CRITICAL' ? '#dc3545' : alert.severity === 'WARN' ? '#ffc107' : '#17a2b8';

  const fields = [];

  if (alert.workspaceId) {
    fields.push({
      title: 'Workspace',
      value: alert.workspaceId,
      short: true,
    });
  }

  if (alert.incidentId) {
    fields.push({
      title: 'Incident',
      value: alert.incidentId,
      short: true,
    });
  }

  fields.push({
    title: 'Source',
    value: alert.source,
    short: true,
  });

  fields.push({
    title: 'Severity',
    value: alert.severity,
    short: true,
  });

  if (alert.driftItems && alert.driftItems.length > 0) {
    fields.push({
      title: 'Drift Items',
      value: alert.driftItems.map((d) => `• ${d.type}: ${d.message}`).join('\n'),
      short: false,
    });
  }

  return {
    text: `${emoji} ${alert.title}`,
    attachments: [
      {
        color,
        text: alert.message,
        fields,
        footer: 'AdLab Compliance Monitor',
        ts: Math.floor(new Date(alert.timestamp).getTime() / 1000),
      },
    ],
  };
}

async function sendSlackAlert(
  alert: AlertPayload
): Promise<DeliveryAttempt> {
  const webhookUrl = getSlackWebhookUrl();

  if (!webhookUrl) {
    return {
      integration: 'slack',
      timestamp: new Date().toISOString(),
      status: 'FAILED',
      error: 'Slack webhook URL not configured',
      retryCount: 0,
    };
  }

  const payload = buildSlackPayload(alert);

  const result = await fetchWithRetry(
    webhookUrl,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    RETRY_CONFIG
  );

  return {
    integration: 'slack',
    timestamp: new Date().toISOString(),
    status: result.ok ? 'SENT' : 'FAILED',
    statusCode: result.status,
    error: result.error,
    retryCount: result.retries,
  };
}

// ============================================
// PagerDuty Integration
// ============================================

function buildPagerDutyPayload(
  alert: AlertPayload,
  routingKey: string
): Record<string, unknown> {
  const severity =
    alert.severity === 'CRITICAL'
      ? 'critical'
      : alert.severity === 'WARN'
      ? 'warning'
      : 'info';

  return {
    routing_key: routingKey,
    event_action: 'trigger',
    dedup_key: alert.incidentId || alert.id,
    payload: {
      summary: alert.title,
      source: alert.source,
      severity,
      timestamp: alert.timestamp,
      custom_details: {
        message: alert.message,
        workspaceId: alert.workspaceId,
        incidentId: alert.incidentId,
        driftItems: alert.driftItems,
        ...alert.metadata,
      },
    },
  };
}

async function sendPagerDutyAlert(
  alert: AlertPayload
): Promise<DeliveryAttempt> {
  const config = getPagerDutyConfig();

  if (!config.routingKey) {
    return {
      integration: 'pagerduty',
      timestamp: new Date().toISOString(),
      status: 'FAILED',
      error: 'PagerDuty routing key not configured',
      retryCount: 0,
    };
  }

  const payload = buildPagerDutyPayload(alert, config.routingKey);

  const result = await fetchWithRetry(
    config.apiUrl!,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    RETRY_CONFIG
  );

  return {
    integration: 'pagerduty',
    timestamp: new Date().toISOString(),
    status: result.ok ? 'SENT' : 'FAILED',
    statusCode: result.status,
    error: result.error,
    retryCount: result.retries,
  };
}

// ============================================
// Generic Webhook Integration
// ============================================

async function sendWebhookAlert(
  alert: AlertPayload
): Promise<DeliveryAttempt> {
  const webhookUrl = getGenericWebhookUrl();

  if (!webhookUrl) {
    return {
      integration: 'webhook',
      timestamp: new Date().toISOString(),
      status: 'FAILED',
      error: 'Generic webhook URL not configured',
      retryCount: 0,
    };
  }

  const result = await fetchWithRetry(
    webhookUrl,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alert),
    },
    RETRY_CONFIG
  );

  return {
    integration: 'webhook',
    timestamp: new Date().toISOString(),
    status: result.ok ? 'SENT' : 'FAILED',
    statusCode: result.status,
    error: result.error,
    retryCount: result.retries,
  };
}

// ============================================
// Alert Dispatch
// ============================================

/**
 * Determines which integrations to use based on severity.
 */
function getIntegrationsForSeverity(severity: AlertSeverity): IntegrationType[] {
  switch (severity) {
    case 'CRITICAL':
      // Page on-call via all channels
      return ['slack', 'pagerduty', 'webhook'];
    case 'WARN':
      // Notify only (no page)
      return ['slack', 'webhook'];
    case 'INFO':
      // Slack only
      return ['slack'];
    default:
      return ['slack'];
  }
}

/**
 * Sends an alert to all appropriate integrations.
 */
export async function sendAlert(alert: AlertPayload): Promise<AlertDeliveryResult> {
  const integrations = getIntegrationsForSeverity(alert.severity);
  const attempts: DeliveryAttempt[] = [];
  const successfulIntegrations: IntegrationType[] = [];
  const failedIntegrations: IntegrationType[] = [];

  for (const integration of integrations) {
    let attempt: DeliveryAttempt;

    switch (integration) {
      case 'slack':
        attempt = await sendSlackAlert(alert);
        break;
      case 'pagerduty':
        attempt = await sendPagerDutyAlert(alert);
        break;
      case 'webhook':
        attempt = await sendWebhookAlert(alert);
        break;
      default:
        continue;
    }

    attempts.push(attempt);

    if (attempt.status === 'SENT') {
      successfulIntegrations.push(integration);
    } else if (attempt.error !== 'not configured' && !attempt.error?.includes('not configured')) {
      failedIntegrations.push(integration);
    }

    // Audit each delivery attempt
    await auditDeliveryAttempt(alert, attempt);
  }

  const finalStatus =
    successfulIntegrations.length === integrations.length
      ? 'SUCCESS'
      : successfulIntegrations.length > 0
      ? 'PARTIAL'
      : 'FAILED';

  return {
    alertId: alert.id,
    attempts,
    finalStatus,
    successfulIntegrations,
    failedIntegrations,
  };
}

// ============================================
// Compliance Alert Helpers
// ============================================

/**
 * Creates an alert from a compliance status change.
 */
export function createComplianceAlert(
  status: ComplianceStatus,
  workspaceId: string,
  driftItems: DriftItem[],
  incidentId?: string
): AlertPayload {
  const severity: AlertSeverity =
    status === 'FAIL' ? 'CRITICAL' : status === 'WARN' ? 'WARN' : 'INFO';

  const title =
    status === 'FAIL'
      ? 'CRITICAL: Compliance Failure Detected'
      : status === 'WARN'
      ? 'WARNING: Compliance Warning Detected'
      : 'INFO: Compliance Check Passed';

  const message = driftItems.length > 0
    ? `${driftItems.length} drift item(s) detected: ${driftItems.map((d) => d.type).join(', ')}`
    : 'All compliance checks passed.';

  return {
    id: `ALERT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    severity,
    title,
    message,
    source: 'AdLab Compliance Monitor',
    timestamp: new Date().toISOString(),
    workspaceId,
    incidentId,
    driftItems,
  };
}

/**
 * Sends a compliance alert based on status.
 */
export async function sendComplianceAlert(
  status: ComplianceStatus,
  workspaceId: string,
  driftItems: DriftItem[],
  incidentId?: string
): Promise<AlertDeliveryResult> {
  const alert = createComplianceAlert(status, workspaceId, driftItems, incidentId);
  return sendAlert(alert);
}

// ============================================
// Audit Logging
// ============================================

async function auditDeliveryAttempt(
  alert: AlertPayload,
  attempt: DeliveryAttempt
): Promise<void> {
  try {
    await appendAuditLog({
      context: {
        workspaceId: alert.workspaceId || 'system',
        actorId: 'alert-integrations',
        actorRole: 'owner',
      },
      action: 'VALIDATE',
      entityType: 'dataset',
      entityId: alert.id,
      scope: {
        platform: 'system',
        dataset: 'alert_delivery',
      },
      metadata: {
        alertId: alert.id,
        alertSeverity: alert.severity,
        integration: attempt.integration,
        status: attempt.status,
        statusCode: attempt.statusCode,
        error: attempt.error,
        retryCount: attempt.retryCount,
        timestamp: attempt.timestamp,
      },
    });
  } catch (e) {
    // Fail-safe: don't block on audit failure
    console.error('[ALERT INTEGRATIONS] Failed to audit delivery attempt:', e);
  }
}

// ============================================
// Health Check
// ============================================

export interface IntegrationHealth {
  integration: IntegrationType;
  configured: boolean;
  url?: string;
}

/**
 * Returns the health status of all integrations.
 */
export function getIntegrationHealth(): IntegrationHealth[] {
  const slackUrl = getSlackWebhookUrl();
  const pagerDutyConfig = getPagerDutyConfig();
  const webhookUrl = getGenericWebhookUrl();

  return [
    {
      integration: 'slack',
      configured: !!slackUrl,
      url: slackUrl ? '[configured]' : undefined,
    },
    {
      integration: 'pagerduty',
      configured: !!pagerDutyConfig.routingKey,
      url: pagerDutyConfig.apiUrl,
    },
    {
      integration: 'webhook',
      configured: !!webhookUrl,
      url: webhookUrl ? '[configured]' : undefined,
    },
  ];
}
