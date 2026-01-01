// ============================================
// AdLab Guard Coverage Registry
// ============================================
// PHASE D24: Production Readiness Proof.
//
// CORE PRINCIPLE:
// Every critical API must declare its guards.
// Every guard must be verified at build time.
// No unguarded critical paths allowed.
//
// HARD RULES:
// - All critical routes must self-register
// - Guard order must be enforced
// - Build fails if guards missing
// ============================================

// ============================================
// Types
// ============================================

/** Guard types that can protect routes */
export type GuardType =
  | 'ACTOR_RESOLUTION'    // resolveActorFromRequest
  | 'KILL_SWITCH'         // assertKillSwitchOpen
  | 'FAILURE_INJECTION'   // assertNoInjectedFailure
  | 'PERMISSION'          // requirePermission
  | 'AUDIT_LOG';          // appendAuditLog

/** Required guard order (enforced) */
export const GUARD_ORDER: readonly GuardType[] = [
  'ACTOR_RESOLUTION',
  'KILL_SWITCH',
  'FAILURE_INJECTION',
  'PERMISSION',
  'AUDIT_LOG',
] as const;

/** Route criticality level */
export type CriticalityLevel =
  | 'CRITICAL'   // Data mutation, irreversible
  | 'HIGH'       // Data access, sensitive
  | 'MEDIUM'     // Standard operations
  | 'LOW';       // Read-only, public

/** Registered route entry */
export interface RegisteredRoute {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  criticality: CriticalityLevel;
  requiredGuards: GuardType[];
  implementedGuards: GuardType[];
  description: string;
  phase: string; // e.g., 'D16', 'D22'
}

/** Coverage report for a route */
export interface RouteCoverageReport {
  route: RegisteredRoute;
  covered: boolean;
  missingGuards: GuardType[];
  orderViolations: string[];
}

/** Overall coverage summary */
export interface CoverageSummary {
  totalRoutes: number;
  coveredRoutes: number;
  uncoveredRoutes: number;
  coverage: number; // percentage
  criticalCoverage: number; // percentage of CRITICAL routes covered
  reports: RouteCoverageReport[];
}

// ============================================
// Guard Registry
// ============================================

/** The global guard registry */
const registry: Map<string, RegisteredRoute> = new Map();

/**
 * Generates a unique key for a route.
 */
function routeKey(path: string, method: string): string {
  return `${method}:${path}`;
}

/**
 * Registers a route with its guard requirements.
 */
export function registerRoute(route: RegisteredRoute): void {
  const key = routeKey(route.path, route.method);
  registry.set(key, route);
}

/**
 * Gets a registered route.
 */
export function getRegisteredRoute(
  path: string,
  method: string
): RegisteredRoute | undefined {
  return registry.get(routeKey(path, method));
}

/**
 * Gets all registered routes.
 */
export function getAllRegisteredRoutes(): RegisteredRoute[] {
  return Array.from(registry.values());
}

/**
 * Clears the registry (for testing).
 */
export function clearRegistry(): void {
  registry.clear();
}

// ============================================
// Required Guards by Criticality
// ============================================

/** Minimum required guards by criticality level */
export const REQUIRED_GUARDS_BY_CRITICALITY: Record<CriticalityLevel, GuardType[]> = {
  CRITICAL: [
    'ACTOR_RESOLUTION',
    'KILL_SWITCH',
    'FAILURE_INJECTION',
    'PERMISSION',
    'AUDIT_LOG',
  ],
  HIGH: [
    'ACTOR_RESOLUTION',
    'PERMISSION',
    'AUDIT_LOG',
  ],
  MEDIUM: [
    'ACTOR_RESOLUTION',
    'PERMISSION',
  ],
  LOW: [],
};

// ============================================
// Coverage Verification
// ============================================

/**
 * Checks if guard order is correct.
 */
