import { useState } from 'react';
import { Star, Truck, ShieldCheck, ArrowRight, Heart, ShoppingCart, Plus, Minus } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import type { Product } from '../../data/products';

type ProductInfoProps = {
  product: Product;
};

export default function ProductInfo({ product }: ProductInfoProps) {
  const { addItem, setIsCartOpen } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const [selectedSize, setSelectedSize] = useState(product.sizes?.[0] ?? '');
  const [selectedColor, setSelectedColor] = useState(product.colors?.[0] ?? '');
  const [quantity, setQuantity] = useState(1);
  const isWishlisted = isInWishlist(product.id);

  const handleQuantityDecrease = () => {
    if (quantity > 1) setQuantity(quantity - 1);
  };

  const handleQuantityIncrease = () => {
    setQuantity(quantity + 1);
  };

  const handleAddToCart = () => {
    // Add multiple items based on quantity
    for (let i = 0; i < quantity; i++) {
      addItem(product, selectedColor || null, selectedSize || null);
    }
    //setIsCartOpen(true);
  };

  const handleWishlist = () => {
    toggleWishlist(product);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-primary tracking-wider uppercase">
            {product.category}
          </span>

          <div className="flex items-center gap-1 text-orange-400 text-sm font-bold">
            <Star size={16} fill="currentColor" />
            <span>{product.rating}</span>
            <span className="text-muted-foreground font-normal ml-1">
              ({product.reviews} сэтгэгдэл)
            </span>
          </div>
        </div>

        <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-2">
          {product.name}
        </h1>

        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold text-primary">
            ${product.price.toFixed(2)}
          </span>
          {product.originalPrice && (
            <span className="text-lg text-muted-foreground line-through">
              ${product.originalPrice.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-muted-foreground leading-relaxed">
        {product.description}
      </p>

      {/* Options */}
      <div className="space-y-6">
        {/* Colors */}
        <div role="group" aria-labelledby="color-label">
          <label id="color-label" className="text-sm font-bold text-foreground mb-3 block">
            Өнгө: <span className="text-muted-foreground font-medium">{selectedColor}</span>
          </label>
          <div className="flex gap-3">
            {(product.colors || []).map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                aria-label={`Select color ${color}`}
                aria-pressed={selectedColor === color}
                className={[
                  'w-9 h-9 rounded-full border-2 transition-all duration-200',
                  selectedColor === color
                    ? 'border-primary ring-4 ring-primary/20 scale-110'
                    : 'border-border hover:border-muted-foreground/30',
                ].join(' ')}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        {/* Sizes */}
        <div role="group" aria-labelledby="size-label">
          <label id="size-label" className="text-sm font-bold text-foreground mb-3 block">
            Хэмжээ
          </label>
          <div className="flex gap-2 flex-wrap">
            {(product.sizes || []).map((size) => (
              <button
                key={size}
                onClick={() => setSelectedSize(size)}
                aria-pressed={selectedSize === size}
                className={[
                  'px-5 py-2.5 rounded-xl border text-sm font-bold transition-all duration-200',
                  selectedSize === size
                    ? 'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/10'
                    : 'border-border bg-background text-foreground hover:bg-muted hover:border-muted-foreground/30',
                ].join(' ')}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quantity & Actions */}
      <div className="space-y-4 pt-4">
        {/* Quantity Selector */}
        <div>
          <label className="text-sm font-bold text-foreground mb-3 block">
            Тоо ширхэг
          </label>
          <div className="inline-flex items-center border-2 border-border rounded-xl overflow-hidden">
            <button
              onClick={handleQuantityDecrease}
              disabled={quantity <= 1}
              className="px-4 py-3 hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Decrease quantity"
            >
              <Minus size={18} className="text-foreground" />
            </button>
            <div className="px-6 py-3 min-w-[60px] text-center font-bold text-foreground border-x-2 border-border">
              {quantity}
            </div>
            <button
              onClick={handleQuantityIncrease}
              className="px-4 py-3 hover:bg-muted transition-colors"
              aria-label="Increase quantity"
            >
              <Plus size={18} className="text-foreground" />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-[1.8fr,1fr] gap-3">
          {/* Add to Cart Button */}
          <button
            id="add-to-cart-button"
            onClick={handleAddToCart}
            className="group flex items-center justify-center gap-2 h-14 px-8 rounded-xl font-bold text-white
                       bg-primary hover:bg-primary/90
                       transition-all hover:shadow-xl shadow-lg shadow-primary/25
                       active:scale-[0.98]"
          >
            <ShoppingCart size={20} className="group-hover:scale-110 transition-transform" />
            <span>ADD TO CART</span>
          </button>

          {/* Wishlist Button */}
          <button
            onClick={handleWishlist}
            className={`group flex items-center justify-center gap-2 h-14 px-6 rounded-xl font-bold border-2 transition-all active:scale-[0.98] ${
              isWishlisted
                ? 'bg-red-50 dark:bg-red-950 border-red-500 text-red-500 hover:bg-red-100 dark:hover:bg-red-900'
                : 'border-border text-foreground hover:border-primary hover:text-primary hover:bg-primary/5'
            }`}
            aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <Heart
              size={20}
              fill={isWishlisted ? 'currentColor' : 'none'}
              className="group-hover:scale-110 transition-transform"
            />
            <span>{isWishlisted ? 'SAVED' : 'WISHLIST'}</span>
          </button>
        </div>
      </div>

      {/* Features List */}
      <div className="pt-6 border-t border-border space-y-3">
        {(product.features || []).map((feature, idx) => (
          <div key={idx} className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
              <ArrowRight size={12} />
            </div>
            <span>{feature}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-6 pt-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        <div className="flex items-center gap-2">
          <Truck size={16} className="text-primary" />
          <span>Үнэгүй хүргэлт</span>
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-primary" />
          <span>Чанарын баталгаа</span>
        </div>
      </div>
    </div>
  );
}