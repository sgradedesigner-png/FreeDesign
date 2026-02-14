# Circuit Breaker Documentation

## Overview

Circuit Breaker pattern protects the application from cascading failures when external services (QPay) are down or slow.

**Problem Solved:**
- QPay service down → Don't keep trying (waste resources)
- QPay slow → Don't wait forever (user timeout)
- QPay intermittent → Automatically recover when fixed

**Library Used:** `opossum` - Industry-standard circuit breaker for Node.js

---

## How Circuit Breaker Works

### Three States:

```
┌─────────┐ success  ┌────────┐ failure  ┌──────┐
│ CLOSED  │ ───────► │  OPEN  │ ───────► │ HALF │
│         │ ◄─────── │        │ ◄─────── │ OPEN │
└─────────┘ recovery └────────┘  timeout └──────┘
```

### 1. **CLOSED** (Normal Operation)
- Requests pass through to QPay
- Failures are counted
- When failure rate > 50% → **OPEN**

### 2. **OPEN** (Service Down)
- Requests fail immediately (don't call QPay)
- Saves resources, prevents timeout
- After 30 seconds → **HALF_OPEN**

### 3. **HALF_OPEN** (Testing Recovery)
- Limited requests pass through
- If successful → **CLOSED**
- If failed → **OPEN** again

---

## Configuration

**Location:** `src/services/qpay-circuit-breaker.service.ts`

### Circuit Breaker Options:

```typescript
{
  timeout: 30000,                 // 30s - max wait time
  errorThresholdPercentage: 50,   // 50% error rate → OPEN
  resetTimeout: 30000,            // 30s - wait before retry
  rollingCountTimeout: 10000,     // 10s - error counting window
  rollingCountBuckets: 10,        // Buckets in window
  volumeThreshold: 5,             // Min requests before circuit opens
  name: 'qpay-service'
}
```

### What These Mean:

| Setting | Value | Meaning |
|---------|-------|---------|
| `timeout` | 30s | If QPay doesn't respond in 30s → failure |
| `errorThresholdPercentage` | 50% | If 50% of requests fail → OPEN circuit |
| `resetTimeout` | 30s | Wait 30s before trying again |
| `rollingCountTimeout` | 10s | Count errors in last 10 seconds |
| `volumeThreshold` | 5 | Need at least 5 requests to open circuit |

---

## Protected Methods

### 1. Create Invoice

**Original:**
```typescript
await qpayService.createInvoice(params);
```

**With Circuit Breaker:**
```typescript
await qpayCircuitBreaker.createInvoice(params);
```

**Error Handling:**
```typescript
try {
  const invoice = await qpayCircuitBreaker.createInvoice(params);
} catch (error) {
  if (error.code === 'CIRCUIT_OPEN') {
    // Service is down, show fallback
    throw new PaymentServiceError('Төлбөрийн систем түр ашиглах боломжгүй');
  }
  if (error.code === 'TIMEOUT') {
    // Service is slow
    throw new ServiceUnavailableError('Хугацаа хэтэрсэн');
  }
  // Other error
  throw error;
}
```

### 2. Check Payment

```typescript
await qpayCircuitBreaker.checkPayment(invoiceId);
```

### 3. Get Payment

```typescript
await qpayCircuitBreaker.getPayment(paymentId);
```

### 4. Cancel Invoice

```typescript
await qpayCircuitBreaker.cancelInvoice(invoiceId);
```

**Note:** Cancel is lenient - if circuit is OPEN, it just skips cancellation (logs warning but doesn't throw error).

---

## Error Codes

When circuit breaker fails, errors include:

| Code | HTTP | Meaning | User Message |
|------|------|---------|--------------|
| `CIRCUIT_OPEN` | 503 | QPay service down | "Төлбөрийн систем түр ашиглах боломжгүй" |
| `TIMEOUT` | 504 | QPay too slow | "Хугацаа хэтэрсэн" |
| Other | 500 | Other QPay error | Original error message |

---

## Fallback Strategy

### Order Creation:

**When Circuit Opens:**
1. Create order with status `PAYMENT_PENDING`
2. Set payment status `PENDING_QPAY`
3. Return 503 to user with message
4. User can retry later when service recovers

**Implementation:**
```typescript
try {
  const invoice = await qpayCircuitBreaker.createInvoice(params);
} catch (error) {
  if (error.code === 'CIRCUIT_OPEN') {
    // Mark order as PAYMENT_PENDING (not CANCELLED)
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'PAYMENT_PENDING',
        paymentStatus: 'PENDING_QPAY'
      }
    });

    throw new PaymentServiceError('QPay түр ашиглах боломжгүй');
  }
}
```

---

## Monitoring

### Circuit Breaker Status Endpoint

**GET `/circuit-breakers`**

Returns current state of all circuit breakers:

```json
{
  "timestamp": "2026-02-08T10:50:00.000Z",
  "anyCircuitOpen": false,
  "status": "healthy",
  "circuits": {
    "createInvoice": {
      "name": "qpay-create-invoice",
      "state": "CLOSED",
      "stats": {
        "failures": 0,
        "successes": 145,
        "timeouts": 0,
        "rejects": 0
      }
    },
    "checkPayment": {
      "name": "qpay-check-payment",
      "state": "CLOSED",
      "stats": {
        "failures": 2,
        "successes": 98,
        "timeouts": 0,
        "rejects": 0
      }
    },
    "getPayment": {
      "name": "qpay-get-payment",
      "state": "CLOSED",
      "stats": { ... }
    },
    "cancelInvoice": {
      "name": "qpay-cancel-invoice",
      "state": "CLOSED",
      "stats": { ... }
    }
  }
}
```

**When Circuit is OPEN:**
```json
{
  "anyCircuitOpen": true,
  "status": "degraded",
  "circuits": {
    "createInvoice": {
      "state": "OPEN",  // ⚠️ Service is down
      "stats": {
        "failures": 12,
        "rejects": 5     // Requests rejected
      }
    }
  }
}
```

---

## Event Logging

Circuit breakers emit events that are automatically logged:

### Success Events:
```
✅ QPay CREATE INVOICE succeeded
✅ QPay CREATE INVOICE circuit breaker CLOSED - Service recovered
```

### Failure Events:
```
❌ QPay CREATE INVOICE failed: Connection timeout
⏱️  QPay CREATE INVOICE timeout (>30s)
```

### Circuit State Changes:
```
⚠️  QPay CREATE INVOICE circuit breaker OPENED - Service is DOWN
🔄 QPay CREATE INVOICE circuit breaker HALF-OPEN - Testing recovery
✅ QPay CREATE INVOICE circuit breaker CLOSED - Service recovered
```

### Rejection Events:
```
🚫 QPay CREATE INVOICE rejected - Circuit is OPEN
```

---

## Testing Circuit Breaker

### Simulate QPay Down:

**Option 1: Stop QPay (if sandbox available)**
```bash
# Circuit will open after 5+ failures
# Watch logs for "circuit breaker OPENED"
```

**Option 2: Mock Environment Variable**
```bash
QPAY_MOCK_MODE=true
```

**Option 3: Timeout Simulation**
```typescript
// In qpay.service.ts, add artificial delay
await new Promise(resolve => setTimeout(resolve, 35000)); // > 30s timeout
```

### Check Circuit Status:

```bash
curl http://localhost:4000/circuit-breakers
```

### Monitor Events:

```bash
# Watch logs for circuit breaker events
tail -f logs/app.log | grep "circuit breaker"
```

---

## Production Scenarios

### Scenario 1: QPay Maintenance

**What Happens:**
1. First request fails
2. Circuit counts failures
3. After 50% failure rate → Circuit OPENS
4. New requests fail immediately (503)
5. Users see: "Төлбөрийн систем түр ашиглах боломжгүй"
6. After 30s → Circuit tries again (HALF_OPEN)
7. If QPay back → Circuit CLOSES

**Benefits:**
- ✅ Fast failure (don't wait 30s per request)
- ✅ Resources saved (no wasted connections)
- ✅ Automatic recovery (no manual intervention)

### Scenario 2: QPay Slow Response

**What Happens:**
1. Requests timeout after 30s
2. Circuit counts as failures
3. Circuit OPENS if too many timeouts
4. New requests fail immediately

**Benefits:**
- ✅ User doesn't wait forever
- ✅ Server doesn't hang

### Scenario 3: Intermittent Failures

**What Happens:**
1. Some requests succeed, some fail
2. If failure rate < 50% → Circuit stays CLOSED
3. If failure rate > 50% → Circuit OPENS
4. Circuit automatically recovers when QPay stable

**Benefits:**
- ✅ Tolerates occasional failures
- ✅ Opens only when truly down

---

## Best Practices

### ✅ DO:

1. **Use circuit breaker for all external calls**
   ```typescript
   await qpayCircuitBreaker.createInvoice(params);
   ```

2. **Handle circuit open gracefully**
   ```typescript
   if (error.code === 'CIRCUIT_OPEN') {
     // Show user-friendly message
     // Save order for later retry
   }
   ```

3. **Monitor circuit status**
   ```bash
   curl http://localhost:4000/circuit-breakers
   ```

4. **Log circuit events**
   ```typescript
   // Already done automatically
   ```

### ❌ DON'T:

1. **Don't bypass circuit breaker**
   ```typescript
   // BAD
   await qpayService.createInvoice(params);

   // GOOD
   await qpayCircuitBreaker.createInvoice(params);
   ```

2. **Don't ignore circuit open errors**
   ```typescript
   // BAD
   try {
     await qpayCircuitBreaker.createInvoice(params);
   } catch (error) {
     // Ignore - silently fail
   }

   // GOOD
   try {
     await qpayCircuitBreaker.createInvoice(params);
   } catch (error) {
     if (error.code === 'CIRCUIT_OPEN') {
       // Handle gracefully
       throw new PaymentServiceError('...');
     }
   }
   ```

3. **Don't set thresholds too low**
   ```typescript
   // BAD - Opens too easily
   errorThresholdPercentage: 10

   // GOOD
   errorThresholdPercentage: 50
   ```

---

## Troubleshooting

### Issue: Circuit opens too easily

**Solution:**
- Increase `errorThresholdPercentage` (50% → 70%)
- Increase `volumeThreshold` (5 → 10)

### Issue: Circuit stays open too long

**Solution:**
- Decrease `resetTimeout` (30s → 15s)

### Issue: Timeouts too frequent

**Solution:**
- Increase `timeout` (30s → 45s)
- Check QPay service performance

### Issue: Circuit never opens

**Solution:**
- Check `volumeThreshold` - need minimum requests
- Check error rate is actually > 50%

---

## Metrics to Monitor

### Key Metrics:

1. **Circuit State**
   - CLOSED = Healthy
   - HALF_OPEN = Testing
   - OPEN = Service down

2. **Failure Rate**
   - < 50% = OK
   - > 50% = Circuit will open

3. **Rejection Count**
   - Requests rejected due to open circuit
   - High number = Service down for extended period

4. **Recovery Time**
   - Time from OPEN → CLOSED
   - Should be < 1 minute in most cases

---

## Summary

- ✅ 4 circuit breakers (createInvoice, checkPayment, getPayment, cancelInvoice)
- ✅ 30 second timeout
- ✅ 50% error threshold
- ✅ 30 second reset timeout
- ✅ Automatic recovery
- ✅ Event logging
- ✅ Monitoring endpoint
- ✅ Graceful fallback
- ✅ Production ready

**Status:** ✅ Production Ready

