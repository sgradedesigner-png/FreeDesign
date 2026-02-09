// VERIFICATION TEST: Cache MISS (Production-like workload)
// Varies page numbers across 1-50 to reduce cache hit rate
// This simulates real production traffic where users browse different pages

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
    'http_req_duration': ['p(95)<1500', 'p(99)<2000'], // More realistic with cache misses
    'http_req_failed': ['rate<0.01'],
  },
};

export default function () {
  // Vary page number across 1-50 to force cache MISSes
  const page = Math.floor(Math.random() * 50) + 1;
  const url = `${BASE_URL}/api/products?page=${page}&limit=20`;

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

  console.log('\n=== VERIFICATION: CACHE MISS TEST ===');
  console.log('Purpose: Measure performance with production-like cache hit rate');
  console.log('Method: Random pages 1-50 to force cache misses');
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
    console.log(`  DB time as % of total: ${((perfDb.values.avg / perfTotal.values.avg) * 100).toFixed(1)}%`);
  }

  console.log('\n=== INTERPRETATION ===');
  console.log('This test simulates real production traffic with varied page access.');
  console.log(`Cache hit rate: ${cacheHitRate}% (expected: 10-30% with random pages 1-50)`);
  console.log(`Average response time: ${reqDuration.values.avg.toFixed(2)}ms`);

  if (reqDuration.values.avg < 100) {
    console.log('✅ Average < 100ms even with cache misses - excellent performance!');
  } else if (reqDuration.values.avg < 500) {
    console.log('✅ Average < 500ms - acceptable for production');
  } else {
    console.log('⚠️  Average > 500ms - may need further optimization');
  }
  console.log('======================\n');

  return {
    'stdout': JSON.stringify(data, null, 2),
  };
}
