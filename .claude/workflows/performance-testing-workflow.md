# Workflow: Performance Testing Workflow

## Purpose
Establish performance baselines, validate SLOs before release,
and identify regressions.

## Agents
- Primary: `performance-engineer`
- Support: `backend-engineer`, `database-analyst`

## When to Run
- Before every release to production
- After any query optimization or infrastructure change
- When Lighthouse score drops below 85
- When p95 API latency exceeds 200ms in staging

## Step 1: Define SLOs (first run only)
Reference: `.claude/standards/performance-standards.md`
Document target SLOs in `docs/performance/slos.md`.

## Step 2: Baseline (API)
```bash
# Run baseline k6 test (10 VUs, 60s)
k6 run --env BASE_URL=https://staging.app.com \
       --env AUTH_URL=$AUTH_URL \
       --env CLIENT_ID=$CLIENT_ID \
       --env CLIENT_SECRET=$CLIENT_SECRET \
       apps/api/tests/performance/baseline.ts

# Save results
k6 run ... --out json=results/baseline-$(date +%Y%m%d).json
```

Expected thresholds (from `performance-standards.md`):
- p50 < 80ms, p95 < 200ms, p99 < 500ms
- Error rate < 1%

## Step 3: Frontend Performance (Lighthouse)
```bash
# Run Lighthouse CI
npx lhci autorun --config lighthouserc.json

# Check against budgets
npx bundlesize
```

Expected thresholds:
- Performance score ≥ 90
- LCP < 2.5s, CLS < 0.1, INP < 100ms
- Main bundle < 250KB gzipped

## Step 4: Database Query Analysis
```bash
# Enable slow query logging in staging
pnpm tsx scripts/analyze-slow-queries.ts --threshold=100

# Check for N+1 patterns
pnpm tsx scripts/analyze-query-patterns.ts
```

For any query > 100ms:
1. Run `EXPLAIN ANALYZE` in staging DB
2. Check for sequential scans on large tables
3. Add index if needed (migration with `CONCURRENTLY`)
4. Re-test after index

## Step 5: Load + Spike Test
```bash
# Load test (20 VUs, 5 min)
k6 run --scenario=load apps/api/tests/performance/load.ts

# Spike test (100 VU surge)
k6 run --scenario=spike apps/api/tests/performance/spike.ts
```

Check: ECS running task count and CPU utilisation in CloudWatch, RDS Proxy connection pool usage.

## Step 6: Document Results
Create `docs/performance/release-YYYY-MM-DD.md`:
```markdown
## Release Performance Report

### API Latency
| Endpoint | p50 | p95 | p99 | SLO Met? |
|----------|-----|-----|-----|----------|
| GET /documents | 45ms | 120ms | 280ms | ✅ |

### Frontend
| Metric | Score | Budget | Met? |
|--------|-------|--------|------|
| Lighthouse Performance | 94 | ≥90 | ✅ |

### Issues Found
- None

### Recommendation
✅ Approved for production deployment
```

## Step 7: CI Integration
```yaml
# Add to CI pipeline (optional: only on release branches)
- name: Performance smoke test
  run: k6 run --vus=5 --duration=30s apps/api/tests/performance/smoke.ts
```

## Checklist
- [ ] Baseline metrics captured and documented
- [ ] All SLO thresholds met in staging
- [ ] Lighthouse scores within budget
- [ ] No N+1 queries detected
- [ ] Bundle size within budget
- [ ] Load test passed (no errors > 1%)
- [ ] Performance report committed to `docs/performance/`
- [ ] Go/No-go recommendation documented

## Token Optimization

- **Load when**: `/test-performance`, performance regression investigation, or scaling-readiness check before launch.
- **Load only**: this workflow + `performance-standards.md` + `performance-test.ts` template. Add `cache-strategy-pattern.md` only when caching is in scope.
- **Unload after**: load test passes thresholds; report committed under `docs/performance/`.
- **Hand-off to**: `performance-engineer` for optimization, `devops-engineer` for capacity planning.
