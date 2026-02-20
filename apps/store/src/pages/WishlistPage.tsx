import { Link } from 'react-router-dom';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import { Trash2, ArrowLeft, Heart, ShoppingCart } from 'lucide-react';
import { imageUrl } from "@/lib/imageUrl";

const PLACEHOLDER_IMG = 'https://placehold.co/800x1000/png?text=No+Image';

export default function WishlistPage() {
  const { wishlist, removeFromWishlist } = useWishlist();
  const { addItem } = useCart();
  const { language } = useTheme();

  const handleAddToCart = (product: any) => {
    const defaultColor = product.colors?.[0] || null;
    const defaultSize = product.sizes?.[0] || null;
    addItem(product, defaultColor, defaultSize);
  };

  if (wishlist.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 pt-28">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Link to="/" className="hover:text-primary flex items-center gap-1">
            <ArrowLeft size={14} />
            {language === 'mn' ? 'Нүүр' : 'Home'}
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">
            {language === 'mn' ? 'Wishlist' : 'Wishlist'}
          </span>
        </div>

        {/* Empty State */}
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center mb-6">
            <Heart size={64} className="text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-2">
            {language === 'mn' ? 'Таны wishlist хоосон байна' : 'Your wishlist is empty'}
          </h2>
          <p className="text-muted-foreground mb-6">
            {language === 'mn' ? 'Таалагдсан бараагаа wishlist-д нэмнэ үү' : 'Add your favorite items to wishlist'}
          </p>
          <Link
            to="/"
            className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors"
          >
            {language === 'mn' ? 'Дэлгүүр хэсэх' : 'Continue Shopping'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 pt-28 pb-20">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
        <Link to="/" className="hover:text-primary flex items-center gap-1">
          <ArrowLeft size={14} />
          {language === 'mn' ? 'Нүүр' : 'Home'}
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">
          {language === 'mn' ? 'Wishlist' : 'Wishlist'}
        </span>
      </div>

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <Heart className="text-primary" size={32} />
          {language === 'mn' ? 'Миний Wishlist' : 'My Wishlist'}
          <span className="text-sm font-medium text-muted-foreground bg-black/5 dark:bg-white/10 px-3 py-1 rounded-full">
            {wishlist.length} {language === 'mn' ? 'бараа' : 'items'}
          </span>
        </h1>
      </div>

      {/* Wishlist Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {wishlist.map((item) => {
          const imgSrc = imageUrl(item.image_path ?? item.gallery_paths?.[0] ?? "") || PLACEHOLDER_IMG;

          return (
            <div
              key={item.id}
              className="group relative bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Product Image */}
              <Link to={`/product/${item.id}`} className="block aspect-[4/5] overflow-hidden bg-muted">
                <img
                  src={imgSrc}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </Link>

              {/* Remove Button */}
              <button
                onClick={() => removeFromWishlist(item.id)}
                className="absolute top-3 right-3 p-2 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-white/20 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shadow-lg"
                aria-label="Remove from wishlist"
              >
                <Trash2 size={18} />
              </button>

              {/* Product Info */}
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">
                    {item.category}
                  </p>
                  <Link to={`/product/${item.id}`}>
                    <h3 className="font-bold text-foreground line-clamp-2 hover:text-primary transition-colors">
                      {item.name}
                    </h3>
                  </Link>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-primary">
                    ${item.price.toFixed(2)}
                  </span>
                  {item.originalPrice && (
                    <span className="text-sm text-muted-foreground line-through">
                      ${item.originalPrice.toFixed(2)}
                    </span>
                  )}
                </div>

                {/* Add to Cart Button */}
                <button
                  onClick={() => handleAddToCart(item)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
                >
                  <ShoppingCart size={18} />
                  <span>{language === 'mn' ? 'САГСАНД НЭМЭХ' : 'ADD TO CART'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

