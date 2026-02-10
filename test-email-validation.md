# Email Validation Тест

## Буруу email хаягууд илгээх

### Тест 1.1: @ байхгүй email
```bash
curl -X POST http://localhost:3000/admin/test-email \
  -H "Content-Type: application/json" \
  -d '{"to": "invalid-email-no-at-sign"}'
```

**Хүлээгдэж буй үр дүн:**
```json
{
  "success": false,
  "error": "Invalid email addresses: invalid-email-no-at-sign"
}
```

---

### Тест 1.2: Domain байхгүй
```bash
curl -X POST http://localhost:3000/admin/test-email \
  -H "Content-Type: application/json" \
  -d '{"to": "test@"}'
```

**Хүлээгдэж буй үр дүн:**
```json
{
  "success": false,
  "error": "Invalid email addresses: test@"
}
```

---

### Тест 1.3: Зөв email
```bash
curl -X POST http://localhost:3000/admin/test-email \
  -H "Content-Type: application/json" \
  -d '{"to": "mongoldesignner@gmail.com"}'
```

**Хүлээгдэж буй үр дүн:**
```json
{
  "success": true,
  "message": "Test email sent successfully",
  "messageId": "..."
}
```

---

## ✅ Шалгах зүйлс:
- [ ] Буруу email хүлээн авагдахгүй байна
- [ ] Зөв email хүлээн авагдаж байна
- [ ] Error message ойлгомжтой байна
