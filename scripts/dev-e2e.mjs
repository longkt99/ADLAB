#!/usr/bin/env node
// ============================================
// E2E Dev Server Script
// ============================================

import { spawn } from 'child_process';
import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

// ============================================
// Quiet Mode Configuration
// ============================================

const RING_BUFFER_SIZE = 200;

function isQuietModeEnabled() {
  if (process.env.CM_E2E_QUIET === '0') return false;
  if (process.env.CM_E2E_QUIET === '1') return true;
  return true;
}

function shouldDumpOnReady() {
  return process.env.CM_E2E_DUMP_ON_READY === '1';
}

function shouldShowLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;

  const showPatterns = [
    // E2E + Next essentials
    /\[E2E\]/i,
    /Local:\s*http/i,
    /ready in/i,
    /started server/i,
    /compiled/i,
    /compiling/i,

    // ✅ Allow box-drawing banners coming from server logs
    /[╔╗╚╝║╠╣═┌┐└┘│]/,

    // Errors (hardened)
    /error/i,
    /\bERR\b/i,
    /\bERR_/i,
    /failed/i,
    /failure/i,
    /exception/i,
    /\bthrow\b/i,
    /stack\s*:/i,
    /^\s+at\s+/,
    /digest:/i,
    /unhandled/i,
    /rejected/i,
    /uncaught/i,
    /fatal/i,
    /panic/i,
    /crash/i,
    /abort/i,

    // Hydration/React
    /hydration/i,
    /mismatch/i,
    /did not match/i,

    // Network
    /ECONN/i,
    /EADDRINUSE/i,
    /EACCES/i,
    /ENOENT/i,
    /EPERM/i,
    /ETIMEDOUT/i,
    /ENETUNREACH/i,

    // HTTP errors
    /HTTP\s*[45]\d{2}/i,
    /\s[45]\d{2}\s/,
    /\b[45]\d{2}\b.*\b(GET|POST|PUT|DELETE|PATCH)\b/i,

    // Warnings
    /warning/i,
    /\bWARN\b/i,
    /deprecated/i,

    // Build/Type errors
    /type\s*error/i,
    /syntax\s*error/i,
    /module\s*not\s*found/i,
    /cannot\s*find/i,
    /build\s*failed/i,
  ];

  return showPatterns.some(pattern => pattern.test(trimmed));
}

class RingBuffer {
  constructor(size) {
    this.size = size;
    this.buffer = [];
    this.suppressedCount = 0;
  }
  push(line) {
    this.buffer.push(line);
    this.suppressedCount++;
    if (this.buffer.length > this.size) this.buffer.shift();
  }
  getAll() {
    return this.buffer.slice();
  }
  clear() {
    this.buffer = [];
    this.suppressedCount = 0;
  }
  getSuppressedCount() {
    return this.suppressedCount;
  }
}

const STARTUP_TIMEOUT_MS = 30000;

// ============================================
// Zero-dependency .env loader (silent)
// ============================================

