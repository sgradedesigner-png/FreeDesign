# SIZE FINDER – REPAIR PLAN (FULL OFFICIAL TABLE)

## Goal
Foot Length (cm) → EU size нь **official хүснэгтээр** 1:1 таарах ёстой.
Ямар ч “formula” ашиглахгүй.

---

## 1) Add FULL lookup table

Create file:
`apps/store/src/lib/sizing/nikeSizeTable.ts`

```ts
export type NikeSizeRow = { eu: number; cm: number };

export const nikeSizeTable: NikeSizeRow[] = [
  { eu: 35.5, cm: 21.6 },
  { eu: 36, cm: 22.0 },
  { eu: 36.5, cm: 22.4 },
  { eu: 37.5, cm: 22.9 },
  { eu: 38, cm: 23.3 },
  { eu: 38.5, cm: 23.7 },
  { eu: 39, cm: 24.1 },
  { eu: 40, cm: 24.5 },
  { eu: 40.5, cm: 25.0 },
  { eu: 41, cm: 25.4 },
  { eu: 42, cm: 25.8 },
  { eu: 42.5, cm: 26.2 },
  { eu: 43, cm: 26.7 },
  { eu: 44, cm: 27.1 },
  { eu: 44.5, cm: 27.5 },
  { eu: 45, cm: 27.9 },
  { eu: 45.5, cm: 28.3 },
  { eu: 46, cm: 28.8 },
  { eu: 47, cm: 29.2 },
  { eu: 47.5, cm: 29.6 },
  { eu: 48, cm: 30.0 },
  { eu: 48.5, cm: 30.5 },
  { eu: 49, cm: 30.9 },
  { eu: 49.5, cm: 31.3 },
  { eu: 50, cm: 31.7 },
  { eu: 50.5, cm: 32.2 },
  { eu: 51, cm: 32.6 },
  { eu: 51.5, cm: 33.0 },
  { eu: 52, cm: 33.4 },
  { eu: 52.5, cm: 33.9 },
  { eu: 53, cm: 34.3 },
  { eu: 53.5, cm: 34.7 },
  { eu: 54, cm: 35.1 },
  { eu: 54.5, cm: 35.5 },
  { eu: 55, cm: 36.0 },
  { eu: 55.5, cm: 36.4 },
  { eu: 56, cm: 36.8 },
  { eu: 56.5, cm: 37.2 },
];
2) Replace recommendShoeSize.ts with lookup logic
File:
apps/store/src/lib/sizing/recommendShoeSize.ts

import { nikeSizeTable } from "./nikeSizeTable";

export type ToeBox = "narrow" | "standard" | "wide";

const toeBoxOffsetCm: Record<ToeBox, number> = {
  narrow: 0.0,
  standard: 0.2,
  wide: 0.4,
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// nearest cm row (by absolute distance)
function findClosestEU(cm: number): number {
  let best = nikeSizeTable[0];
  for (const row of nikeSizeTable) {
    if (Math.abs(row.cm - cm) < Math.abs(best.cm - cm)) best = row;
  }
  return best.eu;
}

// choose next bigger if not in stock (never smaller)
function pickInStockOrNextBigger(recommendedEU: number, inStockEU: number[]) {
  const sorted = [...inStockEU].sort((a, b) => a - b);

  if (sorted.includes(recommendedEU)) return recommendedEU;

  // next bigger
  const bigger = sorted.find((x) => x > recommendedEU);
  if (bigger != null) return bigger;

  // fallback: largest available (still safer than smaller)
  return sorted[sorted.length - 1] ?? recommendedEU;
}

export function recommendShoeSize(params: {
  footLengthCm: number;     // user input
  toeBox: ToeBox;
  inStockEU: number[];      // from product inventory
}) {
  const { footLengthCm, toeBox, inStockEU } = params;

  // allow chart range only
  const minCm = nikeSizeTable[0].cm;
  const maxCm = nikeSizeTable[nikeSizeTable.length - 1].cm;

  const adjusted = clamp(footLengthCm + toeBoxOffsetCm[toeBox], minCm, maxCm);

  const baseEU = findClosestEU(adjusted);
  const chosenEU = pickInStockOrNextBigger(baseEU, inStockEU);

  return {
    recommendedEU: chosenEU,
    baseEU,
    adjustedCm: adjusted,
    toeBoxOffset: toeBoxOffsetCm[toeBox],
  };
}
3) UI/UX required behavior
PDP дээр size сонгох хэсэгт:
Recommended badge нь size buttons дээрхээс өмнө харагдана.

“📏 Миний хэмжээг ол” товч нь size section-ийн баруун талд байрлана.

Modal-ийн 3-р алхам дээр зөвхөн:

Recommended EU

“Энэ хэмжээг сонгох” CTA

“Буцах”

(debug текст харуулахгүй)

User сонгосны дараа:
Size section дээр:
EU 44 ✓ Recommended
гэсэн pill/badge гарч үлдэнэ.

