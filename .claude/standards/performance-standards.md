# Performance Standards

> Load when: implementing features with list views, data fetching, file uploads,
> or during performance reviews, bundle analysis, and load testing.
> Unload after performance review is complete.

## SLO Targets (Production)

| Metric | Target | Critical |
|--------|--------|----------|
| API p50 latency | < 80ms | > 200ms |
| API p95 latency | < 200ms | > 500ms |
| API p99 latency | < 500ms | > 1000ms |
| First Contentful Paint (FCP) | < 1.5s | > 3s |
| Largest Contentful Paint (LCP) | < 2.5s | > 4s |
| Time to Interactive (TTI) | < 3s | > 5s |
| Cumulative Layout Shift (CLS) | < 0.1 | > 0.25 |
| Total Blocking Time (TBT) | < 200ms | > 600ms |
| FID / INP | < 100ms | > 300ms |
| Lighthouse Performance | ≥ 90 | < 70 |

## Detailed Performance Budgets

### Backend (API)
| Metric | Target (p95) | Threshold (p99) |
|--------|--------------|-----------------|
| Simple GET (by ID) | < 50ms | < 100ms |
| Complex GET (with joins) | < 200ms | < 500ms |
| POST/PUT | < 300ms | < 1s |
| Batch operations | < 1s | < 3s |
| Background jobs | < 5s | < 30s |

### Database
| Metric | Target (p95) | Threshold (p99) |
|--------|--------------|-----------------|
| Simple query | < 10ms | < 50ms |
| Complex query (joins) | < 50ms | < 100ms |
| Write operation | < 20ms | < 100ms |
| Transaction | < 100ms | < 500ms |

## Bundle Size Budgets

| Bundle | Budget | Hard Limit |
|--------|--------|------------|
| Main JS chunk (gzipped) | < 150KB | 250KB |
| Per-route chunk (gzipped) | < 50KB | 100KB |
| Total initial JS | < 300KB | 500KB |
| Total CSS (gzipped) | < 30KB | 50KB |

Enforce via `next.config.js` `bundleAnalyzer` (`ANALYZE=true next build`) and size-limit in CI.

## Frontend

### Next.js Optimization Rules

```typescript
// ✅ Lazy load heavy components
const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), {
  loading: () => <Skeleton />,
  ssr: false,
});

// ✅ Optimize images — always use next/image, never <img> for content images
<Image src={url} width={800} height={600} priority={isAboveFold} alt="..." />

// ✅ Memoize expensive computations
const sorted = useMemo(() => sortItems(items), [items]);

// ✅ Stable callbacks
const handleSubmit = useCallback((data) => onSubmit(data), [onSubmit]);

// ✅ Virtualize long lists (> 50 items)
import { VirtualList } from '@repo/ui';

// ❌ Never import entire libraries
import _ from 'lodash';                 // BAD
import debounce from 'lodash/debounce'; // GOOD
```

#### Next.js Config Optimization

```typescript
// next.config.js
module.exports = {
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  experimental: {
    optimizePackageImports: ['@repo/ui', 'lucide-react'],
  },
};
```

### Image Optimization

- Always use `next/image` — never `<img>` for content images
- Provide `width` and `height` to prevent CLS
- Use `priority` prop for LCP image only
- Serve WebP/AVIF via Next.js automatic optimization

```typescript
// apps/web/src/components/Avatar.tsx
import Image from 'next/image';

export function Avatar({ src }: { src: string }) {
  return (
    <Image
      src={src}
      alt="Avatar"
      width={48}
      height={48}
      loading="lazy"
      placeholder="blur"
      blurDataURL="data:image/svg+xml;base64,..." // Low-res placeholder
    />
  );
}
```

### React Query Caching Strategy

```typescript
// Standard stale times by data volatility
const STALE_TIMES = {
  static: 30 * 60 * 1000,      // 30min: reference data, enums
  standard: 5 * 60 * 1000,     // 5min: most business data
  realtime: 30 * 1000,         // 30s: dashboards, notifications
  userSession: 10 * 60 * 1000, // 10min: user profile
};
```

| Data Type | staleTime | Notes |
|-----------|-----------|-------|
| Reference data / enums | 30 min | `STALE_TIMES.static` |
| Most business data | 5 min | `STALE_TIMES.standard` |
| Dashboards / notifications | 30s | `STALE_TIMES.realtime` |
| User profile | 10 min | `STALE_TIMES.userSession` |
| User-specific mutable data | 0 | Always fresh |

## Backend

### NestJS / Fargate Rules

#### Parallel Independent Queries

```typescript
// ✅ Run independent queries in parallel
const [user, permissions, settings] = await Promise.all([
  this.userRepo.findById(id),
  this.permRepo.findByUser(id),
  this.settingsRepo.findByUser(id),
]);
```

#### Prisma Query Optimization

```typescript
// ✅ Always select needed fields and paginate
const users = await this.prisma.user.findMany({
  select: { id: true, email: true, name: true },
  where: { status: 'active' },
  take: pageSize,
  skip: (page - 1) * pageSize,
  orderBy: { createdAt: 'desc' },
});

// ❌ Never do this — unbounded query + app-level filter
const all = await this.prisma.user.findMany();
const result = all.filter(u => u.active);
```

