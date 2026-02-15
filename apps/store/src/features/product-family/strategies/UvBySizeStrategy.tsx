import { useState, useEffect } from 'react';
import { Star, Heart, Share2, ShoppingCart } from 'lucide-react';
import type { ProductStrategy, ProductStrategyProps } from '../types';
import type { PriceTier, FinishingOption } from '../../../lib/pricingCalculator';
import {
  calculateBySizePricing,
  formatPrice,
} from '../../../lib/pricingCalculator';
import PricingTierTable from '../../../components/product/PricingTierTable';
import { UvUseDisclaimer } from '../../../components/customize/UvUseDisclaimer';
import { useCart } from '../../../context/CartContext';
import { useWishlist } from '../../../context/WishlistContext';
import { useTheme } from '../../../context/ThemeContext';
import { Button } from '../../../components/ui/button';

/**
 * UV By-Size Product Info Component
 * Handles UV transfer products sold by size for hard surfaces
 * Similar to BySizeStrategy but with UV disclaimer
 */
function UvBySizeProductInfo({ product, selectedVariant }: ProductStrategyProps) {
  const { language } = useTheme();
  const { addItem } = useCart();
  const { addToWishlist, isInWishlist } = useWishlist();

  // State
  const [quantity, setQuantity] = useState(1);
  const [finishing, setFinishing] = useState<FinishingOption>('roll');
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>([]);
  const [isLoadingTiers, setIsLoadingTiers] = useState(false);

  // Load pricing tiers when variant changes
  useEffect(() => {
    if (!selectedVariant) return;

    setIsLoadingTiers(true);
    fetch(`/api/pricing/tiers/${selectedVariant.id}`)
      .then((res) => res.json())
      .then((data) => {
        setPriceTiers(data.tiers || []);
      })
      .catch((error) => {
        console.error('Failed to load pricing tiers:', error);
        setPriceTiers([
          {
            minQuantity: 1,
            maxQuantity: null,
            unitPrice: selectedVariant.price.toString(),
          },
        ]);
      })
      .finally(() => {
        setIsLoadingTiers(false);
      });
  }, [selectedVariant?.id]);

  // Calculate pricing based on quantity and finishing
  const pricing = calculateBySizePricing(
    priceTiers,
    quantity,
    finishing,
    selectedVariant?.price || 0
  );

  // Handle add to cart
  const handleAddToCart = () => {
    if (!selectedVariant) return;

    addItem({
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      productCategory: product.category,
      variantId: selectedVariant.id,
      variantName: selectedVariant.name,
      variantPrice: pricing.finalUnitPrice,
      variantOriginalPrice: null,
      variantImage: selectedVariant.imagePath,
      variantSku: selectedVariant.sku,
      quantity,
      size: null,
      isCustomized: false,
      optionPayload: {
        finishing,
        tierUnitPrice: pricing.tierUnitPrice,
        finishingSurcharge: pricing.finishingSurcharge,
        surfaceType: 'hard_surface', // UV-specific metadata
      },
    });
  };

  // Handle add to wishlist
  const handleAddToWishlist = () => {
    if (!selectedVariant) return;
    addToWishlist(product);
  };

  const inWishlist = isInWishlist(product.id);

  return (
    <div className="space-y-6">
      {/* Product Title */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
          {product.name}
        </h1>
        {product.subtitle && (
          <p className="text-lg text-muted-foreground">{product.subtitle}</p>
        )}
      </div>

      {/* UV Disclaimer - Prominent placement at top */}
      <UvUseDisclaimer />

      {/* Rating */}
      {product.rating > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                size={18}
                className={
                  i < Math.floor(product.rating)
                    ? 'fill-primary text-primary'
                    : 'text-muted'
                }
              />
            ))}
          </div>
          <span className="text-sm text-muted-foreground">
            {product.rating.toFixed(1)} ({product.reviews}{' '}
            {language === 'mn' ? 'үнэлгээ' : 'reviews'})
          </span>
        </div>
      )}

      {/* Short Description */}
      {product.shortDescription && (
        <p className="text-foreground leading-relaxed">
          {product.shortDescription}
        </p>
      )}

      {/* Size Display */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          {language === 'mn' ? 'Хэмжээ' : 'Size'}
        </label>
        <div className="px-4 py-3 border border-border rounded-lg bg-muted/30">
          <span className="text-lg font-semibold text-foreground">
            {selectedVariant?.name || product.name}
          </span>
        </div>
      </div>

      {/* Finishing Selector */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          {language === 'mn' ? 'Зүсэлт' : 'Finishing'}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setFinishing('roll')}
            className={`px-4 py-3 border rounded-lg text-sm font-medium transition-all ${
              finishing === 'roll'
                ? 'border-primary bg-primary text-primary-foreground shadow-md'
                : 'border-border hover:border-primary/50 text-foreground'
            }`}
          >
            <div className="font-semibold">
              {language === 'mn' ? 'Ороомог' : 'Roll'}
            </div>
            <div className="text-xs opacity-80">
              {language === 'mn' ? 'Стандарт' : 'Standard'}
            </div>
          </button>
          <button
            onClick={() => setFinishing('pre_cut')}
            className={`px-4 py-3 border rounded-lg text-sm font-medium transition-all ${
              finishing === 'pre_cut'
                ? 'border-primary bg-primary text-primary-foreground shadow-md'
                : 'border-border hover:border-primary/50 text-foreground'
            }`}
          >
            <div className="font-semibold">
              {language === 'mn' ? 'Урьдчилан зүссэн' : 'Pre-cut'}
            </div>
            <div className="text-xs opacity-80">+20%</div>
          </button>
        </div>
      </div>

      {/* Quantity Selector */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          {language === 'mn' ? 'Тоо ширхэг' : 'Quantity'}
        </label>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="w-10 h-10 flex items-center justify-center border border-border rounded-lg hover:bg-muted transition-colors text-foreground font-semibold"
          >
            −
          </button>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-20 h-10 text-center border border-border rounded-lg bg-background text-foreground font-semibold focus:ring-2 focus:ring-primary outline-none"
          />
          <button
            onClick={() => setQuantity(quantity + 1)}
            className="w-10 h-10 flex items-center justify-center border border-border rounded-lg hover:bg-muted transition-colors text-foreground font-semibold"
          >
            +
          </button>
        </div>
      </div>

      {/* Pricing Tier Table */}
      {!isLoadingTiers && priceTiers.length > 0 && (
        <PricingTierTable
          tiers={priceTiers}
          selectedQuantity={quantity}
          finishing={finishing}
        />
      )}

      {/* Price Summary */}
      <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {language === 'mn' ? 'Нэгжийн үнэ' : 'Unit Price'}:
          </span>
          <span className="font-medium text-foreground">
            {formatPrice(pricing.tierUnitPrice)}
          </span>
        </div>
        {finishing === 'pre_cut' && pricing.finishingSurcharge > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {language === 'mn' ? 'Зүсэлтийн нэмэлт' : 'Finishing Surcharge'}:
            </span>
            <span className="font-medium text-foreground">
              {formatPrice(pricing.finishingSurcharge)}
            </span>
          </div>
        )}
        <div className="flex justify-between text-sm pt-2 border-t border-border">
          <span className="text-muted-foreground">
            {language === 'mn' ? 'Төлөх үнэ' : 'Final Unit Price'}:
          </span>
          <span className="font-semibold text-foreground">
            {formatPrice(pricing.finalUnitPrice)}
          </span>
        </div>
        <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
          <span className="text-foreground">
            {language === 'mn' ? 'Нийт' : 'Subtotal'}:
          </span>
          <span className="text-primary">{formatPrice(pricing.subtotal)}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button
          onClick={handleAddToCart}
          className="w-full h-12 text-base font-semibold"
          disabled={!selectedVariant}
        >
          <ShoppingCart size={20} className="mr-2" />
          {language === 'mn' ? 'Сагслах' : 'Add to Cart'}
        </Button>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={handleAddToWishlist}
            className="h-10"
            disabled={!selectedVariant}
          >
            <Heart
              size={18}
              className={`mr-2 ${inWishlist ? 'fill-red-500 text-red-500' : ''}`}
            />
            {language === 'mn' ? 'Хүслийн жагсаалт' : 'Wishlist'}
          </Button>
          <Button variant="outline" className="h-10">
            <Share2 size={18} className="mr-2" />
            {language === 'mn' ? 'Хуваалцах' : 'Share'}
          </Button>
        </div>
      </div>

      {/* Features/Benefits */}
      {product.features && product.features.length > 0 && (
        <div className="border-t border-border pt-6">
          <h3 className="font-semibold text-foreground mb-3">
            {language === 'mn' ? 'Онцлог' : 'Features'}
          </h3>
          <ul className="space-y-2">
            {product.features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <span className="text-primary mt-1">•</span>
                <span className="text-foreground">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * UV By-Size Strategy Implementation
 */
export const UvBySizeStrategy: ProductStrategy = {
  renderProductInfo: (props) => <UvBySizeProductInfo {...props} />,

  getGalleryImages: ({ product, selectedVariant }) => {
    if (selectedVariant) {
      if (selectedVariant.galleryPaths?.length) {
        return selectedVariant.galleryPaths;
      }
      if (selectedVariant.imagePath) {
        return [selectedVariant.imagePath];
      }
    }

    if (product.mockupImagePath) {
      return [product.mockupImagePath];
    }
    if (product.gallery_paths?.length) {
      return product.gallery_paths;
    }
    if (product.image_path) {
      return [product.image_path];
    }

    return [];
  },
};
