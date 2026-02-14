# Rate Limiting Documentation

## Overview

Rate limiting хэрэгжүүлсэн нь API-г хэт олон хүсэлтээс хамгаалж, дараах халдлагуудаас сэргийлнэ:
- **DDoS халдлага** - Distributed Denial of Service
- **Brute force attacks** - Нууц үг таах оролдлого
- **API abuse** - Хэт их хүсэлт илгээх
- **Scraping** - Өгөгдөл хулгайлах

---

## Configuration

### Global Rate Limiting

**Default Settings:**
- **Max Requests:** 100 requests per minute per IP
- **Time Window:** 1 minute
- **Cache Size:** 10,000 IPs

**Environment Variables:**
```bash
RATE_LIMIT_MAX=100        # Max requests per window
RATE_LIMIT_WINDOW=1 minute # Time window
```

**Implementation Location:** `src/app.ts:57-87`

```typescript
app.register(rateLimit, {
  global: true,
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
  cache: 10000,
  allowList: ['127.0.0.1', '::1'], // Localhost whitelisted
  keyGenerator: (request) => request.ip,
  errorResponseBuilder: (_request, context) => ({
    error: 'Rate limit exceeded',
    message: `Хэт олон хүсэлт илгээсэн байна. ${context.after} секундын дараа дахин оролдоно уу.`,
    retryAfter: context.after,
    statusCode: 429
  }),
  addHeaders: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true,
    'retry-after': true
  }
});
```

---

## Route-Specific Rate Limits

### 1. Order Creation
**Endpoint:** `POST /api/orders`
**Limit:** 5 requests per minute
**Reason:** Prevent spam orders, double-click protection already handled by transaction

```typescript
config: {
  rateLimit: {
    max: 5,
    timeWindow: '1 minute'
  }
}
```

**Why 5 requests?**
- Normal user: 1-2 orders per minute max
- Allows retry on error
- Prevents cart spamming

---

### 2. Payment Webhook
**Endpoint:** `POST /api/payment/callback`
**Limit:** 20 requests per minute
**Reason:** QPay can send duplicate webhooks, need higher limit

```typescript
config: {
  rateLimit: {
    max: 20,
    timeWindow: '1 minute'
  }
}
```

**Why 20 requests?**
- QPay may retry failed webhooks
- Multiple concurrent payments possible
- Idempotency already handled by PaymentWebhookLog

---

### 3. Payment Verification
**Endpoint:** `POST /api/payment/verify`
**Limit:** 10 requests per minute
**Reason:** Frontend polls this endpoint every 5 seconds

```typescript
config: {
  rateLimit: {
    max: 10,
    timeWindow: '1 minute'
  }
}
```

**Why 10 requests?**
- Polling interval: 5 seconds
- Max 12 polls per minute theoretically
- 10 gives buffer for manual checks

---

### 4. Profile Update
**Endpoint:** `PUT /api/profile`
**Limit:** 10 requests per minute
**Reason:** Prevent profile spam, normal users update rarely

```typescript
config: {
  rateLimit: {
    max: 10,
    timeWindow: '1 minute'
  }
}
```

**Why 10 requests?**
- Normal user: 1 update per session
- Allows form re-submissions
- Prevents automated profile scraping

---

## Response Headers

All rate-limited endpoints include these headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1612345678
Retry-After: 60
```

### Header Meanings:

- **X-RateLimit-Limit** - Maximum requests allowed in time window
- **X-RateLimit-Remaining** - Requests remaining in current window
- **X-RateLimit-Reset** - Unix timestamp when limit resets
- **Retry-After** - Seconds to wait before retrying (only on 429)

---

## Error Response Format

When rate limit is exceeded, returns **429 Too Many Requests**:

```json
{
  "error": "Rate limit exceeded",
  "message": "Хэт олон хүсэлт илгээсэн байна. 45 секундын дараа дахин оролдоно уу.",
  "retryAfter": 45,
  "statusCode": 429
}
```

---

## Testing Rate Limits

### Manual Testing

**Test Order Creation Rate Limit:**
```bash
# Send 6 requests rapidly (limit is 5)
for i in {1..6}; do
  curl -X POST http://localhost:4000/api/orders \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -d '{
      "items": [{"id": "uuid-here", "quantity": 1, "price": 1000}],
      "shippingAddress": {...},
      "total": 1000
    }'
  echo "Request $i sent"
