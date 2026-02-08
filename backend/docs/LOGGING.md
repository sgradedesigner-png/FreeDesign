# Logging System Documentation

## Overview

Production-ready structured logging system using **Pino** - a fast, low-overhead JSON logger for Node.js.

**Library:** `pino` + `pino-pretty` (dev formatting)

**Benefits:**
- ✅ Fast performance (minimal overhead)
- ✅ Structured JSON logging (easy to parse)
- ✅ Pretty printing in development
- ✅ Log levels (trace, debug, info, warn, error, fatal)
- ✅ Request/response logging
- ✅ Context propagation (request IDs)
- ✅ Type-safe logging

---

## Configuration

**Location:** `src/lib/logger.ts`

### Environment-Based Configuration

| Environment | Level | Format | Output |
|-------------|-------|--------|--------|
| **Development** | `debug` | Pretty (colorized) | Console |
| **Production** | `info` | JSON | stdout/file |

### Log Levels

```
fatal → 60  (application crash)
error → 50  (errors that need attention)
warn  → 40  (warnings, degraded performance)
info  → 30  (general information)
debug → 20  (debugging information)
trace → 10  (detailed trace information)
```

**Setting Log Level:**
```bash
LOG_LEVEL=debug npm run dev     # Development
LOG_LEVEL=info npm start        # Production
```

---

## Usage

### Basic Logging

```typescript
import { logger } from '../lib/logger';

// Info level
logger.info('User logged in');

// With context
logger.info({ userId: '123', email: 'user@example.com' }, 'User logged in');

// Error logging
logger.error({ err: error }, 'Payment failed');

// Warning
logger.warn({ orderId: '456' }, 'Order taking too long');

// Debug (development only)
logger.debug({ query: 'SELECT * FROM users' }, 'Database query');
```

### Specialized Logging Functions

#### 1. Payment Logging

```typescript
import { logPayment } from '../lib/logger';

logPayment(
  'CREATE_INVOICE',
  orderId,
  10000,
  'PENDING',
  { method: 'QPay', invoiceId: 'inv-123' }
);
```

**Output:**
```
💳 Payment: CREATE_INVOICE
  orderId: "order-123"
  amount: 10000
  status: "PENDING"
  method: "QPay"
  invoiceId: "inv-123"
```

#### 2. QPay Operations

```typescript
import { logQPay } from '../lib/logger';

// Success
logQPay('CREATE INVOICE', 'inv-123', true);

// Failure
logQPay('CREATE INVOICE', 'inv-123', false, error);
```

**Output:**
```
✅ QPay CREATE INVOICE succeeded
  operation: "CREATE INVOICE"
  invoiceId: "inv-123"
  success: true
```

#### 3. Circuit Breaker Events

```typescript
import { logCircuitBreaker } from '../lib/logger';

logCircuitBreaker('CREATE INVOICE', 'OPEN', {
  service: 'QPay',
  failureRate: 0.6
});
```

**Output:**
```
⚠️  Circuit Breaker: CREATE INVOICE → OPEN
  operation: "CREATE INVOICE"
  state: "OPEN"
  service: "QPay"
  failureRate: 0.6
```

#### 4. Security Events

```typescript
import { logSecurity } from '../lib/logger';

logSecurity(
  'INVALID_TOKEN',
  'high',
  { ip: '192.168.1.1', userId: '123' }
);
```

**Output:**
```
🚨 Security: INVALID_TOKEN
  event: "INVALID_TOKEN"
  severity: "high"
  ip: "192.168.1.1"
  userId: "123"
```

#### 5. Rate Limiting

```typescript
import { logRateLimit } from '../lib/logger';

logRateLimit('192.168.1.1', '/api/orders', 60);
```

**Output:**
```
🚫 Rate limit exceeded
  ip: "192.168.1.1"
  route: "/api/orders"
  retryAfter: "60s"
```

#### 6. Database Queries

```typescript
import { logQuery } from '../lib/logger';

logQuery('SELECT * FROM orders WHERE id = ?', 1250, { id: '123' });
```

**Output (if > 1000ms):**
```
🐌 Slow database query detected
  query: "SELECT * FROM orders WHERE id = ?"
  duration: "1250ms"
  params: "{"id":"123"}"
```

---

## Request/Response Logging

### Automatic Request Logging

Fastify automatically logs all requests using Pino:

```
INFO: Incoming request
  method: "POST"
  url: "/api/orders"
  requestId: "req-1707389012345-abc123"

INFO: Request completed
  method: "POST"
  url: "/api/orders"
  statusCode: 201
  responseTime: "125ms"
  requestId: "req-1707389012345-abc123"
```

### Request ID Propagation

Every request gets a unique ID:

```typescript
// In app.ts
const app = fastify({
  logger,
  genReqId: () => `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
});
```

Access request ID in routes:

```typescript
const requestId = (request as any).id;
logger.info({ requestId, orderId: '123' }, 'Order created');
```

---

## Error Logging

### In Error Handler

The error handler middleware automatically logs all errors:

```typescript
// src/middleware/errorHandler.ts
request.log.error({
  err: error,
  method: request.method,
  url: request.url,
  userId: (request as any).user?.id,
  body: request.body
}, 'Request error occurred');
```

**Output:**
```json
{
  "level": "error",
  "timestamp": "2026-02-08T12:30:45.123Z",
  "err": {
    "type": "ValidationError",
    "message": "Invalid order data",
    "stack": "..."
  },
  "method": "POST",
  "url": "/api/orders",
  "userId": "user-123",
  "msg": "Request error occurred"
}
```

### Custom Error Logging

```typescript
try {
  await createOrder(data);
} catch (error) {
  logger.error({
    err: error,
    orderId: data.orderId,
    userId: user.id
  }, 'Failed to create order');
  throw error;
}
```

---

## Log Output Formats

### Development (Pretty Print)

```
[12:30:45.123] INFO - Incoming request
  method: "POST"
  url: "/api/orders"
  requestId: "req-1707389012345-abc123"

[12:30:45.248] INFO - Request completed
  method: "POST"
  url: "/api/orders"
  statusCode: 201
  responseTime: "125ms"
  requestId: "req-1707389012345-abc123"

[12:30:45.250] ERROR - Request error occurred
  err: {
    type: "ValidationError"
    message: "Invalid order data"
  }
  method: "POST"
  url: "/api/orders"
```

### Production (JSON)

```json
{"level":"info","timestamp":"2026-02-08T12:30:45.123Z","method":"POST","url":"/api/orders","requestId":"req-1707389012345-abc123","msg":"Incoming request"}
{"level":"info","timestamp":"2026-02-08T12:30:45.248Z","method":"POST","url":"/api/orders","statusCode":201,"responseTime":"125ms","requestId":"req-1707389012345-abc123","msg":"Request completed"}
```

---

## Best Practices

### ✅ DO:

1. **Use structured logging** (include context as object)
   ```typescript
   // GOOD
   logger.info({ userId: '123', orderId: '456' }, 'Order created');

   // BAD
   logger.info('Order created for user 123, order 456');
   ```

2. **Use appropriate log levels**
   ```typescript
   logger.debug('Query executed');           // Development only
   logger.info('User logged in');            // General information
   logger.warn('Payment taking too long');   // Warnings
   logger.error('Payment failed');           // Errors
   ```

3. **Include request IDs**
   ```typescript
   logger.info({ requestId: request.id }, 'Processing order');
   ```

4. **Log errors with context**
   ```typescript
   logger.error({
     err: error,
     userId: user.id,
     orderId: order.id
   }, 'Payment processing failed');
   ```

5. **Use specialized logging functions**
   ```typescript
   logPayment('CREATE_INVOICE', orderId, amount, 'PENDING');
   logQPay('CREATE INVOICE', invoiceId, true);
   logCircuitBreaker('CREATE INVOICE', 'OPEN');
   ```

### ❌ DON'T:

1. **Don't use console.log**
   ```typescript
   // BAD
   console.log('User logged in');

   // GOOD
   logger.info('User logged in');
   ```

2. **Don't log sensitive data**
   ```typescript
   // BAD
   logger.info({ password: user.password }, 'User logged in');

   // GOOD
   logger.info({ userId: user.id }, 'User logged in');
   ```

3. **Don't log in hot paths (unless debug)**
   ```typescript
   // BAD (in a loop)
   items.forEach(item => {
     logger.info({ item }, 'Processing item');
   });

   // GOOD
   logger.debug({ itemCount: items.length }, 'Processing items');
   ```

4. **Don't ignore errors silently**
   ```typescript
   // BAD
   try {
     await processPayment();
   } catch (error) {
     // Silent failure
   }

   // GOOD
   try {
     await processPayment();
   } catch (error) {
     logger.error({ err: error }, 'Payment processing failed');
     throw error;
   }
   ```

---

## Log Analysis

### Filtering Logs

**By level:**
```bash
# Show only errors
cat app.log | grep '"level":"error"'