#### Avoid N+1 Queries

```typescript
// ❌ Bad: N+1 queries
const users = await prisma.user.findMany();
for (const user of users) {
  const posts = await prisma.post.findMany({ where: { userId: user.id } });
}

// ✅ Good: Single query with include
const users = await prisma.user.findMany({
  include: { posts: true },
});
```

#### Prisma Index Definitions

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique // Automatic index
  firstName String
  lastName  String
  createdAt DateTime @default(now())

  @@index([lastName, firstName]) // Compound index for search
  @@index([createdAt])           // Index for sorting
}
```

### Database Query Standards

- All queries must use indexes — run `EXPLAIN ANALYZE` for queries on tables > 1K rows
- No unbounded queries — always paginate (cursor or offset with max limit)
- N+1 prevention: use Prisma `include` or `select` — never loop-query
- Slow query threshold: > 100ms logged as WARN, > 500ms as ERROR
- Connection pool managed via RDS Proxy (single pool per Fargate task process)
- Use cursor pagination for large datasets (see `pagination-cursor-pattern.md`)

```sql
-- Required indexes:
-- 1. All foreign keys
-- 2. Columns in WHERE clauses on tables with > 1000 rows
-- 3. Columns used in ORDER BY for paginated queries
-- 4. Composite indexes matching common query patterns
-- 5. Partial indexes for soft-deletes: WHERE deleted_at IS NULL
```

### Fargate Autoscaling

- Target-tracking autoscaling: CPU 60% / memory 70% thresholds
- `circuitBreaker: { rollback: true }` on ECS service for safe deployments
- Fargate services are always warm — no scale-out lag on the interactive path
- Use Prisma client as a singleton (one pool per process, shared across requests)

### Prisma Query Logging (Non-Prod)

```typescript
// prisma.service.ts
const prisma = new PrismaClient({
  log: process.env.NODE_ENV !== 'production'
    ? [{ emit: 'event', level: 'query' }]
    : [],
});
prisma.$on('query', (e) => {
  if (e.duration > 100) {
    logger.warn({ query: e.query, duration: e.duration }, 'Slow query detected');
  }
});
```

## Caching Strategy

| Layer | Strategy |
|-------|----------|
| API GET responses | `Cache-Control: private, max-age=0, must-revalidate` (default) |
| Static assets | `Cache-Control: public, max-age=31536000, immutable` |
| React Query (reference data) | `staleTime: 30 * 60 * 1000` (30 min) |
| React Query (business data) | `staleTime: 5 * 60 * 1000` (5 min) |
| React Query (user mutable) | `staleTime: 0` |

#### Backend: Redis Cache Example

```typescript
const cacheKey = `user:${id}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const user = await prisma.user.findUnique({ where: { id } });
await redis.setex(cacheKey, 300, JSON.stringify(user)); // 5 min TTL
return user;
```

## Monitoring

### CloudWatch Alarms (Required for Prod)

| Alarm | Threshold | Action |
|-------|-----------|--------|
| API p95 latency | > 2s for 5min | Page on-call |
| ECS service errors | > 1% error rate | Alert team |
| RDS CPU | > 80% for 10min | Alert DBA |
| RDS connections | > 80% of max | Alert + scale |

### CloudWatch Metrics Interceptor

```typescript
// apps/api/src/common/interceptors/metrics.interceptor.ts
import { metrics } from 'aws-embedded-metrics';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        metrics.addMetric('ApiDuration', 'Milliseconds', duration);
      })
    );
  }
}
```

### Lighthouse CI

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
            http://localhost:3000/dashboard
          uploadArtifacts: true
          temporaryPublicStorage: true
```

## Load Testing

Run k6 baseline: 10 VUs for 60s before every release. Spike test: ramp to 100 VUs in 10s — no error rate > 1%.

```typescript
// tests/load/api-load-test.ts (k6)
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp-up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 0 },   // Ramp-down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% < 500ms, 99% < 1s
    http_req_failed: ['rate<0.01'], // Error rate < 1%
  },
};

export default function () {
  const res = http.get('https://api.example.com/v2/users');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
```

Template: `.claude/templates/performance-test.ts`

## Performance Quality Gates

- [ ] Lighthouse score ≥ 90 (Performance)
- [ ] No API endpoint > 1s (p99)
- [ ] No database query > 100ms (p95)
- [ ] Bundle size < 200KB gzipped (initial JS)
- [ ] Load test passes (spike to 100 VUs, error rate < 1%)
- [ ] No N+1 queries detected
- [ ] Cache hit rate > 80% (for cached endpoints)

## Related

- `.claude/agents/performance-engineer.md`
- `.claude/patterns/cache-strategy-pattern.md`
- `.claude/workflows/performance-optimization-workflow.md`
- `.claude/templates/performance-test.ts`

## Token Optimization

Load for: performance reviews, load testing tasks, bundle analysis, database query
optimization, Fargate autoscaling, list views, data fetching, file uploads. Unload for routine CRUD tasks.
