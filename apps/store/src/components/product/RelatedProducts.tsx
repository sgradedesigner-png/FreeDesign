import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchProducts } from "../../data/products.api";
import type { Product } from "../../data/products";
import { r2Url } from "@/lib/r2";

const PLACEHOLDER_IMG = "https://placehold.co/800x1000/png?text=No+Image";

export default function RelatedProducts({ currentSlug }: { currentSlug?: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      setIsLoading(true);
      try {
        const data = await fetchProducts();
        if (isMounted) setProducts(data);
      } catch {
        if (isMounted) setProducts([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

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
        Танд таалагдаж магадгүй
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {related.map((product) => {
          const imgSrc =
            r2Url(product.image_path ?? product.gallery_paths?.[0] ?? "") || PLACEHOLDER_IMG;

          return (
            <Link
              key={product.slug ?? product.uuid ?? product.id ?? `${product.name}-${product.price}`}
              to={`/product/${product.slug}`}
              state={{ product }}
              className="group block"
            >
              <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted mb-3">
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
                    ХЯМДРАЛ
                  </span>
                )}
                {product.isNew && (
                  <span className="absolute top-2 left-2 bg-success text-white text-[10px] font-bold px-2 py-1 rounded">
                    ШИНЭ
                  </span>
                )}
              </div>

              <div>
                <h3 className="font-heading font-bold text-base text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                  {product.name}
                </h3>
                <div className="flex items-center gap-1 mt-1">
                  <div className="flex text-yellow-400 text-xs">★★★★☆</div>
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
