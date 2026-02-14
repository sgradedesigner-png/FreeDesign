# Swagger API Documentation Guide

Backend API-н Swagger/OpenAPI documentation-ийн гарын авлага.

---

## Swagger-т хандах

API documentation нь `/docs` endpoint дээр байрлана:

- **Development:** http://localhost:4000/docs
- **Production:** https://your-app.railway.app/docs

---

## Swagger тохиргоо

`src/app.ts` файлд бүртгэгдсэн:

```typescript
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

// Swagger/OpenAPI бүртгэх
app.register(swagger, {
  openapi: {
    info: {
      title: 'Korean Goods E-commerce API',
      description: 'Солонгос хувцас, гоо сайхны бүтээгдэхүүний онлайн худалдааны платформын Backend API',
      version: '1.0.0',
      contact: {
        name: 'API Support',
        email: 'support@koreangoods.mn',
      },
    },
    servers: [
      {
        url: 'http://localhost:4000',
        description: 'Хөгжүүлэлтийн сервер (Development)',
      },
      {
        url: 'https://api.koreangoods.mn',
        description: 'Продакшн сервер (Production)',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Supabase JWT token (Authorization: Bearer <token>)',
        },
      },
    },
    tags: [
      { name: 'Products', description: 'Бүтээгдэхүүн' },
      { name: 'Categories', description: 'Ангилал' },
      { name: 'Orders', description: 'Захиалга' },
      { name: 'Payment', description: 'Төлбөр' },
      { name: 'Profile', description: 'Хэрэглэгчийн мэдээлэл' },
      { name: 'Admin', description: 'Админ удирдлага' },
      { name: 'Health', description: 'Эрүүл мэнд шалгалт' },
    ],
  },
});

// Swagger UI
app.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: true,
    displayRequestDuration: true,
    filter: true,
  },
});
```

---

## Schema-тай Route үүсгэх жишээ

### 1. Энгийн GET endpoint

```typescript
// Жишээ: Health check
app.get('/health', {
  schema: {
    description: 'Серверийн эрүүл мэндийн статус',
    tags: ['Health'],
    response: {
      200: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['healthy'], example: 'healthy' },
          timestamp: { type: 'string', format: 'date-time' },
          database: {
            type: 'object',
            properties: {
              connected: { type: 'boolean', example: true }
            }
          }
        }
      },
      503: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['unhealthy'] },
          database: {
            type: 'object',
            properties: {
              connected: { type: 'boolean', example: false },
              error: { type: 'string' }
            }
          }
        }
      }
    }
  }
}, async (request, reply) => {
  // Handler code...
});
```

### 2. Authentication шаардлагатай endpoint

```typescript
// Жишээ: Захиалга үүсгэх
app.post('/api/orders', {
  schema: {
    description: 'Шинэ захиалга үүсгэх',
    tags: ['Orders'],
    security: [{ bearerAuth: [] }],  // JWT шаардлагатай
    body: {
      type: 'object',
      required: ['items', 'shippingAddress', 'paymentMethod'],
      properties: {
        items: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['variantId', 'quantity'],
            properties: {
              variantId: {
                type: 'string',
                format: 'uuid',
                description: 'Бүтээгдэхүүний variant ID',
                example: '123e4567-e89b-12d3-a456-426614174000'
              },
              quantity: {
                type: 'integer',
                minimum: 1,
                maximum: 10,
                description: 'Тоо хэмжээ',
                example: 2
              }
            }
          }
        },
        shippingAddress: {
          type: 'object',
          required: ['fullName', 'phone', 'address', 'city', 'district'],
          properties: {
            fullName: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              description: 'Бүтэн нэр',
              example: 'Болд Батаа'
            },
            phone: {
              type: 'string',
              pattern: '^\\d{8}$',
              description: 'Утасны дугаар (8 орон)',
              example: '99887766'
            },
            address: {
              type: 'string',
              minLength: 10,
              maxLength: 500,
              description: 'Хаяг',
              example: '3-р хороо, 5-р байр, 12 тоот'
            },
            city: {
              type: 'string',
              description: 'Хот',
              example: 'Улаанбаатар'
            },
            district: {
              type: 'string',
              description: 'Дүүрэг',
              example: 'Баянзүрх'
            }
          }
        },
        paymentMethod: {
          type: 'string',
          enum: ['QPAY'],
          description: 'Төлбөрийн арга',
          example: 'QPAY'
        }
      }
    },
    response: {
      201: {
        description: 'Захиалга амжилттай үүслээ',
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          orderNumber: { type: 'string', example: 'ORD-20260210-ABC123' },
          total: { type: 'number', example: 150000 },
          status: { type: 'string', enum: ['PENDING'], example: 'PENDING' },
          qpayInvoiceId: { type: 'string' },
          qpayUrls: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', example: 'Khan Bank' },
                description: { type: 'string' },
                logo: { type: 'string', format: 'uri' },
                link: { type: 'string', format: 'uri' }
              }
            }
          }
        }
      },
      400: {
        description: 'Validation алдаа',
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Invalid request data' }
        }
      },
      401: {
        description: 'Нэвтрээгүй',
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Authentication required' }
        }
      },
      500: {
        description: 'Серверийн алдаа',
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Failed to create order' }
        }
      }
    }
  },
  preHandler: [authenticate],  // Auth middleware
  config: {
    rateLimit: { max: 5, timeWindow: '1 minute' }
  }
}, async (request, reply) => {
  // Handler code...
});
```

