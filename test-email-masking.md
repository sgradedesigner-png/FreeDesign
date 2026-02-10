# Email Masking Тест (GDPR Compliance)

## Production mode-д email хаяг нууцлагдах эсэхийг шалгах

### Алхам 1: Development mode (одоогийн байдал)

Backend server logs харах:
```powershell
# Logs-ын сүүлийн мөрүүдийг харах
tail -20 backend/logs/app.log   # эсвэл server output харах
```

**Одоо харагдах ёстой:**
```
[Email Service] Sending email: { to: 'mongoldesignner@gmail.com', ... }
[Email] Sending order confirmation to mongoldesignner@gmail.com for order ...
```
☝️ Бүтэн email хаяг харагдаж байна (development mode)

---

### Алхам 2: Production mode-руу шилжих

Backend `.env` файл засах:
```bash
# .env файл дээр
NODE_ENV=production   # Энийг нэмэх
```

Server restart:
```powershell
cd backend
npm run dev
```

---

### Алхам 3: Email дахин илгээх

Захиалга үүсгэх эсвэл тест email илгээх:
```bash
# (Энэ нь ажиллахгүй учир нь admin guard идэвхтэй, зөвхөн жишээ)
curl -X POST http://localhost:3000/admin/test-email \
  -H "Content-Type: application/json" \
  -d '{"to": "mongoldesignner@gmail.com"}'
```

---

### Алхам 4: Server logs шалгах

**Production mode-д харагдах ёстой:**
```
[Email Service] Sending email: { to: 'm***@g***.com', ... }
[Email] Sending order confirmation to m***@g***.com for order ...
```
☝️ Email хаяг mask хийгдсэн байна! (GDPR compliant)

---

## Mask функцийн жишээнүүд:

| Эх email | Masked (production) |
|----------|---------------------|
| test@example.com | t***@e***.com |
| mongoldesignner@gmail.com | m***@g***.com |
| a@b.c | a***@b***.c*** |
| user@company.co.uk | u***@c***.c***.u*** |

---

## ✅ Шалгах зүйлс:
- [ ] Development mode-д бүтэн email харагдана
- [ ] Production mode-д email mask хийгдэнэ
- [ ] Mask формат зөв байна (first_char***)
- [ ] Email илгээлт ажиллаж байна (mask нь зөвхөн logs-д)
