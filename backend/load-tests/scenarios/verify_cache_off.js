// VERIFICATION TEST: Cache OFF (Baseline)
// Measures performance with caching completely disabled
// This is the TRUE baseline without any cache benefit

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { BASE_URL } from '../config.js';

const perfTotalTime = new Trend('perf_total_ms', true);
const perfDbTime = new Trend('perf_db_ms', true);

export const options = {
  stages: [
    { duration: '10s', target: 10 },
    { duration: '20s', target: 10 },
  ],
  thresholds: {
    'http_req_failed': ['rate<0.01'],
  },
};

export default function () {
  // Request different pages to prevent any caching
  const page = Math.floor(Math.random() * 100) + 1;

  // Add cache-buster to ensure no HTTP cache
  const cacheBuster = Date.now() + Math.random();
  const url = `${BASE_URL}/api/products?page=${page}&limit=20&_cb=${cacheBuster}`;

  const headers = {
    'Content-Type': 'application/json',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
  };

  const response = http.get(url, { headers });

  check(response, {
    'status is 200': (r) => r.status === 200,
  });

  // Extract timing
  if (response.headers['X-Perf-Total-Ms']) {
    perfTotalTime.add(parseInt(response.headers['X-Perf-Total-Ms'], 10));
    perfDbTime.add(parseInt(response.headers['X-Perf-Db-Ms'] || '0', 10));
  }

  sleep(0.1);
}

export function handleSummary(data) {
  const reqDuration = data.metrics.http_req_duration;

  console.log('\n=== VERIFICATION: CACHE OFF (Baseline) ===');
  console.log('IMPORTANT: Run with ENABLE_RESPONSE_CACHE=false\n');
  console.log('HTTP Request Duration:');
  console.log(`  avg: ${reqDuration.values.avg.toFixed(2)}ms`);
  console.log(`  p50: ${reqDuration.values.p50.toFixed(2)}ms`);
  console.log(`  p95: ${reqDuration.values.p95.toFixed(2)}ms`);
  console.log(`  p99: ${reqDuration.values.p99.toFixed(2)}ms`);

  if (data.metrics.perf_total_ms) {
    const perfTotal = data.metrics.perf_total_ms;
    const perfDb = data.metrics.perf_db_ms;
    console.log('\nPerformance Diagnostics:');
    console.log(`  Avg total: ${perfTotal.values.avg.toFixed(2)}ms`);
    console.log(`  Avg DB: ${perfDb.values.avg.toFixed(2)}ms`);
  }

  console.log('\n=== BASELINE (No Cache) ===');
  console.log('This is the TRUE performance without any caching benefit.');
  console.log('==================\n');

  return { 'stdout': JSON.stringify(data, null, 2) };
}
