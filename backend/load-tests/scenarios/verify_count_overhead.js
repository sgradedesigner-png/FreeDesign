// VERIFICATION TEST: COUNT Query Overhead
// Compares performance WITH include_total=true vs WITHOUT
// This validates the claim that COUNT query adds 27% overhead

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { BASE_URL } from '../config.js';

// Custom metrics
const withCountDuration = new Trend('with_count_duration', true);
const withoutCountDuration = new Trend('without_count_duration', true);
const withCountDbTime = new Trend('with_count_db_ms', true);
const withoutCountDbTime = new Trend('without_count_db_ms', true);

export const options = {
  scenarios: {
    // Scenario 1: WITHOUT include_total (1 query)
    without_count: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
      exec: 'testWithoutCount',
    },
    // Scenario 2: WITH include_total=true (2 queries)
    with_count: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
      exec: 'testWithCount',
      startTime: '0s', // Run in parallel
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<2000'],
    'http_req_failed': ['rate<0.01'],
  },
};

export function testWithoutCount() {
  // WITHOUT include_total - should only run findMany (1 query)
  const url = `${BASE_URL}/api/products?page=1&limit=20`;

  const headers = {
    'Content-Type': 'application/json',
    'Accept-Encoding': 'gzip, deflate, br',
  };

  const response = http.get(url, { headers });

  check(response, {
    'status is 200': (r) => r.status === 200,
  });

  // Track duration
  withoutCountDuration.add(response.timings.duration);

  // Track DB time (if PERF_DIAG=true)
  if (response.headers['X-Perf-Db-Ms']) {
    const dbMs = parseInt(response.headers['X-Perf-Db-Ms'], 10);
    withoutCountDbTime.add(dbMs);
  }

  sleep(0.1);
}

export function testWithCount() {
  // WITH include_total=true - should run findMany + count (2 queries)
  const url = `${BASE_URL}/api/products?page=1&limit=20&include_total=true`;

  const headers = {
    'Content-Type': 'application/json',
    'Accept-Encoding': 'gzip, deflate, br',
  };

  const response = http.get(url, { headers });

  check(response, {
    'status is 200': (r) => r.status === 200,
    'has totalCount': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.pagination && body.pagination.totalCount !== undefined;
      } catch {
        return false;
      }
    },
  });

  // Track duration
  withCountDuration.add(response.timings.duration);

  // Track DB time (if PERF_DIAG=true)
  if (response.headers['X-Perf-Db-Ms']) {
    const dbMs = parseInt(response.headers['X-Perf-Db-Ms'], 10);
    withCountDbTime.add(dbMs);
  }

  sleep(0.1);
}

export function handleSummary(data) {
  const withCount = data.metrics.with_count_duration;
  const withoutCount = data.metrics.without_count_duration;
  const withCountDb = data.metrics.with_count_db_ms;
  const withoutCountDb = data.metrics.without_count_db_ms;

  console.log('\n=== VERIFICATION: COUNT QUERY OVERHEAD ===');
  console.log('Purpose: Measure overhead of include_total=true (COUNT query)');
  console.log('Method: Compare WITH vs WITHOUT include_total parameter\n');

  if (withoutCount && withCount) {
    console.log('HTTP Request Duration:');
    console.log(`  WITHOUT include_total: avg=${withoutCount.values.avg.toFixed(2)}ms, p95=${withoutCount.values.p95.toFixed(2)}ms`);
    console.log(`  WITH include_total:    avg=${withCount.values.avg.toFixed(2)}ms, p95=${withCount.values.p95.toFixed(2)}ms`);

    const overhead = withCount.values.avg - withoutCount.values.avg;
    const overheadPct = ((overhead / withoutCount.values.avg) * 100).toFixed(1);
    console.log(`\n  COUNT Overhead: +${overhead.toFixed(2)}ms (${overheadPct}%)`);
  }

  if (withoutCountDb && withCountDb) {
    console.log('\nDatabase Time (PERF_DIAG=true):');
    console.log(`  WITHOUT include_total: avg=${withoutCountDb.values.avg.toFixed(2)}ms`);
    console.log(`  WITH include_total:    avg=${withCountDb.values.avg.toFixed(2)}ms`);

    const dbOverhead = withCountDb.values.avg - withoutCountDb.values.avg;
    console.log(`\n  COUNT Query Time: ~${dbOverhead.toFixed(2)}ms`);
  }

  console.log('\n=== INTERPRETATION ===');
  if (withoutCount && withCount) {
    const overheadPct = parseFloat(
      (((withCount.values.avg - withoutCount.values.avg) / withoutCount.values.avg) * 100).toFixed(1)
    );

    if (overheadPct < 10) {
      console.log(`✅ COUNT overhead is only ${overheadPct}% - negligible impact`);
    } else if (overheadPct < 30) {
      console.log(`✅ COUNT overhead is ${overheadPct}% - acceptable for paginated views`);
    } else {
      console.log(`⚠️  COUNT overhead is ${overheadPct}% - consider lazy loading`);
    }

    console.log('\nRecommendation:');
    if (overheadPct > 20) {
      console.log('  - Use include_total=true only when pagination UI needs total count');
      console.log('  - Most list views can use hasNextPage heuristic without COUNT');
    } else {
      console.log('  - COUNT query overhead is acceptable for all requests');
    }
  }
  console.log('======================\n');

  return {
    'stdout': JSON.stringify(data, null, 2),
  };
}
