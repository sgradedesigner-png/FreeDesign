import type { FastifyInstance, FastifyRequest } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { logger, hashIdentifier } from '../lib/logger';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL) throw new Error('SUPABASE_URL is required in backend/.env');
if (!SUPABASE_ANON_KEY) throw new Error('SUPABASE_ANON_KEY is required in backend/.env');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

type RequestIdentity = {
  userId: string | null;
  guestCartId: string | null;
};

const cartItemPayloadSchema = z.object({
  cartKey: z.string().min(1).max(190),
  quantity: z.coerce.number().int().min(1).max(999),
  productId: z.string().min(1),
  productName: z.string().min(1),
  productSlug: z.string().min(1),
  productCategory: z.string().min(1),
  variantId: z.string().min(1),
  variantName: z.string().min(1),
  variantPrice: z.coerce.number().nonnegative(),
  variantOriginalPrice: z.union([z.coerce.number().nonnegative(), z.null()]).optional(),
  variantImage: z.string().min(1),
  variantSku: z.string().min(1),
  size: z.string().nullable().optional(),
  isCustomized: z.boolean().optional(),
  optionPayload: z.record(z.string(), z.unknown()).optional(),
});

const quantityPayloadSchema = z.object({
  quantity: z.coerce.number().int().min(0).max(999),
});

const mergePayloadSchema = z.object({
  guestCartId: z.string().min(8).max(128).optional(),
});

const cartInclude = {
  items: {
    orderBy: {
      updatedAt: 'desc' as const,
    },
  },
};

type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

type CartItemPayload = z.infer<typeof cartItemPayloadSchema>;

const normalizeGuestCartId = (value: unknown): string | null => {
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === 'string' && first.trim().length > 0 ? first.trim() : null;
  }

  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toOptionObject = (value: Prisma.JsonValue): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
};

const toInputJson = (value: unknown): Prisma.InputJsonValue => {
  if (value === null || value === undefined) {
    return {};
  }

  return value as Prisma.InputJsonValue;
};

const getIdentityWhere = (identity: RequestIdentity): Prisma.CartWhereInput | null => {
  if (identity.userId) {
    return {
      userId: identity.userId,
      status: 'ACTIVE',
    };
  }

  if (identity.guestCartId) {
    return {
      guestCartId: identity.guestCartId,
      status: 'ACTIVE',
    };
  }

  return null;
};

const resolveIdentity = async (request: FastifyRequest): Promise<RequestIdentity> => {
  const auth = request.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  let userId: string | null = null;

  if (token) {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      throw new Error('INVALID_AUTH_TOKEN');
    }

    userId = data.user.id;
  }

  const guestCartId = normalizeGuestCartId(request.headers['x-guest-cart-id']);

  return { userId, guestCartId };
};

