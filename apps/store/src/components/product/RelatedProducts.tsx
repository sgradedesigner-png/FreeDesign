import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { Product } from "../../data/products";
import { useQueryClient } from "@tanstack/react-query";
import { prefetchProduct, seedProductCache, useProductsQuery } from "../../data/products.queries";
import { imageUrl } from "@/lib/imageUrl";

const PLACEHOLDER_IMG = "https://placehold.co/800x1000/png?text=No+Image";

export default function RelatedProducts({ currentSlug }: { currentSlug?: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useProductsQuery();
  const products = error ? [] : data ?? [];

  const handlePrefetch = (product: Product) => {
    if (!product.slug) return;
    seedProductCache(queryClient, product);
    prefetchProduct(queryClient, product.slug);
  };

  const related = useMemo(() => {
    const filtered = currentSlug ? products.filter((p) => p.slug !== currentSlug) : products;
    return filtered.slice(0, 4);
  }, [products, currentSlug]);

  if (isLoading && related.length === 0) {
    return <div className="mt-20 text-sm text-muted-foreground">Loading related products...</div>;
  }

  return (
    <div className="mt-20">
      <h2 className="text-2xl font-heading font-bold mb-8 text-foreground">
        Ð¢Ð°Ð½Ð´ Ñ‚Ð°Ð°Ð»Ð°Ð³Ð´Ð°Ð¶ Ð¼Ð°Ð³Ð°Ð´Ð³Ò¯Ð¹
      </h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {related.map((product) => {
          const imgSrc =
            imageUrl(product.image_path ?? product.gallery_paths?.[0] ?? "") || PLACEHOLDER_IMG;

          return (
            <Link
              key={product.id}
              to={`/product/${product.slug}`}
              state={{ product }}
              className="group block"
              onMouseEnter={() => handlePrefetch(product)}
              onFocus={() => handlePrefetch(product)}
              onTouchStart={() => handlePrefetch(product)}
            >
              <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-muted mb-2 sm:mb-3">
                <img
                  src={imgSrc}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                  onError={(e) => {
                    const img = e.currentTarget;
                    if (img.src !== PLACEHOLDER_IMG) img.src = PLACEHOLDER_IMG;
                  }}
                />

                {product.originalPrice && (
                  <span className="absolute top-2 right-2 bg-destructive text-white text-[10px] font-bold px-2 py-1 rounded">
                    Ð¥Ð¯ÐœÐ”Ð ÐÐ›
                  </span>
                )}
                {product.is_new && (
                  <span className="absolute top-2 left-2 bg-success text-white text-[10px] font-bold px-2 py-1 rounded">
                    Ð¨Ð˜ÐÐ­
                  </span>
                )}
              </div>

              <div>
                <h3 className="font-heading font-bold text-sm sm:text-base text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                  {product.name}
                </h3>
                <div className="flex items-center gap-1 mt-1">
                  <div className="flex text-yellow-400 text-xs">â˜…â˜…â˜…â˜…â˜†</div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="font-bold text-primary">${product.price}</span>
                  {product.originalPrice && (
                    <span className="text-xs text-muted-foreground line-through">
                      ${product.originalPrice}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

