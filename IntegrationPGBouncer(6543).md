# IntegrationPGBouncer(6543).md

## Зорилго

`backend` (Fastify + Prisma) нь Supabase Postgres руу **PgBouncer
connection pooling (port 6543)** ашиглан холбогдож, Supabase Free plan
дээр: - "too many connections" эрсдэлийг бууруулах - deploy/restart үед
connection spike-ээс хамгаалах - production орчинд тогтвортой ажиллах

> Энэ документ нь **reference/spec**. CODEX үүнийг уншаад таны repo дээр
> хамгийн бага diff-ээр хэрэгжүүлэлт хийнэ.\
> CODEX нь дараа нь тусдаа **ImplementationPGBouncer(6543).md**
> төлөвлөгөөг `ecommerce-platform/` дотор үүсгэнэ.

------------------------------------------------------------------------

## 1) PgBouncer гэж юу вэ (Supabase дээр)

Supabase нь DB холболтын 2 зам өгдөг: - **Direct Postgres**: порт
**5432** (pool байхгүй, шууд DB руу) - **PgBouncer Pooler**: порт
**6543** (connection pooling давхарга)

Backend `DATABASE_URL`-ээ 6543 руу чиглүүлбэл бүх query
(SELECT/INSERT/UPDATE/DELETE) PgBouncer-оор дамжина:
`Prisma -> PgBouncer:6543 -> Postgres:5432`

------------------------------------------------------------------------

## 2) Хаанаас pooling connection string авах вэ

Supabase Dashboard → **Settings → Database → Connection pooling**
хэсгээс:

-   **Pooler connection string (port 6543)**-ийг авна
-   Энэ string ихэвчлэн `*.pooler.supabase.com` host-той байдаг

Жишээ:

    postgresql://USER:PASSWORD@HOST:6543/postgres

Railway дээрх `DATABASE_URL`-ийг **энэ pooling string** болгож солино.

------------------------------------------------------------------------

## 3) Хэзээ 6543 хэрэгтэй вэ (Railway + Prisma + Supabase Free)

Таны нөхцөлд (Railway \$5 + Prisma + Supabase Free): - Prisma pool-ийн
хэмжээ өсөхөд Supabase free connection limit хурдан тулдаг -
deploy/restart үед олон connection зэрэг нээгдэх эрсдэлтэй

Тиймээс 6543 ашиглах нь ерөнхийдөө зөв.

------------------------------------------------------------------------

## 4) Prisma + PgBouncer дээр заавал баримтлах тохиргоо

### 4.1 Connection string параметрүүд (must)

Prisma + PgBouncer дээр prepared statements / pooling-н алдааг
бууруулахын тулд: - `pgbouncer=true` - `connection_limit` (pool size-г
багасгах) --- эхлэхдээ 5--10

Жишээ:

    DATABASE_URL="postgresql://USER:PASSWORD@HOST:6543/postgres?pgbouncer=true&connection_limit=5"

------------------------------------------------------------------------

### 4.2 PrismaClient singleton (must)

Backend дээр PrismaClient-ийг **нэг л удаа** үүсгээд reuse хийх: -
request бүр дээр шинэ PrismaClient үүсгэхийг хориглоно - dev/hot-reload
орчинд ч singleton pattern баримтална

------------------------------------------------------------------------

## 5) Long transaction гэж юу вэ, яаж зайлсхийх вэ

### 5.1 Гол санаа

PgBouncer (transaction pooling) ашиглаж байгаа үед: - transaction
(`BEGIN ... COMMIT`) нээлттэй хугацаанд connection pool-д "баригдана" -
transaction удаан үргэлжилбэл pool бөглөрч API удааширна

------------------------------------------------------------------------

### 5.2 Long transaction үүсгэдэг нийтлэг алдаа (DON'T)

Transaction дотор: - HTTP API call хийх (payment gateway, shipping,
email) - file upload хийх - олон секунд ажиллах loop / delay хийх - user
input хүлээх

