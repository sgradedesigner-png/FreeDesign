/**
 * API Endpoints Test - Test all critical endpoints
 *
 * Purpose: Comprehensive test of all public and authenticated endpoints
 * Duration: 5 minutes
 * Virtual Users: 50
 *
 * Run: k6 run load-tests/scenarios/api-endpoints-test.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { BASE_URL, headers, SLEEP } from '../config.js';

// Custom metrics per endpoint
const healthCheckErrors = new Rate('health_check_errors');
const productsErrors = new Rate('products_errors');
const metricsErrors = new Rate('metrics_errors');
const circuitBreakerErrors = new Rate('circuit_breaker_errors');

const healthCheckDuration = new Trend('health_check_duration');
const productsDuration = new Trend('products_duration');

export const options = {
  stages: [
    { duration: '1m', target: 20 },   // Ramp up
    { duration: '3m', target: 50 },   // Stay at 50 users
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
    health_check_errors: ['rate<0.001'], // Health check should almost never fail
    products_errors: ['rate<0.01'],
  },
};

export default function () {
  // Group 1: Health and Monitoring
  group('Health & Monitoring', function () {
    let response = http.get(`${BASE_URL}/health`);
    const success = check(response, {
      'health check is 200': (r) => r.status === 200,
      'health check has status': (r) => {
        try {
          return JSON.parse(r.body).status === 'healthy';
        } catch {
          return false;
        }
      },
    });
    healthCheckErrors.add(!success);
    healthCheckDuration.add(response.timings.duration);

    sleep(1);

    response = http.get(`${BASE_URL}/ready`);
    check(response, {
      'ready check is 200': (r) => r.status === 200,
      'ready check has ready field': (r) => {
        try {
          return JSON.parse(r.body).ready === true;
        } catch {
          return false;
        }
      },
    });

    sleep(1);

    response = http.get(`${BASE_URL}/metrics`);
    const metricsSuccess = check(response, {
      'metrics endpoint is 200': (r) => r.status === 200,
      'metrics has database info': (r) => {
        try {
          return JSON.parse(r.body).database !== undefined;
        } catch {
          return false;
        }
      },
    });
    metricsErrors.add(!metricsSuccess);
  });

  sleep(SLEEP.SHORT);

  // Group 2: Public API
  group('Public API', function () {
    // Get paginated products (default page)
    let response = http.get(`${BASE_URL}/api/products?page=1&limit=10`);
    const productsSuccess = check(response, {
      'get products is 200': (r) => r.status === 200,
      'products has pagination structure': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.products && Array.isArray(body.products) && body.pagination;
        } catch {
          return false;
        }
      },
    });
    productsErrors.add(!productsSuccess);
    productsDuration.add(response.timings.duration);

    sleep(1);

    // Get products with larger page size
    response = http.get(`${BASE_URL}/api/products?page=1&limit=20`);
    check(response, {
      'get products with pagination is 200': (r) => r.status === 200,
    });

    sleep(1);

    // Get products page 2
    response = http.get(`${BASE_URL}/api/products?page=2&limit=10`);
    check(response, {
      'get products page 2 is 200': (r) => r.status === 200,
    });

    sleep(1);

    // Get single product (try random ID 1-10)
    const productId = Math.floor(Math.random() * 10) + 1;
    response = http.get(`${BASE_URL}/api/products/${productId}`);
    check(response, {
      'get single product is 200 or 404': (r) => r.status === 200 || r.status === 404,
    });
  });

  sleep(SLEEP.SHORT);

  // Group 3: Circuit Breakers
  group('Circuit Breakers', function () {
    const response = http.get(`${BASE_URL}/circuit-breakers`);
    const success = check(response, {
      'circuit breaker status is 200': (r) => r.status === 200,
      'circuit breaker has circuits': (r) => {
        try {
          return JSON.parse(r.body).circuits !== undefined;
        } catch {
          return false;
        }
      },
    });
    circuitBreakerErrors.add(!success);
  });

  sleep(SLEEP.MEDIUM);
}

export function handleSummary(data) {
  console.log('\n=== API ENDPOINTS TEST SUMMARY ===');
  console.log(`Total Requests: ${data.metrics.http_reqs.values.count}`);
  console.log(`Request Rate: ${data.metrics.http_reqs.values.rate.toFixed(2)} req/s`);
  console.log(`Overall Failed Rate: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%`);
  console.log(`\nPer-Endpoint Error Rates:`);
  console.log(`  Health Check: ${(data.metrics.health_check_errors.values.rate * 100).toFixed(2)}%`);
  console.log(`  Products API: ${(data.metrics.products_errors.values.rate * 100).toFixed(2)}%`);
  console.log(`  Metrics: ${(data.metrics.metrics_errors.values.rate * 100).toFixed(2)}%`);
  console.log(`  Circuit Breaker: ${(data.metrics.circuit_breaker_errors.values.rate * 100).toFixed(2)}%`);
  console.log(`\nResponse Times:`);
  console.log(`  Overall p95: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`);
  console.log(`  Health Check Avg: ${data.metrics.health_check_duration.values.avg.toFixed(2)}ms`);
  console.log(`  Products API Avg: ${data.metrics.products_duration.values.avg.toFixed(2)}ms`);
  console.log('===================================\n');

  return {
    'stdout': 'API endpoints test completed!',
    '../load-tests/results/api-endpoints-test-summary.json': JSON.stringify(data, null, 2),
  };
}
