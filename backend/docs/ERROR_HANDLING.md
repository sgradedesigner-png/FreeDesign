# Error Handling Documentation

## Overview

Comprehensive error handling system that:
- ✅ Catches all error types
- ✅ Provides consistent error responses
- ✅ Protects sensitive data in production
- ✅ Logs errors with context
- ✅ Maps errors to Mongolian messages

---

## Error Handler Middleware

**Location:** `src/middleware/errorHandler.ts`

### Handles These Error Types:

1. **Custom Application Errors** (`AppError`)
2. **Zod Validation Errors** (`ZodError`)
3. **Prisma Database Errors** (`Prisma.*`)
4. **Prisma Initialization Errors**
5. **Prisma Validation Errors**
6. **Rate Limit Errors** (429)
7. **Fastify Errors** (statusCode-based)
8. **Generic JavaScript Errors**
9. **Unknown Errors** (fallback)

---

## Custom Error Classes

**Location:** `src/utils/errors.ts`

### Base Class: `AppError`

All custom errors extend this class:

```typescript
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
}
```

### Available Error Classes:

| Class | Status Code | Default Message | Use Case |
|-------|-------------|-----------------|----------|
| `BadRequestError` | 400 | "Буруу хүсэлт" | Invalid input |
| `UnauthorizedError` | 401 | "Нэвтрэх шаардлагатай" | Missing auth |
| `ForbiddenError` | 403 | "Хандах эрхгүй байна" | No permission |
| `NotFoundError` | 404 | "Олдсонгүй" | Resource not found |
| `ConflictError` | 409 | "Зөрчилдөөн гарлаа" | Duplicate record |
| `UnprocessableEntityError` | 422 | "Боловсруулах боломжгүй" | Semantic error |
| `ServiceUnavailableError` | 503 | "Үйлчилгээ түр ашиглах боломжгүй байна" | External service down |
| `PaymentServiceError` | 503 | "Төлбөрийн систем түр ашиглах боломжгүй" | QPay down |
| `DatabaseConnectionError` | 503 | "Өгөгдлийн санд холбогдож чадсангүй" | DB connection lost |
| `ValidationError` | 400 | "Оруулсан өгөгдөл буруу байна" | Business logic validation |

---

## Usage Examples

### 1. Basic Error Throwing

```typescript
// In routes/orders.ts
const order = await prisma.order.findUnique({ where: { id } });

if (!order) {
  throw new NotFoundError('Захиалга олдсонгүй');
}
```

### 2. Authorization Check

```typescript
// Check user permission
if (!user.isAdmin) {
  throw new ForbiddenError('Админ эрх шаардлагатай');
}
```

### 3. Duplicate Detection

```typescript
// Check if email already exists
const existingUser = await prisma.user.findUnique({ where: { email } });

if (existingUser) {
  throw new ConflictError('И-мэйл аль хэдийн бүртгэгдсэн байна');
}
```

### 4. External Service Error

```typescript
// QPay service down
try {
  const invoice = await qpayService.createInvoice(data);
} catch (error) {
  throw new PaymentServiceError('QPay систем түр ашиглах боломжгүй байна');
}
```

### 5. Validation with Details

```typescript
// Business logic validation
if (order.items.length === 0) {
  throw new ValidationError('Захиалгад барааны мэдээлэл байхгүй байна', {
    field: 'items',
    requirement: 'At least one item required'
  });
}
```

---

## Error Response Format

### Development Environment

Full error details included:

```json
{
  "error": "NotFoundError",
  "message": "Захиалга олдсонгүй",
  "details": {
    "stack": "NotFoundError: Захиалга олдсонгүй\n    at ..."
  },
  "statusCode": 404
}
```

### Production Environment

Minimal information (no sensitive data):

```json
{
  "error": "NotFoundError",
  "message": "Захиалга олдсонгүй",
  "statusCode": 404
}
```

---

## Prisma Error Mapping

### P2002 - Unique Constraint Violation

**Response:**
```json
{
  "error": "Conflict",
  "message": "Давхардсан утга байна",
  "statusCode": 409
}
```

**Development mode includes:**
```json
{
  "details": {
    "fields": ["email"],
    "constraint": "User_email_key"
  }
}
```

### P2025 - Record Not Found

**Response:**
```json
{
  "error": "Not Found",
  "message": "Өгөгдөл олдсонгүй",
  "statusCode": 404
}
```

### P2003 - Foreign Key Constraint

**Response:**
```json
{
  "error": "Foreign Key Constraint",
  "message": "Холбоотой өгөгдөл олдсонгүй",
  "statusCode": 400
}
```

### P2024 - Database Timeout

**Response:**
```json
{
  "error": "Database Timeout",
  "message": "Өгөгдлийн санд холбогдох хугацаа дууслаа. Дахин оролдоно уу.",
  "statusCode": 504
}
```

---

## Zod Validation Error Response