Муу жишээ:

``` ts
await prisma.$transaction(async (tx) => {
  await tx.order.create({ data: orderData });
  const payment = await callPaymentGateway(); // ❌ гаднын API
  await tx.payment.create({ data: payment });
});
```

------------------------------------------------------------------------

### 5.3 Зөв загвар (DO)

Гаднын API-аа transaction-оос гадуур хий, дараа нь богино transaction
ашигла.

Зөв жишээ:

``` ts
const payment = await callPaymentGateway(); // ✅ гадна

await prisma.$transaction(async (tx) => {
  await tx.order.create({ data: orderData });
  await tx.payment.create({ data: payment });
});
```

------------------------------------------------------------------------

### 5.4 Practical rule of thumb

-   Transaction дотор зөвхөн DB query байлга
-   Аль болох **\< 200ms** хугацаанд commit хий
-   Том batch insert/update бол chunk хий

------------------------------------------------------------------------

## 6) Back-end (Railway) дээр хийх өөрчлөлтийн хүрээ (minimal diff)

### 6.1 Env өөрчлөлт

Railway environment variables дээр:

-   `DATABASE_URL` → PgBouncer (6543) pooling connection string болгоно
-   Хуучин direct (5432) string-ийг backup байдлаар хадгалж болно

------------------------------------------------------------------------

### 6.2 Prisma schema / migration

-   Prisma schema өөрчлөх шаардлагагүй
-   Migration workflow өөрчлөхгүй

------------------------------------------------------------------------

### 6.3 Health check (optional)

Startup үед: - `DATABASE_URL` порт 6543 ашиглаж байгааг баталгаажуулах -
Secret утгыг логлохгүй

------------------------------------------------------------------------

## 7) Store/Admin-д нөлөөлөх үү?

Store/Admin нь Supabase PostgREST/Auth (HTTP) ашиглаж байгаа тул
PgBouncer-тай холбоогүй.

PgBouncer нь зөвхөн:

    Backend (Prisma) -> Postgres

холболт дээр хамаарна.

------------------------------------------------------------------------

## 8) Acceptance Criteria

### 8.1 Runtime

-   Backend production дээр `DATABASE_URL` нь 6543 ашиглаж байна
-   API endpoints бүгд хэвийн ажиллана

### 8.2 Regression

-   Admin CRUD эвдэхгүй
-   Store public read эвдэхгүй

### 8.3 Observability

-   Supabase logs дээр connection spike багассан
-   Railway logs дээр DB connection алдаа багассан

------------------------------------------------------------------------

## 9) CODEX-д өгөх шууд заавар (ажлын хэсэг)

You are Codex working in the existing monorepo (ecommerce-platform/).

Your tasks:

1.  Read the current codebase of:
    -   backend (Fastify + Prisma)
    -   apps/admin
    -   apps/store and identify the current DB connection configuration
        and Prisma client initialization.
2.  Implement PgBouncer (6543) support with minimum diff:
    -   Ensure Prisma connection uses a DATABASE_URL that supports
        PgBouncer (`pgbouncer=true` and a small `connection_limit`).
    -   Ensure PrismaClient is a singleton and not created per request.
    -   Do not break existing routes or auth logic.
    -   Do not change store/admin behavior.
3.  Create a step-by-step implementation plan document named:

```{=html}
<!-- -->
```
    ecommerce-platform/ImplementationPGBouncer(6543).md

This plan must be split into PHASEs and include:

-   Phase 0: Audit
-   Phase 1: Env changes on Railway
-   Phase 2: Code changes
-   Phase 3: Verification steps
-   Phase 4: Performance & safety

4.  In the implementation plan, include:

-   Exact files to change
-   Expected diffs (small)
-   Manual test checklist
-   Rollback steps (revert to 5432)

IMPORTANT: - Do not invent files. - Avoid large refactors. - Keep
changes minimal and reversible. - Do not log secrets.