function parseEnvFile(content) {
  const result = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function loadEnvFiles(cwd) {
  const envFiles = ['.env', '.env.local', '.env.development', '.env.development.local'];
  for (const file of envFiles) {
    const filePath = path.join(cwd, file);
    if (existsSync(filePath)) {
      try {
        const parsed = parseEnvFile(readFileSync(filePath, 'utf-8'));
        for (const [key, value] of Object.entries(parsed)) {
          if (process.env[key] === undefined) process.env[key] = value;
        }
      } catch {}
    }
  }
}

// ============================================
// Helpers
// ============================================

function getSupabaseHost(url) {
  if (!url) return '(not set)';
  try {
    return new URL(url).host;
  } catch {
    return '(invalid)';
  }
}

function detectShell() {
  if (process.platform === 'win32') {
    if (process.env.PSModulePath && !process.env.PROMPT) return 'powershell';
    if (process.env.PROMPT) return 'cmd';
  }
  const shell = process.env.SHELL || '';
  if (shell.includes('bash')) return 'bash';
  if (shell.includes('zsh')) return 'zsh';
  return 'unknown';
}

function resolveNextBin(cwd) {
  try {
    const require = createRequire(import.meta.url);
    return require.resolve('next/dist/bin/next');
  } catch {
    return path.join(cwd, 'node_modules', 'next', 'dist', 'bin', 'next');
  }
}

function parseLocalPort(str) {
  const normalized = str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const match = normalized.match(/[-─]?\s*Local:\s*http:\/\/localhost:(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

// ============================================
// Main
// ============================================

async function main() {
  const cwd = process.cwd();
  loadEnvFiles(cwd);

  const nodeEnv = process.env.NODE_ENV || 'development';
  const supabaseHost = getSupabaseHost(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const shell = detectShell();
  const nextBin = resolveNextBin(cwd);
  const quietMode = isQuietModeEnabled();

  const suppressedBuffer = new RingBuffer(RING_BUFFER_SIZE);

  console.log('');
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  [E2E] Starting Dev Server (auto-port)                ║');
  console.log('╠═══════════════════════════════════════════════════════╣');
  console.log('║  DEBUG_ADLAB_E2E = 1                                  ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log(`  NODE_ENV     = ${nodeEnv}`);
  console.log(`  shell        = ${shell}`);
  console.log(`  supabaseHost = ${supabaseHost}`);
  console.log(`  quietMode    = ${quietMode ? 'ON (CM_E2E_QUIET=0 to disable)' : 'OFF'}`);
  console.log('');

  const childEnv = { ...process.env };
  delete childEnv.PORT;
  childEnv.DEBUG_ADLAB_E2E = '1';
  childEnv.NODE_ENV = 'development';

  console.log('[E2E] Spawning Next.js dev (no port specified, auto-pick)...');
  console.log(`[E2E] nextBin = ${nextBin}`);
  console.log('');

  const child = spawn(process.execPath, [nextBin, 'dev'], {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: childEnv,
    shell: false,
    cwd,
  });

  let outputBuffer = '';
  let outputLines = [];
  let resolved = false;

  const dumpSuppressedBuffer = (reason) => {
    if (!quietMode) return;
    const lines = suppressedBuffer.getAll();
    const total = suppressedBuffer.getSuppressedCount();
    if (lines.length === 0) return;

    console.error('');
    console.error('╔═══════════════════════════════════════════════════════╗');
    console.error(`║  [E2E] Dumping suppressed output (${reason})`.padEnd(56) + '║');
    console.error('╚═══════════════════════════════════════════════════════╝');
    console.error(`[E2E] Showing last ${lines.length} of ${total} suppressed lines:`);
    console.error('');
    for (const line of lines) console.error(`  ${line}`);
    console.error('');
  };

  function onPortDetected(port) {
    const baseUrl = `http://localhost:${port}`;

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║  [E2E] DEBUG_ADLAB_E2E=1 (CONFIRMED)                                          ║');
    console.log('╠═══════════════════════════════════════════════════════════════════════════════╣');
    console.log(`║  baseUrl      = ${baseUrl.padEnd(58)}║`);
    console.log(`║  port         = ${String(port).padEnd(58)}║`);
    console.log(`║  NODE_ENV     = ${nodeEnv.padEnd(58)}║`);
    console.log(`║  shell        = ${shell.padEnd(58)}║`);
    console.log(`║  supabaseHost = ${supabaseHost.padEnd(58)}║`);
    console.log(`║  quietMode    = ${(quietMode ? 'ON' : 'OFF').padEnd(58)}║`);
    console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('  Verify URLs (use these exact URLs):');
    console.log(`    → ${baseUrl}/ads/overview`);
    console.log(`    → ${baseUrl}/ads/metrics`);
    console.log('');

    if (quietMode) {
      console.log(`  Quiet mode: ${suppressedBuffer.getSuppressedCount()} lines suppressed during startup`);
      console.log('  Set CM_E2E_QUIET=0 to see all output');
      console.log('');
    }

    if (shouldDumpOnReady()) {
      dumpSuppressedBuffer('CM_E2E_DUMP_ON_READY=1');
    }

    const cleanup = () => {
      if (child && !child.killed) {
        console.log('\n[E2E] Shutting down...');
        try {
          child.kill('SIGTERM');
        } catch {}
      }
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }

  const handleOutput = (data, isStderr) => {
    const str = data.toString();
    outputBuffer += str;

    const newLines = str.split(/\r?\n/).filter(l => l.trim());
    outputLines.push(...newLines);
    if (outputLines.length > 50) outputLines = outputLines.slice(-50);

    if (quietMode) {
      for (const line of newLines) {
        if (shouldShowLine(line)) {
          (isStderr ? process.stderr : process.stdout).write(line + '\n');
        } else {
          suppressedBuffer.push(line);
        }
      }
    } else {
      (isStderr ? process.stderr : process.stdout).write(data);
    }

    if (resolved) return;

    const port = parseLocalPort(outputBuffer);
    if (port) {
      resolved = true;
      // stop unbounded growth
      outputBuffer = '';
      onPortDetected(port);
    }
  };

  child.stdout.on('data', (data) => handleOutput(data, false));
  child.stderr.on('data', (data) => handleOutput(data, true));

  child.on('error', (err) => {
    console.error('[E2E] Spawn error:', err.message);
    process.exit(1);
  });

  child.on('exit', (code) => {
    if (!resolved) {
      console.error(`[E2E] Next.js exited with code ${code} before detecting port`);
      console.error('[E2E] Last 20 lines of output:');
      outputLines.slice(-20).forEach(line => console.error(`  ${line}`));
      dumpSuppressedBuffer('exit before ready');
      process.exit(1);
    }
    if (code !== 0) {
      dumpSuppressedBuffer(`exit code ${code}`);
    }
    console.log(`[E2E] Next.js exited with code ${code}`);
    process.exit(code ?? 0);
  });

  setTimeout(() => {
    if (!resolved) {
      console.error('');
      console.error('╔═══════════════════════════════════════════════════════╗');
      console.error('║  [E2E] TIMEOUT: Could not detect Local URL            ║');
      console.error('╚═══════════════════════════════════════════════════════╝');
      console.error('');
      console.error('[E2E] Last 30 lines of output:');
      outputLines.slice(-30).forEach(line => console.error(`  ${line}`));
      console.error('');
      console.error('[E2E] Expected to find: "Local: http://localhost:XXXX"');
      dumpSuppressedBuffer('timeout');
      try { child.kill('SIGTERM'); } catch {}
      process.exit(1);
    }
  }, STARTUP_TIMEOUT_MS);
}

main().catch((err) => {
  console.error('[E2E] Fatal error:', err);
  process.exit(1);
});
