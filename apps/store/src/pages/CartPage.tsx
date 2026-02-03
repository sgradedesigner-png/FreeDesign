import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import { useCheckoutGate } from '@/hooks/useCheckoutGate';
import { Trash2, Plus, Minus, ArrowLeft, ShoppingBag } from 'lucide-react';
import { r2Url } from "@/lib/r2";
import AuthModal from '@/components/auth/AuthModal';

const PLACEHOLDER_IMG = 'https://placehold.co/800x1000/png?text=No+Image';

export default function CartPage() {
  const { cart, increaseQty, decreaseQty, removeItem, cartTotal } = useCart();
  const { language } = useTheme();
  const navigate = useNavigate();
  const { checkAuthAndProceed, showAuthModal, setShowAuthModal, onAuthSuccess } = useCheckoutGate();

  const deliveryFee = 0; // Free delivery
  const taxFee = 0; // Free tax
  const total = cartTotal + deliveryFee + taxFee;

  const handleCheckout = () => {
    checkAuthAndProceed(() => {
      navigate('/checkout');
    });
  };

  if (cart.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 pt-28">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Link to="/" className="hover:text-primary flex items-center gap-1">
            <ArrowLeft size={14} />
            {language === 'mn' ? 'Нүүр' : 'Home'}
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">
            {language === 'mn' ? 'Сагс' : 'Shopping Cart'}
          </span>
        </div>

        {/* Empty State */}
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center mb-6">
            <ShoppingBag size={64} className="text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-2">
            {language === 'mn' ? 'Таны сагс хоосон байна' : 'Your cart is empty'}
          </h2>
          <p className="text-muted-foreground mb-6">
            {language === 'mn' ? 'Дэлгүүрээс бараа сонгож авна уу' : 'Start shopping to add items to your cart'}
          </p>
          <Link
            to="/"
            className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors"
          >
            {language === 'mn' ? 'Дэлгүүр хэсэх' : 'Continue Shopping'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 pt-28 pb-20">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
        <Link to="/" className="hover:text-primary flex items-center gap-1">
          <ArrowLeft size={14} />
          {language === 'mn' ? 'Нүүр' : 'Home'}
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">
          {language === 'mn' ? 'Сагс' : 'Shopping Cart'}
        </span>
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-[1fr,400px] gap-8">
        {/* Cart Items */}
        <div className="space-y-4">
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-[2fr,1fr,1fr,auto] gap-4 px-6 py-4 bg-muted/50 rounded-xl font-bold text-sm">
            <div>{language === 'mn' ? 'Бүтээгдэхүүн' : 'Product'}</div>
            <div className="text-center">{language === 'mn' ? 'Тоо ширхэг' : 'Quantity'}</div>
            <div className="text-right">{language === 'mn' ? 'Нийт үнэ' : 'Total Price'}</div>
            <div className="w-10"></div>
          </div>

          {/* Cart Items List */}
          <div className="space-y-4">
            {cart.map((item) => {
              const imgSrc = r2Url(item.variantImage) || PLACEHOLDER_IMG;
              const itemTotal = item.variantPrice * item.quantity;

              return (
                <div
                  key={item.cartKey}
                  className="grid md:grid-cols-[2fr,1fr,1fr,auto] gap-4 items-center p-4 md:p-6 bg-card border border-border rounded-2xl hover:shadow-md transition-shadow"
                >
                  {/* Product Info */}
                  <div className="flex gap-4">
                    <div className="w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden bg-muted">
                      <img
                        src={imgSrc}
                        alt={`${item.productName} - ${item.variantName}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex flex-col justify-center">
                      <h3 className="font-bold text-foreground mb-1 line-clamp-2">
                        {item.productName}
                      </h3>
                      <p className="text-sm font-medium text-primary">
                        {item.variantName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        ${item.variantPrice.toFixed(2)}
                      </p>
                      {item.size && (
                        <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                          <span>Size: {item.size}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quantity */}
                  <div className="flex justify-center">
                    <div className="inline-flex items-center border-2 border-border rounded-lg overflow-hidden">
                      <button
                        onClick={() => decreaseQty(item.cartKey)}
                        className="px-3 py-2 hover:bg-muted transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <Minus size={16} />
                      </button>
                      <div className="px-4 py-2 min-w-[50px] text-center font-bold border-x-2 border-border">
                        {item.quantity}
                      </div>
                      <button
                        onClick={() => increaseQty(item.cartKey)}
                        className="px-3 py-2 hover:bg-muted transition-colors"
                        aria-label="Increase quantity"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Total Price */}
                  <div className="text-right">
                    <p className="text-xl font-bold text-primary">
                      ${itemTotal.toFixed(2)}
                    </p>
                  </div>

                  {/* Remove Button */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => removeItem(item.cartKey)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      aria-label="Remove item"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Summary */}
        <div className="lg:sticky lg:top-24 h-fit">
          <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
            <h2 className="text-2xl font-bold">
              {language === 'mn' ? 'Захиалгын дүн' : 'Order Summary'}
            </h2>

            {/* Summary Details */}
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {language === 'mn' ? 'Нийт дүн' : 'Subtotal'}
                </span>
                <span className="font-semibold">${cartTotal.toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {language === 'mn' ? 'Хүргэлт' : 'Delivery'}
                </span>
                <span className="font-semibold text-primary">
                  {language === 'mn' ? 'Үнэгүй' : 'Free'}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {language === 'mn' ? 'Татвар' : 'Tax'}
                </span>
                <span className="font-semibold text-primary">
                  {language === 'mn' ? 'Үнэгүй' : 'Free'}
                </span>
              </div>

              <div className="border-t border-border pt-3">
                <div className="flex justify-between text-lg font-bold">
                  <span>{language === 'mn' ? 'НИЙТ' : 'TOTAL'}</span>
                  <span className="text-primary">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Coupon */}
            <div className="space-y-2">
              <input
                type="text"
                placeholder={language === 'mn' ? 'Купон код оруулах' : 'Enter coupon'}
                className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary bg-background"
              />
              <button className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors">
                {language === 'mn' ? 'ХЭРЭГЛЭХ' : 'APPLY'}
              </button>
            </div>

            {/* Checkout Button */}
            <button
              onClick={handleCheckout}
              className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-bold text-lg hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25"
            >
              {language === 'mn' ? 'ХУДАЛДАН АВАХ' : 'PROCEED TO CHECKOUT'}
            </button>
          </div>
        </div>
      </div>

      {/* Auth Modal - shown when user is not authenticated */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={onAuthSuccess}
      />
    </div>
  );
}
