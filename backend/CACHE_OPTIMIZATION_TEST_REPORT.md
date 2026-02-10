# Cache Optimization Test Report

**Date**: 2026-02-10
**Test Duration**: 30 seconds per scenario
**Virtual Users**: 10 concurrent
**Server**: localhost:3000 with PERF_DIAG=true

---

## Test 1: BASELINE (Cache Disabled)

**Configuration**:
- Environment: `ENABLE_RESPONSE_CACHE=false`
- URL Pattern: Random pages 1-100
- Purpose: Measure performance WITHOUT cache

**Results**:

| Metric | Value |
|--------|-------|
| Average | 716.95ms |
| p50 (median) | 619.05ms |
| p90 | 775.61ms |
| p95 | 926.99ms |
| max | 2070ms |

**Cache Statistics**:
- Hits: 0
- Misses: 313
- Total Requests: 313
- Hit Rate: 0%

**Logical Consistency Check**: ✅
- p50 (619.05ms) < avg (716.95ms) < p95 (926.99ms)

**Throughput**: 10.15 req/s

---

## Test 2: CACHE HOT (Optimal Caching)

**Configuration**:
- Environment: `ENABLE_RESPONSE_CACHE=true`
- URL Pattern: Same page repeated (page=1)
- Purpose: Measure maximum performance with optimal cache hit rate

**Results**:

| Metric | Value |
|--------|-------|
| Average | 3.03ms |
| p50 (median) | 1.82ms |
| p90 | 6.51ms |
| p95 | 8.59ms |
| max | 56.57ms |

**Cache Statistics**:
- Hits: 2355
- Misses: 0
- Total Requests: 2355
- Hit Rate: 100%

**Logical Consistency Check**: ✅
- p50 (1.82ms) < avg (3.03ms) < p95 (8.59ms)

**Throughput**: 78.23 req/s

---

## Test 3: CACHE COLD (Low Cache Hit Rate)

**Configuration**:
- Environment: `ENABLE_RESPONSE_CACHE=true`
- URL Pattern: Random pages 1-1000
- Purpose: Measure production-like performance with low cache hit rate

**Results**:

| Metric | Value |
|--------|-------|
| Average | 660.64ms |
| p50 (median) | 623.71ms |
| p90 | 780.34ms |
| p95 | 795.13ms |
| max | 1920ms |

**Cache Statistics**:
- Hits: 25
- Misses: 307
- Total Requests: 332
- Hit Rate: 7.5%

**Cache Hit Rate Verification**: ✅ (7.5% < 20% threshold)

**Logical Consistency Check**: ✅
- p50 (623.71ms) < avg (660.64ms) < p95 (795.13ms)

**Throughput**: 10.77 req/s

---

## Performance Improvements

### CACHE HOT vs BASELINE

**Average Response Time**:
- Before: 716.95ms
- After: 3.03ms
- Calculation: (716.95 - 3.03) / 716.95 × 100
- **Improvement: 99.58% faster**

**p50 (Median)**:
- Before: 619.05ms
- After: 1.82ms
- Calculation: (619.05 - 1.82) / 619.05 × 100
- **Improvement: 99.71% faster**

**p95 (95th Percentile)**:
- Before: 926.99ms
- After: 8.59ms
- Calculation: (926.99 - 8.59) / 926.99 × 100
- **Improvement: 99.07% faster**

**Throughput**:
- Before: 10.15 req/s
- After: 78.23 req/s
- Calculation: (78.23 - 10.15) / 10.15 × 100
- **Improvement: 670.54% increase**

---

### CACHE COLD vs BASELINE

**Average Response Time**:
- Before: 716.95ms
- After: 660.64ms
- Calculation: (716.95 - 660.64) / 716.95 × 100
- **Improvement: 7.85% faster**

**p50 (Median)**:
- Before: 619.05ms
- After: 623.71ms
- Calculation: (619.05 - 623.71) / 619.05 × 100
- **Regression: 0.75% slower**

**p95 (95th Percentile)**:
- Before: 926.99ms
- After: 795.13ms
- Calculation: (926.99 - 795.13) / 926.99 × 100
- **Improvement: 14.22% faster**

**Throughput**:
- Before: 10.15 req/s
- After: 10.77 req/s
- Calculation: (10.77 - 10.15) / 10.15 × 100
- **Improvement: 6.11% increase**

---

## Summary Table

| Scenario | Avg | p50 | p95 | Cache Hit Rate | vs Baseline |
|----------|-----|-----|-----|----------------|-------------|
| BASELINE | 716.95ms | 619.05ms | 926.99ms | 0% | - |
| CACHE HOT | 3.03ms | 1.82ms | 8.59ms | 100% | 99.58% faster |
| CACHE COLD | 660.64ms | 623.71ms | 795.13ms | 7.5% | 7.85% faster |

---

## Findings

1. **Cache effectiveness is directly proportional to cache hit rate**:
   - 100% hit rate → 99.58% faster
   - 7.5% hit rate → 7.85% faster

2. **CACHE COLD test shows minimal improvement**:
   - Average: 7.85% faster
   - Median: 0.75% **slower** (regression)
   - p95: 14.22% faster
   - This is expected with only 7.5% cache hit rate

3. **CACHE HOT test validates maximum performance**:
   - Median response of 1.82ms
   - 99.71% faster than baseline
   - Throughput increased 670%

4. **Cache hit rate < 20% provides limited benefit**:
   - CACHE COLD (7.5% hits) shows minimal performance gain
   - Most requests still hit database
   - The 7.85% average improvement comes from the small percentage of cached requests

5. **Production performance depends on traffic patterns**:
   - High-traffic pages (repeated access) → near 100% hit rate → 99%+ faster
   - Diverse pages (random access) → <10% hit rate → <10% faster
   - Medium traffic → 50-80% hit rate → 50-80% faster (estimated)

---

## Configuration Verified

**LRU Cache Settings**:
- TTL: 60 seconds (60000ms)
- Max Entries: 100
- Eviction: Least Recently Used (LRU)

**Skip Cache When**:
- `include_total=true` query parameter is present
- `ENABLE_RESPONSE_CACHE=false` environment variable

**Cache Key Format**: `products:{page}:{limit}:{category_id}:{is_published}`

---

## Test Commands

```bash
# Test 1: BASELINE (cache disabled)
cd backend
echo "ENABLE_RESPONSE_CACHE=false" >> .env
echo "PERF_DIAG=true" >> .env
npm run dev
cd load-tests
k6 run scenarios/baseline_no_cache.js

# Test 2: CACHE HOT (cache enabled, same page)
cd backend
# Remove ENABLE_RESPONSE_CACHE=false from .env
npm run dev
cd load-tests
k6 run scenarios/cache_hot.js

# Test 3: CACHE COLD (cache enabled, random pages)
k6 run scenarios/cache_cold.js
```

---

**Report Generated**: 2026-02-10
**Test Status**: Complete
**All Consistency Checks**: Passed ✅
