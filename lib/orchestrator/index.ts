// ============================================
// Orchestrator Module Index
// ============================================
// Re-exports all orchestrator functionality
// ============================================

// Action Classifier
export {
  classifyAction,
  hasImplicitReference,
  requiresSource,
  getActionCategory,
  detectTransformMode,
  getDirectiveSignals,
  detectNewCreate,
  getNewCreateSignals,
  detectTopicDrift,
  extractTopicAnchors,
} from './actionClassifier';

// Source Resolver
export {
  resolveSource,
  getMessageContent,
  isResolutionUsable,
  needsUserSelection,
  createOutputReference,
  getRecentOutputs,
  isValidSource,
} from './sourceResolver';

// Locked Context Extractor
export {
  extractLockedContext,
  getCriticalEntities,
  getEntitiesByType,
} from './lockedContextExtractor';

// Constraint Injector
export {
  buildConstraintBlock,
  injectConstraints,
  buildSourceReference,
  hasCriticalEntities,
  getConstraintSummary,
} from './constraintInjector';

// Topic Lock Validator
export {
  validateTopicLock,
  getValidationSummary,
  isRecoverable,
} from './topicLockValidator';

// Transform Orchestrator
export {
  executeTransform,
  executeSimple,
  shouldValidate,
  getLockedContext,
  getActionLabel,
  isRefusal,
  hasMeaningfulContent,
  applyFallbackTransform,
  validateForAction,
  type TransformRequest,
  type AICallFunction,
} from './transformOrchestrator';

// State Manager
export {
  OrchestratorStateManager,
  getStateManager,
  initializeStateManager,
} from './stateManager';

// Output Contract (Immutable Validation)
export {
  extractOutputContract,
  validateOutputContract,
  buildEnforcementInstruction,
  buildContractInstruction,
  countWords,
  detectStructure,
} from './outputContract';

// Execution Gate (Invariant Checker)
export {
  canExecute,
  validateToken,
  generateEventId,
  createAuthorizationToken,
  __resetProcessedCache,
  __getProcessedCacheSize,
  type UserActionType,
  type ExecutionContext,
  type GateDecision,
  type AuthorizationToken,
} from './executionGate';

// LLM Executor (Single Authorized Call Site)
export {
  executeLLM,
  buildLLMRequest,
  buildTransformRequest,
  __getInFlightCount,
  __clearInFlightRequests,
  type LLMMessage,
  type LLMRequest,
  type LLMResponse,
  type ExecutionResult,
} from './llmExecutor';