const serializeCart = (cart: CartWithItems | null) => {
  if (!cart) {
    return null;
  }

  return {
    id: cart.id,
    userId: cart.userId,
    guestCartId: cart.guestCartId,
    status: cart.status,
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
    items: cart.items.map((item) => {
      const optionPayload = toOptionObject(item.optionPayload);

      return {
        id: item.id,
        cartKey: item.cartKey,
        quantity: item.quantity,
        productId: item.productId,
        productName: item.productName,
        productSlug: item.productSlug,
        productCategory: item.productCategory,
        variantId: item.variantId,
        variantName: item.variantName,
        variantPrice: Number(item.variantPrice),
        variantOriginalPrice: item.variantOriginalPrice === null ? null : Number(item.variantOriginalPrice),
        variantImage: item.variantImage,
        variantSku: item.variantSku,
        size: item.size,
        isCustomized: item.isCustomized,
        optionPayload,
        customizations: Array.isArray(optionPayload.customizations) ? optionPayload.customizations : undefined,
        addOns: Array.isArray(optionPayload.addOns) ? optionPayload.addOns : undefined,
        rushOrder: typeof optionPayload.rushOrder === 'boolean' ? optionPayload.rushOrder : undefined,
        rushFee: typeof optionPayload.rushFee === 'number' ? optionPayload.rushFee : undefined,
        addOnFees: typeof optionPayload.addOnFees === 'number' ? optionPayload.addOnFees : undefined,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    }),
  };
};

const upsertCartItem = async (cartId: string, payload: CartItemPayload) => {
  const now = new Date();

  return prisma.cartItem.upsert({
    where: {
      cartId_cartKey: {
        cartId,
        cartKey: payload.cartKey,
      },
    },
    create: {
      cartId,
      cartKey: payload.cartKey,
      quantity: payload.quantity,
      productId: payload.productId,
      productName: payload.productName,
      productSlug: payload.productSlug,
      productCategory: payload.productCategory,
      variantId: payload.variantId,
      variantName: payload.variantName,
      variantPrice: payload.variantPrice,
      variantOriginalPrice: payload.variantOriginalPrice ?? null,
      variantImage: payload.variantImage,
      variantSku: payload.variantSku,
      size: payload.size ?? null,
      isCustomized: payload.isCustomized ?? false,
      optionPayload: toInputJson(payload.optionPayload),
      updatedAt: now,
    },
    update: {
      quantity: payload.quantity,
      productName: payload.productName,
      productSlug: payload.productSlug,
      productCategory: payload.productCategory,
      variantName: payload.variantName,
      variantPrice: payload.variantPrice,
      variantOriginalPrice: payload.variantOriginalPrice ?? null,
      variantImage: payload.variantImage,
      variantSku: payload.variantSku,
      size: payload.size ?? null,
      isCustomized: payload.isCustomized ?? false,
      optionPayload: toInputJson(payload.optionPayload),
      updatedAt: now,
    },
  });
};

const getOrCreateActiveCart = async (identity: RequestIdentity): Promise<CartWithItems> => {
  const where = getIdentityWhere(identity);

  if (!where) {
    throw new Error('IDENTITY_REQUIRED');
  }

  const existing = await prisma.cart.findFirst({
    where,
    include: cartInclude,
  });

  if (existing) {
    return existing;
  }

  return prisma.cart.create({
    data: {
      userId: identity.userId,
      guestCartId: identity.userId ? null : identity.guestCartId,
      status: 'ACTIVE',
    },
    include: cartInclude,
  });
};

const loadCartByIdentity = async (identity: RequestIdentity): Promise<CartWithItems | null> => {
  const where = getIdentityWhere(identity);

  if (!where) {
    return null;
  }

  return prisma.cart.findFirst({
    where,
    include: cartInclude,
  });
};

export default async function cartRoutes(fastify: FastifyInstance) {
  fastify.get('/api/cart', async (request, reply) => {
    try {
      const identity = await resolveIdentity(request);

      if (!identity.userId && !identity.guestCartId) {
        return reply.status(400).send({ error: 'X-Guest-Cart-Id header is required for guest cart access' });
      }

      const cart = await loadCartByIdentity(identity);
      return reply.send({ cart: serializeCart(cart) });
    } catch (error: any) {
      if (error?.message === 'INVALID_AUTH_TOKEN') {
        return reply.status(401).send({ error: 'Invalid or expired token' });
      }

      logger.error({ error, requestId: request.id }, '[Cart] Failed to fetch cart');
      return reply.status(500).send({ error: 'Failed to fetch cart' });
    }
  });

  fastify.put('/api/cart/items', async (request, reply) => {
    try {
      const identity = await resolveIdentity(request);

      if (!identity.userId && !identity.guestCartId) {
        return reply.status(400).send({ error: 'X-Guest-Cart-Id header is required for guest cart access' });
      }

      const parsed = cartItemPayloadSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        });
      }

      const cart = await getOrCreateActiveCart(identity);
      await upsertCartItem(cart.id, parsed.data);

      const updatedCart = await prisma.cart.findUnique({
        where: { id: cart.id },
        include: cartInclude,
      });

      return reply.send({ cart: serializeCart(updatedCart) });
    } catch (error: any) {
      if (error?.message === 'INVALID_AUTH_TOKEN') {
        return reply.status(401).send({ error: 'Invalid or expired token' });
      }

      logger.error({ error, requestId: request.id }, '[Cart] Failed to upsert cart item');
      return reply.status(500).send({ error: 'Failed to upsert cart item' });
    }
  });

  fastify.patch('/api/cart/items/:cartKey', async (request, reply) => {
    try {
      const identity = await resolveIdentity(request);
      if (!identity.userId && !identity.guestCartId) {
        return reply.status(400).send({ error: 'X-Guest-Cart-Id header is required for guest cart access' });
      }

      const cart = await loadCartByIdentity(identity);
      if (!cart) {
        return reply.status(404).send({ error: 'Cart not found' });
      }

      const parsedBody = quantityPayloadSchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsedBody.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        });
      }

      const params = request.params as { cartKey?: string };
      const cartKey = typeof params.cartKey === 'string' ? params.cartKey.trim() : '';

      if (!cartKey) {
        return reply.status(400).send({ error: 'cartKey is required' });
      }

      if (parsedBody.data.quantity === 0) {
        const deleted = await prisma.cartItem.deleteMany({
          where: {
            cartId: cart.id,
            cartKey,
          },
        });

        if (deleted.count === 0) {
          return reply.status(404).send({ error: 'Cart item not found' });
        }
      } else {
        const updated = await prisma.cartItem.updateMany({
          where: {
            cartId: cart.id,
            cartKey,
          },
          data: {
            quantity: parsedBody.data.quantity,
            updatedAt: new Date(),
          },
        });

        if (updated.count === 0) {
          return reply.status(404).send({ error: 'Cart item not found' });
        }
      }

      const updatedCart = await prisma.cart.findUnique({
        where: { id: cart.id },
        include: cartInclude,
      });

      return reply.send({ cart: serializeCart(updatedCart) });
    } catch (error: any) {
      if (error?.message === 'INVALID_AUTH_TOKEN') {
        return reply.status(401).send({ error: 'Invalid or expired token' });
      }

      logger.error({ error, requestId: request.id }, '[Cart] Failed to update cart item quantity');
      return reply.status(500).send({ error: 'Failed to update cart item quantity' });
    }
  });

  fastify.delete('/api/cart/items/:cartKey', async (request, reply) => {
    try {
      const identity = await resolveIdentity(request);
      if (!identity.userId && !identity.guestCartId) {
        return reply.status(400).send({ error: 'X-Guest-Cart-Id header is required for guest cart access' });
      }

      const cart = await loadCartByIdentity(identity);
      if (!cart) {
        return reply.status(404).send({ error: 'Cart not found' });
      }

      const params = request.params as { cartKey?: string };
      const cartKey = typeof params.cartKey === 'string' ? params.cartKey.trim() : '';

      if (!cartKey) {
        return reply.status(400).send({ error: 'cartKey is required' });
      }

      const deleted = await prisma.cartItem.deleteMany({
        where: {
          cartId: cart.id,
          cartKey,
        },
      });

      if (deleted.count === 0) {
        return reply.status(404).send({ error: 'Cart item not found' });
      }

      const updatedCart = await prisma.cart.findUnique({
        where: { id: cart.id },
        include: cartInclude,
      });

      return reply.send({ cart: serializeCart(updatedCart) });
    } catch (error: any) {
      if (error?.message === 'INVALID_AUTH_TOKEN') {
        return reply.status(401).send({ error: 'Invalid or expired token' });
      }

      logger.error({ error, requestId: request.id }, '[Cart] Failed to delete cart item');
      return reply.status(500).send({ error: 'Failed to delete cart item' });
    }
  });

  fastify.post('/api/cart/clear', async (request, reply) => {
    try {
      const identity = await resolveIdentity(request);
      if (!identity.userId && !identity.guestCartId) {
        return reply.status(400).send({ error: 'X-Guest-Cart-Id header is required for guest cart access' });
      }

      const cart = await loadCartByIdentity(identity);
      if (!cart) {
        return reply.send({ cart: null });
      }

      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

      const updatedCart = await prisma.cart.findUnique({
        where: { id: cart.id },
        include: cartInclude,
      });

      return reply.send({ cart: serializeCart(updatedCart) });
    } catch (error: any) {
      if (error?.message === 'INVALID_AUTH_TOKEN') {
        return reply.status(401).send({ error: 'Invalid or expired token' });
      }

      logger.error({ error, requestId: request.id }, '[Cart] Failed to clear cart');
      return reply.status(500).send({ error: 'Failed to clear cart' });
    }
  });

  fastify.post('/api/cart/merge', async (request, reply) => {
    try {
      const identity = await resolveIdentity(request);
      if (!identity.userId) {
        return reply.status(401).send({ error: 'Authentication required for cart merge' });
      }

      const parsed = mergePayloadSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        });
      }

      const guestCartId = parsed.data.guestCartId ?? identity.guestCartId;
      if (!guestCartId) {
        return reply.status(400).send({ error: 'guestCartId is required for cart merge' });
      }

      const mergedCart = await prisma.$transaction(async (tx) => {
        let userCart = await tx.cart.findFirst({
          where: {
            userId: identity.userId,
            status: 'ACTIVE',
          },
          include: cartInclude,
        });

        if (!userCart) {
          userCart = await tx.cart.create({
            data: {
              userId: identity.userId,
              guestCartId: null,
              status: 'ACTIVE',
            },
            include: cartInclude,
          });
        }

        const guestCart = await tx.cart.findFirst({
          where: {
            guestCartId,
            status: 'ACTIVE',
          },
          include: cartInclude,
        });

        if (!guestCart || guestCart.items.length === 0) {
          return userCart;
        }

        const userItems = await tx.cartItem.findMany({
          where: { cartId: userCart.id },
        });

        const userItemsByKey = new Map(userItems.map((item) => [item.cartKey, item]));

        for (const guestItem of guestCart.items) {
          const existing = userItemsByKey.get(guestItem.cartKey);
          const existingOption = existing ? toOptionObject(existing.optionPayload) : {};
          const guestOption = toOptionObject(guestItem.optionPayload);

          const canMergeQuantity =
            Boolean(existing) &&
            !guestItem.isCustomized &&
            !existing?.isCustomized &&
            JSON.stringify(existingOption) === JSON.stringify(guestOption);

          if (existing && canMergeQuantity) {
            const updated = await tx.cartItem.update({
              where: { id: existing.id },
              data: {
                quantity: existing.quantity + guestItem.quantity,
                updatedAt: new Date(),
              },
            });

            userItemsByKey.set(existing.cartKey, updated);
          } else {
            const created = await tx.cartItem.create({
              data: {
                cartId: userCart.id,
                cartKey: guestItem.cartKey,
                quantity: guestItem.quantity,
                productId: guestItem.productId,
                productName: guestItem.productName,
                productSlug: guestItem.productSlug,
                productCategory: guestItem.productCategory,
                variantId: guestItem.variantId,
                variantName: guestItem.variantName,
                variantPrice: guestItem.variantPrice,
                variantOriginalPrice: guestItem.variantOriginalPrice,
                variantImage: guestItem.variantImage,
                variantSku: guestItem.variantSku,
                size: guestItem.size,
                isCustomized: guestItem.isCustomized,
                optionPayload: toInputJson(guestItem.optionPayload),
                updatedAt: new Date(),
              },
            });

            userItemsByKey.set(created.cartKey, created);
          }
        }

        await tx.cart.update({
          where: { id: guestCart.id },
          data: {
            status: 'ABANDONED',
            updatedAt: new Date(),
          },
        });

        return tx.cart.findUniqueOrThrow({
          where: { id: userCart.id },
          include: cartInclude,
        });
      });


      logger.info({
        event: 'cart_merged',
        requestId: request.id,
        userIdHash: hashIdentifier(identity.userId) ?? undefined,
        itemCount: mergedCart.items.length,
      }, '[Cart] cart_merged');
      return reply.send({ cart: serializeCart(mergedCart) });
    } catch (error: any) {
      if (error?.message === 'INVALID_AUTH_TOKEN') {
        return reply.status(401).send({ error: 'Invalid or expired token' });
      }

      logger.error({ error, requestId: request.id }, '[Cart] Failed to merge carts');
      return reply.status(500).send({ error: 'Failed to merge carts' });
    }
  });
}