function checkGuardOrder(implementedGuards: GuardType[]): string[] {
  const violations: string[] = [];
  let lastIndex = -1;

  for (const guard of implementedGuards) {
    const currentIndex = GUARD_ORDER.indexOf(guard);
    if (currentIndex === -1) continue;

    if (currentIndex < lastIndex) {
      const expectedBefore = GUARD_ORDER[lastIndex];
      violations.push(
        `${guard} should come before ${expectedBefore}`
      );
    }
    lastIndex = currentIndex;
  }

  return violations;
}

/**
 * Verifies coverage for a single route.
 */
export function verifyRouteCoverage(route: RegisteredRoute): RouteCoverageReport {
  const missingGuards = route.requiredGuards.filter(
    (g) => !route.implementedGuards.includes(g)
  );

  const orderViolations = checkGuardOrder(route.implementedGuards);

  return {
    route,
    covered: missingGuards.length === 0 && orderViolations.length === 0,
    missingGuards,
    orderViolations,
  };
}

/**
 * Verifies coverage for all registered routes.
 */
export function verifyCoverage(): CoverageSummary {
  const routes = getAllRegisteredRoutes();
  const reports = routes.map(verifyRouteCoverage);

  const coveredRoutes = reports.filter((r) => r.covered).length;
  const criticalRoutes = routes.filter((r) => r.criticality === 'CRITICAL');
  const coveredCritical = reports.filter(
    (r) => r.route.criticality === 'CRITICAL' && r.covered
  ).length;

  return {
    totalRoutes: routes.length,
    coveredRoutes,
    uncoveredRoutes: routes.length - coveredRoutes,
    coverage: routes.length > 0 ? (coveredRoutes / routes.length) * 100 : 100,
    criticalCoverage:
      criticalRoutes.length > 0
        ? (coveredCritical / criticalRoutes.length) * 100
        : 100,
    reports,
  };
}

/**
 * Asserts all routes have full coverage.
 * Throws if any route is missing required guards.
 */
export function assertFullCoverage(): CoverageSummary {
  const summary = verifyCoverage();

  if (summary.uncoveredRoutes > 0) {
    const uncovered = summary.reports
      .filter((r) => !r.covered)
      .map((r) => ({
        path: r.route.path,
        method: r.route.method,
        missing: r.missingGuards,
        orderViolations: r.orderViolations,
      }));

    throw new Error(
      `Guard coverage incomplete. Uncovered routes:\n${JSON.stringify(uncovered, null, 2)}`
    );
  }

  return summary;
}

// ============================================
// Pre-registered AdLab Routes
// ============================================

// Register all critical AdLab routes at module load

registerRoute({
  path: '/api/adlab/ingestion/validate',
  method: 'POST',
  criticality: 'MEDIUM',
  requiredGuards: ['ACTOR_RESOLUTION', 'FAILURE_INJECTION', 'PERMISSION', 'AUDIT_LOG'],
  implementedGuards: ['ACTOR_RESOLUTION', 'FAILURE_INJECTION', 'PERMISSION', 'AUDIT_LOG'],
  description: 'Validates CSV content and creates ingestion log',
  phase: 'D16A',
});

registerRoute({
  path: '/api/adlab/ingestion/promote',
  method: 'POST',
  criticality: 'CRITICAL',
  requiredGuards: [
    'ACTOR_RESOLUTION',
    'KILL_SWITCH',
    'FAILURE_INJECTION',
    'PERMISSION',
    'AUDIT_LOG',
  ],
  implementedGuards: [
    'ACTOR_RESOLUTION',
    'KILL_SWITCH',
    'FAILURE_INJECTION',
    'PERMISSION',
    'AUDIT_LOG',
  ],
  description: 'Promotes validated data to production tables',
  phase: 'D16B',
});

registerRoute({
  path: '/api/adlab/snapshots/rollback',
  method: 'POST',
  criticality: 'CRITICAL',
  requiredGuards: [
    'ACTOR_RESOLUTION',
    'KILL_SWITCH',
    'FAILURE_INJECTION',
    'PERMISSION',
    'AUDIT_LOG',
  ],
  implementedGuards: [
    'ACTOR_RESOLUTION',
    'KILL_SWITCH',
    'FAILURE_INJECTION',
    'PERMISSION',
    'AUDIT_LOG',
  ],
  description: 'Rolls back to a previous production snapshot',
  phase: 'D18',
});

