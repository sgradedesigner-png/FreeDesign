/**
 * Load Test - Gradual ramp-up to normal capacity
 *
 * Purpose: Test system behavior under expected load
 * Duration: 10 minutes
 * Virtual Users: 10 → 50 → 100 → 50 → 10
 *
 * Run: k6 run load-tests/scenarios/load-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { BASE_URL, commonThresholds, headers, SLEEP } from '../config.js';

// Custom metrics
const errorRate = new Rate('errors');
const productViewDuration = new Trend('product_view_duration');
const healthCheckDuration = new Trend('health_check_duration');
const apiCallCounter = new Counter('api_calls');

export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up to 10 users
    { duration: '3m', target: 50 },   // Ramp up to 50 users
    { duration: '2m', target: 100 },  // Spike to 100 users
    { duration: '2m', target: 50 },   // Ramp down to 50 users
    { duration: '1m', target: 10 },   // Ramp down to 10 users
  ],
  thresholds: {
    ...commonThresholds,
    errors: ['rate<0.01'], // Error rate should be less than 1%
    http_reqs: ['rate>50'], // Should handle at least 50 requests per second
  },
};

export default function () {
  const scenarios = [
    testHealthEndpoint,
    testProductList,
    testProductDetails,
    testCircuitBreakers,
    testMetrics,
  ];

  // Randomly select a scenario (weighted by importance)
  const weights = [10, 40, 30, 10, 10]; // Product list is most common
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const random = Math.random() * totalWeight;

  let cumulative = 0;
  let selectedScenario = scenarios[0];

  for (let i = 0; i < scenarios.length; i++) {
    cumulative += weights[i];
    if (random < cumulative) {
      selectedScenario = scenarios[i];
      break;
    }
  }

  selectedScenario();
  sleep(SLEEP.SHORT + Math.random() * 2); // Random sleep between 1-3 seconds
}

function testHealthEndpoint() {
  const startTime = Date.now();
  const response = http.get(`${BASE_URL}/health`);
  healthCheckDuration.add(Date.now() - startTime);
  apiCallCounter.add(1);

  const success = check(response, {
    'health check is 200': (r) => r.status === 200,
  });
  errorRate.add(!success);
}

function testProductList() {
  const startTime = Date.now();
  const response = http.get(`${BASE_URL}/api/products?page=1&limit=20`);
  productViewDuration.add(Date.now() - startTime);
  apiCallCounter.add(1);

  const success = check(response, {
    'product list is 200': (r) => r.status === 200,
    'product list has pagination': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.products && Array.isArray(body.products) && body.pagination;
      } catch {
        return false;
      }
    },
  });
  errorRate.add(!success);
}

function testProductDetails() {
  // Try to get a random product (ID 1-10)
  const productId = Math.floor(Math.random() * 10) + 1;
  const response = http.get(`${BASE_URL}/api/products/${productId}`);
  apiCallCounter.add(1);

  const success = check(response, {
    'product detail is 200 or 404': (r) => r.status === 200 || r.status === 404,
  });
  errorRate.add(!success && response.status !== 404);
}

function testCircuitBreakers() {
  const response = http.get(`${BASE_URL}/circuit-breakers`);
  apiCallCounter.add(1);

  const success = check(response, {
    'circuit breaker status is 200': (r) => r.status === 200,
  });
  errorRate.add(!success);
}

function testMetrics() {
  const response = http.get(`${BASE_URL}/metrics`);
  apiCallCounter.add(1);

  const success = check(response, {
    'metrics endpoint is 200': (r) => r.status === 200,
  });
  errorRate.add(!success);
}

export function handleSummary(data) {
  console.log('\n=== LOAD TEST SUMMARY ===');
  console.log(`Duration: 10 minutes`);
  console.log(`Total Requests: ${data.metrics.http_reqs.values.count}`);
  console.log(`Request Rate: ${data.metrics.http_reqs.values.rate.toFixed(2)} req/s`);
  console.log(`Failed Requests: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%`);
  console.log(`\nResponse Times:`);
  console.log(`  Avg: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms`);
  console.log(`  Min: ${data.metrics.http_req_duration.values.min.toFixed(2)}ms`);
  console.log(`  Max: ${data.metrics.http_req_duration.values.max.toFixed(2)}ms`);
  console.log(`  p50: ${data.metrics.http_req_duration.values.med.toFixed(2)}ms`);
  console.log(`  p95: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`);
  console.log(`  p99: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms`);
  console.log('=========================\n');

  return {
    'stdout': 'Load test completed!',
    '../load-tests/results/load-test-summary.json': JSON.stringify(data, null, 2),
    '../load-tests/results/load-test-summary.html': generateHTMLReport(data),
  };
}

function generateHTMLReport(data) {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Load Test Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #4CAF50; color: white; }
    tr:nth-child(even) { background-color: #f2f2f2; }
    .pass { color: green; font-weight: bold; }
    .fail { color: red; font-weight: bold; }
  </style>
</head>
<body>
  <h1>Load Test Report</h1>
  <p><strong>Date:</strong> ${new Date().toISOString()}</p>
  <p><strong>Duration:</strong> 10 minutes</p>

  <h2>Summary</h2>
  <table>
    <tr><th>Metric</th><th>Value</th></tr>
    <tr><td>Total Requests</td><td>${data.metrics.http_reqs.values.count}</td></tr>
    <tr><td>Request Rate</td><td>${data.metrics.http_reqs.values.rate.toFixed(2)} req/s</td></tr>
    <tr><td>Failed Requests</td><td class="${data.metrics.http_req_failed.values.rate < 0.01 ? 'pass' : 'fail'}">${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%</td></tr>
    <tr><td>Avg Response Time</td><td>${data.metrics.http_req_duration.values.avg.toFixed(2)}ms</td></tr>
    <tr><td>p95 Response Time</td><td class="${data.metrics.http_req_duration.values['p(95)'] < 500 ? 'pass' : 'fail'}">${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms</td></tr>
    <tr><td>p99 Response Time</td><td class="${data.metrics.http_req_duration.values['p(99)'] < 2000 ? 'pass' : 'fail'}">${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms</td></tr>
  </table>

  <h2>Response Time Distribution</h2>
  <table>
    <tr><th>Percentile</th><th>Response Time (ms)</th></tr>
    <tr><td>Min</td><td>${data.metrics.http_req_duration.values.min.toFixed(2)}</td></tr>
    <tr><td>p50 (Median)</td><td>${data.metrics.http_req_duration.values.med.toFixed(2)}</td></tr>
    <tr><td>p90</td><td>${data.metrics.http_req_duration.values['p(90)'].toFixed(2)}</td></tr>
    <tr><td>p95</td><td>${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}</td></tr>
    <tr><td>p99</td><td>${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}</td></tr>
    <tr><td>Max</td><td>${data.metrics.http_req_duration.values.max.toFixed(2)}</td></tr>
  </table>
</body>
</html>
  `;
}
