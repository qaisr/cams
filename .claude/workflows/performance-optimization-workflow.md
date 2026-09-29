# Performance Optimization Workflow

## Overview
Systematic workflow for identifying, fixing, and validating performance issues.

## Workflow Steps

### 1. Establish Baseline
**Agent**: `performance-engineer`

**Task**: Measure current performance

**Tools:**
- Lighthouse (frontend)
- k6 or Artillery (backend load testing)
- CloudWatch metrics (API latency, ECS CPU/memory, ALB target response time)
- Prisma query logging

**Metrics to Collect:**
```typescript
{
  frontend: {
    fcp: 2.8, // First Contentful Paint (seconds)
    lcp: 4.1, // Largest Contentful Paint
    tti: 5.3, // Time to Interactive
    cls: 0.25, // Cumulative Layout Shift
    bundleSize: 350, // KB (gzipped)
  },
  backend: {
    p50: 120, // API response time (ms)
    p95: 450,
    p99: 890,
    errorRate: 0.8, // %
  },
  database: {
    queryCount: 45, // Queries per request
    p95QueryTime: 85, // ms
    nPlusOneQueries: 12, // Count
  },
}
```

### 2. Identify Bottlenecks
**Agent**: `performance-engineer`

**Frontend Analysis:**
```bash
# Run Lighthouse
npm run lighthouse -- --url=https://example.com --output=json

# Analyze bundle
npm run analyze:bundle
```

**Backend Analysis:**
```typescript
// Enable Prisma query logging
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
  log      = ["query", "info", "warn", "error"]
}
```

**Load Test:**
```typescript
// tests/load/api-load-test.ts (k6)
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '3m', target: 100 },
    { duration: '1m', target: 0 },
  ],
};

export default function () {
  const res = http.get('https://api.example.com/v2/users');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
```

### 3. Optimize Database Queries
**Agent**: `database-analyst`

**Identify N+1 Queries:**
```typescript
// ❌ Bad: N+1 queries
const users = await prisma.user.findMany();
for (const user of users) {
  const posts = await prisma.post.findMany({ where: { userId: user.id } });
}

// ✅ Good: Single query
const users = await prisma.user.findMany({
  include: { posts: true },
});
```

**Add Indexes:**
```prisma
model User {
  id        String @id @default(uuid())
  email     String @unique
  lastName  String
  firstName String
  createdAt DateTime @default(now())

  @@index([lastName, firstName]) // Compound index for search
  @@index([createdAt]) // Index for sorting
}
```

**Optimize Selects:**
```typescript
// ❌ Bad: Fetches all fields
const user = await prisma.user.findUnique({ where: { id } });

// ✅ Good: Fetch only needed fields
const user = await prisma.user.findUnique({
  where: { id },
  select: {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
  },
});
```

### 4. Implement Caching
**Agent**: `backend-engineer`

**Redis Cache:**
```typescript
async findById(id: string): Promise<User> {
  const cacheKey = `user:${id}`;

  // Try cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Cache miss
  const user = await prisma.user.findUniqueOrThrow({ where: { id } });

  // Store in cache (5 min TTL)
  await redis.setex(cacheKey, 300, JSON.stringify(user));

  return user;
}
```

**React Query Cache:**
```typescript
export function useUser(id: string) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => api.users.findById(id),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000,
  });
}
```

### 5. Optimize Frontend Bundle
**Agent**: `frontend-developer`

**Code Splitting:**
```typescript
// apps/web/src/app/admin/page.tsx
import dynamic from 'next/dynamic';

const AdminDashboard = dynamic(() => import('@/components/AdminDashboard'), {
  loading: () => <Spinner />,
  ssr: false,
});
```

**Tree Shaking:**
```typescript
// ❌ Bad
import _ from 'lodash';

// ✅ Good
import debounce from 'lodash/debounce';
```

**Image Optimization:**
```typescript
<Image
  src={user.avatar}
  alt="Avatar"
  width={48}
  height={48}
  loading="lazy"
  placeholder="blur"
/>
```

### 6. Optimize Fargate Autoscaling
**Agent**: `devops-engineer`

**Tune autoscaling policy to minimize scale-out lag:**
```typescript
// infra/lib/api-stack.ts
const scaling = svc.service.autoScaleTaskCount({
  minCapacity: 2,   // keep 2 tasks warm in production
  maxCapacity: 10,
});

scaling.scaleOnCpuUtilization('CpuScaling', {
  targetUtilizationPercent: 60,
  scaleInCooldown: cdk.Duration.seconds(120),
  scaleOutCooldown: cdk.Duration.seconds(30),
});

scaling.scaleOnMemoryUtilization('MemoryScaling', {
  targetUtilizationPercent: 70,
});
```

