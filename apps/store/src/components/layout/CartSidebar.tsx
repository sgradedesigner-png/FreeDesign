import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useTheme } from '../../context/ThemeContext';
import { useMemo } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { r2Url } from "@/lib/r2"; // 1. Added this import

const PLACEHOLDER_IMG = 'https://placehold.co/800x1000/png?text=No+Image'; // 2. Added placeholder

const colorLabel = (color: string | null) => {
  if (!color) return 'Color';
  const c = color.toLowerCase();
  if (c === '#000000' || c === 'black') return 'Black';
  if (c === '#ffffff' || c === 'white') return 'White';
  if (c === '#333333') return 'Charcoal';
  return color;
};

export default function CartSidebar() {
  const { cart, isCartOpen, setIsCartOpen, removeFromCart, addToCart, cartTotal } = useCart();
  const { language } = useTheme();

  const groupedCart = useMemo(() => {
    const products = new Map<
      string,
      {
        product: typeof cart[number];
        colors: Map<string, Map<string, typeof cart[number]>>;
      }
    >();

    for (const item of cart) {
      const productId = item.id;
      const colorKey = item.color ?? 'none';
      const sizeKey = item.size ?? 'none';

      if (!products.has(productId)) {
        products.set(productId, { product: item, colors: new Map() });
      }

      const entry = products.get(productId)!;
      if (!entry.colors.has(colorKey)) {
        entry.colors.set(colorKey, new Map());
      }
      entry.colors.get(colorKey)!.set(sizeKey, item);
    }

    return Array.from(products.values());
  }, [cart]);

  return (
    <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md bg-white/80 dark:bg-[#0B1120]/80 backdrop-blur-xl border-l border-white/20 dark:border-white/10 shadow-2xl h-full flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-black/5 dark:border-white/5">
          <h2 className="text-xl font-heading font-bold text-foreground flex items-center gap-2">
            <ShoppingBag className="text-primary" size={22} />
            {language === 'mn' ? 'Таны Сагс' : 'Your Cart'}
            <span className="text-sm font-medium text-muted-foreground bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-full">
              {cart.length}
            </span>
          </h2>
          <button
            onClick={() => setIsCartOpen(false)}
            className="group p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-90"
          >
            <X size={20} className="text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full"></div>
                <div className="relative w-20 h-20 bg-gradient-to-tr from-white to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-3xl flex items-center justify-center text-muted-foreground shadow-lg ring-1 ring-white/20">
                  <ShoppingBag size={40} />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">
                  {language === 'mn' ? 'Сагс хоосон байна' : 'Your cart is empty'}
                </h3>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="mt-6 px-8 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all"
                >
                  {language === 'mn' ? 'Дэлгүүр хэсэх' : 'Start Shopping'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedCart.map(({ product, colors }) => {
                // 3. Updated image logic to match your data structure
                const imgSrc = r2Url(product.image_path ?? product.gallery_paths?.[0] ?? "") || PLACEHOLDER_IMG;

                return (
                  <div
                    key={product.id}
                    className="group relative p-4 bg-white/50 dark:bg-white/5 rounded-2xl border border-white/20 dark:border-white/5 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex gap-4">
                      <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-muted relative">
                        <img
                          src={imgSrc}
                          alt={product.name}
                          className="h-full w-full object-cover object-center group-hover:scale-110 transition-transform duration-500"
                        />
                      </div>

                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-bold text-base text-foreground line-clamp-1 pr-6">
                              {product.name}
                            </h3>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-1">
                              {product.category}
                            </p>
                          </div>
                        </div>

                        {/* Color & Size logic continues... */}
                        <div className="mt-3 space-y-3">
                          {Array.from(colors.entries()).map(([colorKey, sizeMap]) => {
                            const color = colorKey === 'none' ? null : colorKey;
                            return (
                              <div key={`${product.id}-${colorKey}`} className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-4 h-4 rounded-full border border-black/10 shadow-sm"
                                    style={{ backgroundColor: color ?? 'transparent' }}
                                  />
                                  <span className="text-xs font-semibold text-foreground">
                                    {colorLabel(color)}
                                  </span>
                                </div>
                                <div className="mt-1 flex flex-wrap gap-2">
                                  {Array.from(sizeMap.entries()).map(([sizeKey, item]) => (
                                    <div
                                      key={item.cartKey}
                                      className="flex items-center gap-1 bg-black/5 dark:bg-white/10 px-2 py-1 rounded-lg"
                                    >
                                      <span className="text-[11px] font-bold text-foreground">
                                        {sizeKey === 'none' ? '-' : sizeKey} ({item.quantity})
                                      </span>
                                      <button onClick={() => addToCart(item, -1, item.color, item.size)} disabled={item.quantity <= 1} className="ml-1"><Minus size={12} /></button>
                                      <button onClick={() => addToCart(item, 1, item.color, item.size)}><Plus size={12} /></button>
                                      <button onClick={() => removeFromCart(item.cartKey)} className="ml-1 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-4 flex justify-end">
                          <span className="font-bold text-lg text-primary">
                            $
                            {Array.from(colors.values())
                              .flatMap((m) => Array.from(m.values()))
                              .reduce((acc, i) => acc + i.price * i.quantity, 0)
                              .toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="border-t border-black/5 dark:border-white/5 p-6 space-y-4">
            <div className="flex justify-between text-lg font-bold text-foreground">
              <p>{language === 'mn' ? 'Нийт дүн' : 'Total'}</p>
              <p>${cartTotal.toFixed(2)}</p>
            </div>
            <button className="w-full rounded-xl bg-primary px-6 py-4 text-white font-bold flex items-center justify-center gap-2">
              {language === 'mn' ? 'Худалдан авах' : 'Checkout Now'}
              <ArrowRight size={18} />
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}