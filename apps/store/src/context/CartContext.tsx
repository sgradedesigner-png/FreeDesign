import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import type { Product, ProductVariant } from '../data/types';
import { logger } from '@/lib/logger';

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

type CartItem = {
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
};

type CartContextValue = {
  cart: CartItem[];
  addItem: (product: Product, variant: ProductVariant, selectedSize?: string | null) => void;
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

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const savedCart = localStorage.getItem('shopping-cart');

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

  const addItem = (product: Product, variant: ProductVariant, selectedSize: string | null = null) => {
    const cartKey = makeCartKey(product.id, variant.id, selectedSize);

    setCart((prev) => {
      const existing = prev.find((item) => item.cartKey === cartKey);

      if (existing) {
        return prev.map((item) =>
          item.cartKey === cartKey ? { ...item, quantity: item.quantity + 1 } : item
        );
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
      };

      return [...prev, newItem];
    });

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
    };

    setCart((prev) => [...prev, newItem]);
    toast.success(`${product.name} customized item added to cart`);
  };

  const increaseQty = (cartKey: string) => {
    setCart((prev) =>
      prev.map((item) => (item.cartKey === cartKey ? { ...item, quantity: item.quantity + 1 } : item))
    );
  };

  const decreaseQty = (cartKey: string) => {
    setCart((prev) => {
      const item = prev.find((entry) => entry.cartKey === cartKey);
      if (!item) return prev;

      if (item.quantity === 1) {
        toast.error(`${item.productName} removed from cart`);
        return prev.filter((entry) => entry.cartKey !== cartKey);
      }

      return prev.map((entry) =>
        entry.cartKey === cartKey
          ? { ...entry, quantity: entry.quantity - 1 }
          : entry
      );
    });
  };

  const removeItem = (cartKey: string) => {
    setCart((prev) => {
      const item = prev.find((entry) => entry.cartKey === cartKey);
      if (item) {
        toast.error(`${item.productName} removed from cart`);
      }
      return prev.filter((entry) => entry.cartKey !== cartKey);
    });
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartCount = useMemo(() => cart.reduce((acc, item) => acc + item.quantity, 0), [cart]);
  const cartTotal = useMemo(() => cart.reduce((acc, item) => acc + item.variantPrice * item.quantity, 0), [cart]);

  return (
    <CartContext.Provider
      value={{
        cart,
        addItem,
        addCustomizedItem,
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