registerRoute({
  path: '/api/adlab/me',
  method: 'GET',
  criticality: 'LOW',
  requiredGuards: ['ACTOR_RESOLUTION'],
  implementedGuards: ['ACTOR_RESOLUTION'],
  description: 'Returns current actor context',
  phase: 'D21',
});

registerRoute({
  path: '/api/adlab/kill-switch/status',
  method: 'GET',
  criticality: 'LOW',
  requiredGuards: [],
  implementedGuards: [],
  description: 'Returns kill-switch status for UI',
  phase: 'D22',
});

registerRoute({
  path: '/api/adlab/system/readiness',
  method: 'GET',
  criticality: 'LOW',
  requiredGuards: [],
  implementedGuards: [],
  description: 'Returns production readiness status',
  phase: 'D24',
});

// D25: Drill routes
registerRoute({
  path: '/api/adlab/system/drills',
  method: 'GET',
  criticality: 'LOW',
  requiredGuards: ['ACTOR_RESOLUTION'],
  implementedGuards: ['ACTOR_RESOLUTION'],
  description: 'Lists available drills for operator',
  phase: 'D25',
});

registerRoute({
  path: '/api/adlab/system/drills',
  method: 'POST',
  criticality: 'LOW',
  requiredGuards: ['ACTOR_RESOLUTION', 'AUDIT_LOG'],
  implementedGuards: ['ACTOR_RESOLUTION', 'AUDIT_LOG'],
  description: 'Starts a new drill',
  phase: 'D25',
});

registerRoute({
  path: '/api/adlab/system/drills/action',
  method: 'POST',
  criticality: 'LOW',
  requiredGuards: ['ACTOR_RESOLUTION', 'AUDIT_LOG'],
  implementedGuards: ['ACTOR_RESOLUTION', 'AUDIT_LOG'],
  description: 'Records operator action during drill',
  phase: 'D25',
});

// D26: Go-Live Gate
registerRoute({
  path: '/api/adlab/system/go-live',
  method: 'GET',
  criticality: 'CRITICAL',
  requiredGuards: [],
  implementedGuards: [],
  description: 'Hard deploy gate - returns 200 if pass, 412 if fail',
  phase: 'D26',
});

// D27: Compliance Export
registerRoute({
  path: '/api/adlab/system/compliance/export',
  method: 'GET',
  criticality: 'LOW',
  requiredGuards: [],
  implementedGuards: [],
  description: 'Exports compliance snapshot for audit/security review',
  phase: 'D27',
});

// D29: System Controls
registerRoute({
  path: '/api/adlab/system/controls/kill-switch',
  method: 'GET',
  criticality: 'LOW',
  requiredGuards: ['ACTOR_RESOLUTION'],
  implementedGuards: ['ACTOR_RESOLUTION'],
  description: 'Returns current kill-switch status',
  phase: 'D29',
});

registerRoute({
  path: '/api/adlab/system/controls/kill-switch',
  method: 'POST',
  criticality: 'CRITICAL',
  requiredGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  implementedGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  description: 'Toggles kill-switch (owner-only)',
  phase: 'D29',
});

registerRoute({
  path: '/api/adlab/system/controls/failure-injection',
  method: 'GET',
  criticality: 'LOW',
  requiredGuards: ['ACTOR_RESOLUTION'],
  implementedGuards: ['ACTOR_RESOLUTION'],
  description: 'Lists failure injection configs',
  phase: 'D29',
});

registerRoute({
  path: '/api/adlab/system/controls/failure-injection',
  method: 'POST',
  criticality: 'HIGH',
  requiredGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  implementedGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  description: 'Configures failure injection (owner-only)',
  phase: 'D29',
});

