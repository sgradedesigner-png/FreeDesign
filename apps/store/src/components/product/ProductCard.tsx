import { Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useTheme } from '../../context/ThemeContext';
import { r2Url } from '@/lib/r2';
import { ShoppingBag } from 'lucide-react';
import type { Product } from '../../data/products';
import { useQueryClient } from '@tanstack/react-query';
import { prefetchProduct, seedProductCache } from '../../data/products.queries';
import { logger } from '@/lib/logger';

const PLACEHOLDER_IMG = 'https://placehold.co/800x1000/png?text=No+Image';

type ProductCardProps = {
  product: Product;
};

export default function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const { language } = useTheme();
  const queryClient = useQueryClient();

  // Get default variant (first available variant)
  const defaultVariant = product.variants?.[0];
  const imgSrc = r2Url(defaultVariant?.imagePath ?? product.image_path ?? '') || PLACEHOLDER_IMG;

  // Get price from default variant or product
  const displayPrice = defaultVariant?.price ?? product.price ?? 0;

  const handlePrefetch = () => {
    if (!product.slug) return;
    seedProductCache(queryClient, product);
    prefetchProduct(queryClient, product.slug);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if product has variants
    if (!defaultVariant) {
      logger.error('Product has no variants:', product);
      return;
    }

    // Add first variant to cart (user can change variant in product detail page)
    addItem(product, defaultVariant, null);
  };

  return (
    <div
      data-testid="product-card"
      className="group relative rounded-3xl overflow-hidden h-full flex flex-col transition-all duration-500
                 bg-card text-card-foreground border border-border/40
                 hover:shadow-2xl hover:shadow-primary/10"
    >
      {/* Image Section */}
      <div className="relative aspect-[4/5] overflow-hidden rounded-t-3xl bg-muted">
        <Link
          to={`/product/${product.slug}`}
          state={{ product }}
          className="block w-full h-full cursor-pointer"
          onMouseEnter={handlePrefetch}
          onFocus={handlePrefetch}
          onTouchStart={handlePrefetch}
        >
          <img
            src={imgSrc}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
            onError={(e) => {
              e.currentTarget.src = PLACEHOLDER_IMG;
            }}
          />
        </Link>

        {/* Hover Overlay Buttons */}
        <div className="absolute inset-x-4 bottom-4 flex gap-2 opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 ease-out z-20">
          {/* View Details Button */}
          <Link
            to={`/product/${product.slug}`}
            state={{ product }}
            className="flex-1 h-12 bg-white text-slate-900 rounded-xl flex items-center justify-center font-bold text-[11px] tracking-wider shadow-lg hover:bg-slate-100 transition-colors"
            onMouseEnter={handlePrefetch}
            onFocus={handlePrefetch}
            onTouchStart={handlePrefetch}
          >
            {language === 'mn' ? 'ДЭЛГЭРЭНГҮЙ' : 'VIEW DETAILS'}
          </Link>

          {/* Add to Cart Button */}
          <button
            data-testid="add-to-cart-btn"
            onClick={handleAddToCart}
            className="w-12 h-12 bg-white text-slate-900 rounded-xl flex items-center justify-center shadow-lg hover:bg-primary hover:text-white transition-all duration-300"
            title={language === 'mn' ? 'Сагсанд нэмэх' : 'Add to cart'}
          >
            <ShoppingBag size={20} />
          </button>
        </div>

        {/* Dark overlay on hover */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      </div>

      {/* Product Info Section */}
      <div className="p-5 flex-1 flex flex-col justify-between bg-card">
        <div>
          <p className="mb-1 line-clamp-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            {product.category}
          </p>
          <h3 className="mb-2 line-clamp-2 min-h-[3rem] text-base font-bold text-foreground transition-colors group-hover:text-primary">
            {product.name}
          </h3>
          <div className="flex items-baseline gap-2 overflow-hidden whitespace-nowrap">
            <p className="shrink-0 text-lg font-bold text-foreground">
              ₮{Number(displayPrice).toLocaleString()}
            </p>
            {defaultVariant?.originalPrice && Number(defaultVariant.originalPrice) > Number(displayPrice) && (
              <p className="truncate text-sm text-muted-foreground line-through">
                ₮{Number(defaultVariant.originalPrice).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
