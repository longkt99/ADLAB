// ============================================
// AdLab Operations Module - Barrel Export
// ============================================
// PHASE D24: Operator Runbook.
// PHASE D25: Production Drill & Operator Certification.
// PHASE D26: Go-Live Gate & Continuous Compliance.
// PHASE D28: Data Freshness Truth + Staleness Controls.
// PHASE D29: Compliance Control Panel + Safe Overrides.
// PHASE D31: Security Whitepaper (Auto-Generated).
// PHASE D32: External Attestation Mode (SOC2/ISO/Enterprise DD).
// PHASE D33: Public Trust Portal (Zero-Auth, Customer-Shareable).
// PHASE D34: Public Customer Security Page + SLA Guarantees.
// PHASE D35: Customer Security Questionnaire Engine (Auto-Answerable).
// PHASE D36: Sales-Ready Trust Bundle Engine (Deal-Scoped Trust as a Link).
// PHASE D37: Sales Activation & Trust Intelligence Engine.
// PHASE D38: Revenue Enablement & Sales Activation Engine.
// PHASE D44: Procurement & Security Response Layer.
// ============================================

// D24: Operator Runbook
export {
  type Severity,
  type DecisionNode,
  type Procedure,
  type AuditInterpretation,
  type OperatorRunbook,
  OPERATOR_RUNBOOK,
  getProcedure,
  getProceduresBySeverity,
  exportRunbookAsJSON,
} from './runbook';

// D25: Drill Definitions
export {
  type IncidentSeverity,
  type IncidentType,
  type DrillAction,
  type ExpectedGuard,
  type DrillStatus,
  type RequiredAction,
  type SuccessCriteria,
  type DrillDefinition,
  type DrillInstance,
  type DrillActionRecord,
  type DrillEvaluationResult,
  DRILL_DEFINITIONS,
  INCIDENT_TYPES,
  DRILL_ACTIONS,
  getDrillById,
  getDrillsByType,
  getDrillsForRole,
  getRequiredDrills,
  getDrillsBySeverity,
  canParticipate,
} from './drills';

// D25: Drill Runner
export {
  type DrillMode,
  type DrillStartResult,
  type DrillActionResult,
  type SimulatedEffects,
  startDrill,
  getActiveDrill,
  getOperatorActiveDrill,
  recordDrillAction,
  getDrillEffects,
  cancelDrill,
  checkExpiredDrills,
  getWorkspaceDrills,
  markDrillPassed,
  markDrillFailed,
  cleanupOldDrills,
} from './drillRunner';

// D25: Drill Evaluator
export {
  type CertificationRecord,
  type OperatorCertificationStatus,
  REQUIRED_DRILLS_BY_ROLE,
  evaluateDrill,
  getOperatorCertificationStatus,
  isOperatorCertified,
  getOperatorCertifications,
  getRequiredDrillsForRole,
  canRoleParticipate,
  clearAllCertifications,
} from './drillEvaluator';

// D26: Compliance Monitor
export {
  type ComplianceStatus,
  type DriftSeverity,
  type DriftType,
  type DriftItem,
  type ComplianceCheckResult,
  type GlobalComplianceResult,
  checkWorkspaceCompliance,
  runGlobalComplianceCheck,
  checkSnapshotDrift,
  checkKillSwitchDrift,
  checkFailureInjectionDrift,
  checkMembershipDrift,
  checkGlobalKillSwitch,
  checkAuditReachability,
} from './complianceMonitor';

// D26: Auto-Response Playbooks
export {
  type IncidentRecord,
  type AutoActionRecord,
  type AutoResponseResult,
  executeAutoResponse,
  getIncident,
  getOpenIncidents,
  getAllIncidents,
  acknowledgeIncident,
  resolveIncident,
  clearCooldown,
  clearAllIncidents,
} from './autoResponse';

// D27: Alert Integrations
export {
  type AlertSeverity,
  type IntegrationType,
  type DeliveryStatus,
  type AlertPayload,
  type DeliveryAttempt,
  type AlertDeliveryResult,
  sendAlert,
  createComplianceAlert,
  sendComplianceAlert,
  getIntegrationHealth,
} from './alertIntegrations';

// D27: Drift Escalation
export {
  type EscalationSLA,
  type DriftRecord,
  type EscalationLevel,
  type EscalationResult,
  type EscalationConfig,
  recordDrift,
  resolveDrift,
  getDrift,
  getAllActiveDrifts,
  checkAndEscalate,
  checkAllEscalations,
  setEscalationConfig,
  getEscalationConfig,
  resetEscalationConfig,
  clearAllDrifts,
  getDriftStats,
  linkDriftToIncident,
} from './driftEscalation';

