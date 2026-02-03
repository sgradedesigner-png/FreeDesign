import { useState } from 'react';
import { Star, Truck, ShieldCheck, ArrowRight } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import type { Product } from '../../data/products';

type ProductInfoProps = {
  product: Product;
};

export default function ProductInfo({ product }: ProductInfoProps) {
  const { addItem, setIsCartOpen } = useCart();
  const [selectedSize, setSelectedSize] = useState(product.sizes?.[0] ?? '');
  const [selectedColor, setSelectedColor] = useState(product.colors?.[0] ?? '');

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

      {/* Buttons */}
      <div className="pt-4">
        {/* Add to Cart */}
        <button
          id="add-to-cart-button"
          onClick={() => {
            addItem(product, selectedColor || null, selectedSize || null);
            setIsCartOpen(true); // хүсвэл нэмэхэд сагсаа нээ
          }}
          className="w-full flex items-center justify-center gap-2 h-13 rounded-2xl font-bold
                     bg-primary text-primary-foreground
                     hover:bg-primary/90 transition-all active:scale-95 shadow-md"
        >
          Сагсанд нэмэх
        </button>
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