# Show warnings and errors
cat app.log | grep -E '"level":"(error|warn)"'
```

**By request ID:**
```bash
# Track a specific request
cat app.log | grep 'req-1707389012345-abc123'
```

**By operation:**
```bash
# QPay operations
cat app.log | grep 'QPay'

# Circuit breaker events
cat app.log | grep 'Circuit Breaker'
```

### Parsing JSON Logs

**Using jq:**
```bash
# Pretty print
cat app.log | jq '.'

# Extract errors
cat app.log | jq 'select(.level == "error")'

# Extract slow queries
cat app.log | jq 'select(.msg | contains("Slow query"))'

# Count errors by type
cat app.log | jq -r 'select(.level == "error") | .err.type' | sort | uniq -c
```

---

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Error Rate**
   - Count of `level: "error"` per minute
   - Alert if > 10/minute

2. **Slow Queries**
   - Count of "Slow database query" logs
   - Alert if > 5/minute

3. **Circuit Breaker Opens**
   - Count of `state: "OPEN"` events
   - Alert immediately

4. **Rate Limiting**
   - Count of "Rate limit exceeded" logs
   - Alert if > 100/minute (potential attack)

5. **Response Times**
   - P95/P99 of `responseTime`
   - Alert if P95 > 1000ms

---

## Integration with External Services

### Sending Logs to External Services

#### 1. File Transport (for log aggregators)

```typescript
// In logger.ts
const fileTransport: pino.TransportSingleOptions = {
  target: 'pino/file',
  options: { destination: './logs/app.log' }
};
```

#### 2. Multiple Destinations

```typescript
const multiTransport: pino.TransportMultiOptions = {
  targets: [
    {
      target: 'pino-pretty',
      level: 'debug',
      options: { colorize: true }
    },
    {
      target: 'pino/file',
      level: 'info',
      options: { destination: './logs/app.log' }
    }
  ]
};
```

#### 3. CloudWatch/DataDog Integration

Use dedicated Pino transports:
- `pino-cloudwatch`: AWS CloudWatch
- `pino-datadog`: DataDog
- `pino-elasticsearch`: Elasticsearch

---

## Performance

### Pino vs Console.log

| Operation | console.log | Pino |
|-----------|-------------|------|
| Simple log | ~1ms | ~0.1ms |
| With object | ~2ms | ~0.15ms |
| In production | Blocking | Non-blocking |

**Pino is 10-20x faster** than console.log and doesn't block the event loop.

### Benchmarks

```bash
npm run benchmark
```

---

## Troubleshooting

### Issue: Logs not appearing

**Solution:**
- Check `LOG_LEVEL` environment variable
- Ensure logger is imported from `lib/logger`
- Check if logs are being filtered

### Issue: Too many logs in production

**Solution:**
- Set `LOG_LEVEL=info` (not `debug`)
- Use `shouldSkipLogging()` for health checks
- Reduce logging in hot paths

### Issue: Logs are not pretty in development

**Solution:**
- Ensure `NODE_ENV=development`
- Install `pino-pretty`: `npm install pino-pretty`
- Check transport configuration in `logger.ts`

### Issue: Can't find logs from specific request

**Solution:**
- Use request ID to track: `grep "req-xxx" app.log`
- Ensure request ID is included in all logs
- Check `genReqId` in app.ts

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | - | `development` or `production` |
| `LOG_LEVEL` | `debug` (dev), `info` (prod) | Minimum log level |

---

## Files

### Created:
1. `src/lib/logger.ts` - Logger configuration and utilities
2. `src/middleware/requestLogger.ts` - Request/response logging middleware
3. `docs/LOGGING.md` - This documentation

### Modified:
1. `src/app.ts` - Integrated Pino logger, request ID generation
2. `src/middleware/errorHandler.ts` - Already uses request.log
3. `src/services/qpay-circuit-breaker.service.ts` - Uses specialized logging functions

---

## Summary

- ✅ Pino logger installed and configured
- ✅ Environment-based configuration (dev/prod)
- ✅ Automatic request/response logging
- ✅ Structured JSON logging
- ✅ Request ID propagation
- ✅ Specialized logging functions (payment, QPay, circuit breaker, security)
- ✅ Error logging with context
- ✅ Performance optimized
- ✅ Production ready

**Status:** ✅ Production Ready