### 3. Query parameters-тай endpoint

```typescript
// Жишээ: Бүтээгдэхүүн жагсаалт
app.get('/api/products', {
  schema: {
    description: 'Бүтээгдэхүүний жагсаалт авах',
    tags: ['Products'],
    querystring: {
      type: 'object',
      properties: {
        page: {
          type: 'integer',
          minimum: 1,
          default: 1,
          description: 'Хуудасны дугаар',
          example: 1
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 20,
          description: 'Хуудсан дахь бичлэгийн тоо',
          example: 20
        },
        categoryId: {
          type: 'string',
          format: 'uuid',
          description: 'Ангиллаар шүүх (optional)',
          example: '123e4567-e89b-12d3-a456-426614174000'
        },
        search: {
          type: 'string',
          description: 'Хайлтын үг (optional)',
          example: 'hoodie'
        },
        include_total: {
          type: 'string',
          enum: ['true', 'false'],
          default: 'false',
          description: 'Нийт тоог тооцох эсэх (хурдас болгох)',
          example: 'false'
        }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          products: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string', example: 'Korean Oversized Hoodie' },
                slug: { type: 'string', example: 'korean-oversized-hoodie' },
                basePrice: { type: 'number', example: 89000 },
                thumbnail: { type: 'string', format: 'uri' },
                category: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string', example: 'Hoodies' }
                  }
                },
                variants: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string', example: 'Black / L' },
                      price: { type: 'number', example: 89000 },
                      stock: { type: 'integer', example: 10 }
                    }
                  }
                }
              }
            }
          },
          total: {
            type: 'integer',
            nullable: true,
            description: 'Нийт бүтээгдэхүүний тоо (include_total=true үед)',
            example: 145
          },
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 }
        }
      }
    }
  }
}, async (request, reply) => {
  // Handler code...
});
```

### 4. Admin endpoint (Role-based access)

```typescript
// Жишээ: Бүтээгдэхүүн засах (Admin only)
app.put('/admin/products/:id', {
  schema: {
    description: 'Бүтээгдэхүүн засварлах (Зөвхөн админ)',
    tags: ['Admin'],
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: {
          type: 'string',
          format: 'uuid',
          description: 'Бүтээгдэхүүний ID',
          example: '123e4567-e89b-12d3-a456-426614174000'
        }
      }
    },
    body: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Нэр' },
        description: { type: 'string', description: 'Тайлбар' },
        basePrice: { type: 'number', minimum: 0, description: 'Үндсэн үнэ' },
        categoryId: { type: 'string', format: 'uuid', description: 'Ангиллын ID' },
        is_published: { type: 'boolean', description: 'Нийтлэгдсэн эсэх' }
      }
    },
    response: {
      200: {
        description: 'Амжилттай засагдлаа',
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      403: {
        description: 'Эрх хүрэхгүй байна',
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Insufficient permissions' }
        }
      },
      404: {
        description: 'Бүтээгдэхүүн олдсонгүй',
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Product not found' }
        }
      }
    }
  },
  preHandler: [authenticate, requireRole(['ADMIN'])],
}, async (request, reply) => {
  // Handler code...
});
```

---

## Schema-д ашиглах JSON Schema types

### Үндсэн types:

```typescript
// String
{ type: 'string' }
{ type: 'string', minLength: 1, maxLength: 100 }
{ type: 'string', pattern: '^\\d{8}$' }  // Regex
{ type: 'string', format: 'email' }
{ type: 'string', format: 'uri' }
{ type: 'string', format: 'uuid' }
{ type: 'string', format: 'date-time' }
{ type: 'string', enum: ['QPAY', 'CASH'] }

// Number
{ type: 'number' }
{ type: 'integer' }
{ type: 'number', minimum: 0, maximum: 1000000 }
{ type: 'number', multipleOf: 100 }

// Boolean
{ type: 'boolean' }

// Array
{
  type: 'array',
  minItems: 1,
  maxItems: 10,
  items: { type: 'string' }
}

// Object
{
  type: 'object',
  required: ['field1', 'field2'],
  properties: {
    field1: { type: 'string' },
    field2: { type: 'number' }
  }
}

// Nullable
{ type: 'string', nullable: true }
{ type: ['string', 'null'] }

// Any of (union)
{ anyOf: [
  { type: 'string' },
  { type: 'number' }
]}
```

---

## Reusable schemas үүсгэх

Олон газар ашиглагдах schema-г components дотор тодорхойлж болно:

