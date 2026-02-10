// CACHE HOT TEST: Optimal caching scenario
// ENABLE_RESPONSE_CACHE=true, same page repeated
// This measures maximum performance with near-100% cache hit rate

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { BASE_URL } from '../config.js';

// Custom metrics
const perfTotalTime = new Trend('perf_total_ms', true);
const perfDbTime = new Trend('perf_db_ms', true);
const cacheHitCount = new Counter('cache_hits');
const cacheMissCount = new Counter('cache_misses');

export const options = {
  stages: [
    { duration: '10s', target: 10 },  // Ramp up to 10 VUs
    { duration: '20s', target: 10 },  // Hold at 10 VUs for 20s
  ],
  thresholds: {
    'http_req_failed': ['rate<0.01'],
  },
};

export default function () {
  // Same page every time to maximize cache hits
  const url = `${BASE_URL}/api/products?page=1&limit=20`;

  const headers = {
    'Content-Type': 'application/json',
    'Accept-Encoding': 'gzip, deflate, br',
  };

  const response = http.get(url, { headers });

  check(response, {
    'status is 200': (r) => r.status === 200,
    'has products': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.products && Array.isArray(body.products);
      } catch {
        return false;
      }
    },
  });

  // Extract performance headers
  if (response.headers['X-Perf-Total-Ms']) {
    perfTotalTime.add(parseInt(response.headers['X-Perf-Total-Ms'], 10));
    perfDbTime.add(parseInt(response.headers['X-Perf-Db-Ms'] || '0', 10));
  }

  // Track cache status
  const cacheStatus = response.headers['X-Cache'] || response.headers['x-cache'];
  if (cacheStatus === 'HIT') {
    cacheHitCount.add(1);
  } else {
    cacheMissCount.add(1);
  }

  sleep(0.1);
}

export function handleSummary(data) {
  const reqDuration = data.metrics.http_req_duration;
  const cacheHits = data.metrics.cache_hits?.values.count || 0;
  const cacheMisses = data.metrics.cache_misses?.values.count || 0;
  const totalReqs = cacheHits + cacheMisses;
  const cacheHitRate = totalReqs > 0 ? ((cacheHits / totalReqs) * 100).toFixed(1) : '0';

  console.log('\n=== CACHE HOT TEST ===');
  console.log('ENABLE_RESPONSE_CACHE=true');
  console.log('Same page repeated: page=1');
  console.log('\nHTTP Request Duration:');
  console.log(`  avg:  ${reqDuration.values.avg.toFixed(2)}ms`);
  console.log(`  p50:  ${reqDuration.values.p50.toFixed(2)}ms`);
  console.log(`  p95:  ${reqDuration.values.p95.toFixed(2)}ms`);
  console.log(`  p99:  ${reqDuration.values.p99.toFixed(2)}ms`);
  console.log(`  max:  ${reqDuration.values.max.toFixed(2)}ms`);

  console.log('\nCache Performance:');
  console.log(`  Hits: ${cacheHits}`);
  console.log(`  Misses: ${cacheMisses}`);
  console.log(`  Total: ${totalReqs}`);
  console.log(`  Hit Rate: ${cacheHitRate}%`);

  if (data.metrics.perf_total_ms) {
    const perfTotal = data.metrics.perf_total_ms;
    const perfDb = data.metrics.perf_db_ms;
    console.log('\nPerformance Diagnostics:');
    console.log(`  Avg total time: ${perfTotal.values.avg.toFixed(2)}ms`);
    console.log(`  Avg DB time: ${perfDb.values.avg.toFixed(2)}ms`);
  }

  console.log('\n======================\n');

  return {
    'stdout': JSON.stringify(data, null, 2),
  };
}
