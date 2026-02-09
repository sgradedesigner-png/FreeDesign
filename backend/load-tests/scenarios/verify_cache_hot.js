// VERIFICATION TEST: Cache HOT (Maximum Cache HIT Rate)
// Repeatedly requests the SAME page to maximize cache hits
// This validates the "99% faster" claim under optimal caching conditions

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
    { duration: '10s', target: 10 },  // Ramp up
    { duration: '20s', target: 10 },  // Sustained load
  ],
  thresholds: {
    'http_req_duration': ['p(95)<100', 'p(99)<200'], // Expect fast with cache
    'http_req_failed': ['rate<0.01'],
  },
};

export default function () {
  // ALWAYS request the same page to maximize cache HITs
  const url = `${BASE_URL}/api/products?page=1&limit=20`;

  const headers = {
    'Content-Type': 'application/json',
    'Accept-Encoding': 'gzip, deflate, br', // Enable compression
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

  // Extract performance headers (if PERF_DIAG=true)
  if (response.headers['X-Perf-Total-Ms']) {
    const totalMs = parseInt(response.headers['X-Perf-Total-Ms'], 10);
    const dbMs = parseInt(response.headers['X-Perf-Db-Ms'] || '0', 10);
    perfTotalTime.add(totalMs);
    perfDbTime.add(dbMs);
  }

  // Track cache status
  const cacheStatus = response.headers['X-Cache'] || response.headers['x-cache'];
  if (cacheStatus === 'HIT') {
    cacheHitCount.add(1);
  } else {
    cacheMissCount.add(1);
  }

  // No artificial sleep - measure real performance
  sleep(0.1);
}

export function handleSummary(data) {
  const reqDuration = data.metrics.http_req_duration;
  const cacheHits = data.metrics.cache_hits?.values.count || 0;
  const cacheMisses = data.metrics.cache_misses?.values.count || 0;
  const totalReqs = cacheHits + cacheMisses;
  const cacheHitRate = totalReqs > 0 ? ((cacheHits / totalReqs) * 100).toFixed(1) : '0';

  console.log('\n=== VERIFICATION: CACHE HOT TEST ===');
  console.log('Purpose: Measure performance with maximum cache HIT rate');
  console.log('\nHTTP Request Duration:');
  console.log(`  avg: ${reqDuration.values.avg.toFixed(2)}ms`);
  console.log(`  p95: ${reqDuration.values.p95.toFixed(2)}ms`);
  console.log(`  p99: ${reqDuration.values.p99.toFixed(2)}ms`);

  console.log('\nCache Performance:');
  console.log(`  Hit rate: ${cacheHitRate}%`);
  console.log(`  Total requests: ${totalReqs}`);
  console.log(`  Hits: ${cacheHits} | Misses: ${cacheMisses}`);

  if (data.metrics.perf_total_ms) {
    const perfTotal = data.metrics.perf_total_ms;
    const perfDb = data.metrics.perf_db_ms;
    console.log('\nPerformance Diagnostics (PERF_DIAG=true):');
    console.log(`  Avg total time: ${perfTotal.values.avg.toFixed(2)}ms`);
    console.log(`  Avg DB time: ${perfDb.values.avg.toFixed(2)}ms`);
  }

  console.log('\n=== INTERPRETATION ===');
  if (parseFloat(cacheHitRate) > 90) {
    console.log('✅ Cache hit rate > 90% - This test validates optimal caching scenario');
    console.log(`✅ Average response time: ${reqDuration.values.avg.toFixed(2)}ms (mostly cache hits)`);
  } else {
    console.log(`⚠️  Cache hit rate ${cacheHitRate}% is lower than expected`);
    console.log('   Cache may need warmup or TTL is too short');
  }
  console.log('======================\n');

  return {
    'stdout': JSON.stringify(data, null, 2),
  };
}
