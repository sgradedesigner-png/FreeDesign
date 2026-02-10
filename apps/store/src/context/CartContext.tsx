import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import type { Product, ProductVariant } from '../data/types';
import { logger } from '@/lib/logger';

type CartItem = {
  cartKey: string;
  quantity: number;

  // Product info
  productId: string;
  productName: string;
  productSlug: string;
  productCategory: string;

  // Variant info
  variantId: string;
  variantName: string;
  variantPrice: number;
  variantOriginalPrice: number | null;
  variantImage: string;
  variantSku: string;

  // Size selection
  size: string | null;
};

type CartContextValue = {
  cart: CartItem[];

  // Add item with variant information
  addItem: (product: Product, variant: ProductVariant, selectedSize?: string | null) => void;

  // Quantity controls by cartKey
  increaseQty: (cartKey: string) => void;
  decreaseQty: (cartKey: string) => void;

  // Remove item
  removeItem: (cartKey: string) => void;

  // Clear all items
  clearCart: () => void;

  cartCount: number;
  cartTotal: number;

  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

const makeCartKey = (productId: string, variantId: string, size: string | null) =>
  `${productId}__${variantId}__${size ?? 'none'}`;

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // LocalStorage-оос сэргээх (mount хийхэд 1 удаа)
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

    // Loading дууссан гэж тэмдэглэх
    setIsInitialized(true);
  }, []);

  // LocalStorage-д хадгалах (initialized болсны дараа л)
  useEffect(() => {
    // Initialized болтол бүү хадгала (race condition сэргийлэх)
    if (!isInitialized) return;

    localStorage.setItem('shopping-cart', JSON.stringify(cart));
  }, [cart, isInitialized]);

  // Add new item (or increase if exists)
  const addItem = (product: Product, variant: ProductVariant, selectedSize: string | null = null) => {
    const cartKey = makeCartKey(product.id, variant.id, selectedSize);

    setCart((prev) => {
      const existing = prev.find((i) => i.cartKey === cartKey);

      if (existing) {
        return prev.map((i) => (i.cartKey === cartKey ? { ...i, quantity: i.quantity + 1 } : i));
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
        variantPrice: Number(variant.price), // Convert Decimal/string to number
        variantOriginalPrice: variant.originalPrice ? Number(variant.originalPrice) : null,
        variantImage: variant.imagePath,
        variantSku: variant.sku,
        size: selectedSize,
      };

      return [...prev, newItem];
    });

    toast.success(`${product.name} - ${variant.name} сагсанд нэмэгдлээ!`);
  };

  // ✅ Increase qty (no “added” toast, optional: message)
  const increaseQty = (cartKey: string) => {
    setCart((prev) =>
      prev.map((i) => (i.cartKey === cartKey ? { ...i, quantity: i.quantity + 1 } : i))
    );
    // хүсвэл: toast.message('Тоо нэмэгдлээ');
  };

  // Decrease qty (if becomes 0 -> remove)
  const decreaseQty = (cartKey: string) => {
    setCart((prev) => {
      const item = prev.find((i) => i.cartKey === cartKey);
      if (!item) return prev;

      // 1 байхад → устгана + toast
      if (item.quantity === 1) {
        toast.error(`${item.productName} - ${item.variantName} сагснаас хасагдлаа`);
        return prev.filter((i) => i.cartKey !== cartKey);
      }

      // 2+ байхад → тоо буурна + message
      toast.message(`${item.productName} - ${item.variantName} тоо буурлаа`);

      return prev.map((i) =>
        i.cartKey === cartKey
          ? { ...i, quantity: i.quantity - 1 }
          : i
      );
    });
  };


  // Remove item
  const removeItem = (cartKey: string) => {
    setCart((prev) => {
      const item = prev.find((i) => i.cartKey === cartKey);
      if (item) {
        toast.error(`${item.productName} - ${item.variantName} сагснаас хасагдлаа`);
      }
      return prev.filter((i) => i.cartKey !== cartKey);
    });
  };

  // Clear all items from cart
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