```typescript
// src/app.ts дээр
app.register(swagger, {
  openapi: {
    components: {
      schemas: {
        // Бүтээгдэхүүн
        Product: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            slug: { type: 'string' },
            basePrice: { type: 'number' },
            thumbnail: { type: 'string', format: 'uri' }
          }
        },
        // Алдааны хариу
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        // Захиалгын хаяг
        ShippingAddress: {
          type: 'object',
          required: ['fullName', 'phone', 'address', 'city', 'district'],
          properties: {
            fullName: { type: 'string' },
            phone: { type: 'string', pattern: '^\\d{8}$' },
            address: { type: 'string' },
            city: { type: 'string' },
            district: { type: 'string' }
          }
        }
      }
    }
  }
});

// Route-д ашиглах:
app.get('/api/products', {
  schema: {
    response: {
      200: {
        type: 'object',
        properties: {
          products: {
            type: 'array',
            items: { $ref: '#/components/schemas/Product' }  // Reference
          }
        }
      },
      400: { $ref: '#/components/schemas/ErrorResponse' }
    }
  }
}, handler);
```

---

## Tags (ангилал) ашиглах

Routes-ыг ангилахын тулд tags ашиглана:

```typescript
schema: {
  tags: ['Products'],  // Swagger UI дээр "Products" бүлэгт харагдана
  description: 'Бүтээгдэхүүний жагсаалт'
}
```

**Одоо байгаа tags:**
- `Health` - Эрүүл мэнд шалгалт
- `Products` - Бүтээгдэхүүн
- `Categories` - Ангилал
- `Orders` - Захиалга
- `Payment` - Төлбөр
- `Profile` - Хэрэглэгчийн мэдээлэл
- `Admin` - Админ удирдлага

---

## Swagger UI features

### Хайлт:
Swagger UI-н дээд хэсэгт **Filter** input ашиглана:
```
Type: GET /products
```

### Try it out:
1. Endpoint сонгох
2. "Try it out" товч дарах
3. Parameters оруулах
4. "Execute" дарах
5. Response харах

### Authentication:
1. "Authorize" товч (дээд баруун)
2. Bearer token оруулах
3. "Authorize" дарах
4. Одоо бүх authenticated endpoints туршиж болно

---

## Swagger documentation нэмэх алхамууд

### 1. Хийгдсэн:
- ✅ `@fastify/swagger` суулгасан
- ✅ `@fastify/swagger-ui` суулгасан
- ✅ `app.ts` дээр Swagger бүртгэсэн
- ✅ Health check endpoints-д schema нэмсэн

### 2. Дараагийн алхамууд (хэрэгтэй бол):

#### A. Products route (src/routes/products.ts)
```bash
# GET /api/products - Бүтээгдэхүүний жагсаалт
# GET /api/products/:slug - Бүтээгдэхүүний дэлгэрэнгүй
```

#### B. Orders route (src/routes/orders.ts)
```bash
# POST /api/orders - Захиалга үүсгэх
# GET /api/orders - Миний захиалгууд
# GET /api/orders/:id - Захиалгын дэлгэрэнгүй
```

#### C. Payment route (src/routes/payment.ts)
```bash
# POST /api/payment/callback - QPay webhook
# GET /api/payment/verify/:orderId - Төлбөр шалгах
```

#### D. Admin routes (src/routes/admin/*)
```bash
# Admin products, categories, orders, stats, upload
```

---

## Жишээ: Products route-д schema нэмэх

```typescript
// src/routes/products.ts
import { FastifyInstance } from 'fastify';

export async function publicProductRoutes(app: FastifyInstance) {
  // GET /api/products
  app.get('/', {
    schema: {
      description: 'Бүтээгдэхүүний жагсаалт авах',
      tags: ['Products'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          categoryId: { type: 'string', format: 'uuid' },
          search: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            products: { type: 'array', items: { type: 'object' } },
            total: { type: 'integer', nullable: true },
            page: { type: 'integer' },
            limit: { type: 'integer' }
          }
        }
      }
    }
  }, async (request, reply) => {
    // Handler code...
  });
}
```

---

## Development tips

### 1. Swagger UI refresh:
Server restart хийгээд `/docs` хуудсыг дахин ачаална

### 2. Validation errors:
Schema validation алдаатай бол Fastify error өгнө:
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "body.items[0] must have required property 'variantId'"
}
```

### 3. Debug mode:
Development дээр Swagger validation errors-ыг logs дээр харна

---

## Ашигтай холбоосууд

- **Fastify Swagger Plugin:** https://github.com/fastify/fastify-swagger
- **Swagger UI:** https://swagger.io/tools/swagger-ui/
- **JSON Schema:** https://json-schema.org/
- **OpenAPI 3.0 Spec:** https://spec.openapis.org/oas/v3.0.0

---

## Summary

✅ **Хийгдсэн:**
- Swagger dependencies суулгасан
- app.ts дээр бүртгэсэн
- Health check endpoints-д schema нэмсэн
- `/docs` endpoint идэвхжсэн

🎯 **Дараагийн алхам (optional):**
- Бүх routes-д schema нэмэх
- Reusable components үүсгэх
- Request/response examples нэмэх

**Swagger UI хандах:**
```
http://localhost:4000/docs
```

Одоо API documentation бэлэн! 🚀

