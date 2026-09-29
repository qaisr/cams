/**
 * Performance Test Template (k6)
 *
 * Usage: Copy and adapt for each critical API endpoint.
 * Run:   k6 run performance-test.ts
 * Env vars:
 *   BASE_URL        - API base URL (default: http://localhost:3001)
 *   AUTH_URL        - OAuth token endpoint base (OAuth flow)
 *   CLIENT_ID       - OAuth client ID
 *   CLIENT_SECRET   - OAuth client secret
 * Standards: .claude/standards/performance-standards.md
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ─── Custom Metrics ────────────────────────────────────────────────────────────
const errorRate = new Rate('error_rate');
const apiLatency = new Trend('api_latency', true); // true = track in ms

// ─── Test Configuration ────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    // Smoke test: verify it works at minimal load
    smoke: {
      executor: 'constant-vus',
      vus: 2,
      duration: '30s',
      tags: { scenario: 'smoke' },
    },
    // Load test: normal expected load
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 20 },   // ramp up
        { duration: '3m', target: 20 },   // sustain
        { duration: '1m', target: 0 },    // ramp down
      ],
      tags: { scenario: 'load' },
    },
    // Spike test: sudden traffic surge
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 100 }, // spike
        { duration: '1m', target: 100 },  // hold
        { duration: '30s', target: 0 },   // recover
      ],
      tags: { scenario: 'spike' },
    },
  },

  // SLO thresholds — matches performance-standards.md
  thresholds: {
    'http_req_duration{scenario:load}': [
      'p(50)<80',    // p50 < 80ms
      'p(95)<200',   // p95 < 200ms
      'p(99)<500',   // p99 < 500ms
    ],
    'http_req_duration{scenario:spike}': [
      'p(95)<500',   // relaxed during spike
    ],
    'error_rate': ['rate<0.01'],       // < 1% errors overall
    'http_req_failed': ['rate<0.01'],
  },
};

// ─── Config ────────────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// ─── Auth Helpers ──────────────────────────────────────────────────────────────
/** OAuth 2.0 client-credentials flow (production / staging) */
function getAuthTokenOAuth(): string {
  const response = http.post(
    `${__ENV.AUTH_URL}/oauth/token`,
    JSON.stringify({
      grant_type: 'client_credentials',
      client_id: __ENV.CLIENT_ID,
      client_secret: __ENV.CLIENT_SECRET,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  return JSON.parse(response.body as string).access_token;
}

/** Username/password login (local dev / mock auth) */
function getAuthTokenLogin(): string {
  const response = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: 'test@example.com', password: 'password' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  return JSON.parse(response.body as string).token;
}

// ─── Request Helpers ───────────────────────────────────────────────────────────
function makeHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-Correlation-Id': `k6-${Date.now()}`,
  };
}

// ─── Setup / Teardown ──────────────────────────────────────────────────────────
export function setup() {
  // TODO: Switch to getAuthTokenOAuth() for non-local environments
  const token = getAuthTokenLogin();
  // TODO: Create any additional test data here (users, seed records, etc.)
  return { token };
}

export function teardown(_data: { token: string }) {
  // TODO: Clean up test data created in setup()
}

// ─── Virtual-user scenario ─────────────────────────────────────────────────────
export default function (data: { token: string }) {
  const headers = makeHeaders(data.token);

  // ── SCENARIO 1: List resources ──────────────────────────────────────────
  {
    const res = http.get(`${BASE_URL}/api/documents?limit=20`, { headers });
    apiLatency.add(res.timings.duration, { endpoint: 'list' });

    const ok = check(res, {
      'list: status 200': (r) => r.status === 200,
      'list: response time < 500ms': (r) => r.timings.duration < 500,
      'list: has data array': (r) => Array.isArray(JSON.parse(r.body as string).data),
      'list: has pagination': (r) => typeof JSON.parse(r.body as string).pagination?.hasMore === 'boolean',
    });
    errorRate.add(!ok);
  }

  sleep(1);

  // ── SCENARIO 2: Get single resource ────────────────────────────────────
  {
    const resourceId = 'TODO-use-dynamic-id'; // TODO: use an ID from setup() data
    const res = http.get(`${BASE_URL}/api/documents/${resourceId}`, { headers });
    apiLatency.add(res.timings.duration, { endpoint: 'get' });

    const ok = check(res, {
      'get: status 200 or 404': (r) => [200, 404].includes(r.status),
      'get: response time < 200ms': (r) => r.timings.duration < 200,
    });
    errorRate.add(!ok);
  }

  sleep(1);

  // ── SCENARIO 3: Create resource ─────────────────────────────────────────
  {
    const payload = JSON.stringify({
      // TODO: replace with the actual request body shape
      name: `load-test-${Date.now()}`,
    });
    const res = http.post(`${BASE_URL}/api/documents`, payload, { headers });
    apiLatency.add(res.timings.duration, { endpoint: 'create' });

    const ok = check(res, {
      'create: status 201': (r) => r.status === 201,
      'create: response time < 1s': (r) => r.timings.duration < 1000,
      'create: returns id': (r) => JSON.parse(r.body as string).id !== undefined,
    });
    errorRate.add(!ok);
  }

  sleep(2);
}

// ─── Summary ───────────────────────────────────────────────────────────────────
export function handleSummary(data: any) {
  return {
    'performance-results.json': JSON.stringify(data, null, 2),
    stdout: `
      ✅ Performance Test Summary
      ─────────────────────────────
      p50:        ${data.metrics.http_req_duration?.values?.['p(50)']?.toFixed(0)}ms
      p95:        ${data.metrics.http_req_duration?.values?.['p(95)']?.toFixed(0)}ms
      p99:        ${data.metrics.http_req_duration?.values?.['p(99)']?.toFixed(0)}ms
      Error Rate: ${(data.metrics.error_rate?.values?.rate * 100)?.toFixed(2)}%
    `,
  };
}
