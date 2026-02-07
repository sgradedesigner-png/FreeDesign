# repair.md — Size Finder UX сайжруулалт + Size тооцоолол засвар (Codex/Claude Code-д шууд paste)

## Зорилго
1) **“📏 Миний хэмжээг ол”** modal (3 алхам) UX-ийг production түвшинд ойлгомжтой, итгэл төрүүлэхүйц болгох  
2) **Foot length (cm) → EU size** тооцооллыг **Nike chart-ын дагуу 100% зөв** болгох  
3) PDP дээр “сонгосон хэмжээ” **үргэлж харагддаг** (Size picker UI дээр “EU 43 ✓ Recommended” гэх мэт)

---

## 0) Алдааны тодорхойлолт (Одоогийн асуудал)
- Хэрэглэгч **27cm** оруулахад **EU 41** гэж санал болгож байна → буруу.  
  Танай өгсөн chart-аар бол:
  - EU 43 ↔ 26.7cm
  - EU 44 ↔ 27.1cm  
  Тэгэхээр **27.0cm → EU 43 эсвэл EU 44 (round up default: EU44)** байх ёстой.
- Gallery/Size хэсэгт “recommended size” сонгосны дараа **UI дээр тод харагдахгүй**, хэрэглэгч ойлгохгүй байна.

---

## 1) Шийдэл — Size тооцооллын “Source of Truth”
### 1.1 Nike chart-ыг кодод шууд embed хийнэ (та өгсөн хүснэгт)
> **Анхаар:** EU ба cm массивуудын индекс 1:1 таарах ёстой.

EU массив:
- `EU = [35.5, 36, 36.5, 37.5, 38, 38.5, 39, 40, 40.5, 41, 42, 42.5, 43, 44, 44.5, 45, 45.5, 46, 47, 47.5, 48, 48.5, 49, 49.5, 50, 50.5, 51, 51.5, 52, 52.5, 53, 53.5, 54, 54.5, 55, 55.5, 56, 56.5]`

Foot length (cm) массив:
- `CM = [21.6, 22, 22.4, 22.9, 23.3, 23.7, 24.1, 24.5, 25, 25.4, 25.8, 26.2, 26.7, 27.1, 27.5, 27.9, 28.3, 28.8, 29.2, 29.6, 30, 30.5, 30.9, 31.3, 31.7, 32.2, 32.6, 33, 33.4, 33.9, 34.3, 34.7, 35.1, 35.5, 36, 36.4, 36.8, 37.2]`

### 1.2 Зөв алгоритм (round up default)
- `targetCm = inputCm + allowanceCm`
- `idx = CM.findIndex(x => x >= targetCm)`
  - олдохгүй бол хамгийн сүүлчийн idx
- `baseEU = EU[idx]`

#### allowanceCm (toe box adjustment) — зөв тэмдэгтэй байх ёстой
- Нарийн: `+0.0`
- Стандарт: `+0.2`
- Өргөн: `+0.4`
> **Анхаар:** allowance сөрөг байх ёсгүй. (+) үргэлж нэмэгдэнэ.

### 1.3 Available sizes дээр “сонгож буулгах” дүрэм (PDP inventory)
Хэрвээ тухайн бараанд боломжит size массив байгаа бол:
- **Prefer round up** (том тал руу) — заавал багасгаж болохгүй
- BaseEU яг байвал түүнийг
- BaseEU байхгүй бол **baseEU-ээс дээш хамгийн ойр** боломжит
- Хэрвээ дээш байхгүй бол хамгийн том боломжит

---

## 2) Кодын өөрчлөлтийн зорилтот бүтэц
### Файлууд
- `apps/store/src/lib/recommendShoeSize.ts`  
  - ✅ Chart + recommend logic + dedupe + guardrails
- `apps/store/src/components/SizeFinderDialog.tsx`  
  - ✅ 3 алхамтай modal UX + sizeguide.gif reference + “Debug line” dev-only
- `apps/store/src/components/ProductInfo.tsx`  
  - ✅ “📏 Миний хэмжээг ол” товч
  - ✅ Recommended size сонгогдсоны дараа Size UI дээр **pill** хэлбэрээр харагдах

---

## 3) Implementation details (Codex хийх ажлууд)

### 3.1 recommendShoeSize.ts — шинэчилсэн API
#### Input
- `gender: "men" | "women"` (одоохондоо chart нэг байж болно, гэхдээ future-proof)
- `footLengthCm: number` (20–37.2)
- `toeBox: "narrow" | "standard" | "wide"`
- `availableEU?: number[]` (optional)

