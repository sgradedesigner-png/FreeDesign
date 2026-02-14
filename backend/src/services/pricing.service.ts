import { prisma } from '../lib/prisma';
import { BadRequestError, NotFoundError } from '../utils/errors';
import type { PriceQuoteInput } from '../schemas/customization.schema';

type PrintFeeLine = {
  printAreaId: string;
  printArea: string;
  printSizeTierId: string;
  printSizeTier: string;
  fee: number;
};

type ExtraSideFeeLine = {
  printAreaId: string;
  printArea: string;
  fee: number;
};

type AddOnFeeLine = {
  id: string;
  name: string;
  fee: number;
};

type PriceQuoteBreakdown = {
  basePrice: number;
  quantity: number;
  printFees: PrintFeeLine[];
  printFeeTotalPerItem: number;
  extraSideFee: {
    appliedSides: number;
    lines: ExtraSideFeeLine[];
    perItem: number;
    total: number;
  };
  addOnFee: {
    lines: AddOnFeeLine[];
    perItem: number;
    total: number;
  };
  subtotal: number;
  quantityDiscount: {
    percent: number;
    amount: number;
  };
  rushFee: number;
  grandTotal: number;
};

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function orderedUnique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }

  return out;
}

function pickRuleByQuantity<T extends { minQuantity: number | null; maxQuantity: number | null }>(
  rules: T[],
  quantity: number
): T | undefined {
  const quantityMatched = rules
    .filter((rule) => {
      const minOk = rule.minQuantity == null || quantity >= rule.minQuantity;
      const maxOk = rule.maxQuantity == null || quantity <= rule.maxQuantity;
      return minOk && maxOk;
    })
    .sort((a, b) => {
      const aMin = a.minQuantity ?? -1;
      const bMin = b.minQuantity ?? -1;
      if (aMin !== bMin) return bMin - aMin;

      const aMax = a.maxQuantity ?? Number.MAX_SAFE_INTEGER;
      const bMax = b.maxQuantity ?? Number.MAX_SAFE_INTEGER;
      return aMax - bMax;
    });

  return quantityMatched[0];
}

