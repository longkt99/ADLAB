// ============================================
// AdLab Sales Playbooks Engine
// ============================================
// PHASE D38: Revenue Enablement & Sales Activation.
//
// PROVIDES:
// - Signal → recommendation mapping
// - Deterministic playbook generation
// - Asset recommendations
// - Action guidance for sales teams
//
// INVARIANTS:
// - READ-ONLY: No mutations
// - NO AUTOMATION: doNotAutomate always true
// - NO PII: Zero identity data
// - ADVISORY ONLY: Never gating, never blocking
// - Evidence-derived only
// ============================================

import {
  type SalesSignalType,
  type SignalConfidence,
  type DealStageIndicator,
  type SalesSignal,
} from './salesSignals';

// ============================================
// Types
// ============================================

/** Bundle profile for asset recommendations */
export type BundleProfile =
  | 'ENTERPRISE_FULL'
  | 'ENTERPRISE_LITE'
  | 'SMB_STANDARD'
  | 'QUICK_REFERENCE';

/** Asset types that can be recommended */
export type RecommendedAssetType =
  | 'ENTERPRISE_FULL_BUNDLE'
  | 'SOC2_ATTESTATION'
  | 'SECURITY_WHITEPAPER'
  | 'EXECUTIVE_SUMMARY'
  | 'QUESTIONNAIRE_EXPORT'
  | 'COMPLIANCE_PDF'
  | 'REFRESHED_BUNDLE'
  | 'TECHNICAL_DOCUMENTATION';

/** Action types for sales recommendations */
export type RecommendedActionType =
  | 'SCHEDULE_SECURITY_CALL'
  | 'SEND_EXECUTIVE_SUMMARY'
  | 'EXPORT_COMPLIANCE_DOCS'
  | 'FOLLOW_UP_CONTACT'
  | 'REFRESH_BUNDLE'
  | 'SCHEDULE_TECHNICAL_CALL'
  | 'VERIFY_CONTACT'
  | 'OFFER_DEMO'
  | 'PREPARE_PROCUREMENT_DOCS'
  | 'MONITOR_ENGAGEMENT';

/** Priority level for recommendations */
export type RecommendationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

/** A sales playbook recommendation */
export interface PlaybookRecommendation {
  signal: SalesSignalType;
  confidence: SignalConfidence;
  recommendedAction: RecommendedActionType;
  recommendedAsset: RecommendedAssetType | null;
  priority: RecommendationPriority;
  rationale: string;
  talkingPoints: string[];
  doNotAutomate: true; // ALWAYS true
  generatedAt: string;
}

/** Full playbook for a bundle */
export interface BundlePlaybook {
  bundleId: string;
  dealStage: DealStageIndicator;
  recommendations: PlaybookRecommendation[];
  primaryRecommendation: PlaybookRecommendation | null;
  summaryGuidance: string;
  generatedAt: string;
}

/** Playbook template definition */
interface PlaybookTemplate {
  signal: SalesSignalType;
  actionByConfidence: Record<SignalConfidence, RecommendedActionType>;
  assetByConfidence: Record<SignalConfidence, RecommendedAssetType | null>;
  priorityByConfidence: Record<SignalConfidence, RecommendationPriority>;
  rationale: string;
  talkingPoints: string[];
}

// ============================================
// Playbook Templates
// ============================================

