# Task: PDP дээр “📏 Миний хэмжээг ол” Modal + sizeguide.gif ашиглах (store app)

## Context
Repo бүтэц:
- `apps/store/` (Vite + React + TS)
- `apps/store/sizeguide.gif` файл **store app root** дээр байна.
Энэ GIF-ийг “Хэрхэн хэмжих вэ?” хэсэгт reference болгож modal дотор харуулна.

## Goal
PDP (product details) дээр “📏 Миний хэмжээг ол” товч нэмнэ.
Дармагц shadcn/ui `Dialog` нээгдэж:
1) Gender (эрэгтэй/эмэгтэй)
2) Хөлийн урт (см)
3) Toe box / өргөн (нарийн/стандарт/өргөн)
асуугаад **Recommended EU size** санал болгоно.
“Энэ хэмжээг сонгох” дархад PDP-ийн `selectedSize` state дээр set хийнэ.

## Must Use
- shadcn/ui: `Dialog`, `Button`, `Input`, `Label`, `RadioGroup` (эсвэл Toggle)
- Tailwind хэв маяг existing theme-тэй нийцнэ
- `sizeguide.gif`-ийг modal дотор харуулна (measure guide)

## Files to Create / Update

### 1) Create: `apps/store/src/lib/recommendShoeSize.ts`
Pure function + mapping table.
Inputs:
- gender: `"men" | "women"`
- footLengthCm: number
- toeBox: `"narrow" | "regular" | "wide"`
- availableEuSizes: number[]  (product дээр байгаа EU sizes)

Outputs:
- recommendedEu: number
- reason: string (for debug/UI)
Rules:
1) Base EU size-г cm -> EU mapping table-оор олно (доорх table ашигла).
2) toeBox adjust:
   - narrow: -0.5
   - regular: +0
   - wide: +1.0
3) available list-д байхгүй бол “nearest bigger” (ceil) size-г сонго.
4) Хэрвээ available хоосон бол base rounded size-г буцаа.

### 2) Create: `apps/store/src/components/product/SizeFinderDialog.tsx`
Props:
- `open: boolean`
- `onOpenChange: (v:boolean)=>void`
- `availableEuSizes: number[]`
- `onSelectSize: (eu:number)=>void`
UX:
- Title: `Танд яг таарах хэмжээг олъё`
- Steps 1/3, 2/3, 3/3
- Step1: Gender Radio (эрэгтэй/эмэгтэй)
- Step2: Foot length input (cm)
  - helper: `Хэрхэн зөв хэмжих вэ?` (collapse/accordion эсвэл simply section)
  - энд `sizeguide.gif` image харуул:
    - Source: `/sizeguide.gif` (Vite static: app root файл = public path root дээр served болно)
    - Alt: `Хэмжээ авах заавар`
- Step3: Toe box Radio (нарийн/стандарт/өргөн)
- Result view:
  - `✅ Танд тохирох хэмжээ: EU {recommended}`
  - CTA: `Энэ хэмжээг сонгох` -> onSelectSize(recommended) + close
  - Secondary: `Буцаад засах` -> step=1

Validation:
- footLengthCm: 20–33 хооронд байх (adult)
- Continue disabled until valid

### 3) Update PDP size section (хаана ч байсан)
ProductInfo дээр:
- existing `selectedSize` state байна гэж үзнэ.
- “📏 Миний хэмжээг ол” товч нэмээд dialog нээ.
- `availableEuSizes`-г product дээрх sizes-ээс гаргаж (string байвал number болго) pass хийнэ.
- Dialog confirm дээр `setSelectedSize(recommendedEu.toString())` (эсвэл number state бол number).

## Mapping Table (cm -> EU)
Энэ table-г recommendShoeSize.ts дотор hardcode хийнэ (эхний хувилбар):
Men:
- 25.0->40, 25.5->40.5, 26.0->41, 26.5->42, 27.0->42.5, 27.5->43,
  28.0->44, 28.5->44.5, 29.0->45, 29.5->46, 30.0->47
Women:
- 22.0->35.5, 22.5->36, 23.0->36.5, 23.5->37.5, 24.0->38,
  24.5->38.5, 25.0->39, 25.5->40, 26.0->40.5, 26.5->41, 27.0->42

(Зайлшгүй шаардлагатай бол interpolation/nearest хийх)

## Acceptance Criteria
1) PDP дээр “📏 Миний хэмжээг ол” харагдана, дархад Modal нээгдэнэ.
2) Step workflow ажиллана (validation OK).
3) Step2 дээр sizeguide.gif зураг заавал харагдана.
4) Result гарч EU recommended харуулна.
5) “Энэ хэмжээг сонгох” дархад PDP selected size set болж modal хаагдана.
6) Recommended size available list-д байхгүй бол дараагийн том хэмжээг сонгоно.

## Notes (Implementation details)
- `sizeguide.gif`-ийг харагдуулах хамгийн энгийн арга: `<img src="/sizeguide.gif" ... />`
- Хэрвээ ажиллахгүй бол файл public руу хуул:
  - `apps/store/public/sizeguide.gif` (Vite standard)
- TypeScript strict-ийг эвдэхгүй.

## Deliverables
- `src/lib/recommendShoeSize.ts`
- `src/components/product/SizeFinderDialog.tsx`
- PDP component update (button + dialog integration)

Now implement all changes.
