# End-to-End Тест - Жинхэнэ захиалга

## Бүх email систем + аюулгүй байдал хамтад нь тест хийх

---

## 🎬 Бэлтгэл

### 1. Бүх системүүд ажиллаж байгаа эсэхийг шалгах:
```bash
# Backend
cd backend && npm run dev
# Port 3000 дээр ажиллаж байна

# Store (Frontend)
cd apps/store && npm run dev
# Port 5173 дээр ажиллаж байна

# Admin Panel
cd apps/admin && npm run dev
# Port 5176 дээр ажиллаж байна
```

### 2. Email хаягаа бэлдэх:
- Gmail эсвэл өөр email хаяг ашиглана уу
- Inbox-ээ онгойлгож бэлэн байлгана уу

---

## 📋 Тест алхамууд

### Алхам 1: Бүтээгдэхүүн үүсгэх (XSS тест)

**Admin Panel** (http://localhost:5176):
1. Login хийх (admin эрх)
2. Products → Add New Product
3. Бүтээгдэхүүн үүсгэх:
   - **Нэр**: `Samsung TV <script>alert('test')</script>` *(XSS тест)*
   - **Үнэ**: 1500000
   - **Variant**: `55 inch <img src=x>`
   - **Зураг**: Ямар нэгэн зураг upload хийх
4. Save хийх

---

### Алхам 2: Захиалга үүсгэх

**Store** (http://localhost:5173):
1. Үндсэн хуудас руу орох
2. Шинээр үүссэн бүтээгдэхүүнээ олох
3. "Сагсанд нэмэх" дарах
4. Сагс руу орох
5. "Төлбөр төлөх" дарах
6. **Email хаягаа оруулах**: `mongoldesignner@gmail.com`
7. Хаяг бөглөх (optional)
8. "Захиалга баталгаажуулах" дарах

---

### Алхам 3: Backend logs шалгах

Terminal дээр server logs харах:
```
[Order Create] newOrderId=abc123... userId=xyz...
[QPay Invoice] success orderId=abc123... invoiceId=...
[Email] Sending order confirmation to mongoldesignner@gmail.com for order abc123...
[Email Service] Sending email: { to: 'mongoldesignner@gmail.com', ... }
[Email Service] ✅ Email sent successfully: message-id-here
```

**Шалгах зүйлс:**
- ✅ Order үүссэн
- ✅ QPay invoice үүссэн
- ✅ Email илгээгдсэн
- ✅ Email хаяг зөв харагдаж байна (development mode)

---

### Алхам 4: Email inbox шалгах

**Gmail** inbox нээх:
1. "Захиалга баталгаажлаа" email ирсэн эсэхийг шалгах
2. Email нээх
3. Дараах зүйлсийг шалгах:

**✅ Зөв үр дүн:**
```
Захиалга баталгаажлаа!
Таны #ABC123DE дугаартай захиалга амжилттай үүслээ.

Бүтээгдэхүүн:
- Samsung TV &lt;script&gt;alert('test')&lt;/script&gt; - 55 inch &lt;img src=x&gt; x 1 = ₮1,500,000

Нийт: ₮1,500,000

[QPay QR код товч]
```

**❌ Буруу үр дүн (эмзэг байдал):**
```
- Samsung TV <script>alert('test')</script>  ← Script ажиллана!
```

---

### Алхам 5: XSS халдлага шалгах

Email дотор:
- [ ] HTML tags escape хийгдсэн (`<` → `&lt;`)
- [ ] Alert popup гарахгүй байна
- [ ] Script execute болохгүй байна
- [ ] Email зөв форматтай харагдаж байна

---

### Алхам 6: Production mode тест (Optional)

`.env` засах:
```env
NODE_ENV=production
```

Server restart хийгээд дахин захиалга үүсгэнэ үү.

Logs шалгах:
```
[Email] Sending order confirmation to m***@g***.com for order ...
```
☝️ Email mask хийгдсэн байна!

---

## ✅ Бүгд амжилттай бол:

| Шалгалт | Статус |
|---------|--------|
| Захиалга үүссэн | ✅ |
| Email илгээгдсэн | ✅ |
| HTML escape хийгдсэн | ✅ |
| XSS халдлага хамгаалагдсан | ✅ |
| Email хүлээн авагдсан | ✅ |
| Production-д email mask | ✅ |

---

## 🎊 Амжилттай!

Систем production-д deploy хийхэд бэлэн!
