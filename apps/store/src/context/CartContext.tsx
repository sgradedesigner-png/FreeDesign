import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import type { Product } from '../data/products';

type CartItem = Product & {
  cartKey: string;
  quantity: number;
  color: string | null;
  size: string | null;
};

type CartContextValue = {
  cart: CartItem[];

  // ✅ New: add item (initial add)
  addItem: (product: Product, selectedColor?: string | null, selectedSize?: string | null) => void;

  // ✅ New: quantity controls by cartKey
  increaseQty: (cartKey: string) => void;
  decreaseQty: (cartKey: string) => void;

  // ✅ New: remove item
  removeItem: (cartKey: string) => void;

  cartCount: number;
  cartTotal: number;

  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

const makeCartKey = (id: string, color: string | null, size: string | null) =>
  `${id}__${color ?? 'none'}__${size ?? 'none'}`;

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // LocalStorage-оос сэргээх
  useEffect(() => {
    const savedCart = localStorage.getItem('shopping-cart');
    if (!savedCart) return;

    const parsed = JSON.parse(savedCart) as any[];

    const normalized: CartItem[] = parsed.map((i) => {
      const color = i.color ?? null;
      const size = i.size ?? null;
      return {
        ...i,
        color,
        size,
        cartKey: i.cartKey ?? makeCartKey(i.id, color, size),
      };
    });

    setCart(normalized);
  }, []);

  // LocalStorage-д хадгалах
  useEffect(() => {
    localStorage.setItem('shopping-cart', JSON.stringify(cart));
  }, [cart]);

  // ✅ Add new item (or increase if exists)
  const addItem = (product: Product, selectedColor: string | null = null, selectedSize: string | null = null) => {
    const cartKey = makeCartKey(product.id, selectedColor, selectedSize);

    setCart((prev) => {
      const existing = prev.find((i) => i.cartKey === cartKey);

      if (existing) {
        return prev.map((i) => (i.cartKey === cartKey ? { ...i, quantity: i.quantity + 1 } : i));
      }

      const newItem: CartItem = {
        ...product,
        cartKey,
        quantity: 1,
        color: selectedColor,
        size: selectedSize,
      };

      return [...prev, newItem];
    });

    toast.success(`${product.name} сагсанд нэмэгдлээ!`);
  };

  // ✅ Increase qty (no “added” toast, optional: message)
  const increaseQty = (cartKey: string) => {
    setCart((prev) =>
      prev.map((i) => (i.cartKey === cartKey ? { ...i, quantity: i.quantity + 1 } : i))
    );
    // хүсвэл: toast.message('Тоо нэмэгдлээ');
  };

  // ✅ Decrease qty (if becomes 0 -> remove)
 const decreaseQty = (cartKey: string) => {
  setCart((prev) => {
    const item = prev.find((i) => i.cartKey === cartKey);
    if (!item) return prev;

    // 1 байхад → устгана + toast
    if (item.quantity === 1) {
      toast.error(`${item.name} сагснаас хасагдлаа`);
      return prev.filter((i) => i.cartKey !== cartKey);
    }

    // 2+ байхад → тоо буурна + message
    toast.message(`${item.name} тоо буурлаа`);

    return prev.map((i) =>
      i.cartKey === cartKey
        ? { ...i, quantity: i.quantity - 1 }
        : i
    );
  });
};


  // ✅ Remove item
  const removeItem = (cartKey: string) => {
    setCart((prev) => prev.filter((i) => i.cartKey !== cartKey));
    toast.error('Бараа сагснаас хасагдлаа');
  };

  const cartCount = useMemo(() => cart.reduce((acc, item) => acc + item.quantity, 0), [cart]);
  const cartTotal = useMemo(() => cart.reduce((acc, item) => acc + item.price * item.quantity, 0), [cart]);

  return (
    <CartContext.Provider
      value={{
        cart,
        addItem,
        increaseQty,
        decreaseQty,
        removeItem,
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