// D28: Freshness Policy
export {
  type DatasetKey,
  type FreshnessStatusValue,
  type FreshnessPolicy,
  type FreshnessStatus,
  ALL_DATASET_KEYS,
  CRITICAL_DATASET_KEYS,
  DEFAULT_FRESHNESS_POLICIES,
  getFreshnessPolicy,
  computeFreshnessStatus,
  formatAge,
  isDatasetCritical,
  getAllFreshnessPolicies,
} from './freshnessPolicy';

// D28: Freshness Status Resolver
export {
  type LastIngestionRecord,
  type DatasetFreshnessResult,
  type WorkspaceFreshnessMap,
  getLastSuccessfulIngestion,
  getDatasetFreshness,
  getWorkspaceFreshnessMap,
  hasCriticalFreshnessFailure,
  getFreshnessDisplayStatus,
} from './freshnessStatus';

// D29: Config Overrides
export {
  type ConfigOverride,
  type SetOverrideInput,
  type ConfigKey,
  getOverride,
  getNumericOverride,
  listOverrides,
  setOverride,
  deleteOverride,
  getFreshnessOverrides,
  setFreshnessOverrides,
} from './configOverrides';

// D31: Security Whitepaper
export {
  type SectionId,
  type WhitepaperSection,
  type SecurityWhitepaper,
  generateSecurityWhitepaper,
  SECTION_ORDER,
} from './securityWhitepaper';

// D32: Attestation Profiles
export {
  type AttestationProfile,
  type EvidenceSection,
  type RedactionTarget,
  type TimeWindowRequirement,
  type InvariantRequirement,
  type ProfileDefinition,
  type SectionStatus,
  type AttestationResult,
  ATTESTATION_PROFILES,
  getProfile,
  getAllProfiles,
  getProfileIds,
  isValidProfile,
  applyRedactions,
  countRedactions,
  generateAttestation,
  generateRedactedAttestation,
} from './attestationProfiles';

// D33: Trust Tokens
export {
  type TrustTokenScope,
  type TrustTokenPayload,
  type TrustToken,
  type CreateTokenInput,
  type CreateTokenResult,
  type VerifyTokenResult,
  type RevokeTokenResult,
  createTrustToken,
  verifyTrustToken,
  revokeTrustToken,
  listTrustTokens,
  getTrustToken,
  cleanupExpiredTokens,
} from './trustTokens';

// D34: SLA Derivation
export {
  type SLAStatus,
  type RTODerivation,
  type RPODerivation,
  type ResponseTimeDerivation,
  type AvailabilityClass,
  type FreshnessGuarantee,
  type SLASummary,
  type EvidenceSource,
  deriveRTO,
  deriveRPO,
  deriveResponseTargets,
  deriveAvailabilityClass,
  deriveFreshnessGuarantees,
  deriveSLASummary,
  getSLAEvidenceSources,
  SLA_EVIDENCE_SOURCES,
} from './slaDerivation';

// D35: Security Questionnaire Engine
export {
  type QuestionCategory,
  type AnswerType,
  type AnswerStatus,
  type ConfidenceLevel,
  type SecurityQuestion,
  type EvidenceReference,
  type ResolvedAnswer,
  type QuestionnaireResult,
  STANDARD_QUESTIONS,
  resolveQuestionnaire,
  resolveCustomQuestions,
  getQuestionsByCategory,
  getAllCategories,
  validateQuestion,
} from './questionnaireEngine';

// D36: Trust Bundle Engine
export {
  type BundleStatus,
  type BundleManifest,
  type BundleSection,
  type BundleContents,
  type PublicSecuritySummary,
  type EvidenceMetadata,
  type TrustBundle,
  type TrustBundleRecord,
  type CreateBundleInput,
  type CreateBundleResult,
  type VerifyBundleTokenResult,
  type BundleTokenPayload,
  type PreflightCheckResult,
  createTrustBundle,
  verifyBundleToken,
  revokeTrustBundle,
  listTrustBundles,
  getTrustBundle,
  getBundleContents,
  checkBundlePrerequisites,
  cleanupExpiredBundles,
} from './trustBundleEngine';

// D37: Trust Engagement Telemetry
export {
  type TimeBucket,
  type TrackedSection,
  type ExportFormat,
  type EngagementEventType,
  type EngagementEvent,
  type EngagementMetadata,
  type EngagementRecord,
  type BundleEngagementMetrics,
  type WorkspaceEngagementSummary,
  getTimeBucket,
  getTimeBucketLabel,
  getExpiryProximityDays,
  getBundleAgeDays,
  recordBundleView,
  recordSectionView,
  recordBundleExport,
  recordExpiredAccessAttempt,
  getBundleEngagementMetrics,
  getWorkspaceEngagementSummary,
  getSectionLabel,
  getEngagementEventLabel,
} from './trustEngagement';

