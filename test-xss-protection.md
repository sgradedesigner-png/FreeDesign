# XSS Protection Тест

## Хортой HTML агуулсан бүтээгдэхүүн үүсгэх

### Алхам 1: Admin Panel-д нэвтрэх
1. http://localhost:5176 нээх
2. Admin эрхээр нэвтрэх

---

### Алхам 2: Хортой нэртэй бүтээгдэхүүн үүсгэх
1. Products → Add New Product
2. **Бүтээгдэхүүний нэр**: `<script>alert('XSS Test')</script>Samsung TV`
3. **Variant нэр**: `<img src=x onerror=alert('XSS')>55 inch`
4. Бусад талбаруудыг бөглөх
5. Save хийх

---

### Алхам 3: Захиалга үүсгэх
1. Store (http://localhost:5173) нээх
2. Хортой нэртэй бүтээгдэхүүнийг сагсанд нэмэх
3. Checkout хийх
4. Email хаягаа оруулах: **mongoldesignner@gmail.com**
5. Order үүсгэх

---

### Алхам 4: Email шалгах
1. Gmail inbox нээх
2. "Захиалга баталгаажлаа" email-ийг нээх
3. Email дотор HTML code гарсан эсэхийг шалгах

**✅ Зөв үр дүн:**
```
Бүтээгдэхүүн: &lt;script&gt;alert('XSS Test')&lt;/script&gt;Samsung TV
Variant: &lt;img src=x onerror=alert('XSS')&gt;55 inch
```

**❌ Буруу үр дүн (XSS эмзэг):**
```
Бүтээгдэхүүн: <script>alert('XSS Test')</script>Samsung TV  (script ажиллана)
```

---

## ✅ Шалгах зүйлс:
- [ ] Email дотор HTML tags escape хийгдсэн (`<` → `&lt;`, `>` → `&gt;`)
- [ ] Alert эсвэл script ажиллахгүй байна
- [ ] Email зөв харагдаж байна
