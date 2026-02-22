import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { getGuestCartId } from '@/lib/cartId';
import { logger } from '@/lib/logger';
import { addBreadcrumb, captureException } from '@/lib/sentry';
import type { Product, ProductVariant } from '../data/types';

type PlacementConfig = {
  offsetX?: number;
  offsetY?: number;
  rotation?: number;
  scale?: number;
};

export type CartItemCustomization = {
  printAreaId: string;
  printAreaLabel: string;
  printSizeTierId: string;
  printSizeTierLabel: string;
  assetId: string;
  assetOriginalUrl: string;
  assetThumbnailUrl?: string | null;
  printFee: number;
  placementConfig?: PlacementConfig;
};

export type CartItemAddOn = {
  id: string;
  name: string;
  fee: number;
};

export type CartItem = {
  cartKey: string;
  quantity: number;

  productId: string;
  productName: string;
  productSlug: string;
  productCategory: string;

  variantId: string;
  variantName: string;
  variantPrice: number;
  variantOriginalPrice: number | null;
  variantImage: string;
  variantSku: string;
  size: string | null;

  isCustomized?: boolean;
  customizations?: CartItemCustomization[];
  addOns?: CartItemAddOn[];
  rushOrder?: boolean;
  rushFee?: number;
  addOnFees?: number;
  optionPayload?: Record<string, unknown>;
  // P3-04: Gang-sheet builder project reference
  builderProjectId?: string | null;
};

type CartContextValue = {
  cart: CartItem[];
  addItem: (
    productOrLegacyItem: Product | Record<string, unknown>,
    variant?: ProductVariant,
    selectedSize?: string | null
  ) => void;
  addCustomizedItem: (params: {
    product: Product;
    variant: ProductVariant;
    quantity: number;
    unitPrice: number;
    customizations: CartItemCustomization[];
    addOns?: CartItemAddOn[];
    rushOrder?: boolean;
    rushFee?: number;
    addOnFees?: number;
  }) => void;
  // P3-04: Add a builder gang-sheet project to cart
  addBuilderItem: (params: {
    product: { id: string; name: string; slug: string; category: string };
    variant: { id: string; name: string; price: number; originalPrice?: number | null; imagePath: string; sku: string };
    builderProjectId: string;
    unitPrice: number;
  }) => void;
  increaseQty: (cartKey: string) => void;
  decreaseQty: (cartKey: string) => void;
  removeItem: (cartKey: string) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

const makeCartKey = (productId: string, variantId: string, size: string | null) =>
  `${productId}__${variantId}__${size ?? 'none'}`;

const makeCustomCartKey = (productId: string, variantId: string) =>
  `${productId}__${variantId}__custom__${Date.now()}__${Math.random().toString(36).slice(2, 8)}`;

const asNumber = (value: unknown, fallback = 0): number => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const toObjectRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
};

const toCustomizations = (value: unknown): CartItemCustomization[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  return value as CartItemCustomization[];
};

const toAddOns = (value: unknown): CartItemAddOn[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  return value as CartItemAddOn[];
};

const buildOptionPayload = (item: CartItem): Record<string, unknown> => {
  if (item.optionPayload && typeof item.optionPayload === 'object') {
    return item.optionPayload;
  }

  return {
    customizations: item.customizations ?? [],
    addOns: item.addOns ?? [],
    rushOrder: item.rushOrder ?? false,
    rushFee: item.rushFee ?? 0,
    addOnFees: item.addOnFees ?? 0,
  };
};

const toCartApiPayload = (item: CartItem) => ({
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
  isCustomized: Boolean(item.isCustomized),
  optionPayload: buildOptionPayload(item),
  // P3-04: include builder project reference when present
  ...(item.builderProjectId ? { builderProjectId: item.builderProjectId } : {}),
});

