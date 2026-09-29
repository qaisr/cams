---
description: Generate k6 performance tests — baseline, load, spike, and soak scenarios
agent: test-engineer
subtask: true
---

# Performance Test Generation

## Input

$ARGUMENTS
Examples:

- `/test-performance for GET /api/v1/orders endpoint`
- `/test-performance for the order creation flow`
- `/test-performance baseline for all endpoints in @api/src/main/resources/openapi/orders.yaml`

## Process

### Step 1: Read Context

- Read referenced OpenAPI spec or controller
- Read existing performance tests if any:

```bash
!`find . -name "*.js" -path "*/performance/*" -o -name "*.js" -path "*/k6/*" | head -10`
!`mkdir -p tests/performance`
```

- Read `.claude/standards/observability-standards.md` for baseline targets

### Step 2: Define Scenarios

Generate four standard k6 scenarios:

```
Baseline:  10 VUs, 1 min  — establishes normal performance
Load:      50 VUs, 5 min  — expected peak traffic
Spike:     ramp 0→200 in 30s, hold 1min, ramp down — traffic surge
Soak:      20 VUs, 30 min — memory leak / degradation detection
```

Default thresholds (from `@.claude/standards/observability-standards.md`):

```
http_req_duration p(50) < 200ms
http_req_duration p(95) < 500ms
http_req_duration p(99) < 1000ms
http_req_failed   rate < 0.01  (< 1% error rate)
```

### Step 3: Generate k6 Test File

```javascript
// tests/performance/{resource}-performance.js
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ─── Custom Metrics ───────────────────────────────────────────────────────────

const errorRate = new Rate('error_rate');
const listDuration = new Trend('{resource}_list_duration', true);
const createDuration = new Trend('{resource}_create_duration', true);

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || 'https://api-dev.ppcc.com.au';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';  // Set via CI env var — never hardcode

const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`,
  'X-Correlation-Id': `perf-test-${Date.now()}`,
};

// ─── Thresholds ───────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    baseline: {
      executor: 'constant-vus',
      vus: 10,
      duration: '1m',
      tags: { scenario: 'baseline' },
    },
    load: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
      startTime: '2m',  // after baseline
      tags: { scenario: 'load' },
    },
    spike: {
      executor: 'ramping-vus',
      startTime: '8m',
      stages: [
        { target: 200, duration: '30s' },
        { target: 200, duration: '1m' },
        { target: 0,   duration: '30s' },
      ],
      tags: { scenario: 'spike' },
    },
  },

  thresholds: {
    // PPCC standard SLOs from observability-standards.md
    'http_req_duration{scenario:baseline}': [
      'p(50)<200', 'p(95)<500', 'p(99)<1000',
    ],
    'http_req_duration{scenario:load}': [
      'p(50)<300', 'p(95)<800', 'p(99)<2000',
    ],
    'http_req_duration{scenario:spike}': [
      'p(95)<2500',
    ],
    'http_req_failed': ['rate<0.01'],
    'error_rate':      ['rate<0.01'],
  },
};

// ─── Test Data Setup ──────────────────────────────────────────────────────────

// Pre-created test resource ID (set up before test run)
const EXISTING_ID = __ENV.TEST_RESOURCE_ID || 'test-id-placeholder';

// ─── Scenarios ────────────────────────────────────────────────────────────────

export default function () {
  // Realistic user flow — not just hammering one endpoint

  group('List {Resources}', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/{resources}?page=0&size=20`,
      { headers: COMMON_HEADERS }
    );
    listDuration.add(res.timings.duration);
    errorRate.add(res.status >= 400);
    check(res, {
      'list: status 200':           (r) => r.status === 200,
      'list: has content field':    (r) => JSON.parse(r.body).content !== undefined,
      'list: response time < 500ms':(r) => r.timings.duration < 500,
    });
  });

  sleep(1);  // Realistic think time between requests

  group('Get {Resource} by ID', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/{resources}/${EXISTING_ID}`,
      { headers: COMMON_HEADERS }
    );
    check(res, {
      'getById: status 200':           (r) => r.status === 200,
      'getById: response time < 200ms':(r) => r.timings.duration < 200,
    });
  });

  sleep(1);

  group('Create {Resource}', () => {
    const payload = JSON.stringify({
      name: `Perf Test {Resource} ${Date.now()}`,
    });
    const res = http.post(
      `${BASE_URL}/api/v1/{resources}`,
      payload,
      { headers: COMMON_HEADERS }
    );
    createDuration.add(res.timings.duration);
    errorRate.add(res.status >= 400);
    check(res, {
      'create: status 201':            (r) => r.status === 201,
      'create: has id':                (r) => JSON.parse(r.body).id !== undefined,
      'create: response time < 1000ms':(r) => r.timings.duration < 1000,
    });
  });

  sleep(Math.random() * 2 + 1); // 1-3 second think time
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

export function setup() {
  // Verify API is reachable before test
  const res = http.get(`${BASE_URL}/api/v1/health`,
    { headers: COMMON_HEADERS });
  if (res.status !== 200) {
    throw new Error(`Health check failed: ${res.status}`);
  }
  return { startTime: new Date().toISOString() };
}

export function teardown(data) {
  console.log(`Performance test completed. Started: ${data.startTime}`);
}
```

### Step 4: Generate Run Script

```bash
# tests/performance/run-perf-tests.sh
#!/bin/bash
set -e

ENVIRONMENT=${1:-dev}
BASE_URL="https://api-${ENVIRONMENT}.ppcc.com.au"

echo "Running performance tests against: ${BASE_URL}"
echo "Requires: AUTH_TOKEN env var and TEST_RESOURCE_ID env var"

if [ -z "$AUTH_TOKEN" ]; then
  echo "ERROR: AUTH_TOKEN environment variable not set"
  exit 1
fi

# Run baseline only (fast check)
k6 run \
  --env BASE_URL="${BASE_URL}" \
  --env AUTH_TOKEN="${AUTH_TOKEN}" \
  --env TEST_RESOURCE_ID="${TEST_RESOURCE_ID}" \
  --scenario baseline \
  --out json=results/baseline-$(date +%Y%m%d-%H%M%S).json \
  tests/performance/{resource}-performance.js

echo "Results saved to results/ directory"
```

### Step 5: Generate GitHub Actions Job

```yaml
# Add to .github/workflows/ci.yml — optional performance job
  performance-test:
    needs: deploy-dev
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Setup k6
        uses: grafana/setup-k6-action@v1
      - name: Run baseline performance test
        run: |
          k6 run \
            --env BASE_URL=${{ vars.DEV_API_URL }} \
            --env AUTH_TOKEN=${{ secrets.PERF_TEST_TOKEN }} \
            --env TEST_RESOURCE_ID=${{ vars.PERF_TEST_RESOURCE_ID }} \
            --scenario baseline \
            tests/performance/{resource}-performance.js
```

## Output

- `tests/performance/{resource}-performance.js`
- `tests/performance/run-perf-tests.sh`
- `tests/performance/README.md` (how to run)
- GitHub Actions job snippet

## Cross-References

- Observability targets: `@.claude/standards/observability-standards.md`
- Deploy: `@.claude/workflows/deployment.md`
- Monitoring: `/monitor-setup`
