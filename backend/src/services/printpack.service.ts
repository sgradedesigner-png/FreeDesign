import { prisma } from '../lib/prisma';
import { NotFoundError } from '../utils/errors';

type PrintPackLine = {
  customizationId: string;
  orderItemIndex: number;
  printAreaId: string;
  printArea: string;
  printSizeTierId: string;
  printSizeTier: string;
  designUrl: string;
  thumbnailUrl: string | null;
  widthPx: number | null;
  heightPx: number | null;
  placementConfig: unknown;
  printFee: unknown;
  createdAt: Date;
};

export async function buildOrderPrintPack(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customizations: {
        include: {
          printArea: true,
          printSizeTier: true,
          asset: true,
        },
        orderBy: [
          { orderItemIndex: 'asc' },
          { createdAt: 'asc' },
        ],
      },
      productionEvents: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  const itemSnapshots = Array.isArray(order.items) ? (order.items as Record<string, unknown>[]) : [];

  const printPack: PrintPackLine[] = order.customizations.map((item) => ({
    customizationId: item.id,
    orderItemIndex: item.orderItemIndex,
    printAreaId: item.printAreaId,
    printArea: item.printArea.label,
    printSizeTierId: item.printSizeTierId,
    printSizeTier: item.printSizeTier.label,
    designUrl: item.asset.originalUrl,
    thumbnailUrl: item.asset.thumbnailUrl,
    widthPx: item.asset.widthPx,
    heightPx: item.asset.heightPx,
    placementConfig: item.placementConfig,
    printFee: item.printFee,
    createdAt: item.createdAt,
  }));

  const groupedByItem = printPack.reduce<Record<string, { snapshot: unknown; assets: PrintPackLine[] }>>(
    (acc, row) => {
      const key = String(row.orderItemIndex);
      if (!acc[key]) {
        acc[key] = {
          snapshot: itemSnapshots[row.orderItemIndex] ?? null,
          assets: [],
        };
      }

      acc[key].assets.push(row);
      return acc;
    },
    {}
  );

  return {
    orderId: order.id,
    productionStatus: order.productionStatus,
    paymentStatus: order.paymentStatus,
    isCustomOrder: order.isCustomOrder,
    generatedAt: new Date().toISOString(),
    totalCustomizations: printPack.length,
    orderItemCount: itemSnapshots.length,
    printPack,
    groupedByItem,
    productionEvents: order.productionEvents,
  };
}
