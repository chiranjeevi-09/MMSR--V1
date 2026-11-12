import http from 'k6/http';
import { check, sleep, group } from 'k6';

// Base target host (override with -e TARGET_URL=https://api.mmsrpublications.org)
const BASE_URL = __ENV.TARGET_URL || 'http://127.0.0.1:8000';

// Pick scenario via -e SCENARIO=<name>: baseline, normal, peak, spike, soak, stress
const SCENARIO = __ENV.SCENARIO || 'baseline';

const scenarios = {
  // Scenario a: Baseline (10 concurrent users, 2 minutes)
  baseline: {
    executor: 'constant-vus',
    vus: 10,
    duration: '2m',
  },
  // Scenario b: Normal Load (100 concurrent users, 5 minutes)
  normal: {
    executor: 'ramping-vus',
    startVUs: 10,
    stages: [
      { duration: '1m', target: 50 },
      { duration: '3m', target: 100 },
      { duration: '1m', target: 0 },
    ],
  },
  // Scenario c: Peak Load (500 to 1000 concurrent users)
  peak: {
    executor: 'ramping-vus',
    startVUs: 100,
    stages: [
      { duration: '2m', target: 500 },
      { duration: '3m', target: 1000 },
      { duration: '2m', target: 1000 },
      { duration: '1m', target: 0 },
    ],
  },
  // Scenario d: Spike Test (sudden jump from 10 to 1000 in 30 seconds)
  spike: {
    executor: 'ramping-vus',
    startVUs: 10,
    stages: [
      { duration: '1m', target: 10 },
      { duration: '30s', target: 1000 }, // sudden spike
      { duration: '3m', target: 1000 },  // sustain
      { duration: '1m', target: 10 },    // recovery
    ],
  },
  // Scenario e: Soak Test (moderate 50 VUs for 30 minutes to check memory leaks)
  soak: {
    executor: 'constant-vus',
    vus: 50,
    duration: '30m',
  },
  // Scenario f: Stress Test (ramp up continuously until breaking point)
  stress: {
    executor: 'ramping-vus',
    startVUs: 50,
    stages: [
      { duration: '2m', target: 100 },
      { duration: '2m', target: 300 },
      { duration: '3m', target: 600 },
      { duration: '3m', target: 1000 },
      { duration: '3m', target: 1500 }, // stress point
      { duration: '2m', target: 0 },
    ],
  },
};

export const options = {
  scenarios: {
    selected_scenario: scenarios[SCENARIO] || scenarios.baseline,
  },
  thresholds: {
    http_req_failed: ['rate<0.01'], // error rate < 1%
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
  },
};

export default function () {
  // 1. Health check probe
  group('Health Check', function () {
    const res = http.get(`${BASE_URL}/api/health/`);
    check(res, {
      'health status is 200': (r) => r.status === 200,
      'health body is ok': (r) => r.json('status') === 'ok',
    });
  });

  sleep(0.5);

  // 2. Books Catalog
  group('Books Catalog', function () {
    const res = http.get(`${BASE_URL}/api/publications/books/`);
    check(res, {
      'books status is 200': (r) => r.status === 200,
    });
  });

  sleep(0.5);

  // 3. Journals List
  group('Journals Catalog', function () {
    const res = http.get(`${BASE_URL}/api/publications/journals/`);
    check(res, {
      'journals status is 200': (r) => r.status === 200,
    });
  });

  sleep(0.5);

  // 4. Conferences
  group('Conferences List', function () {
    const res = http.get(`${BASE_URL}/api/conferences/`);
    check(res, {
      'conferences status is 200': (r) => r.status === 200,
    });
  });

  sleep(1);
}

