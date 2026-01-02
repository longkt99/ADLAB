# CI Quality Gates

This document explains how CI works in this repository and how to troubleshoot common issues.

## What CI Checks

Every PR and push to `main` triggers the CI workflow (`.github/workflows/ci.yml`) which runs:

| Step | Command | Purpose |
|------|---------|---------|
| **Lint** | `npm run lint` | Check code style and common errors |
| **Typecheck** | `npx tsc -p tsconfig.json --noEmit` | Verify TypeScript types |
| **Build** | `npm run build` | Ensure production build succeeds |

All three must pass for CI to be green.

## Local Verification

**Always run these commands locally before pushing:**

```bash
npm run lint
npx tsc -p tsconfig.json --noEmit
npm run build
```

Expected output:
- **Lint:** `No ESLint warnings or errors`
- **Typecheck:** No output (exit code 0)
- **Build:** `Compiled successfully` with route table

## Environment Variables & Fallbacks

### Why Fallbacks Exist

The app uses Supabase, which requires environment variables. However:

- **CI builds don't have `.env.local`** - secrets aren't always configured
- **Build-time imports would crash** if env vars were missing at module load

### How It Works

1. **Lazy Initialization:** Supabase clients are created on first use, not at import time
2. **CI Fallback Values:** The workflow provides dummy values so build succeeds:
   ```yaml
   NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co' }}
   ```
3. **Runtime Errors Only:** If the app tries to actually connect with dummy credentials, it fails at runtime (not build time)

### When Real Keys Are Needed

| Scenario | Real Keys Required? |
|----------|---------------------|
| CI build (lint/typecheck/build) | No - fallbacks work |
| Local development (`npm run dev`) | Yes - need `.env.local` |
| Production deployment | Yes - set in hosting platform |
| Running tests that hit Supabase | Yes - need real credentials |

## Common Failure Modes

### 1. Lint Errors

**Symptom:** CI fails at "Lint" step

**Fix:**
```bash
npm run lint
# Fix reported issues, then commit
```

### 2. Type Errors

**Symptom:** CI fails at "Typecheck" step with `TS####` errors

**Fix:**
```bash
npx tsc -p tsconfig.json --noEmit
# Fix type errors shown, then commit
```

### 3. Build Errors

**Symptom:** CI fails at "Build" step

**Common causes:**
- Import errors (missing files)
- Runtime code executed at build time
- Missing env vars (should be fixed by lazy init)

**Fix:**
```bash
npm run build
# Read the error message, fix the issue
```

### 4. Supabase Env Errors at Build Time

**Symptom:** Error like `NEXT_PUBLIC_SUPABASE_URL is not set`

**Cause:** Code is reading env vars at module scope (import time)

**Fix:** Ensure all Supabase client creation is inside functions, not at top level:
```typescript
// BAD - runs at import time
const supabase = createClient(process.env.URL!, process.env.KEY!);

// GOOD - runs when function is called
function getSupabase() {
  return createClient(process.env.URL!, process.env.KEY!);
}
```

## CI Workflow Features

| Feature | Purpose |
|---------|---------|
| `concurrency` | Cancels in-progress runs when new commits push (saves CI minutes) |
| `permissions: read` | Minimal permissions for security |
| `timeout-minutes: 10` | Prevents hung builds from wasting resources |
| `cache: 'npm'` | Caches node_modules for faster installs |

## Future: Migrating from `next lint`

The `next lint` command is deprecated and will be removed in Next.js 16.

When ready to migrate:

1. Run: `npx @next/codemod@canary next-lint-to-eslint-cli .`
2. Update `package.json` scripts to use ESLint CLI directly
3. Test that `npm run lint` still works

The migration can be done gradually since ESLint is already installed.

## Troubleshooting CI

### CI passes locally but fails on GitHub

1. Check if you have uncommitted changes: `git status`
2. Ensure `.env.local` isn't being used (CI doesn't have it)
3. Check the GitHub Actions log for the exact error

### CI is slow

- First run after dependency changes is slower (cache miss)
- Subsequent runs use cached `node_modules`
- The `concurrency` setting cancels superseded runs

### Need to re-run CI

- Push an empty commit: `git commit --allow-empty -m "chore: trigger CI"`
- Or use GitHub UI: Actions → select workflow → Re-run jobs
