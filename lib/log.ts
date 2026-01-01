// ============================================
// Central Logger for Content Machine
// ============================================
// Provides structured logging with levels and deduplication.
// Designed to keep dev:e2e output clean and deterministic.
//
// Levels: silent < error < warn < info < debug
//
// Environment variables:
//   CM_LOG_LEVEL        - Log level (default: 'warn' when DEBUG_ADLAB_E2E=1, else 'info')
//   DEBUG_ADLAB_E2E     - If '1', E2E logs show even at warn level
//
// Usage:
//   import { log } from '@/lib/log';
//   log.info('message');
//   log.debug('detailed info', { data });
//   log.error('error occurred', error);
//
// RUNTIME SAFETY:
//   Safe for both server and client bundles.
// ============================================

export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

const LEVEL_ORDER: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

function isServer(): boolean {
  return typeof window === 'undefined';
}

function getLogLevel(): LogLevel {
  const envLevel = process.env.CM_LOG_LEVEL?.toLowerCase();
  if (envLevel && envLevel in LEVEL_ORDER) {
    return envLevel as LogLevel;
  }
  // Default: warn when E2E debug enabled (quieter), info otherwise
  if (process.env.DEBUG_ADLAB_E2E === '1') {
    return 'warn';
  }
  return 'info';
}

function shouldLog(level: LogLevel): boolean {
  const currentLevel = getLogLevel();
  return LEVEL_ORDER[level] <= LEVEL_ORDER[currentLevel];
}

// ============================================
// One-time Deduplication (HMR-safe on server)
// ============================================

interface DedupeState {
  logged: Set<string>;
}

let clientDedupeState: DedupeState | null = null;

function getDedupeState(): DedupeState {
  if (!isServer()) {
    // Client: module-scoped state (no globalThis pollution, still dedupes per session)
    if (!clientDedupeState) clientDedupeState = { logged: new Set() };
    return clientDedupeState;
  }

  // Server: globalThis to survive HMR
  const g = globalThis as unknown as { __cmLogDedupeState?: DedupeState };
  if (!g.__cmLogDedupeState) {
    g.__cmLogDedupeState = { logged: new Set() };
  }
  return g.__cmLogDedupeState;
}

function writeConsole(level: LogLevel, prefix: string, message: string, args: unknown[]) {
  switch (level) {
    case 'error':
      console.error(prefix, message, ...args);
      break;
    case 'warn':
      console.warn(prefix, message, ...args);
      break;
    case 'debug':
      console.debug(prefix, message, ...args);
      break;
    default:
      console.log(prefix, message, ...args);
  }
}

/**
 * Log a message only once per runtime session.
 * - Server: once per process (survives HMR)
 * - Client: once per session (module-scoped)
 */
function logOnce(key: string, level: LogLevel, message: string, ...args: unknown[]): void {
  // Important: if not visible at current level, do NOT consume the key
  if (!shouldLog(level)) return;

  const state = getDedupeState();
  if (state.logged.has(key)) return;
  state.logged.add(key);

  const prefix = `[${level.toUpperCase()}]`;
  writeConsole(level, prefix, message, args);
}

// ============================================
// Logger Implementation
// ============================================

function createLogger() {
  const doLog = (level: LogLevel, message: string, ...args: unknown[]) => {
    if (!shouldLog(level)) return;
    const prefix = `[${level.toUpperCase()}]`;
    writeConsole(level, prefix, message, args);
  };

  return {
    error: (message: string, ...args: unknown[]) => doLog('error', message, ...args),
    warn: (message: string, ...args: unknown[]) => doLog('warn', message, ...args),
    info: (message: string, ...args: unknown[]) => doLog('info', message, ...args),
    debug: (message: string, ...args: unknown[]) => doLog('debug', message, ...args),

    once: (key: string, level: LogLevel, message: string, ...args: unknown[]) =>
      logOnce(key, level, message, ...args),

    isEnabled: (level: LogLevel) => shouldLog(level),
    getLevel: () => getLogLevel(),
  };
}

export const log = createLogger();

// ============================================
// E2E-specific logging
// ============================================

export function isE2ELogEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  if (process.env.DEBUG_ADLAB_E2E === '1') return true;
  return shouldLog('debug');
}

export function getE2ERouteFilter(): string[] {
  const filter = process.env.DEBUG_ADLAB_E2E_ROUTES?.trim();
  if (!filter || filter === '*') return [];
  return filter.split(',').map(r => r.trim()).filter(Boolean);
}

export function shouldLogE2ERoute(route: string): boolean {
  const filter = getE2ERouteFilter();
  if (filter.length === 0) return true;
  return filter.some(f => route.includes(f));
}

export function getE2EAggMs(): number {
  const val = process.env.DEBUG_ADLAB_E2E_AGG_MS;
  if (val) {
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 0) return parsed;
  }
  return 0;
}

// ============================================
// E2E Aggregation State
// ============================================

interface E2EAggEntry {
  routes: Map<string, { count: number; lastData: unknown }>;
  startTime: number;
  timer: ReturnType<typeof setTimeout> | null;
}

interface E2EAggState {
  pending: Map<string, E2EAggEntry>; // key = pageKey
}

let clientAggState: E2EAggState | null = null;

function getE2EAggState(): E2EAggState {
  if (!isServer()) {
    if (!clientAggState) clientAggState = { pending: new Map() };
    return clientAggState;
  }
  const g = globalThis as unknown as { __cmE2EAggState?: E2EAggState };
  if (!g.__cmE2EAggState) {
    g.__cmE2EAggState = { pending: new Map() };
  }
  return g.__cmE2EAggState;
}

export function logE2EBanner(lines: string[]): void {
  if (!isE2ELogEnabled()) return;
  for (const line of lines) {
    console.log(line);
  }
}

export function logE2E(route: string, data: Record<string, unknown>, pageKey: string): void {
  if (!isE2ELogEnabled()) return;
  if (!shouldLogE2ERoute(route)) return;

  const aggMs = getE2EAggMs();

  if (aggMs === 0) {
    console.log(`[E2E] ${route}`, data);
    return;
  }

  const state = getE2EAggState();
  let entry = state.pending.get(pageKey);

  if (!entry) {
    entry = {
      routes: new Map(),
      startTime: Date.now(),
      timer: null,
    };
    state.pending.set(pageKey, entry);

    entry.timer = setTimeout(() => {
      flushE2EAgg(pageKey);
    }, aggMs);
  }

  const existing = entry.routes.get(route);
  if (existing) {
    existing.count++;
    existing.lastData = data;
  } else {
    entry.routes.set(route, { count: 1, lastData: data });
  }
}

function flushE2EAgg(pageKey: string): void {
  const state = getE2EAggState();
  const entry = state.pending.get(pageKey);
  if (!entry) return;

  if (entry.timer) clearTimeout(entry.timer);
  state.pending.delete(pageKey);

  const routes: string[] = [];
  let totalQueries = 0;

  for (const [route, info] of entry.routes) {
    routes.push(`${route}(${info.count})`);
    totalQueries += info.count;
  }

  const duration = Date.now() - entry.startTime;
  console.log(`[E2E] Page aggregated`, {
    pageKey,
    routes: routes.join(', '),
    totalQueries,
    durationMs: duration,
  });
}
