import { describe, it, expect } from 'vitest';
import { prisma } from '../lib/prisma';

describe('Cart Schema Contracts', () => {
  it('enforces unique (cart_id, cart_key) for cart items', async () => {
    const cart = await prisma.cart.create({
      data: {
        guestCartId: 'guest-cart-contract',
        status: 'ACTIVE',
      },
    });

    const baseItem = {
      cartId: cart.id,
      cartKey: 'dup-key',
      quantity: 1,
      productId: 'p1',
      productName: 'Test Product',
      productSlug: 'test-product',
      productCategory: 'test',
      variantId: 'v1',
      variantName: 'Variant',
      variantPrice: 99,
      variantOriginalPrice: null,
      variantImage: '/x.png',
      variantSku: 'SKU',
      size: null,
      isCustomized: false,
      optionPayload: {},
    } as const;

    await prisma.cartItem.create({ data: baseItem });

    await expect(prisma.cartItem.create({ data: baseItem })).rejects.toThrow();
  });
});
