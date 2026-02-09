// Products Endpoint Performance Benchmark
// Phase 1: Diagnostic test to measure COUNT query overhead
// This test has NO artificial delays and measures real performance

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { BASE_URL } from '../config.js';

// Custom metrics to track COUNT query overhead
const dbTimeMetric = new Trend('db_time', true); // Track X-DB-Time header
const totalTimeMetric = new Trend('total_time', true); // Track X-Total-Time header
const cacheHitRate = new Counter('cache_hits');
const cacheMissRate = new Counter('cache_misses');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 VUs
    { duration: '1m', target: 10 },   // Stay at 10 VUs
    { duration: '30s', target: 50 },  // Ramp up to 50 VUs
    { duration: '1m', target: 50 },   // Stay at 50 VUs
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    // Target thresholds (will improve after optimizations)
    'http_req_duration': ['p(95)<500', 'p(99)<1000'], // Current: ~1400ms p95
    'db_time': ['p(95)<400'], // Most time is in DB
    'http_req_failed': ['rate<0.01'], // Less than 1% errors
  },
};

export default function () {
  // Test multiple page numbers to verify skip performance
  const pages = [1, 5, 10];
  const page = pages[Math.floor(Math.random() * pages.length)];

  // Headers with compression enabled (critical!)
  const headers = {
    'Content-Type': 'application/json',
    'Accept-Encoding': 'gzip, deflate, br', // Phase 1: Enable compression in tests
  };

  // Request products with pagination
  const response = http.get(
    `${BASE_URL}/api/products?page=${page}&limit=20`,
    { headers }
  );

  // Validate response
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response has products': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.products && Array.isArray(body.products);
      } catch {
        return false;
      }
    },
    'response has pagination': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.pagination && body.pagination.totalCount !== undefined;
      } catch {
        return false;
      }
    },
    'has diagnostic headers': (r) => {
      return r.headers['X-Db-Time'] !== undefined;
    },
  });

  // Phase 1: Extract diagnostic headers
  if (success && response.headers['X-Db-Time']) {
    const dbTime = parseInt(response.headers['X-Db-Time'].replace('ms', ''), 10);
    const totalTime = parseInt(response.headers['X-Total-Time']?.replace('ms', '') || '0', 10);
    const cacheStatus = response.headers['X-Cache'];

    // Track metrics
    dbTimeMetric.add(dbTime);
    if (totalTime > 0) {
      totalTimeMetric.add(totalTime);
    }

    // Track cache status
    if (cacheStatus === 'HIT') {
      cacheHitRate.add(1);
    } else {
      cacheMissRate.add(1);
    }
  }

  // NO artificial sleep - measure real performance
  sleep(0.1); // Only 100ms between requests (was 1-3 seconds)
}

// Summary handler to display results
export function handleSummary(data) {
  const dbTime = data.metrics.db_time;
  const totalTime = data.metrics.total_time;
  const reqDuration = data.metrics.http_req_duration;

  console.log('\n=== PHASE 1 DIAGNOSTIC RESULTS ===');
  console.log('\nHTTP Request Duration:');
  console.log(`  avg: ${reqDuration.values.avg.toFixed(2)}ms`);
  console.log(`  p50: ${reqDuration.values.p50.toFixed(2)}ms`);
  console.log(`  p95: ${reqDuration.values.p95.toFixed(2)}ms`);
  console.log(`  p99: ${reqDuration.values.p99.toFixed(2)}ms`);

  if (dbTime) {
    console.log('\nDatabase Time (X-DB-Time header):');
    console.log(`  avg: ${dbTime.values.avg.toFixed(2)}ms`);
    console.log(`  p95: ${dbTime.values.p95.toFixed(2)}ms`);
    console.log(`  DB time as % of total: ${((dbTime.values.avg / reqDuration.values.avg) * 100).toFixed(1)}%`);
  }

  if (totalTime && totalTime.values.count > 0) {
    console.log('\nTotal Processing Time (X-Total-Time header):');
    console.log(`  avg: ${totalTime.values.avg.toFixed(2)}ms`);
    console.log(`  p95: ${totalTime.values.p95.toFixed(2)}ms`);
  }

  console.log('\nCache Performance:');
  const cacheHits = data.metrics.cache_hits?.values.count || 0;
  const cacheMisses = data.metrics.cache_misses?.values.count || 0;
  const totalRequests = cacheHits + cacheMisses;
  console.log(`  Hit rate: ${totalRequests > 0 ? ((cacheHits / totalRequests) * 100).toFixed(1) : 0}%`);
  console.log(`  Total requests: ${totalRequests}`);

  console.log('\n=== KEY FINDINGS ===');
  if (dbTime && reqDuration) {
    const dbPercent = (dbTime.values.avg / reqDuration.values.avg) * 100;
    if (dbPercent > 80) {
      console.log(`⚠️  Database queries take ${dbPercent.toFixed(1)}% of response time`);
      console.log('   → COUNT query is likely the bottleneck (Phase 2 will fix)');
    }
  }

  console.log('\nNext steps:');
  console.log('1. Check logs for "Product.count" query timings');
  console.log('2. Compare COUNT vs findMany durations');
  console.log('3. Proceed to Phase 2 (Lazy COUNT) if COUNT > 40% of DB time');
  console.log('==================\n');

  return {
    'stdout': JSON.stringify(data, null, 2),
  };
}
