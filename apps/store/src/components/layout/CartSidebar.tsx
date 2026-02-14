import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, Eye } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useTheme } from '../../context/ThemeContext';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { imageUrl } from "@/lib/imageUrl";

const PLACEHOLDER_IMG = 'https://placehold.co/800x1000/png?text=No+Image';
const formatMNT = (value: number): string =>
  `â‚®${Math.max(0, Math.round(value)).toLocaleString()}`;

export default function CartSidebar() {
  const { cart, isCartOpen, setIsCartOpen, increaseQty, decreaseQty, removeItem, cartTotal } = useCart();
  const { language } = useTheme();

  const groupedCart = useMemo(() => {
    const products = new Map<
      string,
      {
        productId: string;
        productName: string;
        productCategory: string;
        variants: Map<string, Map<string, typeof cart[number]>>;
      }
    >();

    for (const item of cart) {
      const productId = item.productId;
      const variantId = item.variantId;
      const sizeKey = item.isCustomized ? item.cartKey : (item.size ?? 'none');

      if (!products.has(productId)) {
        products.set(productId, {
          productId: item.productId,
          productName: item.productName,
          productCategory: item.productCategory,
          variants: new Map(),
        });
      }

      const entry = products.get(productId)!;
      if (!entry.variants.has(variantId)) {
        entry.variants.set(variantId, new Map());
      }
      entry.variants.get(variantId)!.set(sizeKey, item);
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
          <SheetTitle className="text-xl font-heading font-bold text-foreground flex items-center gap-2">
            <ShoppingBag className="text-primary" size={22} />
            {language === 'mn' ? 'Ð¢Ð°Ð½Ñ‹ Ð¡Ð°Ð³Ñ' : 'Your Cart'}
            <span className="text-sm font-medium text-muted-foreground bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-full">
              {cart.length}
            </span>
          </SheetTitle>
          <SheetDescription className="sr-only">
            {language === 'mn'
              ? `Ð¢Ð°Ð½Ñ‹ ÑÐ°Ð³ÑÐ°Ð½Ð´ ${cart.length} Ð±Ð°Ñ€Ð°Ð° Ð±Ð°Ð¹Ð½Ð°. Ð”ÑÐ»Ð³ÑÑ€ÑÐ½Ð³Ò¯Ð¹Ð³ Ð´Ð¾Ð¾Ñ€ Ò¯Ð·Ð½Ñ Ò¯Ò¯.`
              : `Your shopping cart contains ${cart.length} items. View details below.`}
          </SheetDescription>
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
            <div data-testid="cart-empty" className="h-full flex flex-col items-center justify-center text-center space-y-6">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full"></div>
                <div className="relative w-20 h-20 bg-gradient-to-tr from-white to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-3xl flex items-center justify-center text-muted-foreground shadow-lg ring-1 ring-white/20">
                  <ShoppingBag size={40} />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">
                  {language === 'mn' ? 'Ð¡Ð°Ð³Ñ Ñ…Ð¾Ð¾ÑÐ¾Ð½ Ð±Ð°Ð¹Ð½Ð°' : 'Your cart is empty'}
                </h3>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="mt-6 px-8 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all"
                >
                  {language === 'mn' ? 'Ð”ÑÐ»Ð³Ò¯Ò¯Ñ€ Ñ…ÑÑÑÑ…' : 'Start Shopping'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedCart.map(({ productId, productName, productCategory, variants }) => {
                return (
                  <div
                    key={productId}
                    data-testid="cart-item"
                    className="group relative p-4 bg-white/50 dark:bg-white/5 rounded-2xl border border-white/20 dark:border-white/5 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex flex-col gap-3">
                      {/* Product Header */}
                      <div>
                        <h3 className="font-bold text-base text-foreground">
                          {productName}
                        </h3>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {productCategory}
                        </p>
                      </div>

                      {/* Variants */}
                      <div className="space-y-3">
                        {Array.from(variants.entries()).map(([variantId, sizeMap]) => {
                          const firstItem = Array.from(sizeMap.values())[0];
                          const imgSrc = imageUrl(firstItem.variantImage) || PLACEHOLDER_IMG;
                          const variantTotal = Array.from(sizeMap.values())
                            .reduce((acc, i) => acc + i.variantPrice * i.quantity, 0);

                          return (
                            <div key={variantId} className="flex gap-3 border-t border-white/10 pt-3 first:border-t-0 first:pt-0">
                              {/* Variant Image */}
                              <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
                                <img
                                  src={imgSrc}
                                  alt={firstItem.variantName}
                                  className="h-full w-full object-cover object-center group-hover:scale-110 transition-transform duration-500"
                                />
                              </div>

                              {/* Variant Info */}
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-semibold text-foreground">
                                    {firstItem.variantName}
                                  </span>
                                  <span data-testid="item-price" className="font-bold text-sm text-primary">
                                    {formatMNT(variantTotal)}
                                  </span>
                                </div>

                                {/* Sizes */}
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {Array.from(sizeMap.entries()).map(([sizeKey, item]) => (
                                    <div
                                      key={item.cartKey}
                                      className="flex items-center gap-1 bg-black/5 dark:bg-white/10 px-2 py-1 rounded-lg"
                                    >
                                      <span data-testid="item-quantity" className="text-[11px] font-bold text-foreground">
                                        {item.isCustomized
                                          ? `Custom (${item.customizations?.length || 0} area${item.customizations?.length === 1 ? '' : 's'})`
                                          : (sizeKey === 'none' ? 'No size' : sizeKey)} ({item.quantity})
                                      </span>
                                      <button data-testid="decrease-quantity" onClick={() => decreaseQty(item.cartKey)} className="ml-1 hover:text-primary">
                                        <Minus size={12} />
                                      </button>
                                      <button data-testid="increase-quantity" onClick={() => increaseQty(item.cartKey)} className="hover:text-primary">
                                        <Plus size={12} />
                                      </button>
                                      <button data-testid="remove-item" onClick={() => removeItem(item.cartKey)} className="ml-1 text-muted-foreground hover:text-destructive">
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
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
          <div className="border-t border-black/5 dark:border-white/5 p-6 space-y-3">
            <div className="flex justify-between text-lg font-bold text-foreground">
              <p>{language === 'mn' ? 'ÐÐ¸Ð¹Ñ‚ Ð´Ò¯Ð½' : 'Total'}</p>
              <p data-testid="cart-total">{formatMNT(cartTotal)}</p>
            </div>
            <Link
              to="/cart"
              onClick={() => setIsCartOpen(false)}
              className="w-full rounded-xl border-2 border-primary text-primary px-6 py-3 font-bold flex items-center justify-center gap-2 hover:bg-primary/5 transition-colors"
            >
              <Eye size={18} />
              {language === 'mn' ? 'Ð¡Ð°Ð³Ñ Ò¯Ð·ÑÑ…' : 'VIEW CART'}
            </Link>
            <Link
              to="/checkout"
              data-testid="checkout-btn"
              onClick={() => setIsCartOpen(false)}
              className="w-full rounded-xl bg-primary px-6 py-3 text-white font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
            >
              {language === 'mn' ? 'Ð¥ÑƒÐ´Ð°Ð»Ð´Ð°Ð½ Ð°Ð²Ð°Ñ…' : 'CHECKOUT'}
              <ArrowRight size={18} />
            </Link>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