done

# 6th request should return 429
```

**Test Global Rate Limit:**
```bash
# Send 101 requests (limit is 100)
for i in {1..101}; do
  curl http://localhost:4000/health
  echo "Request $i"
done

# 101st request should return 429
```

---

## Bypassing Rate Limits (Whitelist)

**Localhost is whitelisted by default:**
```typescript
allowList: ['127.0.0.1', '::1']
```

To add more IPs to whitelist:

```typescript
allowList: [
  '127.0.0.1',    // IPv4 localhost
  '::1',          // IPv6 localhost
  '10.0.0.1',     // Internal admin IP
  '192.168.1.100' // Development server
]
```

---

## Production Recommendations

### Adjust Limits for Production

**Global Limit:**
```bash
RATE_LIMIT_MAX=200         # Higher for production traffic
RATE_LIMIT_WINDOW=1 minute
```

**Route-Specific Adjustments:**

| Endpoint | Development | Production | Reason |
|----------|-------------|------------|---------|
| Global | 100/min | 200/min | More legitimate traffic |
| Order Creation | 5/min | 3/min | Stricter in production |
| Webhook | 20/min | 50/min | More concurrent payments |
| Payment Verify | 10/min | 20/min | More users polling |
| Profile Update | 10/min | 5/min | Less frequent updates |

---

## Redis for Distributed Rate Limiting

**For multi-server deployments**, use Redis:

### 1. Install Redis Client:
```bash
npm install ioredis
```

### 2. Update app.ts:
```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

app.register(rateLimit, {
  global: true,
  max: 200,
  timeWindow: '1 minute',
  redis: redis, // Use Redis for distributed rate limiting
  nameSpace: 'rate-limit:',
  // ... other config
});
```

### 3. Environment Variable:
```bash
REDIS_URL=redis://localhost:6379
```

**Benefits:**
- ✅ Rate limits shared across all servers
- ✅ No per-server limit bypass
- ✅ Better accuracy in multi-instance setups

---

## Monitoring

### Check Rate Limit Violations

**Via Logs:**
```bash
# Search for 429 errors
grep "429" logs/app.log

# Count rate limit errors
grep "Rate limit exceeded" logs/app.log | wc -l
```

**Via Response Headers:**
```bash
curl -I http://localhost:4000/health

# Check headers:
# X-RateLimit-Remaining: 95
# If this is low, user is close to limit
```

---

## Security Best Practices

1. **Don't set limits too high** - Defeats the purpose
2. **Don't set limits too low** - Frustrates legitimate users
3. **Monitor 429 errors** - Adjust limits based on data
4. **Use Redis in production** - For distributed rate limiting
5. **Whitelist carefully** - Only trusted IPs
6. **Log violations** - Track potential attackers

---

## Troubleshooting

### Issue: Legitimate users getting rate limited

**Solution:**
- Increase global limit
- Add user to whitelist (if internal)
- Use Redis for better accuracy

### Issue: Rate limit not working

**Checklist:**
- ✅ `@fastify/rate-limit` installed?
- ✅ Plugin registered in app.ts?
- ✅ Environment variables set?
- ✅ Route config correct?

### Issue: Different IPs bypassing limit

**Cause:** User behind NAT/proxy
**Solution:** Use Redis or implement per-user rate limiting

---

## Summary

- ✅ Global rate limit: 100 requests/minute
- ✅ Order creation: 5 requests/minute
- ✅ Payment webhook: 20 requests/minute
- ✅ Payment verify: 10 requests/minute
- ✅ Profile update: 10 requests/minute
- ✅ Localhost whitelisted
- ✅ Clear error messages in Mongolian
- ✅ Response headers included
- ⏳ Redis integration ready for production

**Status:** ✅ Production Ready (with Redis recommended for multi-server)

