import { useMemo, useState, useEffect } from "react";
import { r2Url } from "@/lib/r2";
import { ChevronLeft, ChevronRight } from "lucide-react";

type ProductGalleryProps = {
  images: string[]; // энд "products/uuid/web/main.webp" эсвэл full URL байж болно
  name: string;
};

export default function ProductGallery({ images, name }: ProductGalleryProps) {
  // images доторх value-г R2 full URL болгон хувиргана (хэрвээ already full URL бол хэвээр)
  const resolvedImages = useMemo(
    () => (images ?? []).map((img) => r2Url(img)).filter(Boolean),
    [images]
  );

  const [activeImage, setActiveImage] = useState<string>(resolvedImages[0] ?? "");

  // images солигдоход active-г reset хийж өгнө (product солигдох үед хэрэгтэй)
  useEffect(() => {
    setActiveImage(resolvedImages[0] ?? "");
  }, [resolvedImages]);

  // Navigate to previous/next image
  const currentIndex = resolvedImages.indexOf(activeImage);

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setActiveImage(resolvedImages[currentIndex - 1]);
    }
  };

  const goToNext = () => {
    if (currentIndex < resolvedImages.length - 1) {
      setActiveImage(resolvedImages[currentIndex + 1]);
    }
  };

  if (!resolvedImages.length) {
    return (
      <div className="aspect-square bg-muted rounded-2xl grid place-items-center">
        <span className="text-sm text-muted-foreground">No images</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col-reverse lg:flex-row gap-4">
      {/* Thumbnails */}
      <div className="flex lg:flex-col gap-4 overflow-x-auto lg:overflow-y-auto lg:max-h-[500px] scrollbar-hide">
        {resolvedImages.map((img, idx) => (
          <button
            key={img}
            onClick={() => setActiveImage(img)}
            className={`relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
              activeImage === img ? "border-primary" : "border-transparent hover:border-border"
            }`}
          >
            <img src={img} alt={`${name} ${idx}`} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>

      {/* Main Image */}
      <div className="flex-1 aspect-square bg-muted rounded-2xl overflow-hidden relative group">
        <img src={activeImage} alt={name} className="w-full h-full object-cover" />

        {/* Navigation Arrows - только если есть несколько изображений */}
        {resolvedImages.length > 1 && (
          <div className="absolute bottom-4 right-4 flex gap-2">
            {/* Previous Button */}
            <button
              onClick={goToPrevious}
              disabled={currentIndex === 0}
              className={`p-3 rounded-full bg-white/90 dark:bg-black/90 backdrop-blur-sm border border-white/20 transition-all shadow-lg hover:scale-110 ${
                currentIndex === 0
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-white dark:hover:bg-black'
              }`}
              aria-label="Previous image"
            >
              <ChevronLeft size={20} className="text-foreground" />
            </button>

            {/* Next Button */}
            <button
              onClick={goToNext}
              disabled={currentIndex === resolvedImages.length - 1}
              className={`p-3 rounded-full bg-white/90 dark:bg-black/90 backdrop-blur-sm border border-white/20 transition-all shadow-lg hover:scale-110 ${
                currentIndex === resolvedImages.length - 1
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-white dark:hover:bg-black'
              }`}
              aria-label="Next image"
            >
              <ChevronRight size={20} className="text-foreground" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