**Container start-up optimisation (reduce scale-out warm-up time):**
- Keep the NestJS bootstrap time lean — defer heavy module init to background tasks
- Use multi-stage Dockerfile to minimise image size (smaller images pull faster on new tasks)
- Set `PRISMA_CLI_BINARY_TARGETS` appropriately to avoid runtime download

### 7. Run Performance Tests
**Agent**: `test-engineer`

**Load Test:**
```bash
k6 run tests/load/api-load-test.ts
```

**Lighthouse:**
```bash
npm run lighthouse
```

**Expected Results:**
```typescript
{
  frontend: {
    fcp: 1.2, // ↓ 57% improvement
    lcp: 2.1, // ↓ 49%
    tti: 2.8, // ↓ 47%
    cls: 0.08, // ↓ 68%
    bundleSize: 180, // ↓ 49%
  },
  backend: {
    p50: 45, // ↓ 63%
    p95: 150, // ↓ 67%
    p99: 320, // ↓ 64%
    errorRate: 0.1, // ↓ 88%
  },
  database: {
    queryCount: 8, // ↓ 82%
    p95QueryTime: 25, // ↓ 71%
    nPlusOneQueries: 0, // ↓ 100%
  },
}
```

### 8. Monitor in Production
**Agent**: `devops-engineer`

**CloudWatch Dashboard:**
```typescript
// Monitor key metrics
const dashboard = new cloudwatch.Dashboard(stack, 'PerformanceDashboard', {
  widgets: [
    new cloudwatch.GraphWidget({
      title: 'API Response Time (p95, p99)',
      left: [apiLatencyP95Metric, apiLatencyP99Metric],
    }),
    new cloudwatch.GraphWidget({
      title: 'Cache Hit Rate',
      left: [cacheHitRateMetric],
    }),
  ],
});
```

**Alerts:**
```typescript
const latencyAlarm = new cloudwatch.Alarm(stack, 'HighLatencyAlarm', {
  metric: apiLatencyP99Metric,
  threshold: 500, // p99 > 500ms
  evaluationPeriods: 2,
});

latencyAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertTopic));
```

### 9. Document Optimizations
**Agent**: `tech-lead`

**Optimization Report:**
```markdown
# Performance Optimization Report

## Summary
Reduced API p95 latency from 450ms to 150ms (67% improvement).

## Changes Made
1. **Database**: Added indexes on `User(lastName, firstName)` and `User(createdAt)`
2. **Backend**: Implemented Redis caching with 5-minute TTL
3. **Frontend**: Code splitting for admin routes, reduced bundle size by 49%
4. **Fargate**: Tuned autoscaling policy (min tasks 2, CPU target 60%), reduced scale-out lag by 40%

## Metrics Before/After
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| API p95 | 450ms | 150ms | 67% |
| API p99 | 890ms | 320ms | 64% |
| Bundle Size | 350KB | 180KB | 49% |
| LCP | 4.1s | 2.1s | 49% |

## Next Steps
- Implement CDN caching for static assets
- Consider database read replicas for high traffic
```

## Performance Budget Enforcement

**Lighthouse CI (GitHub Actions):**
```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI

on: [pull_request]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: treosh/lighthouse-ci-action@v9
        with:
          urls: |
            http://localhost:3000
          budgetPath: ./.lighthouserc.json
          uploadArtifacts: true
```

```json
// .lighthouserc.json
{
  "ci": {
    "assert": {
      "assertions": {
        "first-contentful-paint": ["error", { "maxNumericValue": 2000 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 3000 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }]
      }
    }
  }
}
```

## Quality Gates
- [ ] Lighthouse score > 90 (Performance)
- [ ] API p95 < 200ms, p99 < 500ms
- [ ] No N+1 queries detected
- [ ] Bundle size < 200KB (gzipped)
- [ ] Load test passes (1000 req/s for 5 min)
- [ ] Cache hit rate > 80%

## Token Optimization
- Load `performance-engineer` only during optimization workflow
- Unload after performance tests pass
- Reference `.claude/patterns/cache-strategy-pattern.md` for caching patterns

## Related
- `.claude/standards/performance-standards.md`
- `.claude/agents/performance-engineer.md`
- `.claude/patterns/cache-strategy-pattern.md`
- `.claude/templates/performance-test.ts`
