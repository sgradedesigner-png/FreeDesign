import { describe, expect, it } from 'vitest';
import {
  deriveOrderStatusForProductionStatus,
  getAllowedProductionTransitions,
  getDefaultStatusCounts,
  isTransitionAllowed,
  productionStatuses,
} from '../services/production.service';

describe('Production Service', () => {
  it('should return zero-initialized status counts', () => {
    const counts = getDefaultStatusCounts();

    for (const status of productionStatuses) {
      expect(counts[status]).toBe(0);
    }
  });

  it('should allow and reject transitions according to pipeline rules', () => {
    expect(isTransitionAllowed('NEW', 'ART_CHECK')).toBe(true);
    expect(isTransitionAllowed('ART_CHECK', 'READY_TO_PRINT')).toBe(true);
    expect(isTransitionAllowed('PACKED', 'SHIPPED')).toBe(true);

    expect(isTransitionAllowed('NEW', 'PRINTING')).toBe(false);
    expect(isTransitionAllowed('DONE', 'NEW')).toBe(false);
  });

  it('should expose next transitions for each stage', () => {
    expect(getAllowedProductionTransitions('NEW')).toEqual(['ART_CHECK']);
    expect(getAllowedProductionTransitions('SHIPPED')).toEqual(['PACKED', 'DONE']);
  });

  it('should derive order status for shipping milestones', () => {
    expect(deriveOrderStatusForProductionStatus('SHIPPED')).toBe('SHIPPED');
    expect(deriveOrderStatusForProductionStatus('DONE')).toBe('COMPLETED');
    expect(deriveOrderStatusForProductionStatus('QC')).toBeUndefined();
  });
});
