import { Star } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

type ReviewSummaryProps = {
  /**
   * Average rating (0-5)
   */
  rating: number;
  /**
   * Total number of reviews
   */
  reviewCount: number;
  /**
   * Show detailed rating breakdown (5-star histogram)
   */
  showBreakdown?: boolean;
  /**
   * Rating breakdown data [5-star, 4-star, 3-star, 2-star, 1-star]
   */
  breakdown?: [number, number, number, number, number];
  /**
   * Variant style
   */
  variant?: 'default' | 'compact' | 'inline';
  /**
   * Custom className
   */
  className?: string;
};

/**
 * Render star rating with partial stars
 */
function StarRating({ rating, size = 20 }: { rating: number; size?: number }) {
  const fullStars = Math.floor(rating);
  const hasPartial = rating % 1 !== 0;
  const partialPercent = (rating % 1) * 100;

  return (
    <div className="flex items-center gap-0.5">
      {[...Array(5)].map((_, i) => {
        if (i < fullStars) {
          // Full star
          return (
            <Star
              key={i}
              size={size}
              className="fill-primary text-primary"
            />
          );
        } else if (i === fullStars && hasPartial) {
          // Partial star
          return (
            <div key={i} className="relative">
              <Star size={size} className="text-muted" />
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${partialPercent}%` }}
              >
                <Star size={size} className="fill-primary text-primary" />
              </div>
            </div>
          );
        } else {
          // Empty star
          return (
            <Star
              key={i}
              size={size}
              className="text-muted"
            />
          );
        }
      })}
    </div>
  );
}

/**
 * ReviewSummary - Social proof conversion element
 *
 * Displays product rating and review count to build trust.
 * Can show detailed breakdown for more credibility.
 *
 * @example
 * <ReviewSummary rating={4.5} reviewCount={128} />
 * <ReviewSummary rating={4.8} reviewCount={89} showBreakdown breakdown={[45, 32, 8, 3, 1]} />
 */
export default function ReviewSummary({
  rating,
  reviewCount,
  showBreakdown = false,
  breakdown,
  variant = 'default',
  className = '',
}: ReviewSummaryProps) {
  const { language } = useTheme();

  if (rating === 0 && reviewCount === 0) {
    return null;
  }

  // Inline variant - compact single line
  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <StarRating rating={rating} size={16} />
        <span className="text-sm font-medium text-foreground">
          {rating.toFixed(1)}
        </span>
        <span className="text-sm text-muted-foreground">
          ({reviewCount} {language === 'mn' ? 'үнэлгээ' : 'reviews'})
        </span>
      </div>
    );
  }

  // Compact variant - no breakdown
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="text-center">
          <div className="text-3xl font-bold text-foreground">{rating.toFixed(1)}</div>
          <StarRating rating={rating} size={18} />
          <div className="text-xs text-muted-foreground mt-1">
            {reviewCount} {language === 'mn' ? 'үнэлгээ' : 'reviews'}
          </div>
        </div>
      </div>
    );
  }

  // Default variant - full breakdown
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-4">
        <div className="text-center">
          <div className="text-4xl font-bold text-foreground">{rating.toFixed(1)}</div>
          <StarRating rating={rating} size={20} />
          <div className="text-sm text-muted-foreground mt-1">
            {reviewCount} {language === 'mn' ? 'үнэлгээ' : 'reviews'}
          </div>
        </div>

        {showBreakdown && breakdown && (
          <div className="flex-1 space-y-2">
            {breakdown.map((count, index) => {
              const stars = 5 - index;
              const percentage = reviewCount > 0 ? (count / reviewCount) * 100 : 0;

              return (
                <div key={stars} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-8">
                    {stars} {language === 'mn' ? 'од' : 'star'}
                  </span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-8 text-right">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
