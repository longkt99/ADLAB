# Branch Protection Setup

This guide explains how to protect the `main` branch on GitHub to prevent accidental breaks.

## Why Protect `main`?

- Prevents direct pushes that bypass CI
- Ensures all changes go through PR review
- Requires CI to pass before merging
- Creates an audit trail of changes

## Setup Steps (GitHub UI)

### 1. Navigate to Branch Protection Rules

1. Go to your repository on GitHub
2. Click **Settings** (top menu)
3. In the left sidebar, click **Branches** (under "Code and automation")
4. Click **Add branch protection rule** (or **Add rule**)

### 2. Configure the Rule

**Branch name pattern:**
```
main
```

**Recommended settings:**

| Setting | Recommended | Why |
|---------|-------------|-----|
| **Require a pull request before merging** | ✅ Yes | Forces code review |
| → Require approvals | 1 (or more for teams) | Someone must approve |
| → Dismiss stale approvals | ✅ Yes | New commits need re-approval |
| **Require status checks to pass** | ✅ Yes | CI must be green |
| → Require branches to be up to date | ✅ Yes | Must rebase on latest main |
| → Status checks: `CI / Lint, Typecheck & Build` | ✅ Select | Our CI job name |
| **Require conversation resolution** | ✅ Yes | All comments addressed |
| **Do not allow bypassing** | ✅ Yes | Even admins follow rules |
| **Restrict deletions** | ✅ Yes | Can't delete main |

### 3. Required Status Checks

When enabling "Require status checks to pass":

1. Search for `CI / Lint, Typecheck & Build` (our CI job from `.github/workflows/ci.yml`)
2. Select it to make it required
3. Check "Require branches to be up to date before merging"

### 4. Save the Rule

Click **Create** or **Save changes**.

## After Setup

### What Happens When You Push to `main` Directly?

```
! [remote rejected] main -> main (protected branch hook declined)
error: failed to push some refs
```

You must create a PR instead.

### What Happens When CI Fails?

The "Merge" button is disabled until CI passes:

```
❌ quality — Some checks were not successful
   → 1 failing check
```

### Bypassing Protection (Emergency Only)

If you're a repository admin and need to bypass in an emergency:

1. This should be rare and documented
2. Consider if the emergency can wait for proper PR
3. If you must: temporarily disable rule, push, re-enable

## Recommended PR Workflow

1. Create a feature branch:
   ```bash
   git checkout -b feature/my-change
   ```

2. Make changes and verify locally:
   ```bash
   npm run lint
   npx tsc -p tsconfig.json --noEmit
   npm run build
   ```

3. Push and create PR:
   ```bash
   git push -u origin feature/my-change
   # Open PR on GitHub
   ```

4. Wait for:
   - CI to pass (green checkmark)
   - Code review approval

5. Merge (squash recommended for clean history)

## Troubleshooting

### "Required status check is missing"

The CI workflow hasn't run on the PR yet. Wait a moment or check if there's a workflow error.

### "Branch is not up to date with main"

Click "Update branch" on the PR page, or locally:
```bash
git fetch origin
git rebase origin/main
git push --force-with-lease
```

### Admin Can Still Bypass

Check that "Do not allow bypassing the above settings" is enabled in the rule.
