#!/usr/bin/env node
// ============================================
// AdLab Deploy Gate - CI/CD Integration
// ============================================
// PHASE D27: Release Hardening & External Integration.
//
// USAGE:
//   node scripts/deploy-gate.js [--url <base-url>] [--timeout <ms>]
//
// DEFAULTS:
//   --url     http://localhost:3000
//   --timeout 30000
//
// EXIT CODES:
//   0 - Gate PASSED, deploy may proceed
//   1 - Gate FAILED, deploy blocked
//   2 - Gate ERROR, unable to verify
//
// INVARIANTS:
//   - No deploy without passing gate
//   - All checks audited server-side
//   - Timeout = FAIL (fail-safe)
// ============================================

const https = require('https');
const http = require('http');

// ============================================
// Parse Arguments
// ============================================

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    url: process.env.DEPLOY_GATE_URL || 'http://localhost:3000',
    timeout: parseInt(process.env.DEPLOY_GATE_TIMEOUT || '30000', 10),
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) {
      config.url = args[++i];
    } else if (args[i] === '--timeout' && args[i + 1]) {
      config.timeout = parseInt(args[++i], 10);
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
AdLab Deploy Gate - CI/CD Integration

Usage:
  node scripts/deploy-gate.js [options]

Options:
  --url <base-url>   Base URL of the application (default: http://localhost:3000)
  --timeout <ms>     Request timeout in milliseconds (default: 30000)
  --help, -h         Show this help message

Environment Variables:
  DEPLOY_GATE_URL      Base URL (overridden by --url)
  DEPLOY_GATE_TIMEOUT  Timeout (overridden by --timeout)

Exit Codes:
  0  Gate PASSED - deploy may proceed
  1  Gate FAILED - deploy blocked
  2  Gate ERROR  - unable to verify (fail-safe: blocked)
`);
      process.exit(0);
    }
  }

  return config;
}

// ============================================
// HTTP Request
// ============================================

function makeRequest(url, timeout) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https://');
    const client = isHttps ? https : http;

    const req = client.get(url, { timeout }, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, data: null, raw: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
  });
}

// ============================================
// Output Formatting
// ============================================

function formatCheck(check) {
  const icon = check.passed ? '✓' : '✗';
  const status = check.passed ? 'PASS' : 'FAIL';
  const critical = check.critical ? '[CRITICAL]' : '';
  return `  ${icon} ${check.name}: ${status} ${critical}\n     ${check.message}`;
}

function formatOutput(response) {
  const lines = [];

  lines.push('');
  lines.push('========================================');
  lines.push('  AdLab Deploy Gate');
  lines.push('========================================');
  lines.push('');

  if (response.data) {
    const { canDeploy, status, checks, summary, timestamp } = response.data;

    lines.push(`Status: ${status}`);
    lines.push(`Timestamp: ${timestamp}`);
    lines.push('');
    lines.push(`Summary: ${summary.passed}/${summary.total} checks passed`);

    if (summary.criticalFailed > 0) {
      lines.push(`CRITICAL FAILURES: ${summary.criticalFailed}`);
    }

    lines.push('');
    lines.push('Checks:');

    for (const check of checks || []) {
      lines.push(formatCheck(check));
    }

    lines.push('');

    if (canDeploy) {
      lines.push('========================================');
      lines.push('  ✓ GATE PASSED - Deploy may proceed');
      lines.push('========================================');
    } else {
      lines.push('========================================');
      lines.push('  ✗ GATE FAILED - Deploy BLOCKED');
      lines.push('========================================');
    }
  } else {
    lines.push('ERROR: Unable to parse gate response');
    if (response.raw) {
      lines.push(`Raw response: ${response.raw.substring(0, 200)}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

// ============================================
// Main
// ============================================

async function main() {
  const config = parseArgs();
  const gateUrl = `${config.url.replace(/\/$/, '')}/api/adlab/system/go-live`;

  console.log('');
  console.log('AdLab Deploy Gate');
  console.log(`Checking: ${gateUrl}`);
  console.log(`Timeout: ${config.timeout}ms`);
  console.log('');

  try {
    const response = await makeRequest(gateUrl, config.timeout);

    console.log(formatOutput(response));

    if (response.status === 200 && response.data?.canDeploy) {
      process.exit(0); // PASS
    } else if (response.status === 412) {
      process.exit(1); // FAIL - gate blocked
    } else {
      console.error(`Unexpected response status: ${response.status}`);
      process.exit(2); // ERROR
    }
  } catch (err) {
    console.error('');
    console.error('========================================');
    console.error('  ✗ GATE ERROR - Deploy BLOCKED');
    console.error('========================================');
    console.error('');
    console.error(`Error: ${err.message}`);
    console.error('');
    console.error('Fail-safe: Blocking deploy due to verification failure.');
    console.error('');
    process.exit(2); // ERROR - fail-safe block
  }
}

main();