```json
{
  "error": "Validation Error",
  "message": "Оруулсан өгөгдөл буруу байна",
  "details": [
    {
      "field": "items.0.id",
      "message": "Invalid product ID",
      "code": "invalid_string"
    },
    {
      "field": "shippingAddress.phone",
      "message": "Invalid phone number (must be 8 digits)",
      "code": "invalid_string"
    }
  ],
  "statusCode": 400
}
```

---

## Not Found Handler (404)

**Handles:** Routes that don't exist

**Response:**
```json
{
  "error": "Not Found",
  "message": "POST /api/nonexistent олдсонгүй",
  "statusCode": 404
}
```

---

## Error Logging

All errors are logged with full context:

```typescript
request.log.error({
  err: error,                    // Error object
  method: request.method,        // HTTP method
  url: request.url,              // Request URL
  userId: request.user?.id,      // User ID (if authenticated)
  body: request.body,            // Request body
  query: request.query,          // Query params
  params: request.params         // Route params
}, 'Request error occurred');
```

**Example Log Output:**
```json
{
  "level": 50,
  "time": 1675889234000,
  "msg": "Request error occurred",
  "err": {
    "type": "NotFoundError",
    "message": "Захиалга олдсонгүй",
    "stack": "NotFoundError: Захиалга олдсонгүй\n..."
  },
  "method": "GET",
  "url": "/api/orders/123",
  "userId": "user-uuid",
  "params": { "id": "123" }
}
```

---

## Best Practices

### ✅ DO:

1. **Use custom error classes**
   ```typescript
   throw new NotFoundError('Захиалга олдсонгүй');
   ```

2. **Let error handler catch errors**
   ```typescript
   // DON'T manually send error responses in routes
   // Just throw the error and let middleware handle it
   if (!order) {
     throw new NotFoundError('Захиалга олдсонгүй');
   }
   ```

3. **Provide meaningful messages**
   ```typescript
   throw new ValidationError('Утасны дугаар буруу байна', {
     field: 'phone',
     format: '8 digits required'
   });
   ```

4. **Use appropriate error types**
   ```typescript
   // User not found
   throw new NotFoundError('Хэрэглэгч олдсонгүй');

   // Permission denied
   throw new ForbiddenError('Админ эрх шаардлагатай');

   // QPay down
   throw new PaymentServiceError();
   ```

### ❌ DON'T:

1. **Don't manually send error responses**
   ```typescript
   // BAD
   if (!order) {
     return reply.code(404).send({ error: 'Not found' });
   }

   // GOOD
   if (!order) {
     throw new NotFoundError('Захиалга олдсонгүй');
   }
   ```

2. **Don't catch errors just to re-throw**
   ```typescript
   // BAD
   try {
     const order = await prisma.order.findUnique({ where: { id } });
   } catch (error) {
     throw error; // Unnecessary
   }

   // GOOD
   const order = await prisma.order.findUnique({ where: { id } });
   // Error handler will catch Prisma errors automatically
   ```

3. **Don't expose sensitive info in production**
   ```typescript
   // BAD
   throw new Error(`Database password: ${process.env.DB_PASSWORD}`);

   // GOOD
   throw new DatabaseConnectionError('Өгөгдлийн санд холбогдож чадсангүй');
   ```

---

## Testing Error Handling

### Test 404 Not Found

```bash
curl http://localhost:3000/nonexistent
```

**Expected:**
```json
{
  "error": "Not Found",
  "message": "GET /nonexistent олдсонгүй",
  "statusCode": 404
}
```

### Test Validation Error

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected:** 400 with validation details

### Test Not Found Error

```bash
curl http://localhost:3000/api/orders/00000000-0000-0000-0000-000000000000 \
  -H "Authorization: Bearer TOKEN"
```

**Expected:**
```json
{
  "error": "NotFoundError",
  "message": "Захиалга олдсонгүй",
  "statusCode": 404
}
```

---

## Environment Variables

**NODE_ENV:**
- `development` - Full error details in responses
- `production` - Minimal error information (no stack traces)

```bash
# Development
NODE_ENV=development

# Production
NODE_ENV=production
```

---

## Monitoring

### Track Error Rates

**By Status Code:**
```bash
# Count 500 errors
grep '"statusCode":500' logs/app.log | wc -l

# Count 404 errors
grep '"statusCode":404' logs/app.log | wc -l
```

**By Error Type:**
```bash
# Prisma errors
grep "PrismaClientKnownRequestError" logs/app.log

# Validation errors
grep "ValidationError" logs/app.log

# Not found errors
grep "NotFoundError" logs/app.log
```

---

## Summary

- ✅ 9 error types handled
- ✅ 10+ custom error classes
- ✅ Consistent error format
- ✅ Mongolian error messages
- ✅ Development vs Production modes
- ✅ Full error logging
- ✅ Prisma error mapping
- ✅ Zod validation errors
- ✅ 404 handler
- ✅ Best practices documented

**Status:** ✅ Production Ready
