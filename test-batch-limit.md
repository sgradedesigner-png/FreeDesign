# Email Batch Limit Тест

## Cron job-ын batch limit ажиллаж байгаа эсэхийг шалгах

### Тест кейс: 50+ захиалга expiring

---

### Арга 1: Simulator ашиглах (Хялбар)

Backend terminal дээр:
```bash
# Manual cron trigger (admin эрхтэй)
curl -X POST http://localhost:3000/admin/cron/trigger-all \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

Server logs шалгах:
```
[Cron: Expiration Warnings] Found 75 orders requiring warnings
[Cron: Expiration Warnings] Limiting to 50 emails (found 75 total)
[Cron: Expiration Warnings] Processing 50 orders
...
[Cron: Expiration Warnings] ✅ Completed - sent 50/75 warning emails
```
☝️ 75 захиалга байсан ч зөвхөн 50-ыг л илгээсэн!

---

### Арга 2: Database-д test data үүсгэх (Хүнд)

⚠️ **Энэ нь цаг их авна, skip хийж болно**

SQL:
```sql
-- 100 test захиалга үүсгэх (expiring in 24 hours)
INSERT INTO orders (
  id, user_id, total, status, payment_status,
  qpay_invoice_expires_at, expiration_warning_email_sent
)
SELECT
  gen_random_uuid(),
  (SELECT id FROM profiles LIMIT 1),
  10000,
  'PENDING',
  'UNPAID',
  NOW() + INTERVAL '24 hours',
  false
FROM generate_series(1, 100);
```

Дараа нь cron trigger хийх:
```bash
curl -X POST http://localhost:3000/admin/cron/expiration-warnings
```

---

### Batch limit тохируулах

`.env` файл засах:
```env
# Default: 50
CRON_MAX_EMAILS_PER_RUN=100   # 100 болгох
```

Server restart хийгээд дахин тест хийнэ үү.

---

## ✅ Шалгах зүйлс:
- [ ] 50+ захиалга байхад зөвхөн 50 email илгээгдэнэ
- [ ] Warning log гарна ("Limiting to 50 emails...")
- [ ] Summary log зөв гарна ("sent 50/75")
- [ ] `.env`-аас limit тохируулж болно
