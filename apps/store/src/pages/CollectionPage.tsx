import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import ProductCard from '@/components/product/ProductCard';
import { useProductsQuery } from '@/data/products.queries';
import type { ProductFamily } from '@/data/types';
import { useTheme } from '@/context/ThemeContext';
import { Sentry } from '@/lib/sentry';

type CollectionDef = {
  family: ProductFamily;
  title: { mn: string; en: string };
  description: { mn: string; en: string };
};

const familyCollections: Record<string, CollectionDef> = {
  'dtf-by-size': {
    family: 'BY_SIZE',
    title: { mn: 'DTF Transfer (Хэмжээгээр)', en: 'DTF Transfers (By Size)' },
    description: {
      mn: 'Хэмжээ, хувилбар сонгоод захиалгад нэмнэ.',
      en: 'Select size/variant and add to cart.',
    },
  },
  'dtf-gang-upload': {
    family: 'GANG_UPLOAD',
    title: { mn: 'DTF Gang Sheet (Upload)', en: 'DTF Gang Sheet (Upload)' },
    description: {
      mn: 'Бэлэн файлаа upload хийгээд үргэлжлүүлнэ.',
      en: 'Upload a ready-to-print file and continue.',
    },
  },
  'dtf-gang-builder': {
    family: 'GANG_BUILDER',
    title: { mn: 'DTF Gang Sheet (Builder)', en: 'DTF Gang Sheet (Builder)' },
    description: {
      mn: 'Онлайн builder (MVP) урсгал.',
      en: 'Online builder (MVP) flow.',
    },
  },
  'uv-by-size': {
    family: 'UV_BY_SIZE',
    title: { mn: 'UV DTF (Хэмжээгээр)', en: 'UV DTF (By Size)' },
    description: {
      mn: 'UV transfer бүтээгдэхүүнүүд.',
      en: 'UV transfer products.',
    },
  },
  'uv-gang-upload': {
    family: 'UV_GANG_UPLOAD',
    title: { mn: 'UV Gang Sheet (Upload)', en: 'UV Gang Sheet (Upload)' },
    description: {
      mn: 'UV gang sheet upload урсгал.',
      en: 'UV gang sheet upload flow.',
    },
  },
  'uv-gang-builder': {
    family: 'UV_GANG_BUILDER',
    title: { mn: 'UV Gang Sheet (Builder)', en: 'UV Gang Sheet (Builder)' },
    description: {
      mn: 'UV builder (MVP) урсгал.',
      en: 'UV builder (MVP) flow.',
    },
  },
  blanks: {
    family: 'BLANKS',
    title: { mn: 'Blanks', en: 'Blanks' },
    description: {
      mn: 'Цамц, hoodie, sweatshirt зэрэг үндсэн бараанууд.',
      en: 'Core apparel blanks (shirts, hoodies, sweatshirts).',
    },
  },
};

export default function CollectionPage() {
  const { slug } = useParams();
  const { language } = useTheme();
  const { data: products, isLoading, error } = useProductsQuery();

  const key = (slug || '').trim();
  const def = key ? familyCollections[key] : null;

  const all = products ?? [];

  const filtered = def
    ? all.filter((p) => p.productFamily === def.family)
    : key
      ? all.filter((p) => p.categorySlug === key)
      : all;


  useEffect(() => {
    if (def?.family) {
      Sentry.setTag('product_family', def.family);
    }
  }, [def?.family]);
  const title = def
    ? language === 'mn'
      ? def.title.mn
      : def.title.en
    : key
      ? key
      : language === 'mn'
        ? 'Цуглуулга'
        : 'Collection';

  const description = def
    ? language === 'mn'
      ? def.description.mn
      : def.description.en
    : language === 'mn'
      ? 'Энэ хуудсыг бүтээгдэхүүний гэр бүл эсвэл category slug-аар шүүн харуулна.'
      : 'This page filters products by family or by category slug.';

  return (
    <div className="pt-28 pb-16">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between gap-4">
          <div className="max-w-3xl">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          </div>
          <Link
            to="/start-order"
            className="hidden sm:inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors"
          >
            {language === 'mn' ? '← Буцах' : '← Back'}
          </Link>
        </div>

        {isLoading ? (
          <div className="mt-10 text-sm text-muted-foreground">
            {language === 'mn' ? 'Ачааллаж байна...' : 'Loading...'}
          </div>
        ) : error ? (
          <div className="mt-10 text-sm text-destructive" data-testid="products-error">
            {language === 'mn' ? 'Бүтээгдэхүүн татахад алдаа гарлаа.' : 'Failed to load products.'}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-border bg-muted/20 p-6">
            <p className="text-sm text-muted-foreground">
              {language === 'mn'
                ? 'Энд одоогоор бүтээгдэхүүн алга.'
                : 'No products found for this collection.'}
            </p>
            <div className="mt-4">
              <Link
                to="/products"
                className="inline-flex items-center rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                {language === 'mn' ? 'Каталогоор үзэх' : 'Browse Catalog'}
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