#### Output
- `recommendedEU: number`
- `baseEU: number`
- `targetCm: number`
- `reason: string` (UX дээр “яагаад ингэж санал болгосон” тайлбар)
- `debug?: {...}` dev-only

**Guardrails**
- `footLengthCm` 20–37.2 хооронд clamp хийх
- `availableEU` string бол number болгож sort хийх
- `idx` олдохгүй бол last index ашиглах

### 3.2 SizeFinderDialog UX — 3 алхам
**Алхам 1/3 — Хүйс**
- Эрэгтэй / Эмэгтэй (radio)
- “Үргэлжлүүлэх” disabled until selected

**Алхам 2/3 — Хөлийн урт (cm)**
- Input numeric (step=0.1)
- Helper text: “20–37.2 cm”
- “Хэрхэн зөв хэмжих вэ?” хэсэгт `sizeguide.gif` (apps/store root дээр байгаа файлыг ашигла)
- “Үргэлжлүүлэх” disabled until valid number

**Алхам 3/3 — Toe box / өргөн**
- Нарийн / Стандарт / Өргөн (radio)
- Доор нь **Result card**
  - `Танд тохирох хэмжээ: EU 44 ✓`
  - reason: `27.0cm + өргөн (+0.4) → 27.4cm → base EU 44.5; inventory-д 44.5 байхгүй тул EU 45 эсвэл EU 44...` (inventory rule-д тааруулж)
- CTA: **“Энэ хэмжээг сонгох”**

**UX polish**
- Top-left title: “Танд яг таарах хэмжээг олъё”
- Step indicator: “Алхам 2/3”
- Back button: “Буцах”
- Close icon: X
- Escape key closes
- Overlay click closes (optional, recommended true)

### 3.3 ProductInfo.tsx — Size сонголтын харагдац
Одоогийн “Хэмжээ” талбар дээр:

- **Selected size** button (existing)
- Recommended ирсэн үед:
  - `Size: [ EU 44 ✓ Recommended ]`
  - доор нь жижиг link: “📏 Миний хэмжээг ол” (modal open)
- Хэрвээ хэрэглэгч өөр size сонговол:
  - Recommended pill алга болохгүй, харин:
    - `EU 44 (Recommended)` болон `Selected: EU 43` гэдэг мэт ялгаж харуулж болно
  - эсвэл илүү энгийн: recommended-г зөвхөн modal-аас сонгосон үед pill болгоно

**Хамгийн чухал acceptance:**
- Modal-оос “Энэ хэмжээг сонгох” дарсны дараа
  - `selectedSize` state update
  - UI дээр **шууд харагдана** (pill + check)

---

## 4) Нэмэлт: Debug (dev-only) — алдааг дахин гаргахгүй байлгах
SizeFinderDialog-ийн result card доор `process.env.NODE_ENV !== "production"` үед:
- `Input: 27.0cm | toeBox: wide (+0.4) | target: 27.4 | baseEU: 44.5 | chosenEU: 44`

---

## 5) Тест хийх checklist
### 5.1 Chart sanity tests (заавал)
- 25.4cm → EU 41
- 26.7cm → EU 43
- 27.0cm → EU 44 (round up rule)
- 27.1cm → EU 44
- 27.5cm → EU 44.5
- 28.8cm → EU 46

### 5.2 Inventory mapping tests
Available sizes: `[41, 42, 43]`
- input 27.0cm → baseEU 44 → chosen: **43 (largest available)**  
Available sizes: `[41, 42, 44, 45]`
- input 27.0cm → chosen: **44**
Available sizes: `[44.5, 45]`
- input 27.0cm → chosen: **44.5** (if supported in UI), else round to 45

### 5.3 UX tests
- Modal open/close: ESC / overlay / X
- Back button returns previous step, сохранялт хийдэг
- “Энэ хэмжээг сонгох” дарсны дараа PDP дээр pill харагдана

---

## 6) Хүлээгдэх үр дүн (Done definition)
✅ 27cm оруулахад **EU 43/44 зөв гарна** (round up default: EU44)  
✅ Modal-оос сонгосон size PDP дээр **“EU xx ✓ Recommended”** гэж үргэлж харагдана  
✅ Хэрэглэгч хэмжих зааврыг `sizeguide.gif`-ээр шууд харж чадна  
✅ Available sizes-тай үед “боломжит хамгийн ойр (том тал руу)” сонголт хийнэ  

---


