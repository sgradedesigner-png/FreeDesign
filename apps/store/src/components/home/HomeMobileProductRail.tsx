import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import ProductCard from '../product/ProductCard';
import type { Product } from '../../data/products';

type HomeFeedTab = 'trending' | 'new';

type HomeMobileProductRailProps = {
  trending: Product[];
  newArrivals: Product[];
  language: 'mn' | 'en';
};

const PREVIEW_COUNT = 4;

export default function HomeMobileProductRail({
  trending,
  newArrivals,
  language,
}: HomeMobileProductRailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<HomeFeedTab>('trending');
  const [activeIndex, setActiveIndex] = useState(0);

  const products = useMemo(() => {
    const source = activeTab === 'trending' ? trending : newArrivals;
    return source.slice(0, PREVIEW_COUNT);
  }, [activeTab, newArrivals, trending]);

  const isTrending = activeTab === 'trending';
  const sectionDescription = isTrending
    ? language === 'mn'
      ? 'Олон хүний сонирхож буй бараанууд'
      : 'Most popular products this week'
    : language === 'mn'
      ? 'Хамгийн сүүлд нэмэгдсэн бараанууд'
      : 'Latest additions to our collection';

  const getItemSpan = () => {
    const rail = railRef.current;
    if (!rail) return 0;

    const firstItem = rail.querySelector<HTMLElement>('[data-rail-item]');
    if (!firstItem) return 0;

    const styles = window.getComputedStyle(rail);
    const gap = Number.parseFloat(styles.columnGap || styles.gap || '0') || 0;
    return firstItem.offsetWidth + gap;
  };

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const updateActiveIndex = () => {
      const itemSpan = getItemSpan();
      if (!itemSpan) {
        setActiveIndex(0);
        return;
      }

      const nextIndex = Math.round(rail.scrollLeft / itemSpan);
      const maxIndex = Math.max(products.length - 1, 0);
      setActiveIndex(Math.min(Math.max(nextIndex, 0), maxIndex));
    };

    updateActiveIndex();
    rail.addEventListener('scroll', updateActiveIndex, { passive: true });
    window.addEventListener('resize', updateActiveIndex);

    return () => {
      rail.removeEventListener('scroll', updateActiveIndex);
      window.removeEventListener('resize', updateActiveIndex);
    };
  }, [products.length]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    rail.scrollTo({ left: 0, behavior: 'auto' });
    setActiveIndex(0);
  }, [activeTab]);

  useEffect(() => {
    setActiveIndex((prev) => Math.min(prev, Math.max(products.length - 1, 0)));
  }, [products.length]);

  const handleDotClick = (index: number) => {
    const rail = railRef.current;
    if (!rail) return;

    const itemSpan = getItemSpan();
    if (!itemSpan) return;

    rail.scrollTo({
      left: itemSpan * index,
      behavior: 'smooth',
    });
    setActiveIndex(index);
  };

  const ctaHref = isTrending ? '/products' : '/products?filter=new';
  const ctaText = isTrending
    ? language === 'mn'
      ? 'Бүх бараа үзэх'
      : 'View All Products'
    : language === 'mn'
      ? 'Бүх шинэ бараа'
      : 'View All New Arrivals';

  return (
    <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm">
      <div className="text-center">
        <h2 className="text-2xl font-heading font-bold text-foreground">
          {language === 'mn' ? 'Онцлох бүтээгдэхүүн' : 'Featured Products'}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{sectionDescription}</p>
      </div>

      <div className="mt-5 inline-flex w-full rounded-2xl border border-border bg-muted/40 p-1">
        <button
          type="button"
          data-testid="home-mobile-tab-trending"
          className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
            isTrending
              ? 'bg-background text-foreground shadow'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('trending')}
          aria-pressed={isTrending}
        >
          {language === 'mn' ? 'Эрэлттэй' : 'Trending'}
        </button>
        <button
          type="button"
          data-testid="home-mobile-tab-new"
          className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
            !isTrending
              ? 'bg-background text-foreground shadow'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('new')}
          aria-pressed={!isTrending}
        >
          {language === 'mn' ? 'Шинэ ирсэн' : 'New Arrivals'}
        </button>
      </div>

      {products.length > 0 ? (
        <>
          <div
            ref={railRef}
            data-testid="home-mobile-rail"
            className="mt-4 flex items-stretch snap-x snap-mandatory gap-4 overflow-x-auto pb-2 scrollbar-hide"
          >
            {products.map((product) => (
              <div
                key={`${activeTab}-${product.id}`}
                data-rail-item
                className="h-full snap-start shrink-0 basis-[72%] sm:basis-[55%]"
              >
                <ProductCard product={product} />
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-center gap-2">
            {products.map((product, index) => (
              <button
                key={`${activeTab}-dot-${product.id}`}
                type="button"
                data-testid={`home-mobile-dot-${index}`}
                className={`h-2.5 rounded-full transition-all ${
                  index === activeIndex ? 'w-6 bg-primary' : 'w-2.5 bg-muted-foreground/35'
                }`}
                onClick={() => handleDotClick(index)}
                aria-label={`Go to slide ${index + 1}`}
                aria-current={index === activeIndex}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-2xl border border-border/60 bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
          {language === 'mn' ? 'Мэдээлэл ачааллаж байна...' : 'Loading products...'}
        </div>
      )}

      <div className="mt-4 text-center">
        <Link
          to={ctaHref}
          data-testid="home-mobile-feed-cta"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
        >
          {ctaText}
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
