# Load Testing with k6

## 📋 Overview

This directory contains load testing scenarios for the eCommerce backend API using [k6](https://k6.io/).

## 🚀 Quick Start

### Prerequisites

- k6 installed (`winget install k6` or download from https://k6.io/docs/get-started/installation/)
- Backend server running on `http://localhost:3000`

### Run Tests

```bash
# 1. Start the backend server
npm run dev

# 2. Run a test (in a new terminal)
cd load-tests

# Smoke Test (1-2 minutes) - Quick sanity check
"C:\Program Files\k6\k6.exe" run scenarios/smoke-test.js

# API Endpoints Test (5 minutes) - Test all endpoints
"C:\Program Files\k6\k6.exe" run scenarios/api-endpoints-test.js

# Load Test (10 minutes) - Gradual ramp-up
"C:\Program Files\k6\k6.exe" run scenarios/load-test.js

# Stress Test (15 minutes) - Push to limits
"C:\Program Files\k6\k6.exe" run scenarios/stress-test.js

# Spike Test (5 minutes) - Sudden traffic spike
"C:\Program Files\k6\k6.exe" run scenarios/spike-test.js
```

## 📊 Test Scenarios

### 1. Smoke Test (`smoke-test.js`)
- **Duration:** 1 minute
- **Users:** 1-2 concurrent
- **Purpose:** Quick sanity check before other tests
- **When to run:** After every deployment or major change

### 2. API Endpoints Test (`api-endpoints-test.js`)
- **Duration:** 5 minutes
- **Users:** 50 concurrent
- **Purpose:** Comprehensive test of all public endpoints
- **When to run:** Before release to verify all endpoints work under load

### 3. Load Test (`load-test.js`)
- **Duration:** 10 minutes
- **Users:** 10 → 50 → 100 → 50 → 10
- **Purpose:** Test system behavior under expected load
- **When to run:** Regular performance testing (weekly/monthly)

### 4. Stress Test (`stress-test.js`)
- **Duration:** 15 minutes
- **Users:** Ramp up to 500
- **Purpose:** Find the breaking point and test recovery
- **When to run:** To determine system capacity limits

### 5. Spike Test (`spike-test.js`)
- **Duration:** 5 minutes
- **Users:** 10 → 500 (instant) → 10
- **Purpose:** Test system behavior during sudden traffic spikes
- **When to run:** Before flash sales or major marketing campaigns

## 📈 Performance Thresholds

### Common Thresholds (Applied to most tests)
- **Error Rate:** < 1% (http_req_failed < 0.01)
- **Response Time (p95):** < 500ms
- **Response Time (p99):** < 2000ms

### Critical Endpoint Thresholds
- **Error Rate:** < 0.1% (http_req_failed < 0.001)
- **Response Time (p95):** < 300ms
- **Response Time (p99):** < 1000ms

## 📂 Results

Test results are saved in the `results/` directory:
- **JSON files:** Detailed metrics and statistics
- **HTML files:** Visual reports (load-test only)

Example results:
```
results/
├── smoke-test-summary.json
├── load-test-summary.json
├── load-test-summary.html
├── stress-test-summary.json
├── spike-test-summary.json
└── api-endpoints-test-summary.json
```

## 🎯 Interpreting Results

### Key Metrics to Watch

1. **http_reqs** - Total number of requests
2. **http_req_failed** - Percentage of failed requests (should be < 1%)
3. **http_req_duration** - Response time statistics
   - `avg` - Average response time
   - `p(95)` - 95th percentile (95% of requests faster than this)
   - `p(99)` - 99th percentile (99% of requests faster than this)
   - `max` - Slowest request

### Success Criteria

✅ **Pass:**
- Error rate < 1%
- p95 < 500ms
- p99 < 2000ms
- No timeouts or connection errors

⚠️ **Warning:**
- Error rate 1-5%
- p95 500-1000ms
- Occasional timeouts

❌ **Fail:**
- Error rate > 5%
- p95 > 1000ms
- Frequent timeouts or connection errors

## 🔧 Configuration

Edit `config.js` to customize:
- Base URL (`BASE_URL`)
- Test user credentials
- Performance thresholds
- Common headers

## 🐛 Troubleshooting

### Issue: k6 not found
```bash
# Solution: Add k6 to PATH or use full path
"C:\Program Files\k6\k6.exe" run scenarios/smoke-test.js
```

### Issue: Connection refused
```bash
# Solution: Make sure backend is running
npm run dev
```

### Issue: High error rate
1. Check backend logs for errors
2. Verify database connection
3. Check rate limiting settings
4. Monitor system resources (CPU, memory)

### Issue: Slow response times
1. Check database query performance
2. Monitor CPU usage
3. Check for N+1 queries
4. Review Circuit Breaker status (`/circuit-breakers`)

## 📝 Best Practices

1. **Always run smoke test first** to verify basic functionality
2. **Run tests during off-peak hours** to avoid affecting real users
3. **Monitor system resources** (CPU, memory, database) during tests
4. **Compare results over time** to track performance trends
5. **Test after major changes** to catch performance regressions early

## 🎓 Learning Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 Examples](https://k6.io/docs/examples/)
- [HTTP Performance Testing](https://k6.io/docs/testing-guides/http-performance/)

## 🔮 Future Enhancements

- [ ] Add authenticated user flow tests (login, order creation)
- [ ] Add database load monitoring
- [ ] Add real-time dashboard (k6 Cloud or Grafana)
- [ ] Add CI/CD integration (run on every release)
- [ ] Add performance regression detection
- [ ] Add distributed load testing (multiple load generators)

## 📞 Support

For questions or issues with load testing:
1. Check the k6 documentation: https://k6.io/docs/
2. Review backend logs for errors
3. Check system resource usage
4. Contact the backend team

---

**Last Updated:** 2026-02-09
**Maintained by:** Backend Team
