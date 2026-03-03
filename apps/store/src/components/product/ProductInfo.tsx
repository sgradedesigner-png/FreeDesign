import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Star, Truck, ShieldCheck, ArrowRight, Heart, ShoppingCart, Plus, Minus } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import type { Product, ProductVariant } from '../../data/products';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import SizeFinderDialog from './SizeFinderDialog';

type ProductInfoProps = {
  product: Product;
  onVariantChange?: (variant: ProductVariant) => void;
};

type FeatureSection = {
  heading: string;
  body: string;
};

type EmbeddedSections = {
  intro: string;
  sections: FeatureSection[];
};

const formatMntPrice = (value: number): string =>
  `₮${Math.max(0, Math.round(value)).toLocaleString()}`;

const toNumericSize = (value: string) => {
  const match = value.match(/[\d.]+/);
  return match ? Number.parseFloat(match[0]) : Number.NaN;
};

const splitFeatureEntry = (value: string): FeatureSection | null => {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;

  const match = cleaned.match(/^(.{2,70}?)\s+[—-]\s+(.+)$/);
  if (!match) return null;

  const heading = match[1]?.trim();
  const body = match[2]?.trim();
  if (!heading || !body) return null;

  return { heading, body };
};

const cleanDetailBullet = (value: string): string =>
  value.replace(/^[?*•·-]\s*/, '').trim();

const extractSectionsFromShortDescription = (text: string): EmbeddedSections => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return { intro: '', sections: [] };

  // Captures headings like "Flexibility: High", "Stability: High"
  const headingRegex = /([A-Z][A-Za-z0-9/&' -]{1,38}:\s*[A-Z][A-Za-z0-9/&' -]{1,22})/g;
  const matches = Array.from(normalized.matchAll(headingRegex));

  if (matches.length === 0) {
    return { intro: normalized, sections: [] };
  }

  const sections: FeatureSection[] = [];
  const intro = normalized.slice(0, matches[0].index ?? 0).trim().replace(/[.:-]\s*$/, '').trim();

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const heading = (current[1] || '').trim();
    const bodyStart = (current.index ?? 0) + heading.length;
    const bodyEnd = next ? (next.index ?? normalized.length) : normalized.length;
    const body = normalized.slice(bodyStart, bodyEnd).trim().replace(/[.:-]\s*$/, '').trim();

    if (!heading || !body) continue;
    if (/^(shown|style|weight|heel-to-toe drop|drop|not intended)\b/i.test(heading)) continue;

    sections.push({ heading, body });
  }

  return { intro: intro || normalized, sections };
};