const PLAYBOOK_TEMPLATES: PlaybookTemplate[] = [
  {
    signal: 'SECURITY_BLOCKER_SUSPECTED',
    actionByConfidence: {
      HIGH: 'SCHEDULE_SECURITY_CALL',
      MEDIUM: 'SCHEDULE_SECURITY_CALL',
      LOW: 'FOLLOW_UP_CONTACT',
    },
    assetByConfidence: {
      HIGH: 'ENTERPRISE_FULL_BUNDLE',
      MEDIUM: 'SECURITY_WHITEPAPER',
      LOW: 'QUESTIONNAIRE_EXPORT',
    },
    priorityByConfidence: {
      HIGH: 'URGENT',
      MEDIUM: 'HIGH',
      LOW: 'MEDIUM',
    },
    rationale: 'Extended questionnaire engagement suggests security team review with potential concerns',
    talkingPoints: [
      'Proactively acknowledge their security review process',
      'Offer direct access to security/compliance team',
      'Ask what specific concerns or questions arose during their review',
      'Highlight key compliance certifications if applicable',
    ],
  },
  {
    signal: 'PROCUREMENT_STAGE_REACHED',
    actionByConfidence: {
      HIGH: 'PREPARE_PROCUREMENT_DOCS',
      MEDIUM: 'EXPORT_COMPLIANCE_DOCS',
      LOW: 'MONITOR_ENGAGEMENT',
    },
    assetByConfidence: {
      HIGH: 'SOC2_ATTESTATION',
      MEDIUM: 'COMPLIANCE_PDF',
      LOW: 'SECURITY_WHITEPAPER',
    },
    priorityByConfidence: {
      HIGH: 'URGENT',
      MEDIUM: 'HIGH',
      LOW: 'MEDIUM',
    },
    rationale: 'Multiple exports and whitepaper focus indicate procurement process has begun',
    talkingPoints: [
      'Offer to pre-fill vendor assessment questionnaires',
      'Provide direct compliance officer contact',
      'Ask about procurement timeline',
      'Confirm all required documentation is available',
    ],
  },
  {
    signal: 'SUMMARY_ONLY_CONSUMER',
    actionByConfidence: {
      HIGH: 'SEND_EXECUTIVE_SUMMARY',
      MEDIUM: 'SEND_EXECUTIVE_SUMMARY',
      LOW: 'MONITOR_ENGAGEMENT',
    },
    assetByConfidence: {
      HIGH: 'EXECUTIVE_SUMMARY',
      MEDIUM: 'EXECUTIVE_SUMMARY',
      LOW: null,
    },
    priorityByConfidence: {
      HIGH: 'MEDIUM',
      MEDIUM: 'LOW',
      LOW: 'LOW',
    },
    rationale: 'Viewer focused only on executive summary, likely a decision-maker doing initial screening',
    talkingPoints: [
      'This may be executive-level review',
      'Consider offering a brief executive briefing call',
      'Highlight key business outcomes and ROI',
      'Ask if they need deeper technical details for their team',
    ],
  },
  {
    signal: 'LOW_TRUST_READINESS',
    actionByConfidence: {
      HIGH: 'REFRESH_BUNDLE',
      MEDIUM: 'FOLLOW_UP_CONTACT',
      LOW: 'MONITOR_ENGAGEMENT',
    },
    assetByConfidence: {
      HIGH: 'REFRESHED_BUNDLE',
      MEDIUM: 'REFRESHED_BUNDLE',
      LOW: null,
    },
    priorityByConfidence: {
      HIGH: 'HIGH',
      MEDIUM: 'MEDIUM',
      LOW: 'LOW',
    },
    rationale: 'Expired bundle access attempts indicate ongoing interest past expiry',
    talkingPoints: [
      'Acknowledge their continued interest',
      'Offer a fresh bundle with current evidence',
      'Ask about their timeline and decision process',
      'Understand what delayed their review',
    ],
  },
  {
    signal: 'DEAL_STALLED',
    actionByConfidence: {
      HIGH: 'FOLLOW_UP_CONTACT',
      MEDIUM: 'FOLLOW_UP_CONTACT',
      LOW: 'MONITOR_ENGAGEMENT',
    },
    assetByConfidence: {
      HIGH: 'REFRESHED_BUNDLE',
      MEDIUM: null,
      LOW: null,
    },
    priorityByConfidence: {
      HIGH: 'URGENT',
      MEDIUM: 'HIGH',
      LOW: 'MEDIUM',
    },
    rationale: 'Extended period with engagement but no export action may indicate blockers',
    talkingPoints: [
      'Check if there are unaddressed questions or concerns',
      'Ask if additional stakeholders need to be involved',
      'Offer to refresh the bundle with latest evidence',
      'Understand if timeline or priorities have changed',
    ],
  },
  {
    signal: 'ACTIVE_EVALUATION',
    actionByConfidence: {
      HIGH: 'MONITOR_ENGAGEMENT',
      MEDIUM: 'MONITOR_ENGAGEMENT',
      LOW: 'MONITOR_ENGAGEMENT',
    },
    assetByConfidence: {
      HIGH: null,
      MEDIUM: null,
      LOW: null,
    },
    priorityByConfidence: {
      HIGH: 'MEDIUM',
      MEDIUM: 'LOW',
      LOW: 'LOW',
    },
    rationale: 'Active engagement pattern suggests evaluation is progressing normally',
    talkingPoints: [
      'Evaluation appears to be progressing well',
      'Be available for questions if they reach out',
      'Avoid interrupting their review process',
      'Prepare for potential follow-up requests',
    ],
  },
  {
    signal: 'DEEP_DIVE_IN_PROGRESS',
    actionByConfidence: {
      HIGH: 'SCHEDULE_TECHNICAL_CALL',
      MEDIUM: 'MONITOR_ENGAGEMENT',
      LOW: 'MONITOR_ENGAGEMENT',
    },
    assetByConfidence: {
      HIGH: 'TECHNICAL_DOCUMENTATION',
      MEDIUM: 'SECURITY_WHITEPAPER',
      LOW: null,
    },
    priorityByConfidence: {
      HIGH: 'MEDIUM',
      MEDIUM: 'LOW',
      LOW: 'LOW',
    },
    rationale: 'Extended reading across sections indicates thorough technical review',
    talkingPoints: [
      'Technical team is conducting detailed review',
      'Prepare for detailed architecture questions',
      'Consider offering a technical deep-dive session',
      'Have engineering resources available if needed',
    ],
  },
  {
    signal: 'QUICK_REVIEW_COMPLETED',
    actionByConfidence: {
      HIGH: 'FOLLOW_UP_CONTACT',
      MEDIUM: 'MONITOR_ENGAGEMENT',
      LOW: 'MONITOR_ENGAGEMENT',
    },
    assetByConfidence: {
      HIGH: null,
      MEDIUM: null,
      LOW: null,
    },
    priorityByConfidence: {
      HIGH: 'MEDIUM',
      MEDIUM: 'LOW',
      LOW: 'LOW',
    },
    rationale: 'Brief review across sections suggests initial screening is complete',
    talkingPoints: [
      'Initial screening may be complete',
      'Watch for follow-up engagement from deeper reviewers',
      'Ask if they need specific sections highlighted',
      'Offer to walk through key security controls',
    ],
  },
  {
    signal: 'COMPLIANCE_FOCUS',
    actionByConfidence: {
      HIGH: 'SCHEDULE_SECURITY_CALL',
      MEDIUM: 'EXPORT_COMPLIANCE_DOCS',
      LOW: 'MONITOR_ENGAGEMENT',
    },
    assetByConfidence: {
      HIGH: 'SOC2_ATTESTATION',
      MEDIUM: 'QUESTIONNAIRE_EXPORT',
      LOW: null,
    },
    priorityByConfidence: {
      HIGH: 'HIGH',
      MEDIUM: 'MEDIUM',
      LOW: 'LOW',
    },
    rationale: 'Heavy focus on questionnaire and attestation indicates compliance team review',
    talkingPoints: [
      'Compliance or security team is conducting review',
      'Offer compliance officer direct contact',
      'Ask about specific compliance requirements',
      'Prepare for detailed security questionnaire responses',
    ],
  },
  {
    signal: 'TECHNICAL_REVIEW',
    actionByConfidence: {
      HIGH: 'SCHEDULE_TECHNICAL_CALL',
      MEDIUM: 'SCHEDULE_TECHNICAL_CALL',
      LOW: 'MONITOR_ENGAGEMENT',
    },
    assetByConfidence: {
      HIGH: 'TECHNICAL_DOCUMENTATION',
      MEDIUM: 'SECURITY_WHITEPAPER',
      LOW: null,
    },
    priorityByConfidence: {
      HIGH: 'MEDIUM',
      MEDIUM: 'LOW',
      LOW: 'LOW',
    },
    rationale: 'Focus on whitepaper and evidence suggests engineering team review',
    talkingPoints: [
      'Engineering team is conducting technical review',
      'Be prepared for architecture questions',
      'Consider offering a technical deep-dive session',
      'Have solution architect available if needed',
    ],
  },
  {
    signal: 'NO_ENGAGEMENT',
    actionByConfidence: {
      HIGH: 'VERIFY_CONTACT',
      MEDIUM: 'FOLLOW_UP_CONTACT',
      LOW: 'MONITOR_ENGAGEMENT',
    },
    assetByConfidence: {
      HIGH: null,
      MEDIUM: null,
      LOW: null,
    },
    priorityByConfidence: {
      HIGH: 'HIGH',
      MEDIUM: 'MEDIUM',
      LOW: 'LOW',
    },
    rationale: 'Bundle created but never viewed may indicate delivery or contact issues',
    talkingPoints: [
      'Verify bundle link was delivered correctly',
      'Confirm correct contact person received it',
      'Check if bundle went to spam or was blocked',
      'Consider re-sending with different subject line',
    ],
  },
];

