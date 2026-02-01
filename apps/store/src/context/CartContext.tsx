import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner'; // Гоё мэдэгдэл харуулах
import type { Product } from '../data/products';

type CartItem = Product & {
  cartKey: string;
  quantity: number;
  color: string | null;
  size: string | null;
};

type CartContextValue = {
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number, selectedColor?: string | null, selectedSize?: string | null) => void;
  removeFromCart: (cartKey: string) => void;
  cartCount: number;
  cartTotal: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);
const makeCartKey = (id: string, color: string | null, size: string | null) =>
  `${id}__${color ?? "none"}__${size ?? "none"}`;

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // LocalStorage-оос сагсаа сэргээх
  useEffect(() => {
    const savedCart = localStorage.getItem('shopping-cart');
    if (savedCart) {
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
    }
  }, []);

  // Сагс өөрчлөгдөх бүрт хадгалах
  useEffect(() => {
    localStorage.setItem('shopping-cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (
    product: Product, 
    quantity = 1, 
    selectedColor: string | null = null,
    selectedSize: string | null =null
  ) => {
     const cartKey = makeCartKey(product.id, selectedColor, selectedSize);
    //console.log("ADD_TO_CART size =", selectedSize);
    setCart((prev) => {
     const existing = prev.find((i) => i.cartKey === cartKey);

      if (existing) {
        return prev.map((i) =>
       i.cartKey === cartKey ? {...i, quantity: i.quantity + quantity} : i
      );
      }
     
    const newItem: CartItem = {
      ...product,
      cartKey,
      quantity,
      color: selectedColor,
      size: selectedSize,
    };
      return [...prev, newItem];
      

    });
    //console.log("ADD_TO_CART size =", selectedSize);
    toast.success(`${product.name} сагсанд нэмэгдлээ!`);
  };

  const removeFromCart = (cartKey: string) => {
    setCart((prev) => prev.filter((item) => item.cartKey !== cartKey));
    toast.error('Бараа сагснаас хасагдлаа');
  };

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const cartTotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
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
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
