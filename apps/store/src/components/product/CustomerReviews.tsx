import { Star, ThumbsUp, CheckCircle } from 'lucide-react';

type Review = {
  id: number;
  name: string;
  date: string;
  rating: number;
  verified?: boolean;
  text: string;
  likes: number;
  image: string;
};

type CustomerReviewsProps = {
  reviews: Review[];
  averageRating?: number;
  totalReviews?: number;
};

function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={size}
          className={i < rating ? 'text-yellow-400' : 'text-muted-foreground/40'}
          fill={i < rating ? 'currentColor' : 'none'}
        />
      ))}
    </div>
  );
}

export default function CustomerReviews({
  reviews,
  averageRating,
  totalReviews,
}: CustomerReviewsProps) {
  const dummyReviews =
    reviews.length > 0
      ? reviews
      : [
          {
            id: 1,
            name: 'Jessica Park',
            date: '01/05/2026',
            rating: 5,
            verified: true,
            text: 'Мэргэжлийн болон энгийн орчинд тохирсон төгс пиджак. Би үүнийг ажилд орох ярилцлага, оройн зоог, тэр ч байтугай ажил дээрх энгийн баасан гарагт өмссөн. Олон талт байдал нь гайхалтай бөгөөд энэ нь намайг үргэлж өөртөө итгэлтэй, эмх цэгцтэй мэдрүүлдэг.',
            likes: 42,
            image:
              'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80',
          },
          {
            id: 2,
            name: 'Michael Chen',
            date: '12/28/2025',
            rating: 4,
            verified: true,
            text: 'Чанар нь сайн, гэхдээ размер нь бага зэрэг том санагдлаа. Бусдаар бол дажгүй.',
            likes: 12,
            image:
              'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80',
          },
        ];

  return (
    <div className="mt-16 border-t border-border pt-12">
      <h2 className="text-2xl font-heading font-bold mb-8 text-foreground">
        Хэрэглэгчийн үнэлгээ
      </h2>

      {/* Summary Box */}
      <div className="rounded-2xl border border-border bg-card/50 backdrop-blur p-8 mb-10 flex flex-col md:flex-row items-center gap-8 md:gap-16">
        <div className="text-center">
          <div className="text-6xl font-bold text-foreground mb-2">
            {(averageRating ?? 4.5).toFixed(1)}
          </div>

          <div className="flex justify-center mb-2">
            <StarRow rating={Math.round(averageRating ?? 4.5)} size={24} />
          </div>

          <p className="text-sm text-muted-foreground">
            Нийт {totalReviews ?? 127} үнэлгээ
          </p>
        </div>

        {/* Progress Bars */}
        <div className="flex-1 w-full space-y-2">
          {[5, 4, 3, 2, 1].map((star, idx) => (
            <div key={star} className="flex items-center gap-3">
              <span className="text-xs font-bold w-3 text-foreground">{star}</span>
              <Star size={12} className="text-muted-foreground" />

              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-400 rounded-full"
                  style={{
                    width: idx === 0 ? '70%' : idx === 1 ? '20%' : '5%',
                  }}
                />
              </div>

              <span className="text-xs text-muted-foreground w-8 text-right">
                {idx === 0 ? 98 : idx === 1 ? 24 : 5}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-6">
        {dummyReviews.map((review) => (
          <div
            key={review.id}
            className="rounded-2xl border border-border bg-card p-6 shadow-sm"
          >
            <div className="flex items-start justify-between mb-4 gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={review.image}
                  alt={review.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-sm text-foreground truncate">
                      {review.name}
                    </h4>

                    {review.verified && (
                      <span className="text-[10px] font-medium text-emerald-500 flex items-center gap-1">
                        <CheckCircle size={12} /> Баталгаажсан
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">{review.date}</p>
                </div>
              </div>

              <StarRow rating={review.rating} size={14} />
            </div>

            {/* ✅ энд хамгийн чухал FIX: text-secondary → text-muted-foreground */}
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              {review.text}
            </p>

            <button className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground/80 hover:text-foreground transition-colors">
              <ThumbsUp size={14} className="text-muted-foreground" /> Тустай ({review.likes})
            </button>
          </div>
        ))}
      </div>

      <button className="w-full mt-8 py-3 rounded-xl border border-primary text-primary font-bold hover:bg-primary hover:text-primary-foreground transition-all">
        Үнэлгээ бичих
      </button>
    </div>
  );
}