export async function calculatePriceQuote(input: PriceQuoteInput): Promise<PriceQuoteBreakdown> {
  const variant = await prisma.productVariant.findUnique({
    where: { id: input.variantId },
    select: {
      id: true,
      price: true,
      product: {
        select: {
          id: true,
          isCustomizable: true,
          printAreas: {
            select: {
              printAreaId: true,
            },
          },
        },
      },
    },
  });

  if (!variant) {
    throw new NotFoundError('Product variant not found');
  }

  if (!variant.product.isCustomizable) {
    throw new BadRequestError('This product variant is not customizable');
  }

  const printAreaIds = orderedUnique(input.customizations.map((item) => item.printAreaId));
  const printSizeTierIds = orderedUnique(input.customizations.map((item) => item.printSizeTierId));
  const addOnIds = orderedUnique(input.addOnIds ?? []);

  const configuredAreaIds = new Set(
    variant.product.printAreas.map((item) => item.printAreaId)
  );

  // Backward-compatibility: enforce only when product print-areas are configured.
  if (configuredAreaIds.size > 0) {
    const invalidArea = printAreaIds.find((areaId) => !configuredAreaIds.has(areaId));
    if (invalidArea) {
      throw new BadRequestError('Selected print area is not enabled for this product');
    }
  }

  const [printAreas, printSizeTiers, pricingRules] = await Promise.all([
    prisma.printArea.findMany({
      where: {
        id: { in: printAreaIds },
        isActive: true,
      },
      select: { id: true, label: true },
    }),
    prisma.printSizeTier.findMany({
      where: {
        id: { in: printSizeTierIds },
        isActive: true,
      },
      select: { id: true, label: true },
    }),
    prisma.pricingRule.findMany({
      where: {
        isActive: true,
        ruleType: {
          in: ['PRINT_FEE', 'EXTRA_SIDE', 'QUANTITY_DISCOUNT', 'RUSH_FEE', 'ADD_ON'],
        },
      },
      select: {
        id: true,
        name: true,
        ruleType: true,
        printAreaId: true,
        printSizeTierId: true,
        minQuantity: true,
        maxQuantity: true,
        discountPercent: true,
        price: true,
      },
    }),
  ]);

  if (printAreas.length !== printAreaIds.length) {
    throw new BadRequestError('One or more print areas are invalid or inactive');
  }

  if (printSizeTiers.length !== printSizeTierIds.length) {
    throw new BadRequestError('One or more print size tiers are invalid or inactive');
  }

  const areaMap = new Map(printAreas.map((area) => [area.id, area]));
  const sizeTierMap = new Map(printSizeTiers.map((tier) => [tier.id, tier]));

  const printFeeRules = pricingRules.filter((rule) => rule.ruleType === 'PRINT_FEE');
  const extraSideRules = pricingRules.filter((rule) => rule.ruleType === 'EXTRA_SIDE');
  const quantityDiscountRules = pricingRules.filter((rule) => rule.ruleType === 'QUANTITY_DISCOUNT');
  const rushFeeRules = pricingRules.filter((rule) => rule.ruleType === 'RUSH_FEE');
  const addOnRules = pricingRules.filter((rule) => rule.ruleType === 'ADD_ON');

  const printFees: PrintFeeLine[] = input.customizations.map((customization) => {
    const area = areaMap.get(customization.printAreaId);
    const tier = sizeTierMap.get(customization.printSizeTierId);

    if (!area || !tier) {
      throw new BadRequestError('Invalid customization payload');
    }

    const exactRule = printFeeRules.find((rule) =>
      rule.printAreaId === customization.printAreaId &&
      rule.printSizeTierId === customization.printSizeTierId
    );

    const fallbackRule = printFeeRules.find((rule) =>
      rule.printAreaId === null &&
      rule.printSizeTierId === customization.printSizeTierId
    );

    const resolvedRule = exactRule ?? fallbackRule;
    if (!resolvedRule) {
      throw new BadRequestError('Missing pricing rule for selected print area/size');
    }

    return {
      printAreaId: customization.printAreaId,
      printArea: area.label,
      printSizeTierId: customization.printSizeTierId,
      printSizeTier: tier.label,
      fee: roundCurrency(toNumber(resolvedRule.price)),
    };
  });

  const extraAreaIds = printAreaIds.slice(1);
  const extraSideLines: ExtraSideFeeLine[] = extraAreaIds.map((printAreaId) => {
    const area = areaMap.get(printAreaId);
    if (!area) {
      throw new BadRequestError('Invalid print area in extra side calculation');
    }

    const exactRule = extraSideRules.find((rule) => rule.printAreaId === printAreaId);
    const fallbackRule = extraSideRules.find((rule) => rule.printAreaId === null);
    const resolvedRule = exactRule ?? fallbackRule;

    return {
      printAreaId,
      printArea: area.label,
      fee: roundCurrency(toNumber(resolvedRule?.price ?? 0)),
    };
  });

  const basePrice = roundCurrency(toNumber(variant.price));
  const printFeeTotalPerItem = roundCurrency(
    printFees.reduce((sum, item) => sum + item.fee, 0)
  );
  const extraSideFeePerItem = roundCurrency(
    extraSideLines.reduce((sum, item) => sum + item.fee, 0)
  );
  const addOnLines: AddOnFeeLine[] = addOnIds.map((addOnId) => {
    const rule = addOnRules.find((item) => item.id === addOnId);
    if (!rule) {
      throw new BadRequestError('Selected add-on is invalid or inactive');
    }

    const minOk = rule.minQuantity == null || input.quantity >= rule.minQuantity;
    const maxOk = rule.maxQuantity == null || input.quantity <= rule.maxQuantity;
    if (!minOk || !maxOk) {
      throw new BadRequestError(`Add-on "${rule.name}" is not available for selected quantity`);
    }

    return {
      id: rule.id,
      name: rule.name,
      fee: roundCurrency(toNumber(rule.price)),
    };
  });
  const addOnFeePerItem = roundCurrency(
    addOnLines.reduce((sum, item) => sum + item.fee, 0)
  );

  const subtotal = roundCurrency(
    (basePrice + printFeeTotalPerItem + extraSideFeePerItem + addOnFeePerItem) * input.quantity
  );

  const applicableDiscountRule = quantityDiscountRules
    .filter((rule) => {
      const minOk = rule.minQuantity == null || input.quantity >= rule.minQuantity;
      const maxOk = rule.maxQuantity == null || input.quantity <= rule.maxQuantity;
      return minOk && maxOk;
    })
    .sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0))[0];

  const quantityDiscountPercent = applicableDiscountRule?.discountPercent ?? 0;
  const quantityDiscountAmount = roundCurrency(subtotal * (quantityDiscountPercent / 100));

  const rushFeeRule = pickRuleByQuantity(rushFeeRules, input.quantity)
    ?? rushFeeRules.sort((a, b) => toNumber(b.price) - toNumber(a.price))[0];
  const rushFee = input.rushOrder && rushFeeRule ? roundCurrency(toNumber(rushFeeRule.price)) : 0;

  const grandTotal = roundCurrency(subtotal - quantityDiscountAmount + rushFee);

  return {
    basePrice,
    quantity: input.quantity,
    printFees,
    printFeeTotalPerItem,
    extraSideFee: {
      appliedSides: extraAreaIds.length,
      lines: extraSideLines,
      perItem: extraSideFeePerItem,
      total: roundCurrency(extraSideFeePerItem * input.quantity),
    },
    addOnFee: {
      lines: addOnLines,
      perItem: addOnFeePerItem,
      total: roundCurrency(addOnFeePerItem * input.quantity),
    },
    subtotal,
    quantityDiscount: {
      percent: quantityDiscountPercent,
      amount: quantityDiscountAmount,
    },
    rushFee,
    grandTotal,
  };
}