const mapRemoteItem = (raw: any): CartItem => {
  const optionPayload = toObjectRecord(raw?.optionPayload);
  const customizations = toCustomizations(raw?.customizations) ?? toCustomizations(optionPayload.customizations);
  const addOns = toAddOns(raw?.addOns) ?? toAddOns(optionPayload.addOns);

  return {
    cartKey: asString(raw?.cartKey),
    quantity: Math.max(1, Math.round(asNumber(raw?.quantity, 1))),
    productId: asString(raw?.productId),
    productName: asString(raw?.productName),
    productSlug: asString(raw?.productSlug),
    productCategory: asString(raw?.productCategory),
    variantId: asString(raw?.variantId),
    variantName: asString(raw?.variantName),
    variantPrice: asNumber(raw?.variantPrice, 0),
    variantOriginalPrice: raw?.variantOriginalPrice == null ? null : asNumber(raw?.variantOriginalPrice, 0),
    variantImage: asString(raw?.variantImage),
    variantSku: asString(raw?.variantSku),
    size: raw?.size == null ? null : asString(raw?.size),
    isCustomized: Boolean(raw?.isCustomized),
    customizations,
    addOns,
    rushOrder:
      typeof raw?.rushOrder === 'boolean'
        ? raw.rushOrder
        : typeof optionPayload.rushOrder === 'boolean'
          ? Boolean(optionPayload.rushOrder)
          : undefined,
    rushFee:
      typeof raw?.rushFee === 'number'
        ? raw.rushFee
        : typeof optionPayload.rushFee === 'number'
          ? Number(optionPayload.rushFee)
          : undefined,
    addOnFees:
      typeof raw?.addOnFees === 'number'
        ? raw.addOnFees
        : typeof optionPayload.addOnFees === 'number'
          ? Number(optionPayload.addOnFees)
          : undefined,
    optionPayload,
    builderProjectId: typeof raw?.builderProjectId === 'string' ? raw.builderProjectId : null,
  };
};

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const dbCartEnabled = env.FF_CART_DB_V1;
  const cartRef = useRef<CartItem[]>([]);
  const hydratedIdentityRef = useRef<string | null>(null);
  const mergedUserRef = useRef<string | null>(null);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  const getAuthToken = useCallback(async (): Promise<string | null> => {
    if (session?.access_token) return session.access_token;

    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, [session?.access_token]);

  const requestCartApi = useCallback(async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers ?? {});
    headers.set('X-Guest-Cart-Id', getGuestCartId());

    const token = await getAuthToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${env.API_URL}${path}`, {
      ...init,
      headers,
    });

    const requestId = response.headers.get('x-request-id');

    if (!response.ok) {
      let message = 'Cart request failed';

      try {
        const payload = await response.json();
        message = payload?.error ?? payload?.message ?? message;
      } catch {
        // Ignore JSON parse failures for non-JSON responses.
      }

      const error = new Error(message) as any;
      if (requestId) {
        error.requestId = requestId;
      }

      addBreadcrumb({
        message: 'cart_api_error',
        category: 'api',
        level: 'error',
        data: { path, status: response.status, requestId },
      });

      if (response.status >= 500) {
        captureException(error, { api: { path, status: response.status } });
      }

      throw error;
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }, [getAuthToken]);

  const fetchRemoteCart = useCallback(async (): Promise<CartItem[]> => {
    const payload = await requestCartApi('/api/cart', { method: 'GET' });
    const items = Array.isArray(payload?.cart?.items) ? payload.cart.items : [];
    return items.map((item: any) => mapRemoteItem(item));
  }, [requestCartApi]);

  const upsertRemoteItem = useCallback(async (item: CartItem): Promise<void> => {
    await requestCartApi('/api/cart/items', {
      method: 'PUT',
      body: JSON.stringify(toCartApiPayload(item)),
    });
  }, [requestCartApi]);

  const patchRemoteQuantity = useCallback(async (cartKey: string, quantity: number): Promise<void> => {
    await requestCartApi(`/api/cart/items/${encodeURIComponent(cartKey)}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    });
  }, [requestCartApi]);

  const deleteRemoteItem = useCallback(async (cartKey: string): Promise<void> => {
    await requestCartApi(`/api/cart/items/${encodeURIComponent(cartKey)}`, {
      method: 'DELETE',
    });
  }, [requestCartApi]);

  const clearRemoteCart = useCallback(async (): Promise<void> => {
    await requestCartApi('/api/cart/clear', { method: 'POST' });
  }, [requestCartApi]);

  const mergeGuestCartIntoUser = useCallback(async (): Promise<void> => {
    await requestCartApi('/api/cart/merge', {
      method: 'POST',
      body: JSON.stringify({ guestCartId: getGuestCartId() }),
    });
  }, [requestCartApi]);

  useEffect(() => {
    const savedCart = localStorage.getItem('shopping-cart');
    getGuestCartId();

    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart) as CartItem[];
        setCart(parsed);
      } catch (error) {
        logger.error('Failed to load cart from localStorage:', error);
        localStorage.removeItem('shopping-cart');
      }
    }

    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    localStorage.setItem('shopping-cart', JSON.stringify(cart));
  }, [cart, isInitialized]);

  useEffect(() => {
    if (!isInitialized || !dbCartEnabled) return;

    const identityKey = user?.id ? `user:${user.id}` : `guest:${getGuestCartId()}`;
    if (hydratedIdentityRef.current === identityKey) return;

    let cancelled = false;

    const run = async () => {
      try {
        const remoteItems = await fetchRemoteCart();
        if (cancelled) return;

        if (remoteItems.length > 0) {
          hydratedIdentityRef.current = identityKey;
          setCart(remoteItems);
          return;
        }

        const localSnapshot = [...cartRef.current];
        if (localSnapshot.length > 0) {
          for (const item of localSnapshot) {
            await upsertRemoteItem(item);
          }

          const reloaded = await fetchRemoteCart();
          if (!cancelled) {
            setCart(reloaded);
          }
        }

        hydratedIdentityRef.current = identityKey;
      } catch (error) {
        logger.error('Failed to hydrate cart from backend:', error);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [isInitialized, dbCartEnabled, user?.id, fetchRemoteCart, upsertRemoteItem]);

  useEffect(() => {
    if (!isInitialized || !dbCartEnabled || !user?.id) return;
    if (mergedUserRef.current === user.id) return;

    let cancelled = false;

    const run = async () => {
      try {
        await mergeGuestCartIntoUser();
        const mergedItems = await fetchRemoteCart();
        if (!cancelled) {
          setCart(mergedItems);
          mergedUserRef.current = user.id;
          hydratedIdentityRef.current = `user:${user.id}`;
        }
      } catch (error) {
        logger.error('Failed to merge guest cart into user cart:', error);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [isInitialized, dbCartEnabled, user?.id, mergeGuestCartIntoUser, fetchRemoteCart]);

  const addItem = (product: Product, variant: ProductVariant, selectedSize: string | null = null) => {
    const cartKey = makeCartKey(product.id, variant.id, selectedSize);
    let syncedItem: CartItem | null = null;

    setCart((prev) => {
      const existing = prev.find((item) => item.cartKey === cartKey);

      if (existing) {
        const nextItem = { ...existing, quantity: existing.quantity + 1 };
        syncedItem = nextItem;

        return prev.map((item) => (item.cartKey === cartKey ? nextItem : item));
      }

      const newItem: CartItem = {
        cartKey,
        quantity: 1,
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        productCategory: product.category,
        variantId: variant.id,
        variantName: variant.name,
        variantPrice: Number(variant.price),
        variantOriginalPrice: variant.originalPrice ? Number(variant.originalPrice) : null,
        variantImage: variant.imagePath,
        variantSku: variant.sku,
        size: selectedSize,
        optionPayload: {},
      };

      syncedItem = newItem;
      return [...prev, newItem];
    });

    if (dbCartEnabled && syncedItem) {
      void upsertRemoteItem(syncedItem).catch((error) => {
        logger.error('Failed to sync addItem with backend cart:', error);
      });
    }

    toast.success(`${product.name} - ${variant.name} added to cart`);
  };

  const addCustomizedItem = (params: {
    product: Product;
    variant: ProductVariant;
    quantity: number;
    unitPrice: number;
    customizations: CartItemCustomization[];
    addOns?: CartItemAddOn[];
    rushOrder?: boolean;
    rushFee?: number;
    addOnFees?: number;
  }) => {
    const {
      product,
      variant,
      quantity,
      unitPrice,
      customizations,
      addOns = [],
      rushOrder = false,
      rushFee = 0,
      addOnFees = 0,
    } = params;

    const cartKey = makeCustomCartKey(product.id, variant.id);
    const safeQuantity = Math.max(1, Math.round(quantity));
    const safeUnitPrice = Math.max(0, Number.isFinite(unitPrice) ? unitPrice : 0);

    const optionPayload = {
      customizations,
      addOns,
      rushOrder,
      rushFee,
      addOnFees,
    };

    const newItem: CartItem = {
      cartKey,
      quantity: safeQuantity,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      productCategory: product.category,
      variantId: variant.id,
      variantName: variant.name,
      variantPrice: safeUnitPrice,
      variantOriginalPrice: variant.originalPrice ? Number(variant.originalPrice) : null,
      variantImage: variant.imagePath,
      variantSku: variant.sku,
      size: null,
      isCustomized: true,
      customizations,
      addOns,
      rushOrder,
      rushFee,
      addOnFees,
      optionPayload,
    };

    setCart((prev) => [...prev, newItem]);

    if (dbCartEnabled) {
      void upsertRemoteItem(newItem).catch((error) => {
        logger.error('Failed to sync addCustomizedItem with backend cart:', error);
      });
    }

    toast.success(`${product.name} customized item added to cart`);
  };

  // P3-04: Add a gang-sheet builder project to cart
  const addBuilderItem = (params: {
    product: { id: string; name: string; slug: string; category: string };
    variant: { id: string; name: string; price: number; originalPrice?: number | null; imagePath: string; sku: string };
    builderProjectId: string;
    unitPrice: number;
  }) => {
    const { product, variant, builderProjectId, unitPrice } = params;
    const cartKey = `${product.id}__${variant.id}__builder__${builderProjectId}`;
    const safeUnitPrice = Math.max(0, Number.isFinite(unitPrice) ? unitPrice : 0);

    const newItem: CartItem = {
      cartKey,
      quantity: 1,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      productCategory: product.category,
      variantId: variant.id,
      variantName: variant.name,
      variantPrice: safeUnitPrice,
      variantOriginalPrice: variant.originalPrice != null ? Number(variant.originalPrice) : null,
      variantImage: variant.imagePath,
      variantSku: variant.sku,
      size: null,
      isCustomized: true,
      builderProjectId,
      optionPayload: { builderProjectId },
    };

    setCart((prev) => [...prev, newItem]);

    if (dbCartEnabled) {
      void upsertRemoteItem(newItem).catch((error) => {
        logger.error('Failed to sync addBuilderItem with backend cart:', error);
      });
    }

    toast.success(`${product.name} gang sheet added to cart`);
  };

  const increaseQty = (cartKey: string) => {
    let updatedItem: CartItem | null = null;

    setCart((prev) =>
      prev.map((item) => {
        if (item.cartKey !== cartKey) return item;
        updatedItem = { ...item, quantity: item.quantity + 1 };
        return updatedItem;
      })
    );

    if (dbCartEnabled && updatedItem) {
      void patchRemoteQuantity(cartKey, updatedItem.quantity).catch((error) => {
        logger.error('Failed to sync quantity increase with backend cart:', error);
      });
    }
  };

  const decreaseQty = (cartKey: string) => {
    let nextQuantity: number | null = null;
    let removed = false;

    setCart((prev) => {
      const item = prev.find((entry) => entry.cartKey === cartKey);
      if (!item) return prev;

      if (item.quantity === 1) {
        removed = true;
        toast.error(`${item.productName} removed from cart`);
        return prev.filter((entry) => entry.cartKey !== cartKey);
      }

      nextQuantity = item.quantity - 1;
      return prev.map((entry) =>
        entry.cartKey === cartKey
          ? { ...entry, quantity: entry.quantity - 1 }
          : entry
      );
    });

    if (!dbCartEnabled) return;

    if (removed) {
      void deleteRemoteItem(cartKey).catch((error) => {
        logger.error('Failed to sync item removal with backend cart:', error);
      });
      return;
    }

    if (nextQuantity !== null) {
      void patchRemoteQuantity(cartKey, nextQuantity).catch((error) => {
        logger.error('Failed to sync quantity decrease with backend cart:', error);
      });
    }
  };

  const removeItem = (cartKey: string) => {
    setCart((prev) => {
      const item = prev.find((entry) => entry.cartKey === cartKey);
      if (item) {
        toast.error(`${item.productName} removed from cart`);
      }
      return prev.filter((entry) => entry.cartKey !== cartKey);
    });

    if (dbCartEnabled) {
      void deleteRemoteItem(cartKey).catch((error) => {
        logger.error('Failed to sync removeItem with backend cart:', error);
      });
    }
  };

  const clearCart = () => {
    setCart([]);

    if (dbCartEnabled) {
      void clearRemoteCart().catch((error) => {
        logger.error('Failed to sync clearCart with backend cart:', error);
      });
    }
  };

  const cartCount = useMemo(() => cart.reduce((acc, item) => acc + item.quantity, 0), [cart]);
  const cartTotal = useMemo(() => cart.reduce((acc, item) => acc + item.variantPrice * item.quantity, 0), [cart]);

  return (
    <CartContext.Provider
      value={{
        cart,
        addItem,
        addCustomizedItem,
        addBuilderItem,
        increaseQty,
        decreaseQty,
        removeItem,
        clearCart,
        cartCount,
        cartTotal,
        isCartOpen,
        setIsCartOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
