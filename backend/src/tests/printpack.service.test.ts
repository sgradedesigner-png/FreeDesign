import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../lib/prisma';
import { buildOrderPrintPack } from '../services/printpack.service';
import {
  createTestCategory,
  createTestCustomizationAsset,
  createTestOrder,
  createTestOrderItemCustomization,
  createTestPrintArea,
  createTestPrintSizeTier,
  createTestProductionStatusEvent,
  createTestProfile,
  createTestProduct,
  createTestProductVariant,
} from './helpers';

describe('Printpack Service', () => {
  let orderId: string;

  beforeEach(async () => {
    const user = await createTestProfile({
      id: 'printpack-user',
      email: 'printpack@test.com',
    });

    const category = await createTestCategory({
      id: 'printpack-category',
      slug: 'printpack-category',
    });

    const product = await createTestProduct(category.id, {
      id: 'printpack-product',
      title: 'Printpack Product',
    });

    await createTestProductVariant(product.id, {
      id: 'printpack-variant-1',
      sku: 'PRINTPACK-SKU-1',
      name: 'Variant 1',
    });
    await createTestProductVariant(product.id, {
      id: 'printpack-variant-2',
      sku: 'PRINTPACK-SKU-2',
      name: 'Variant 2',
    });

    const frontArea = await createTestPrintArea({
      id: 'printpack-front-area',
      name: 'front',
      label: 'Front',
      sortOrder: 1,
    });

    const backArea = await createTestPrintArea({
      id: 'printpack-back-area',
      name: 'back',
      label: 'Back',
      sortOrder: 2,
    });

    const sizeTier = await createTestPrintSizeTier({
      id: 'printpack-size-tier',
      name: 'M',
      label: 'Medium (20x20cm)',
    });

    const assetA = await createTestCustomizationAsset(user.id, {
      id: 'printpack-asset-a',
      originalUrl: 'https://res.cloudinary.com/test/image/upload/v1/designs/a.png',
    });

    const assetB = await createTestCustomizationAsset(user.id, {
      id: 'printpack-asset-b',
      originalUrl: 'https://res.cloudinary.com/test/image/upload/v1/designs/b.png',
    });

    const order = await createTestOrder(user.id, {
      id: 'printpack-order',
      status: 'PAID',
      paymentStatus: 'PAID',
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        productionStatus: 'PRINTING',
        isCustomOrder: true,
        items: [
          { id: 'printpack-variant-1', quantity: 1, productName: 'Printpack Product', variantName: 'Variant 1' },
          { id: 'printpack-variant-2', quantity: 2, productName: 'Printpack Product', variantName: 'Variant 2' },
        ],
      },
    });

    await createTestOrderItemCustomization({
      orderId: order.id,
      orderItemIndex: 0,
      printAreaId: frontArea.id,
      printSizeTierId: sizeTier.id,
      assetId: assetA.id,
      printFee: 5000,
      placementConfig: { offsetX: 2, offsetY: 1, scale: 1 },
    });

    await createTestOrderItemCustomization({
      orderId: order.id,
      orderItemIndex: 1,
      printAreaId: backArea.id,
      printSizeTierId: sizeTier.id,
      assetId: assetB.id,
      printFee: 7000,
      placementConfig: { offsetX: 0, offsetY: 0, scale: 1.1 },
    });

    await createTestProductionStatusEvent({
      orderId: order.id,
      fromStatus: 'NEW',
      toStatus: 'ART_CHECK',
      changedBy: 'admin-1',
    });

    await createTestProductionStatusEvent({
      orderId: order.id,
      fromStatus: 'ART_CHECK',
      toStatus: 'READY_TO_PRINT',
      changedBy: 'admin-2',
    });

    orderId = order.id;
  });

  it('should build grouped print pack payload', async () => {
    const payload = await buildOrderPrintPack(orderId);

    expect(payload.orderId).toBe(orderId);
    expect(payload.productionStatus).toBe('PRINTING');
    expect(payload.isCustomOrder).toBe(true);
    expect(payload.totalCustomizations).toBe(2);
    expect(payload.orderItemCount).toBe(2);
    expect(payload.printPack.length).toBe(2);
    expect(payload.groupedByItem['0']?.assets.length).toBe(1);
    expect(payload.groupedByItem['1']?.assets.length).toBe(1);
    expect(payload.productionEvents.length).toBe(2);
  });

  it('should throw when order is not found', async () => {
    await expect(buildOrderPrintPack('missing-order')).rejects.toThrow('Order not found');
  });
});