registerRoute({
  path: '/api/adlab/system/controls/freshness-override',
  method: 'GET',
  criticality: 'LOW',
  requiredGuards: ['ACTOR_RESOLUTION'],
  implementedGuards: ['ACTOR_RESOLUTION'],
  description: 'Lists freshness overrides',
  phase: 'D29',
});

registerRoute({
  path: '/api/adlab/system/controls/freshness-override',
  method: 'POST',
  criticality: 'HIGH',
  requiredGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  implementedGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  description: 'Creates/updates freshness override (owner-only)',
  phase: 'D29',
});

registerRoute({
  path: '/api/adlab/system/controls/compliance',
  method: 'GET',
  criticality: 'LOW',
  requiredGuards: ['ACTOR_RESOLUTION'],
  implementedGuards: ['ACTOR_RESOLUTION'],
  description: 'Returns current compliance status',
  phase: 'D29',
});

registerRoute({
  path: '/api/adlab/system/controls/compliance',
  method: 'POST',
  criticality: 'MEDIUM',
  requiredGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  implementedGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  description: 'Triggers manual compliance check (owner-only)',
  phase: 'D29',
});

// D30: Production Evidence Pack
registerRoute({
  path: '/api/adlab/system/compliance/evidence',
  method: 'GET',
  criticality: 'HIGH',
  requiredGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  implementedGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  description: 'Returns full compliance evidence pack (admin-only, read-only)',
  phase: 'D30',
});

registerRoute({
  path: '/api/adlab/system/compliance/evidence/export',
  method: 'GET',
  criticality: 'HIGH',
  requiredGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  implementedGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  description: 'Exports evidence pack in various formats (admin-only, read-only)',
  phase: 'D30',
});

// D31: Security Whitepaper
registerRoute({
  path: '/api/adlab/system/security/whitepaper',
  method: 'GET',
  criticality: 'HIGH',
  requiredGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  implementedGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  description: 'Returns auto-generated security whitepaper from evidence (admin-only, read-only)',
  phase: 'D31',
});

registerRoute({
  path: '/api/adlab/system/security/whitepaper/export',
  method: 'GET',
  criticality: 'HIGH',
  requiredGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  implementedGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  description: 'Exports security whitepaper in various formats (admin-only, read-only)',
  phase: 'D31',
});

// D32: External Attestation Mode
registerRoute({
  path: '/api/adlab/system/attestation',
  method: 'GET',
  criticality: 'HIGH',
  requiredGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  implementedGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  description: 'Returns attestation for specified compliance profile (admin-only, read-only)',
  phase: 'D32',
});

registerRoute({
  path: '/api/adlab/system/attestation/export',
  method: 'GET',
  criticality: 'HIGH',
  requiredGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  implementedGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  description: 'Exports attestation in various formats with redactions (admin-only, read-only)',
  phase: 'D32',
});

// D33: Public Trust Portal
registerRoute({
  path: '/api/adlab/public/trust',
  method: 'GET',
  criticality: 'LOW',
  requiredGuards: ['AUDIT_LOG'],
  implementedGuards: ['AUDIT_LOG'],
  description: 'Public trust verification via signed token (zero-auth, token-based)',
  phase: 'D33',
});

registerRoute({
  path: '/api/adlab/public/trust/export',
  method: 'GET',
  criticality: 'LOW',
  requiredGuards: ['AUDIT_LOG'],
  implementedGuards: ['AUDIT_LOG'],
  description: 'Public trust export via signed token (zero-auth, token-based)',
  phase: 'D33',
});

registerRoute({
  path: '/api/adlab/system/trust-tokens',
  method: 'GET',
  criticality: 'HIGH',
  requiredGuards: ['ACTOR_RESOLUTION', 'PERMISSION'],
  implementedGuards: ['ACTOR_RESOLUTION', 'PERMISSION'],
  description: 'Lists trust tokens for workspace (admin-only)',
  phase: 'D33',
});

