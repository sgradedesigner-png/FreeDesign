import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ImageOff } from 'lucide-react';
import { r2Url } from '../../lib/r2';

type Category = {
  id: string;
  name: string;
  slug: string;
  productCount?: number;
  previewImageUrl?: string | null;
};

type CategoryVisual = {
  backgroundClass: string;
};

type HomeCategoryShowcaseProps = {
  categories: Category[];
  language: 'mn' | 'en';
};

const CATEGORY_VISUALS: Record<string, CategoryVisual> = {
  men: { backgroundClass: 'from-cyan-100 via-white to-emerald-100' },
  women: { backgroundClass: 'from-rose-100 via-white to-orange-100' },
  shoes: { backgroundClass: 'from-amber-100 via-white to-lime-100' },
  accessories: { backgroundClass: 'from-violet-100 via-white to-sky-100' },
  beauty: { backgroundClass: 'from-pink-100 via-white to-fuchsia-100' },
  skincare: { backgroundClass: 'from-teal-100 via-white to-emerald-100' },
};

const DEFAULT_VISUAL: CategoryVisual = {
  backgroundClass: 'from-slate-100 via-white to-slate-50',
};

const getCategoryVisual = (category: Category): CategoryVisual => {
  const slugKey = category.slug.toLowerCase();
  const nameKey = category.name.toLowerCase().replace(/\s+/g, '-');
  return CATEGORY_VISUALS[slugKey] ?? CATEGORY_VISUALS[nameKey] ?? DEFAULT_VISUAL;
};

const getCategoryPreviewSrc = (category: Category): string | null => {
  if (!category.previewImageUrl) return null;
  return r2Url(category.previewImageUrl) || category.previewImageUrl;
};

type PromoCardProps = {
  category: Category;
  language: 'mn' | 'en';
  large?: boolean;
  desktopHeroLayered?: boolean;
  className?: string;
};

type CategoryPreviewImageProps = {
  src: string | null;
  alt: string;
  imageClassName: string;
  noImageLabel: string;
  layered?: boolean;
};

function CategoryPreviewImage({ src, alt, imageClassName, noImageLabel, layered = false }: CategoryPreviewImageProps) {
  const [isInvalid, setIsInvalid] = useState(false);

  if (!src || isInvalid) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500">
        <ImageOff size={20} />
        <span className="text-xs font-semibold uppercase tracking-wide">{noImageLabel}</span>
      </div>
    );
  }

  if (layered) {
    return (
      <>
        <img
          src={src}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover blur-md opacity-25"
        />
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
          onError={() => setIsInvalid(true)}
          onLoad={(event) => {
            const img = event.currentTarget;
            if (img.naturalWidth <= 24 || img.naturalHeight <= 24) {
              setIsInvalid(true);
            }
          }}
        />
      </>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={imageClassName}
      onError={() => setIsInvalid(true)}
      onLoad={(event) => {
        const img = event.currentTarget;
        if (img.naturalWidth <= 24 || img.naturalHeight <= 24) {
          setIsInvalid(true);
        }
      }}
    />
  );
}

