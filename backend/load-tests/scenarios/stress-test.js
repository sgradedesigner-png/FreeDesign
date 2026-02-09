/**
 * Stress Test - Push the system beyond normal capacity
 *
 * Purpose: Find the breaking point and test recovery
 * Duration: 15 minutes
 * Virtual Users: 10 → 500 (gradual increase)
 *
 * Run: k6 run load-tests/scenarios/stress-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter } from 'k6/metrics';
import { BASE_URL, SLEEP } from '../config.js';

// Custom metrics
const errorRate = new Rate('errors');
const timeoutCounter = new Counter('timeouts');

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Warm up
    { duration: '3m', target: 100 },  // Normal load
    { duration: '3m', target: 200 },  // Increased load
    { duration: '3m', target: 300 },  // High load
    { duration: '2m', target: 400 },  // Very high load
    { duration: '1m', target: 500 },  // Maximum load
    { duration: '1m', target: 0 },    // Recovery test
  ],
  thresholds: {
    // More lenient thresholds for stress test
    http_req_failed: ['rate<0.05'], // Allow up to 5% errors
    http_req_duration: ['p(95)<2000'], // 95% under 2s
  },
};

export default function () {
  const endpoints = [
    { url: `${BASE_URL}/health`, name: 'health' },
    { url: `${BASE_URL}/api/products`, name: 'products' },
    { url: `${BASE_URL}/ready`, name: 'ready' },
    { url: `${BASE_URL}/metrics`, name: 'metrics' },
  ];

  // Random endpoint selection
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];

  const response = http.get(endpoint.url, {
    timeout: '10s', // 10 second timeout
    tags: { endpoint: endpoint.name },
  });

  const success = check(response, {
    'status is 200 or 503': (r) => r.status === 200 || r.status === 503, // 503 is acceptable under stress
    'response time < 10s': (r) => r.timings.duration < 10000,
  });

  if (response.status === 0) {
    // Timeout or connection error
    timeoutCounter.add(1);
  }

  errorRate.add(!success && response.status !== 503);

  sleep(SLEEP.SHORT * 0.5); // Shorter sleep for more aggressive testing
}

export function handleSummary(data) {
  const failRate = data.metrics.http_req_failed.values.rate;
  const maxUsers = 500; // Based on our stages

  console.log('\n=== STRESS TEST SUMMARY ===');
  console.log(`Maximum Load: ${maxUsers} concurrent users`);
  console.log(`Total Requests: ${data.metrics.http_reqs.values.count}`);
  console.log(`Request Rate: ${data.metrics.http_reqs.values.rate.toFixed(2)} req/s`);
  console.log(`Failed Requests: ${(failRate * 100).toFixed(2)}%`);
  console.log(`\nResponse Times:`);
  console.log(`  Avg: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms`);
  console.log(`  p95: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`);
  console.log(`  p99: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms`);
  console.log(`  Max: ${data.metrics.http_req_duration.values.max.toFixed(2)}ms`);

  if (failRate < 0.05) {
    console.log(`\n✅ System handled ${maxUsers} users successfully!`);
  } else {
    console.log(`\n⚠️  System struggled at ${maxUsers} users (${(failRate * 100).toFixed(2)}% errors)`);
  }

  console.log('===========================\n');

  return {
    'stdout': 'Stress test completed!',
    '../load-tests/results/stress-test-summary.json': JSON.stringify(data, null, 2),
  };
}
