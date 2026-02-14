export const productionStatuses = [
  'NEW',
  'ART_CHECK',
  'READY_TO_PRINT',
  'PRINTING',
  'QC',
  'PACKED',
  'SHIPPED',
  'DONE',
] as const;

export type ProductionStatus = (typeof productionStatuses)[number];

const transitionMap: Record<ProductionStatus, ProductionStatus[]> = {
  NEW: ['ART_CHECK'],
  ART_CHECK: ['NEW', 'READY_TO_PRINT'],
  READY_TO_PRINT: ['ART_CHECK', 'PRINTING'],
  PRINTING: ['READY_TO_PRINT', 'QC'],
  QC: ['PRINTING', 'PACKED'],
  PACKED: ['QC', 'SHIPPED'],
  SHIPPED: ['PACKED', 'DONE'],
  DONE: [],
};

export function getAllowedProductionTransitions(status: ProductionStatus): ProductionStatus[] {
  return transitionMap[status];
}

export function isTransitionAllowed(fromStatus: ProductionStatus, toStatus: ProductionStatus): boolean {
  if (fromStatus === toStatus) return true;
  return transitionMap[fromStatus].includes(toStatus);
}

export function deriveOrderStatusForProductionStatus(status: ProductionStatus) {
  if (status === 'SHIPPED') return 'SHIPPED' as const;
  if (status === 'DONE') return 'COMPLETED' as const;
  return undefined;
}

export function getDefaultStatusCounts() {
  return productionStatuses.reduce<Record<ProductionStatus, number>>((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {} as Record<ProductionStatus, number>);
}
