# REWRITE_UPGRADE Production Rollout Guide

## STEP 29: Production Hardening & Kill-Switch

This document describes the production safety mechanisms for the REWRITE_UPGRADE feature.

---

## 1. Kill-Switch Configuration

### Environment Variable

```bash
NEXT_PUBLIC_ENABLE_REWRITE_UPGRADE=true   # Feature enabled (default)
NEXT_PUBLIC_ENABLE_REWRITE_UPGRADE=false  # Feature disabled (kill-switch active)
```

### Behavior When Disabled

When the kill-switch is active (`false`):
- Task detection still runs (for telemetry)
- REWRITE_UPGRADE requests are **silently routed to CREATE**
- No error is shown to the user
- Telemetry logs the override with `KILL_SWITCH_ACTIVE`
- All guards, confirmation dialogs, and diff checks are bypassed

### Behavior When Enabled (Default)

When enabled (`true` or not set):
- Full REWRITE_UPGRADE flow executes
- Intent confirmation dialog shows
- Anchor guards validate structure
- Diff guards enforce change limits
- All invariants are enforced

---

## 2. Failure Escalation Policy

### When to Disable REWRITE_UPGRADE

Activate the kill-switch immediately if ANY of these conditions occur:

| Failure Class | Threshold | Action |
|---------------|-----------|--------|
| `REWRITE_DIFF_EXCEEDED` | > 30% of REWRITE requests | Disable immediately |
| `REWRITE_ANCHOR_MISMATCH` | > 20% of REWRITE requests | Disable immediately |
| `BINDING_MISMATCH` | Any occurrence | Investigate, disable if recurring |
| `EXECUTION_BLOCKED` | > 5% of requests | Investigate root cause |
| User complaints about "content changed too much" | > 3 reports/day | Disable and investigate |

### Failure Classes That Justify Shutdown

**Critical (Immediate Shutdown)**:
- `BINDING_MISMATCH` - System integrity compromised
- `REWRITE_ANCHOR_MISMATCH` - Structural validation failing
- Spike in any failure class > 2x baseline

**Warning (Monitor Closely)**:
- `REWRITE_DIFF_EXCEEDED` - May indicate prompt drift
- `REWRITE_NO_CONTEXT` - May indicate UX confusion

### How to Read Telemetry

Telemetry is emitted with prefix `[STUDIO_RUN]`:

```javascript
// DEV mode: Full details
[STUDIO_RUN] {
  taskType: 'REWRITE_UPGRADE',
  ok: false,
  reasonCode: 'REWRITE_DIFF_EXCEEDED',
  failureClass: { layer: 'Rewrite Diff Guard', retryable: true, userFixable: true },
  latencyMs: 2500,
  diffMetrics: { lengthRatioMax: 1.8, ... }
}

// PROD mode: Safe subset only
[STUDIO_RUN] {
  taskType: 'REWRITE_UPGRADE',
  ok: false,
  reasonCode: 'REWRITE_DIFF_EXCEEDED',
  latencyMs: 2500
}
```

### Key Metrics to Monitor

| Metric | Healthy Range | Alert Threshold |
|--------|---------------|-----------------|
| REWRITE_UPGRADE success rate | > 90% | < 80% |
| Average latency | < 3000ms | > 5000ms |
| Diff guard pass rate | > 85% | < 70% |
| Anchor validation pass rate | > 95% | < 85% |

---

## 3. Safe Defaults Confirmation

### CREATE Remains Default-Safe Path

- CREATE mode has no guards that can fail
- CREATE always proceeds to LLM call
- CREATE is the fallback when kill-switch is active
- No special handling required for CREATE

### No Silent Fallback Ever Occurs

**Guaranteed Behaviors**:
1. Every failure is surfaced to the user
2. Every failure is classified in telemetry
3. No request silently changes behavior without logging
4. Kill-switch routing is logged in DEV mode

### All Rewrite Failures Are Visible & Classified

Every REWRITE_UPGRADE failure:
- Has a `reasonCode` in telemetry
- Has a `failureClass` with:
  - `layer`: Which guard caught it
  - `retryable`: Whether retry might help
  - `userFixable`: Whether user action can resolve

---

## 4. Rollback Procedure

### Immediate Rollback (No Deployment)

1. Set environment variable:
   ```bash
   NEXT_PUBLIC_ENABLE_REWRITE_UPGRADE=false
   ```

2. Restart the application (or wait for env refresh)

3. Verify in logs:
   ```
   [StudioEditor:STEP29] Kill-switch active, routing to CREATE
   ```

4. Monitor telemetry for reduced failure rates

### Gradual Re-enablement

1. Fix root cause of failures
2. Deploy fix to staging
3. Verify all tests pass
4. Re-enable with monitoring:
   ```bash
   NEXT_PUBLIC_ENABLE_REWRITE_UPGRADE=true
   ```
5. Watch failure rates for 24 hours

---

## 5. Invariant Checklist

Before any production deployment, verify:

- [ ] All 59 tests pass (dialog + invariant tests)
- [ ] Build succeeds with no unauthorized LLM calls
- [ ] Kill-switch defaults to `true` (enabled)
- [ ] Kill-switch `false` routes to CREATE
- [ ] Telemetry logs kill-switch state
- [ ] No guard thresholds changed
- [ ] No detection logic changed
- [ ] CREATE path unchanged

---

## 6. Contact & Escalation

For production incidents:
1. Activate kill-switch first
2. Collect telemetry samples
3. Check failure taxonomy for classification
4. Review `docs/system-invariants.md` for expected behavior
5. Do NOT modify guards or thresholds without full review

---

## Revision History

| Date | Version | Change |
|------|---------|--------|
| 2025-12-27 | 1.0 | Initial STEP 29 documentation |
