import { nikeSizeTable } from "./nikeSizeTable";

export type ToeBox = "narrow" | "standard" | "wide";

export type RecommendShoeSizeResult = {
  recommendedEU: number;
  baseEU: number;
  adjustedCm: number;
  toeBoxOffset: number;
  inStock: boolean;
  nearestEU: number | null;
};

const toeBoxOffsetCm: Record<ToeBox, number> = {
  narrow: 0.0,
  standard: 0.2,
  wide: 0.4,
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const normalizeInStock = (sizes: number[]) =>
  Array.from(new Set(sizes.filter((size) => Number.isFinite(size)))).sort(
    (a, b) => a - b
  );

// nearest cm row (by absolute distance)
const findClosestEU = (cm: number) => {
  let best = nikeSizeTable[0];
  for (const row of nikeSizeTable) {
    if (Math.abs(row.cm - cm) < Math.abs(best.cm - cm)) {
      best = row;
    }
  }
  return best.eu;
};

const findNearestAvailable = (targetEU: number, inStockEU: number[]) => {
  if (inStockEU.length === 0) {
    return null;
  }

  let best = inStockEU[0];
  let bestDiff = Math.abs(best - targetEU);

  for (const size of inStockEU) {
    const diff = Math.abs(size - targetEU);
    if (diff < bestDiff || (diff === bestDiff && size > best)) {
      best = size;
      bestDiff = diff;
    }
  }

  return best;
};

export function recommendShoeSize(params: {
  footLengthCm: number;
  toeBox: ToeBox;
  inStockEU: number[];
}): RecommendShoeSizeResult {
  const { footLengthCm, toeBox, inStockEU } = params;

  const minCm = nikeSizeTable[0].cm;
  const maxCm = nikeSizeTable[nikeSizeTable.length - 1].cm;

  const adjusted = clamp(footLengthCm + toeBoxOffsetCm[toeBox], minCm, maxCm);

  const baseEU = findClosestEU(adjusted);
  const normalizedStock = normalizeInStock(inStockEU);
  const inStock = normalizedStock.some(
    (size) => Math.abs(size - baseEU) < 0.001
  );
  const nearestEU = findNearestAvailable(baseEU, normalizedStock);

  return {
    recommendedEU: baseEU,
    baseEU,
    adjustedCm: adjusted,
    toeBoxOffset: toeBoxOffsetCm[toeBox],
    inStock,
    nearestEU,
  };
}
