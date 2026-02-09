/**
 * Spike Test - Sudden traffic spike simulation
 *
 * Purpose: Test system behavior during sudden traffic increases (e.g., flash sale)
 * Duration: 5 minutes
 * Virtual Users: 10 → 500 (instant spike) → 10
 *
 * Run: k6 run load-tests/scenarios/spike-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter } from 'k6/metrics';
import { BASE_URL, SLEEP } from '../config.js';

const errorRate = new Rate('errors');
const recoveryRate = new Rate('recovery_success');

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Normal load
    { duration: '10s', target: 500 },  // Sudden spike!
    { duration: '2m', target: 500 },   // Sustain spike
    { duration: '30s', target: 10 },   // Sudden drop
    { duration: '1m', target: 10 },    // Recovery period
  ],
  thresholds: {
    http_req_failed: ['rate<0.1'], // Allow up to 10% errors during spike
    http_req_duration: ['p(95)<3000'], // 95% under 3s (lenient for spike)
  },
};

export default function () {
  // Simulate user browsing products during spike
  const response = http.get(`${BASE_URL}/api/products`);

  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 5s': (r) => r.timings.duration < 5000,
  });

  errorRate.add(!success);

  // During recovery period (last minute), track recovery success
  if (__ITER > 1000) { // Approximate check for recovery period
    recoveryRate.add(success);
  }

  sleep(SLEEP.SHORT * 0.3); // Aggressive load
}

export function handleSummary(data) {
  const failRate = data.metrics.http_req_failed.values.rate;

  console.log('\n=== SPIKE TEST SUMMARY ===');
  console.log(`Spike: 10 → 500 users in 10 seconds`);
  console.log(`Total Requests: ${data.metrics.http_reqs.values.count}`);
  console.log(`Failed Requests: ${(failRate * 100).toFixed(2)}%`);
  console.log(`\nResponse Times During Spike:`);
  console.log(`  Avg: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms`);
  console.log(`  p95: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`);
  console.log(`  p99: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms`);
  console.log(`  Max: ${data.metrics.http_req_duration.values.max.toFixed(2)}ms`);

  if (failRate < 0.1) {
    console.log(`\n✅ System handled the spike well!`);
  } else {
    console.log(`\n⚠️  System struggled during spike (${(failRate * 100).toFixed(2)}% errors)`);
  }

  console.log('==========================\n');

  return {
    'stdout': 'Spike test completed!',
    '../load-tests/results/spike-test-summary.json': JSON.stringify(data, null, 2),
  };
}
