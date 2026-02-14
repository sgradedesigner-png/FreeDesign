import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../lib/prisma';
import { calculatePriceQuote } from '../services/pricing.service';
import {
  createTestCategory,
  createTestPrintArea,
  createTestPrintSizeTier,
  createTestPricingRule,
  createTestProduct,
  createTestProductPrintArea,
  createTestProductVariant,
} from './helpers';

describe('Pricing Service', () => {
  let variantId: string;
  let frontAreaId: string;
  let backAreaId: string;
  let sizeTierId: string;
  let addOnPolybagId: string;
  let addOnLabelId: string;

  beforeEach(async () => {
    const category = await createTestCategory({
      id: 'pricing-category',
      slug: 'pricing-category',
    });

    const product = await createTestProduct(category.id, {
      id: 'pricing-product',
      title: 'Pricing Product',
    });

    await prisma.product.update({
      where: { id: product.id },
      data: { isCustomizable: true },
    });

    const variant = await createTestProductVariant(product.id, {
      id: 'pricing-variant',
      price: 10000,
      sku: 'PRICING-SKU-001',
    });

    const frontArea = await createTestPrintArea({
      id: 'pricing-front-area',
      name: 'front',
      label: 'Front',
      sortOrder: 1,
    });

    const backArea = await createTestPrintArea({
      id: 'pricing-back-area',
      name: 'back',
      label: 'Back',
      sortOrder: 2,
    });

    const sizeTier = await createTestPrintSizeTier({
      id: 'pricing-size-s',
      name: 'S',
      label: 'Small (15x15cm)',
    });

    await createTestProductPrintArea(product.id, frontArea.id, true);
    await createTestProductPrintArea(product.id, backArea.id, false);

    await createTestPricingRule({
      id: 'pricing-rule-front-s',
      name: 'PRINT_FEE_FRONT_S',
      ruleType: 'PRINT_FEE',
      printAreaId: frontArea.id,
      printSizeTierId: sizeTier.id,
      price: 5000,
    });

    await createTestPricingRule({
      id: 'pricing-rule-back-s',
      name: 'PRINT_FEE_BACK_S',
      ruleType: 'PRINT_FEE',
      printAreaId: backArea.id,
      printSizeTierId: sizeTier.id,
      price: 7000,
    });

    await createTestPricingRule({
      id: 'pricing-rule-extra-side',
      name: 'EXTRA_SIDE_FEE_DEFAULT',
      ruleType: 'EXTRA_SIDE',
      price: 2000,
    });

    await createTestPricingRule({
      id: 'pricing-rule-discount',
      name: 'QTY_DISCOUNT_10_PLUS',
      ruleType: 'QUANTITY_DISCOUNT',
      minQuantity: 10,
      discountPercent: 10,
      price: 0,
    });

    await createTestPricingRule({
      id: 'pricing-rule-rush-1-9',
      name: 'RUSH_ORDER_FEE_1_9',
      ruleType: 'RUSH_FEE',
      price: 3000,
      minQuantity: 1,
      maxQuantity: 9,
    });

    await createTestPricingRule({
      id: 'pricing-rule-rush-10-plus',
      name: 'RUSH_ORDER_FEE_10_PLUS',
      ruleType: 'RUSH_FEE',
      price: 8000,
      minQuantity: 10,
      maxQuantity: null,
    });

    const addOnPolybag = await createTestPricingRule({
      id: 'pricing-rule-addon-polybag',
      name: 'ADD_ON_POLYBAG',
      ruleType: 'ADD_ON',
      price: 1500,
    });

    const addOnLabel = await createTestPricingRule({
      id: 'pricing-rule-addon-neck-label',
      name: 'ADD_ON_NECK_LABEL',
      ruleType: 'ADD_ON',
      price: 2500,
    });

    variantId = variant.id;
    frontAreaId = frontArea.id;
    backAreaId = backArea.id;
    sizeTierId = sizeTier.id;
    addOnPolybagId = addOnPolybag.id;
    addOnLabelId = addOnLabel.id;
  });

  it('should calculate single-area quote without extra-side fee', async () => {
    const breakdown = await calculatePriceQuote({
      variantId,
      customizations: [
        { printAreaId: frontAreaId, printSizeTierId: sizeTierId },
      ],
      addOnIds: [],
      quantity: 1,
      rushOrder: false,
    });

    expect(breakdown.basePrice).toBe(10000);
    expect(breakdown.printFeeTotalPerItem).toBe(5000);
    expect(breakdown.extraSideFee.appliedSides).toBe(0);
    expect(breakdown.extraSideFee.perItem).toBe(0);
    expect(breakdown.addOnFee.perItem).toBe(0);
    expect(breakdown.subtotal).toBe(15000);
    expect(breakdown.quantityDiscount.amount).toBe(0);
    expect(breakdown.rushFee).toBe(0);
    expect(breakdown.grandTotal).toBe(15000);
  });

  it('should apply add-ons, extra-side fee, quantity discount, and quantity-tiered rush fee', async () => {
    const breakdown = await calculatePriceQuote({
      variantId,
      customizations: [
        { printAreaId: frontAreaId, printSizeTierId: sizeTierId },
        { printAreaId: backAreaId, printSizeTierId: sizeTierId },
      ],
      addOnIds: [addOnPolybagId, addOnLabelId],
      quantity: 10,
      rushOrder: true,
    });

    expect(breakdown.printFeeTotalPerItem).toBe(12000);
    expect(breakdown.extraSideFee.appliedSides).toBe(1);
    expect(breakdown.extraSideFee.perItem).toBe(2000);
    expect(breakdown.extraSideFee.total).toBe(20000);
    expect(breakdown.addOnFee.perItem).toBe(4000);
    expect(breakdown.addOnFee.total).toBe(40000);
    expect(breakdown.subtotal).toBe(280000);
    expect(breakdown.quantityDiscount.percent).toBe(10);
    expect(breakdown.quantityDiscount.amount).toBe(28000);
    expect(breakdown.rushFee).toBe(8000);
    expect(breakdown.grandTotal).toBe(260000);
  });

  it('should reject print areas that are not configured on product', async () => {
    const sleeveArea = await createTestPrintArea({
      id: 'pricing-sleeve-area',
      name: 'sleeve',
      label: 'Sleeve',
      sortOrder: 3,
    });

    await expect(
      calculatePriceQuote({
        variantId,
        customizations: [
          { printAreaId: sleeveArea.id, printSizeTierId: sizeTierId },
        ],
        addOnIds: [],
        quantity: 1,
        rushOrder: false,
      })
    ).rejects.toThrow('Selected print area is not enabled for this product');
  });

  it('should reject invalid add-on id', async () => {
    await expect(
      calculatePriceQuote({
        variantId,
        customizations: [
          { printAreaId: frontAreaId, printSizeTierId: sizeTierId },
        ],
        addOnIds: ['f36ea535-8cb6-4a3d-9935-c6f6704f8c1f'],
        quantity: 1,
        rushOrder: false,
      })
    ).rejects.toThrow('Selected add-on is invalid or inactive');
  });
});