// D37: Sales Signals Derivation
export {
  type SignalConfidence,
  type SalesSignalType,
  type SalesSignal,
  type BundleSalesIntelligence,
  type FrictionPoint,
  type DealStageIndicator,
  type WorkspaceSalesSummary,
  deriveSalesSignals,
  detectFrictionPoints,
  determineDealStage,
  calculateEngagementScore,
  generateBundleSalesIntelligence,
  getSignalLabel,
  getDealStageLabel,
  getDealStageSeverity,
  getConfidenceSeverity,
} from './salesSignals';

// D38: Sales Playbook Engine
export {
  type RecommendedActionType,
  type RecommendedAssetType,
  type RecommendationPriority,
  type PlaybookUrgency,
  type PlaybookRecommendation,
  type BundlePlaybook,
  type WorkspacePlaybookSummary,
  generatePlaybookRecommendation,
  generateBundlePlaybook,
  generateWorkspacePlaybookSummary,
  getRecommendedActionLabel,
  getRecommendedAssetLabel,
  getPriorityLabel,
  getPriorityColor,
  getUrgencyLabel,
  getUrgencyColor,
} from './salesPlaybooks';

// D38: Trust Timeline Generator
export {
  type TimelineEventType,
  type TimelineRisk,
  type TimelineEntry,
  type TrustTimeline,
  type RawTimelineEvent,
  generateTrustTimeline,
  getTimelineEventLabel,
  getTimelineEventIcon,
  getRiskLabel,
  getRiskColor,
  formatTimelineAsText,
} from './trustTimeline';

// D38: Trust ROI Analytics
export {
  type ROIInsightType,
  type EngagementTier,
  type TimeToActionBucket,
  type BundleOutcome,
  type ROIInsight,
  type BundleROIMetrics,
  type TrustROIAnalytics,
  type ROIInputBundle,
  classifyEngagementTier,
  determineBundleOutcome,
  getTimeToActionBucket,
  getEngagementTierLabel,
  getOutcomeLabel,
  getTimeToActionLabel,
  computeBundleROIMetrics,
  computeTrustROIAnalytics,
  getEngagementTierColor,
  getOutcomeColor,
  formatROIAnalyticsAsText,
} from './trustROI';

// D44: Security Answer Engine
export {
  type SecurityQuestionCategory,
  type AnswerStatus as SecurityAnswerStatus,
  type SecurityQuestion as SecurityAnswerQuestion,
  type SecurityAnswer,
  type EvidenceContext,
  type AnswerResolutionResult,
  resolveSecurityAnswer,
  resolveAllSecurityAnswers,
  resolveSecurityAnswersByCategory,
  getStatusLabel as getAnswerStatusLabel,
  getStatusColor as getAnswerStatusColor,
  getCategoryLabel as getSecurityCategoryLabel,
} from './securityAnswerEngine';

// D44: RFP Response Generator
export {
  type RFPExportFormat,
  type ResponsePackMetadata,
  type ResponseItem,
  type RFPResponsePack,
  type CategorySummary as RFPCategorySummary,
  type GeneratedPack,
  generateRFPResponsePack,
  generateAllFormatPacks,
  getSupportedFormats,
  isValidFormat,
  LEGAL_DISCLAIMER,
  CATEGORY_LABELS as RFP_CATEGORY_LABELS,
} from './rfpResponseGenerator';

// D44: Boundary Sheet Generator
export {
  type BoundaryStatus,
  type BoundaryCategory,
  type BoundaryItem,
  type BoundaryCategorySummary,
  type BoundarySheet,
  generateBoundarySheet,
  exportBoundarySheetMarkdown,
  exportBoundarySheetJSON,
  getItemsByStatus,
  getItemsByCategory,
  getStatusLabel as getBoundaryStatusLabel,
  getStatusColor as getBoundaryStatusColor,
  getCategoryLabel as getBoundaryCategoryLabel,
} from './boundarySheetGenerator';

// D44: Procurement Visibility Model
export {
  type VisibilityLevel,
  type DataCategory,
  type Stakeholder,
  type VisibilityRule,
  type VisibilityMatrix,
  type StakeholderVisibilitySummary,
  type ProcurementEvidencePackage,
  type DataInventoryItem,
  type NonExistentDataItem,
  type VerificationInstruction,
  generateVisibilityMatrix,
  getStakeholderVisibility,
  generateProcurementEvidencePackage,
  exportVisibilityMatrixMarkdown,
  getVisibilityLabel,
  getStakeholderLabel,
  getCategoryLabel as getVisibilityCategoryLabel,
} from './procurementVisibility';
