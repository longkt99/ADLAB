#!/usr/bin/env node
// ============================================
// Build-Time LLM Call Enforcement Script
// ============================================
// This script ensures that all LLM API calls go through the
// authorized llmExecutor module. Any direct fetch calls to
// /api/studio/ai are flagged as violations.
//
// Run as part of build process: npm run check:llm-calls
// ============================================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  // Directories to scan
  scanDirs: ['lib', 'app', 'components'],

  // Files to exclude from scanning
  excludePatterns: [
    'node_modules',
    '.next',
    'dist',
    '__tests__',
    '*.test.ts',
    '*.test.tsx',
    '*.spec.ts',
    '*.spec.tsx',
    'scripts/check-llm-calls.js', // Exclude self
  ],

  // The ONLY authorized call site
  authorizedCallSite: 'lib/orchestrator/llmExecutor.ts',

  // Patterns to detect unauthorized calls
  // NOTE: /api/quality/auto-fix is EXCLUDED because:
  // 1. It's triggered by explicit user click (Auto Fix button)
  // 2. It's a separate API for refinement, not content generation
  // 3. The invariant we're enforcing is about content generation phantom calls
  unauthorizedPatterns: [
    {
      pattern: /fetch\s*\(\s*['"`]\/api\/studio\/ai['"`]/g,
      description: 'Direct fetch to /api/studio/ai',
    },
  ],

  // Exit codes
  EXIT_SUCCESS: 0,
  EXIT_VIOLATION: 1,
  EXIT_ERROR: 2,
};

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logError(message) {
  console.error(`${colors.red}${colors.bold}ERROR: ${message}${colors.reset}`);
}

function logSuccess(message) {
  console.log(`${colors.green}${colors.bold}✓ ${message}${colors.reset}`);
}

function logWarning(message) {
  console.log(`${colors.yellow}⚠ ${message}${colors.reset}`);
}

function logViolation(file, line, pattern, content) {
  console.log(`${colors.red}${colors.bold}VIOLATION:${colors.reset} ${file}:${line}`);
  console.log(`  ${colors.yellow}Pattern:${colors.reset} ${pattern}`);
  console.log(`  ${colors.blue}Code:${colors.reset} ${content.trim().substring(0, 100)}...`);
  console.log('');
}

// Get all TypeScript/JavaScript files in directory recursively
function getFiles(dir, files = []) {
  const fullDir = path.resolve(process.cwd(), dir);

  if (!fs.existsSync(fullDir)) {
    return files;
  }

  const entries = fs.readdirSync(fullDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(fullDir, entry.name);
    const relativePath = path.relative(process.cwd(), fullPath);

    // Check exclusions
    const shouldExclude = CONFIG.excludePatterns.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(relativePath);
      }
      return relativePath.includes(pattern);
    });

    if (shouldExclude) {
      continue;
    }

    if (entry.isDirectory()) {
      getFiles(relativePath, files);
    } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(relativePath);
    }
  }

  return files;
}

// Check if a line is inside a comment
function isCommentLine(line) {
  const trimmed = line.trim();
  // Single-line comments
  if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
    return true;
  }
  return false;
}

// Scan a file for unauthorized patterns
function scanFile(filePath) {
  const violations = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Skip the authorized call site
  const normalizedPath = filePath.replace(/\\/g, '/');
  if (normalizedPath === CONFIG.authorizedCallSite || normalizedPath.endsWith('llmExecutor.ts')) {
    return violations;
  }

  for (const { pattern, description } of CONFIG.unauthorizedPatterns) {
    // Reset regex state
    pattern.lastIndex = 0;

    let match;
    while ((match = pattern.exec(content)) !== null) {
      // Find line number
      const beforeMatch = content.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;
      const lineContent = lines[lineNumber - 1] || '';

      // Skip if inside a comment
      if (isCommentLine(lineContent)) {
        continue;
      }

      violations.push({
        file: filePath,
        line: lineNumber,
        pattern: description,
        content: lineContent,
      });
    }
  }

  return violations;
}

// Main function
function main() {
  log('\n========================================', 'blue');
  log('  LLM Call Enforcement Check', 'blue');
  log('========================================\n', 'blue');

  log(`Authorized call site: ${CONFIG.authorizedCallSite}`, 'green');
  log(`Scanning directories: ${CONFIG.scanDirs.join(', ')}\n`);

  let allViolations = [];
  let filesScanned = 0;

  for (const dir of CONFIG.scanDirs) {
    const files = getFiles(dir);

    for (const file of files) {
      filesScanned++;
      const violations = scanFile(file);
      allViolations = allViolations.concat(violations);
    }
  }

  log(`Files scanned: ${filesScanned}\n`);

  if (allViolations.length === 0) {
    logSuccess('No unauthorized LLM calls detected!');
    log('\nAll LLM calls properly route through llmExecutor.ts');
    log('Invariant: SINGLE_CALL_SITE ✓\n', 'green');
    process.exit(CONFIG.EXIT_SUCCESS);
  } else {
    logError(`Found ${allViolations.length} unauthorized LLM call(s)!\n`);

    for (const violation of allViolations) {
      logViolation(violation.file, violation.line, violation.pattern, violation.content);
    }

    log('\n========================================', 'red');
    log('  FIX REQUIRED', 'red');
    log('========================================\n', 'red');
    log('All LLM calls MUST go through lib/orchestrator/llmExecutor.ts');
    log('Use executeLLM() with a valid AuthorizationToken from canExecute()\n');
    log('Example:');
    log('  const token = createAuthorizationToken({ ... });');
    log('  const result = await executeLLM(token, request);');
    log('');

    process.exit(CONFIG.EXIT_VIOLATION);
  }
}

// Run
try {
  main();
} catch (error) {
  logError(`Script error: ${error.message}`);
  process.exit(CONFIG.EXIT_ERROR);
}
