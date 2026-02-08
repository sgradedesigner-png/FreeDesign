import { describe, it, expect } from 'vitest';
import { createOrderSchema } from '../schemas/order.schema';
import { updateProfileSchema } from '../schemas/user.schema';
import { validateData } from '../utils/validation';

describe('Input Validation', () => {
  describe('Order Validation', () => {
    it('should accept valid order data', () => {
      const validOrder = {
        items: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            quantity: 2,
            price: 10000
          }
        ],
        shippingAddress: {
          fullName: 'Test User',
          phone: '99999999',
          city: 'Ulaanbaatar',
          district: 'Bayanzurkh',
          address: '123 Test Street'
        },
        total: 20000
      };

      const result = validateData(createOrderSchema, validOrder);
      expect(result.success).toBe(true);
    });

    it('should reject order with invalid UUID', () => {
      const invalidOrder = {
        items: [
          {
            id: 'not-a-uuid',
            quantity: 2,
            price: 10000
          }
        ],
        shippingAddress: {
          fullName: 'Test User',
          phone: '99999999',
          city: 'Ulaanbaatar',
          district: 'Bayanzurkh',
          address: '123 Test Street'
        },
        total: 20000
      };

      const result = validateData(createOrderSchema, invalidOrder);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.details[0].field).toContain('items');
        expect(result.error.details[0].message).toContain('Invalid');
      }
    });

    it('should reject order with negative quantity', () => {
      const invalidOrder = {
        items: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            quantity: -1,
            price: 10000
          }
        ],
        shippingAddress: {
          fullName: 'Test User',
          phone: '99999999',
          city: 'Ulaanbaatar',
          district: 'Bayanzurkh',
          address: '123 Test Street'
        },
        total: 20000
      };

      const result = validateData(createOrderSchema, invalidOrder);
      expect(result.success).toBe(false);
    });

    it('should reject order with invalid phone number', () => {
      const invalidOrder = {
        items: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            quantity: 1,
            price: 10000
          }
        ],
        shippingAddress: {
          fullName: 'Test User',
          phone: '123', // Too short
          city: 'Ulaanbaatar',
          district: 'Bayanzurkh',
          address: '123 Test Street'
        },
        total: 10000
      };

      const result = validateData(createOrderSchema, invalidOrder);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.details[0].message).toContain('phone');
      }
    });

    it('should reject order with too many items', () => {
      const items = Array.from({ length: 51 }, (_, i) => ({
        id: '550e8400-e29b-41d4-a716-446655440000',
        quantity: 1,
        price: 100
      }));

      const invalidOrder = {
        items,
        shippingAddress: {
          fullName: 'Test User',
          phone: '99999999',
          city: 'Ulaanbaatar',
          district: 'Bayanzurkh',
          address: '123 Test Street'
        },
        total: 5100
      };

      const result = validateData(createOrderSchema, invalidOrder);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.details[0].message).toContain('Too many');
      }
    });
  });

  describe('Profile Validation', () => {
    it('should accept valid profile update', () => {
      const validUpdate = {
        fullName: 'Updated Name',
        phone: '88888888'
      };

      const result = validateData(updateProfileSchema, validUpdate);
      expect(result.success).toBe(true);
    });

    it('should reject profile with invalid phone', () => {
      const invalidUpdate = {
        fullName: 'Updated Name',
        phone: 'abc12345' // Contains letters
      };

      const result = validateData(updateProfileSchema, invalidUpdate);
      expect(result.success).toBe(false);
    });

    it('should trim whitespace from inputs', () => {
      const updateWithWhitespace = {
        fullName: '  Test User  '
      };

      const result = validateData(updateProfileSchema, updateWithWhitespace);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fullName).toBe('Test User');
      }
    });
  });
});