function PromoCard({ category, language, large = false, desktopHeroLayered = false, className = '' }: PromoCardProps) {
  const visual = getCategoryVisual(category);
  const previewSrc = getCategoryPreviewSrc(category);
  const label = language === 'mn' ? 'Ангилал' : 'Category';
  const cta = language === 'mn' ? 'Дэлгүүр рүү' : 'Shop now';
  const itemLabel = language === 'mn' ? 'бараа' : 'items';
  const noImageLabel = language === 'mn' ? 'Зураггүй' : 'No image';
  const useHeroLayers = large && desktopHeroLayered;
  const imageContainerClass = useHeroLayers
    ? 'relative mt-4 w-full aspect-[16/9] flex-1 min-h-[220px]'
    : large
      ? 'relative mt-4 w-full flex-1 min-h-[220px]'
      : 'relative mt-4 shrink-0 aspect-[16/9]';
  const imageFitClass = 'object-cover object-center';

  return (
    <Link
      to={`/products?category=${category.slug}`}
      className={`group relative flex h-full flex-col overflow-hidden rounded-3xl bg-gradient-to-br ${visual.backgroundClass} shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${className}`}
    >
      <div className="absolute inset-0">
        <CategoryPreviewImage
          src={previewSrc}
          alt={category.name}
          noImageLabel={noImageLabel}
          layered={useHeroLayers}
          imageClassName={`h-full w-full transition-transform duration-500 group-hover:scale-105 ${imageFitClass}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/10 opacity-60 transition-opacity duration-300 group-hover:opacity-75" />
      </div>

      <div className="relative z-10 flex h-full flex-col p-5 md:p-6">
        <div className="pointer-events-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/90">{label}</p>
          <h3
            className={`mt-2 line-clamp-2 font-heading font-extrabold leading-tight text-white ${
              large && !desktopHeroLayered ? 'text-2xl md:text-3xl' : 'text-2xl'
            }`}
          >
            {category.name}
          </h3>
          {category.productCount !== undefined && (
            <p className="mt-2 text-sm text-white/85">
              {category.productCount} {itemLabel}
            </p>
          )}
        </div>
        <div className={`${imageContainerClass} pointer-events-none`} aria-hidden="true" />
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm opacity-100 transition-all duration-300 md:pointer-events-none md:translate-y-1 md:opacity-0 md:group-hover:pointer-events-auto md:group-hover:translate-y-0 md:group-hover:opacity-100">
          {cta}
          <ArrowRight size={15} />
        </span>
      </div>
    </Link>
  );
}

export default function HomeCategoryShowcase({ categories, language }: HomeCategoryShowcaseProps) {
  const hero = categories[0];
  const rightCards = categories.slice(1, 3);
  const remainingCards = categories.slice(3);
  const hasSingleRemaining = remainingCards.length === 1;

  return (
    <section className="max-w-7xl mx-auto px-6 py-20">
      <div className="mb-12 text-center">
        <h2 className="mb-4 text-3xl font-heading font-bold text-foreground md:text-4xl">
          {language === 'mn' ? 'Ангилал' : 'Shop by Category'}
        </h2>
        <p className="text-muted-foreground">
          {language === 'mn' ? 'Өөрт таалагдсан ангиллаа сонгоно уу' : 'Find what you love faster'}
        </p>
      </div>

      {categories.length > 0 && (
        <>
          <div className="hidden items-start grid-cols-12 gap-6 md:grid">
            {hero && (
              <PromoCard
                category={hero}
                language={language}
                large
                desktopHeroLayered
                className={rightCards.length > 0 ? 'col-span-8 min-h-[220px]' : 'col-span-12 min-h-[220px]'}
              />
            )}
            {rightCards.length > 0 && (
              <div className="col-span-4 grid gap-6 content-start">
                {rightCards.map((category) => (
                  <PromoCard key={category.id} category={category} language={language} className="min-h-[220px]" />
                ))}
              </div>
            )}
          </div>

          {remainingCards.length > 0 && (
            <div
              className={`mt-6 hidden gap-6 md:grid ${
                hasSingleRemaining ? 'md:grid-cols-1 md:place-items-center' : 'md:grid-cols-2 lg:grid-cols-3'
              }`}
            >
              {remainingCards.map((category) => (
                <PromoCard
                  key={category.id}
                  category={category}
                  language={language}
                  className={hasSingleRemaining ? 'w-full max-w-[420px]' : ''}
                />
              ))}
            </div>
          )}

          <div className="-mx-1 mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 scrollbar-hide md:hidden">
            {categories.map((category, index) => (
              <div key={category.id} className="snap-start shrink-0 basis-[86%]">
                <PromoCard
                  category={category}
                  language={language}
                  large={index === 0}
                  className="min-h-[280px] rounded-2xl"
                />
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-10 text-center">
        <Link
          to="/products"
          className="inline-flex items-center gap-2 font-semibold text-primary transition-colors hover:text-primary/80"
        >
          {language === 'mn' ? 'Бүгдийг харах' : 'View All Categories'}
          <ArrowRight size={18} />
        </Link>
      </div>
    </section>
  );
}