// ============================================
// Playbook Generation
// ============================================

/**
 * Generates a playbook recommendation from a signal.
 * Deterministic: same signal + confidence = same recommendation.
 */
export function generateRecommendation(signal: SalesSignal): PlaybookRecommendation {
  const template = PLAYBOOK_TEMPLATES.find((t) => t.signal === signal.type);

  if (!template) {
    // Fallback for unknown signals
    return {
      signal: signal.type,
      confidence: signal.confidence,
      recommendedAction: 'MONITOR_ENGAGEMENT',
      recommendedAsset: null,
      priority: 'LOW',
      rationale: 'Signal detected but no specific playbook available',
      talkingPoints: ['Monitor for additional engagement patterns'],
      doNotAutomate: true,
      generatedAt: new Date().toISOString(),
    };
  }

  return {
    signal: signal.type,
    confidence: signal.confidence,
    recommendedAction: template.actionByConfidence[signal.confidence],
    recommendedAsset: template.assetByConfidence[signal.confidence],
    priority: template.priorityByConfidence[signal.confidence],
    rationale: template.rationale,
    talkingPoints: template.talkingPoints,
    doNotAutomate: true,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generates a full playbook for a bundle based on signals.
 */
export function generateBundlePlaybook(
  bundleId: string,
  dealStage: DealStageIndicator,
  signals: SalesSignal[]
): BundlePlaybook {
  const recommendations = signals.map(generateRecommendation);

  // Sort by priority
  const priorityOrder: Record<RecommendationPriority, number> = {
    URGENT: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  const primaryRecommendation = recommendations.length > 0 ? recommendations[0] : null;

  // Generate summary guidance
  const summaryGuidance = generateSummaryGuidance(dealStage, recommendations);

  return {
    bundleId,
    dealStage,
    recommendations,
    primaryRecommendation,
    summaryGuidance,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generates human-readable summary guidance based on deal stage.
 */
function generateSummaryGuidance(
  dealStage: DealStageIndicator,
  recommendations: PlaybookRecommendation[]
): string {
  const hasUrgent = recommendations.some((r) => r.priority === 'URGENT');
  const hasHigh = recommendations.some((r) => r.priority === 'HIGH');

  switch (dealStage) {
    case 'NO_ACTIVITY':
      return 'No engagement recorded. Verify bundle delivery and contact information.';

    case 'INITIAL_INTEREST':
      return 'Initial screening in progress. Monitor for deeper engagement.';

    case 'ACTIVE_REVIEW':
      return 'Active evaluation underway. Be available for questions without interrupting.';

    case 'DEEP_EVALUATION':
      return 'Thorough review in progress. Prepare for detailed technical questions.';

    case 'POTENTIAL_BLOCKER':
      if (hasUrgent) {
        return 'ATTENTION: Potential security concerns detected. Proactive outreach recommended.';
      }
      return 'Possible concerns identified. Consider proactive follow-up.';

    case 'PROCUREMENT_LIKELY':
      if (hasUrgent) {
        return 'Procurement process likely underway. Prioritize compliance documentation.';
      }
      return 'Strong procurement signals. Ensure all documentation is ready.';

    case 'STALLED':
      if (hasHigh || hasUrgent) {
        return 'Deal may be stalled. Follow-up recommended to understand blockers.';
      }
      return 'Engagement has slowed. Consider check-in to maintain momentum.';

    default:
      return 'Review signals and recommendations below.';
  }
}

// ============================================
// Label Functions
// ============================================

/**
 * Gets human-readable label for recommended action.
 */
export function getActionLabel(action: RecommendedActionType): string {
  const labels: Record<RecommendedActionType, string> = {
    SCHEDULE_SECURITY_CALL: 'Schedule Security Call',
    SEND_EXECUTIVE_SUMMARY: 'Send Executive Summary',
    EXPORT_COMPLIANCE_DOCS: 'Export Compliance Docs',
    FOLLOW_UP_CONTACT: 'Follow Up with Contact',
    REFRESH_BUNDLE: 'Create Refreshed Bundle',
    SCHEDULE_TECHNICAL_CALL: 'Schedule Technical Call',
    VERIFY_CONTACT: 'Verify Contact Info',
    OFFER_DEMO: 'Offer Product Demo',
    PREPARE_PROCUREMENT_DOCS: 'Prepare Procurement Docs',
    MONITOR_ENGAGEMENT: 'Monitor Engagement',
  };
  return labels[action];
}

/**
 * Gets human-readable label for recommended asset.
 */
export function getAssetLabel(asset: RecommendedAssetType): string {
  const labels: Record<RecommendedAssetType, string> = {
    ENTERPRISE_FULL_BUNDLE: 'Enterprise Full Bundle',
    SOC2_ATTESTATION: 'SOC2 Attestation Report',
    SECURITY_WHITEPAPER: 'Security Whitepaper',
    EXECUTIVE_SUMMARY: 'Executive Summary',
    QUESTIONNAIRE_EXPORT: 'Questionnaire Export',
    COMPLIANCE_PDF: 'Compliance Documentation',
    REFRESHED_BUNDLE: 'Refreshed Trust Bundle',
    TECHNICAL_DOCUMENTATION: 'Technical Documentation',
  };
  return labels[asset];
}

/**
 * Gets human-readable label for priority.
 */
export function getPriorityLabel(priority: RecommendationPriority): string {
  const labels: Record<RecommendationPriority, string> = {
    URGENT: 'Urgent',
    HIGH: 'High Priority',
    MEDIUM: 'Medium Priority',
    LOW: 'Low Priority',
  };
  return labels[priority];
}

/**
 * Gets color class for priority (for UI).
 */
export function getPriorityColor(priority: RecommendationPriority): string {
  switch (priority) {
    case 'URGENT':
      return 'red';
    case 'HIGH':
      return 'orange';
    case 'MEDIUM':
      return 'yellow';
    case 'LOW':
      return 'gray';
  }
}

// ============================================
// Urgency Types
// ============================================

/** Overall playbook urgency based on highest priority recommendation */
export type PlaybookUrgency = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Gets urgency from highest priority recommendation.
 */
export function getPlaybookUrgency(
  recommendations: PlaybookRecommendation[]
): PlaybookUrgency {
  if (recommendations.length === 0) return 'LOW';

  const hasUrgent = recommendations.some((r) => r.priority === 'URGENT');
  const hasHigh = recommendations.some((r) => r.priority === 'HIGH');
  const hasMedium = recommendations.some((r) => r.priority === 'MEDIUM');

  if (hasUrgent) return 'CRITICAL';
  if (hasHigh) return 'HIGH';
  if (hasMedium) return 'MEDIUM';
  return 'LOW';
}

/**
 * Gets human-readable label for urgency.
 */
export function getUrgencyLabel(urgency: PlaybookUrgency): string {
  const labels: Record<PlaybookUrgency, string> = {
    CRITICAL: 'Critical',
    HIGH: 'High',
    MEDIUM: 'Medium',
    LOW: 'Low',
  };
  return labels[urgency];
}

/**
 * Gets color for urgency (for UI).
 */
export function getUrgencyColor(urgency: PlaybookUrgency): string {
  switch (urgency) {
    case 'CRITICAL':
      return 'red';
    case 'HIGH':
      return 'orange';
    case 'MEDIUM':
      return 'yellow';
    case 'LOW':
      return 'gray';
  }
}

// ============================================
// Workspace Playbook Summary
// ============================================

/** Aggregated playbook summary for a workspace */
export interface WorkspacePlaybookSummary {
  workspaceId: string;
  totalBundles: number;
  byUrgency: Record<PlaybookUrgency, number>;
  topActions: Array<{ action: RecommendedActionType; count: number }>;
  topAssets: Array<{ asset: RecommendedAssetType; count: number }>;
  criticalBundles: string[];
  generatedAt: string;
}

/**
 * Generates a workspace-level playbook summary from all bundle playbooks.
 */
export function generateWorkspacePlaybookSummary(
  workspaceId: string,
  playbooks: BundlePlaybook[]
): WorkspacePlaybookSummary {
  const byUrgency: Record<PlaybookUrgency, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };

  const actionCounts: Record<RecommendedActionType, number> = {
    SCHEDULE_SECURITY_CALL: 0,
    SEND_EXECUTIVE_SUMMARY: 0,
    EXPORT_COMPLIANCE_DOCS: 0,
    FOLLOW_UP_CONTACT: 0,
    REFRESH_BUNDLE: 0,
    SCHEDULE_TECHNICAL_CALL: 0,
    VERIFY_CONTACT: 0,
    OFFER_DEMO: 0,
    PREPARE_PROCUREMENT_DOCS: 0,
    MONITOR_ENGAGEMENT: 0,
  };

  const assetCounts: Record<RecommendedAssetType, number> = {
    ENTERPRISE_FULL_BUNDLE: 0,
    SOC2_ATTESTATION: 0,
    SECURITY_WHITEPAPER: 0,
    EXECUTIVE_SUMMARY: 0,
    QUESTIONNAIRE_EXPORT: 0,
    COMPLIANCE_PDF: 0,
    REFRESHED_BUNDLE: 0,
    TECHNICAL_DOCUMENTATION: 0,
  };

  const criticalBundles: string[] = [];

  for (const playbook of playbooks) {
    const urgency = getPlaybookUrgency(playbook.recommendations);
    byUrgency[urgency]++;

    if (urgency === 'CRITICAL') {
      criticalBundles.push(playbook.bundleId);
    }

    for (const rec of playbook.recommendations) {
      actionCounts[rec.recommendedAction]++;
      if (rec.recommendedAsset) {
        assetCounts[rec.recommendedAsset]++;
      }
    }
  }

  // Sort actions by count
  const topActions = (Object.entries(actionCounts) as [RecommendedActionType, number][])
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([action, count]) => ({ action, count }));

  // Sort assets by count
  const topAssets = (Object.entries(assetCounts) as [RecommendedAssetType, number][])
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([asset, count]) => ({ asset, count }));

  return {
    workspaceId,
    totalBundles: playbooks.length,
    byUrgency,
    topActions,
    topAssets,
    criticalBundles,
    generatedAt: new Date().toISOString(),
  };
}

// ============================================
// Alias Exports for Barrel Compatibility
// ============================================

/** Alias for generateRecommendation */
export const generatePlaybookRecommendation = generateRecommendation;

/** Alias for getActionLabel */
export const getRecommendedActionLabel = getActionLabel;

/** Alias for getAssetLabel */
export const getRecommendedAssetLabel = getAssetLabel;