registerRoute({
  path: '/api/adlab/system/trust-tokens',
  method: 'POST',
  criticality: 'CRITICAL',
  requiredGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  implementedGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  description: 'Creates new trust token (owner-only)',
  phase: 'D33',
});

registerRoute({
  path: '/api/adlab/system/trust-tokens',
  method: 'DELETE',
  criticality: 'CRITICAL',
  requiredGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  implementedGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  description: 'Revokes trust token (owner-only)',
  phase: 'D33',
});

// D34: Public Customer Security Page
registerRoute({
  path: '/api/adlab/public/security',
  method: 'GET',
  criticality: 'LOW',
  requiredGuards: ['AUDIT_LOG'],
  implementedGuards: ['AUDIT_LOG'],
  description: 'Public security summary API (zero-auth, evidence-derived)',
  phase: 'D34',
});

// D35: Security Questionnaire Engine
registerRoute({
  path: '/api/adlab/public/security/questionnaire',
  method: 'GET',
  criticality: 'LOW',
  requiredGuards: ['AUDIT_LOG'],
  implementedGuards: ['AUDIT_LOG'],
  description: 'Public standard questionnaire (zero-auth, evidence-derived)',
  phase: 'D35',
});

registerRoute({
  path: '/api/adlab/public/security/questionnaire',
  method: 'POST',
  criticality: 'LOW',
  requiredGuards: ['AUDIT_LOG'],
  implementedGuards: ['AUDIT_LOG'],
  description: 'Custom questionnaire submission (zero-auth, evidence-derived)',
  phase: 'D35',
});

registerRoute({
  path: '/api/adlab/public/security/questionnaire/export',
  method: 'POST',
  criticality: 'LOW',
  requiredGuards: ['AUDIT_LOG'],
  implementedGuards: ['AUDIT_LOG'],
  description: 'Questionnaire export in various formats (zero-auth, evidence-derived)',
  phase: 'D35',
});

// D36: Trust Bundle Engine
registerRoute({
  path: '/api/adlab/system/trust-bundles',
  method: 'GET',
  criticality: 'HIGH',
  requiredGuards: ['ACTOR_RESOLUTION', 'PERMISSION'],
  implementedGuards: ['ACTOR_RESOLUTION', 'PERMISSION'],
  description: 'Lists trust bundles for workspace (admin-only)',
  phase: 'D36',
});

registerRoute({
  path: '/api/adlab/system/trust-bundles',
  method: 'POST',
  criticality: 'CRITICAL',
  requiredGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  implementedGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  description: 'Creates new trust bundle (owner-only, requires go-live gate)',
  phase: 'D36',
});

registerRoute({
  path: '/api/adlab/system/trust-bundles/revoke',
  method: 'POST',
  criticality: 'CRITICAL',
  requiredGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  implementedGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  description: 'Revokes trust bundle (owner-only, immediate)',
  phase: 'D36',
});

registerRoute({
  path: '/api/adlab/public/trust/bundle',
  method: 'GET',
  criticality: 'LOW',
  requiredGuards: ['AUDIT_LOG'],
  implementedGuards: ['AUDIT_LOG'],
  description: 'Public bundle retrieval via token (zero-auth, token-based)',
  phase: 'D36',
});

registerRoute({
  path: '/api/adlab/public/trust/bundle/export',
  method: 'GET',
  criticality: 'LOW',
  requiredGuards: ['AUDIT_LOG'],
  implementedGuards: ['AUDIT_LOG'],
  description: 'Public bundle export as ZIP (zero-auth, token-based)',
  phase: 'D36',
});

// D37: Sales Trust Intelligence
registerRoute({
  path: '/api/adlab/system/sales/trust-intelligence',
  method: 'GET',
  criticality: 'HIGH',
  requiredGuards: ['ACTOR_RESOLUTION', 'PERMISSION'],
  implementedGuards: ['ACTOR_RESOLUTION', 'PERMISSION'],
  description: 'Sales trust intelligence dashboard (admin-only, read-only)',
  phase: 'D37',
});

