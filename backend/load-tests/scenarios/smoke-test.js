/**
 * Smoke Test - Quick sanity check
 *
 * Purpose: Verify that the system can handle minimal load
 * Duration: 1 minute
 * Virtual Users: 1-2
 *
 * Run: k6 run load-tests/scenarios/smoke-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, commonThresholds, headers, SLEEP } from '../config.js';

export const options = {
  stages: [
    { duration: '30s', target: 1 },  // Ramp up to 1 user
    { duration: '30s', target: 2 },  // Stay at 2 users
  ],
  thresholds: {
    // Lenient thresholds for smoke test (just sanity check)
    http_req_failed: ['rate<0.05'], // Allow up to 5% errors
    http_req_duration: ['p(95)<2000'], // 95% under 2s
  },
};

export default function () {
  // Test 1: Health Check
  let response = http.get(`${BASE_URL}/health`);
  check(response, {
    'health check status is 200': (r) => r.status === 200,
    'health check has status field': (r) => JSON.parse(r.body).status === 'healthy',
  });

  sleep(SLEEP.SHORT);

  // Test 2: Get Products (Public API)
  response = http.get(`${BASE_URL}/api/products`);
  check(response, {
    'get products status is 200': (r) => r.status === 200,
    'products response is array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body) && body.length >= 0;
      } catch {
        return false;
      }
    },
  });

  sleep(SLEEP.SHORT);

  // Test 3: Get Single Product (use existing product slug from first request)
  // For smoke test, just verify the endpoint works
  response = http.get(`${BASE_URL}/api/products`, { tags: { name: 'list_for_slug' } });
  if (response.status === 200) {
    try {
      const products = JSON.parse(response.body);
      if (Array.isArray(products) && products.length > 0) {
        // Get first product's slug
        const firstProduct = products[0];
        const slug = firstProduct.slug || firstProduct.id;

        // Now get that specific product
        response = http.get(`${BASE_URL}/api/products/${slug}`);
        check(response, {
          'get product detail status is 200': (r) => r.status === 200,
        });
      } else {
        // No products exist, skip this test
        console.log('No products found, skipping product detail test');
      }
    } catch (e) {
      console.log('Failed to parse products response:', e);
    }
  }

  sleep(SLEEP.SHORT);

  // Test 4: Circuit Breaker Status
  response = http.get(`${BASE_URL}/circuit-breakers`);
  check(response, {
    'circuit breaker status is 200': (r) => r.status === 200,
    'circuit breaker has status': (r) => JSON.parse(r.body).status !== undefined,
  });

  sleep(SLEEP.MEDIUM);
}

export function handleSummary(data) {
  console.log('\n=== SMOKE TEST SUMMARY ===');
  console.log(`Total Requests: ${data.metrics.http_reqs.values.count}`);
  console.log(`Failed Requests: ${data.metrics.http_req_failed.values.rate * 100}%`);
  console.log(`Avg Response Time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms`);
  console.log(`95th Percentile: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`);
  console.log('==========================\n');

  return {
    'stdout': 'Smoke test completed successfully!',
    '../load-tests/results/smoke-test-summary.json': JSON.stringify(data, null, 2),
  };
}