export default function ProductInfo({ product, onVariantChange }: ProductInfoProps) {
  const { addItem } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();

  // Select first variant by default
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant>(
    product.variants?.[0] || ({} as ProductVariant)
  );
  const [selectedSize, setSelectedSize] = useState(selectedVariant.sizes?.[0] ?? '');
  const [quantity, setQuantity] = useState(1);
  const [isSizeFinderOpen, setIsSizeFinderOpen] = useState(false);
  const [sizeFinderEnabled, setSizeFinderEnabled] = useState(true);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [recommendedSelection, setRecommendedSelection] = useState<{
    size: string;
    label: 'Recommended' | 'Ойр хэмжээ';
  } | null>(null);
  const isWishlisted = isInWishlist(product.id);
  const currentVariantIds = useMemo(
    () => new Set((product.variants ?? []).map((variant) => variant.id)),
    [product.variants]
  );
  const hasValidSelectedVariant =
    Boolean(selectedVariant?.id) && currentVariantIds.has(selectedVariant.id);

  const availableEuSizes = useMemo(
    () =>
      (selectedVariant.sizes ?? [])
        .map((size) => toNumericSize(size))
        .filter((size) => Number.isFinite(size)),
    [selectedVariant]
  );

  const resolveSizeLabel = (euSize: number) => {
    const sizes = selectedVariant.sizes ?? [];
    const match = sizes.find((size) => {
      const numeric = toNumericSize(size);
      return Number.isFinite(numeric) && Math.abs(numeric - euSize) < 0.001;
    });
    return match ?? euSize.toString();
  };

  const formatSizeLabel = (size: string) => {
    const trimmed = size.trim();
    return /eu/i.test(trimmed) ? trimmed : `EU ${trimmed}`;
  };

  // Keep selected variant in sync when route/product changes.
  useEffect(() => {
    const firstVariant = product.variants?.[0] || ({} as ProductVariant);
    if (!selectedVariant?.id || !currentVariantIds.has(selectedVariant.id)) {
      setSelectedVariant(firstVariant);
    }
  }, [product.id, product.variants, selectedVariant?.id, currentVariantIds]);

  // Notify parent only when selected variant belongs to current product.
  useEffect(() => {
    if (onVariantChange && hasValidSelectedVariant) {
      onVariantChange(selectedVariant);
    }
  }, [selectedVariant, onVariantChange, hasValidSelectedVariant]);

  // Update selected size when variant changes
  useEffect(() => {
    setSelectedSize(selectedVariant.sizes?.[0] ?? '');
    setRecommendedSelection(null);
  }, [selectedVariant]);

  useEffect(() => {
    setIsDescriptionExpanded(false);
  }, [product.id]);

  useEffect(() => {
    let isMounted = true;

    const loadUiSettings = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/customization/ui-settings`);
        if (!response.ok) return;

        const payload = (await response.json()) as { sizeFinderEnabled?: boolean };
        if (isMounted) {
          setSizeFinderEnabled(payload.sizeFinderEnabled !== false);
        }
      } catch {
        // Fallback: keep enabled by default when settings endpoint is unavailable.
      }
    };

    void loadUiSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleQuantityDecrease = () => {
    if (quantity > 1) setQuantity(quantity - 1);
  };

  const handleQuantityIncrease = () => {
    setQuantity(quantity + 1);
  };

  const handleAddToCart = () => {
    // Add multiple items based on quantity
    for (let i = 0; i < quantity; i++) {
      addItem(product, selectedVariant, selectedSize || null);
    }
   // setIsCartOpen(true);
  };

  const handleWishlist = () => {
    toggleWishlist(product);
  };

  const shortDescription =
    product.shortDescription?.trim() || product.description || '';
  const benefits = product.benefits ?? [];
  const productDetails = product.productDetails ?? [];
  const embeddedFromShort = useMemo(
    () => extractSectionsFromShortDescription(shortDescription),
    [shortDescription]
  );
  const featureSections = useMemo(() => {
    const fromBenefitsOrDetails = benefits
      .map((benefit) => splitFeatureEntry(benefit))
      .filter((item): item is FeatureSection => Boolean(item));

    if (fromBenefitsOrDetails.length === 0) {
      // Backward compatibility for old records where feature sections were stored in productDetails.
      fromBenefitsOrDetails.push(
        ...productDetails
          .map((detail) => splitFeatureEntry(detail))
          .filter((item): item is FeatureSection => Boolean(item))
      );
    }

    // If old records have feature headings embedded in shortDescription, merge them in front.
    const combined = [...embeddedFromShort.sections, ...fromBenefitsOrDetails];
    const deduped: FeatureSection[] = [];
    const seen = new Set<string>();
    for (const section of combined) {
      const key = section.heading.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(section);
    }

    return deduped;
  }, [benefits, productDetails, embeddedFromShort.sections]);
  const detailItems = useMemo(() => {
    const cleaned = productDetails.map(cleanDetailBullet).filter(Boolean);
    const withoutFeatureLike = cleaned.filter((detail) => !splitFeatureEntry(detail));

    // Nike-like modal always shows these two lines in "Product Details".
    const derived = [
      selectedVariant?.name ? `Shown: ${selectedVariant.name}` : '',
      selectedVariant?.sku ? `Style: ${selectedVariant.sku}` : '',
    ].filter(Boolean);

    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of [...withoutFeatureLike, ...derived]) {
      const key = item.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  }, [productDetails, selectedVariant?.name, selectedVariant?.sku]);
  const displayDescription = embeddedFromShort.intro || shortDescription;
  const rawSubtitle = product.subtitle?.trim() || '';
  const knownSubtitles = [
    "Men's Shoes",
    "Women's Shoes",
    "Kid's Shoes",
    "Kids' Shoes",
    "Boys' Shoes",
    "Girls' Shoes",
    "Baby/Toddler Shoes",
    "Toddler Shoes",
    "Infant Shoes",
    "Unisex Shoes",
  ];
  const fallbackSubtitle =
    rawSubtitle ||
    knownSubtitles.find((entry) =>
      product.name?.toLowerCase().endsWith(entry.toLowerCase())
    ) ||
    '';
  const subtitle = fallbackSubtitle;
  const displayTitle = subtitle &&
    product.name?.toLowerCase().endsWith(subtitle.toLowerCase())
      ? product.name.slice(0, product.name.length - subtitle.length).trim()
      : product.name;
  const shouldClampDescription = displayDescription.trim().length > 220;
  const collapsedDescriptionStyle =
    shouldClampDescription && !isDescriptionExpanded
      ? {
          display: '-webkit-box',
          WebkitLineClamp: 4,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden',
        }
      : undefined;
  const hasDetails = featureSections.length > 0 || detailItems.length > 0;
  const modalImage =
    selectedVariant?.imagePath || product.image_path || product.gallery_paths?.[0] || '';
  const modalPrice = selectedVariant?.price ?? product.price;
  const showCustomizeButton = Boolean(product.slug) && product.productFamily === 'BLANKS';

  return (
    <div className="space-y-4 sm:space-y-6 pb-4">
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

        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-heading font-bold text-foreground leading-tight break-words mb-2">
          {displayTitle}
        </h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mb-2">
            {subtitle}
          </p>
        )}

        <div className="flex items-baseline gap-3">
          <span className="text-2xl sm:text-3xl font-bold text-primary">
            {formatMntPrice(selectedVariant.price ?? product.price)}
          </span>
          {selectedVariant.originalPrice && (
            <span className="text-base sm:text-lg text-muted-foreground line-through">
              {formatMntPrice(selectedVariant.originalPrice)}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <p
          className="text-sm sm:text-base text-muted-foreground leading-relaxed"
          style={collapsedDescriptionStyle}
        >
          {displayDescription}
        </p>
        <div className="flex items-center gap-4">
          {shouldClampDescription && (
            <Button
              variant="link"
              size="sm"
              className="px-0 h-auto"
              onClick={() => setIsDescriptionExpanded((prev) => !prev)}
            >
              {isDescriptionExpanded ? 'Show less' : 'Read more'}
            </Button>
          )}
          <Button
            variant="link"
            size="sm"
            className="px-0 h-auto"
            onClick={() => setIsDetailsOpen(true)}
          >
            View Product Details
          </Button>
        </div>
      </div>

      {/* Options */}
      <div className="space-y-5 sm:space-y-6">
        {/* Variant Selector (Thumbnail Images) */}
        {product.variants && product.variants.length > 0 && (
          <div role="group" aria-labelledby="variant-label">
            <label id="variant-label" className="text-sm font-bold text-foreground mb-3 block">
              Color / Style: <span className="text-muted-foreground font-medium">{selectedVariant.name}</span>
            </label>
            <div className="flex gap-3 flex-wrap" data-testid="variant-select">
              {product.variants.map((variant) => (
                <button
                  key={variant.id}
                  data-testid="variant-option"
                  onClick={() => setSelectedVariant(variant)}
                  aria-label={`Select variant ${variant.name}`}
                  aria-pressed={selectedVariant.id === variant.id}
                  className={[
                    'relative w-16 h-16 rounded-lg border-2 overflow-hidden transition-all duration-200',
                    selectedVariant.id === variant.id
                      ? 'border-primary ring-2 ring-primary/20 scale-110'
                      : 'border-border hover:border-primary/50',
                  ].join(' ')}
                >
                  <img
                    src={variant.imagePath}
                    alt={variant.name}
                    className="w-full h-full object-cover"
                  />
                  {!variant.isAvailable && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-[8px] text-white font-bold">Out</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
            {selectedVariant.stock !== undefined && (
              <p className="text-xs text-muted-foreground mt-2">
                {selectedVariant.stock > 0
                  ? `${selectedVariant.stock} in stock`
                  : 'Out of stock'}
              </p>
            )}
          </div>
        )}

        {/* Sizes (from selected variant) */}
        {selectedVariant.sizes && selectedVariant.sizes.length > 0 && (
          <div role="group" aria-labelledby="size-label">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label id="size-label" className="text-sm font-bold text-foreground">Хэмжээ</label>
              {sizeFinderEnabled ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsSizeFinderOpen(true)}
                  className="text-xs font-semibold"
                >
                  📏 Миний хэмжээг ол
                </Button>
              ) : null}
            </div>
            {recommendedSelection && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {formatSizeLabel(recommendedSelection.size)} ✓ {recommendedSelection.label}
                </span>
                {selectedSize && selectedSize !== recommendedSelection.size && (
                  <span className="text-xs text-muted-foreground">
                    Selected: {formatSizeLabel(selectedSize)}
                  </span>
                )}
              </div>
            )}
            <div className="mt-3 flex gap-2 flex-wrap">
              {selectedVariant.sizes.map((size) => (
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

            <SizeFinderDialog
              open={isSizeFinderOpen}
              onOpenChange={setIsSizeFinderOpen}
              availableEuSizes={availableEuSizes}
              onSelectSize={(euSize, source) => {
                const resolved = resolveSizeLabel(euSize);
                setSelectedSize(resolved);
                setRecommendedSelection({
                  size: resolved,
                  label: source === 'recommended' ? 'Recommended' : 'Ойр хэмжээ',
                });
              }}
            />
          </div>
        )}
      </div>

      {/* Quantity & Actions */}
      <div className="space-y-4 pt-2 sm:pt-4">
        {/* Quantity Selector */}
        <div>
          <label className="text-sm font-bold text-foreground mb-3 block">Тоо ширхэг</label>
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
        <div className="hidden sm:grid grid-cols-[1.8fr,1fr] gap-3">
          {/* Add to Cart Button */}
          <button
            id="add-to-cart-button"
            data-testid="add-to-cart-btn"
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

        {showCustomizeButton ? (
          <Link
            to={`/customize/${product.slug}`}
            className="hidden sm:flex h-12 items-center justify-center rounded-xl border-2 border-primary text-primary font-bold hover:bg-primary/5 transition-colors"
          >
            CUSTOMIZE DESIGN
          </Link>
        ) : null}
      </div>

      {/* Mobile Sticky Actions */}
      <div className="sm:hidden sticky bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-30 border border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 p-2 rounded-2xl shadow-lg">
        {showCustomizeButton ? (
          <Link
            to={`/customize/${product.slug}`}
            className="mb-2 flex h-10 items-center justify-center rounded-xl border border-primary text-xs font-bold text-primary"
          >
            CUSTOMIZE DESIGN
          </Link>
        ) : null}
        <div className="grid grid-cols-[1fr,56px] gap-2">
          <button
            data-testid="add-to-cart-btn"
            onClick={handleAddToCart}
            className="group flex items-center justify-center gap-2 h-12 rounded-xl font-bold text-white bg-primary hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-[0.98]"
          >
            <ShoppingCart size={18} className="group-hover:scale-110 transition-transform" />
            <span>ADD TO CART</span>
          </button>
          <button
            onClick={handleWishlist}
            className={`group h-12 rounded-xl border-2 transition-all active:scale-[0.98] flex items-center justify-center ${
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

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        <div className="flex items-center gap-2">
          <Truck size={16} className="text-primary" />
          <span>Үнэгүй хүргэлт</span>
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-primary" />
          <span>Чанарын баталгаа</span>
        </div>
      </div>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="w-[min(96vw,1280px)] max-w-[1280px] max-h-[96vh] overflow-y-auto rounded-2xl border border-border/70 bg-background p-5 sm:p-7 md:p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-heading font-bold text-foreground">
              Product Details
            </DialogTitle>
            <DialogDescription className="sr-only">
              Product details and benefits
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-[96px,1fr] items-center">
            {modalImage ? (
              <img
                src={modalImage}
                alt={product.name}
                className="w-24 h-24 rounded-xl object-cover border border-border/70"
              />
            ) : (
              <div className="w-24 h-24 rounded-xl bg-muted flex items-center justify-center text-muted-foreground text-xs">
                No image
              </div>
            )}
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {product.category}
              </p>
              <p className="text-[2rem] sm:text-[2.15rem] font-heading font-bold text-foreground leading-tight">
                {displayTitle}
              </p>
              <p className="text-3xl sm:text-[2.2rem] font-bold text-primary leading-tight">
                {formatMntPrice(modalPrice ?? product.price)}
              </p>
            </div>
          </div>

          {displayDescription && (
            <p className="text-[1rem] leading-7 text-foreground">
              {displayDescription}
            </p>
          )}

          {!hasDetails && (
            <p className="text-sm text-muted-foreground">
              No additional details available.
            </p>
          )}

          {hasDetails && (
            <div className="space-y-5">
              {featureSections.length > 0 && (
                <div className="space-y-5">
                  {featureSections.map((section, idx) => (
                    <section key={`${section.heading}-${idx}`} className="space-y-1">
                      <h3 className="text-[1.9rem] sm:text-[2rem] leading-tight font-heading font-bold text-foreground">
                        {section.heading}
                      </h3>
                      <p className="text-[1rem] leading-7 text-foreground">
                        {section.body}
                      </p>
                    </section>
                  ))}
                </div>
              )}

              {detailItems.length > 0 && (
                <div>
                  <p className="text-[1.9rem] sm:text-[2rem] leading-tight font-heading font-bold text-foreground mb-3">
                    Product Details
                  </p>
                  <ul className="list-disc pl-6 space-y-1.5">
                    {detailItems.map((detail, idx) => (
                      <li key={idx} className="text-[1rem] leading-7 text-foreground">
                        {detail}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}