// D38: Sales Activation
registerRoute({
  path: '/api/adlab/system/sales/activation',
  method: 'GET',
  criticality: 'HIGH',
  requiredGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  implementedGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  description: 'Sales activation dashboard with playbooks, timeline, ROI (admin-only, read-only, advisory)',
  phase: 'D38',
});

// D44: Procurement Response
registerRoute({
  path: '/api/adlab/system/procurement',
  method: 'GET',
  criticality: 'HIGH',
  requiredGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  implementedGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  description: 'Procurement response center - security answers, RFP packs, boundary sheets, visibility matrix (admin-only, read-only, evidence-derived)',
  phase: 'D44',
});

// D50: Trust Snapshot Versioning
registerRoute({
  path: '/api/adlab/trust/changelog',
  method: 'GET',
  criticality: 'LOW',
  requiredGuards: [], // Public, no auth required
  implementedGuards: [],
  description: 'Public trust changelog (read-only, no auth, customer-visible)',
  phase: 'D50',
});

registerRoute({
  path: '/api/adlab/trust/versions',
  method: 'GET',
  criticality: 'LOW',
  requiredGuards: [], // Public, no auth required
  implementedGuards: [],
  description: 'Public trust versions list (read-only, no auth)',
  phase: 'D50',
});

registerRoute({
  path: '/api/adlab/trust/versions',
  method: 'POST',
  criticality: 'HIGH',
  requiredGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  implementedGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  description: 'Create trust snapshot (Product/Legal only, full audit)',
  phase: 'D50',
});

registerRoute({
  path: '/api/adlab/trust/versions/[version]',
  method: 'GET',
  criticality: 'LOW',
  requiredGuards: [], // Public, no auth required
  implementedGuards: [],
  description: 'View trust snapshot with diff (public, read-only)',
  phase: 'D50',
});

registerRoute({
  path: '/api/adlab/trust/versions/[version]',
  method: 'POST',
  criticality: 'HIGH',
  requiredGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  implementedGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  description: 'Activate trust snapshot (Owner only, full audit)',
  phase: 'D50',
});

registerRoute({
  path: '/api/adlab/trust/rollback',
  method: 'GET',
  criticality: 'MEDIUM',
  requiredGuards: ['ACTOR_RESOLUTION', 'PERMISSION'],
  implementedGuards: ['ACTOR_RESOLUTION', 'PERMISSION'],
  description: 'Check rollback eligibility (Owner only)',
  phase: 'D50',
});

registerRoute({
  path: '/api/adlab/trust/rollback',
  method: 'POST',
  criticality: 'HIGH',
  requiredGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  implementedGuards: ['ACTOR_RESOLUTION', 'PERMISSION', 'AUDIT_LOG'],
  description: 'Perform trust rollback (Owner only, full audit, customer-visible)',
  phase: 'D50',
});

registerRoute({
  path: '/api/adlab/trust/gate',
  method: 'GET',
  criticality: 'HIGH',
  requiredGuards: [], // No auth - deploy gate check
  implementedGuards: [],
  description: 'Deploy gate verification (returns 412 if trust checks fail)',
  phase: 'D50',
});

// D51: Trust Transparency Badge
registerRoute({
  path: '/api/adlab/trust/badge',
  method: 'GET',
  criticality: 'LOW',
  requiredGuards: [], // Public, no auth required - buyer-facing
  implementedGuards: [],
  description: 'Public trust badge data (read-only, no auth, CDN-cacheable, zero behavioral tracking)',
  phase: 'D51',
});

// ============================================
// Export for build-time verification
// ============================================

/**
 * Run this at build time to verify guard coverage.
 * Returns true if all routes are covered, false otherwise.
 */
export function verifyAtBuildTime(): boolean {
  try {
    assertFullCoverage();
    return true;
  } catch (e) {
    console.error('[GUARD REGISTRY]', e instanceof Error ? e.message : e);
    return false;
  }
}
