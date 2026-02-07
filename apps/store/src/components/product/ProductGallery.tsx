import { useMemo, useState, useEffect, useRef } from "react";
import { r2Url } from "@/lib/r2";
import { ChevronLeft, ChevronRight } from "lucide-react";

type ProductGalleryProps = {
  // Accepts R2 keys (products/uuid/web/main.webp) or full URLs.
  images: string[];
  name: string;
};

export default function ProductGallery({ images, name }: ProductGalleryProps) {
  // Normalize each image to a usable URL via r2Url helper.
  const resolvedImages = useMemo(
    () => (images ?? []).map((img) => r2Url(img)).filter(Boolean),
    [images]
  );

  const [activeImage, setActiveImage] = useState<string>(resolvedImages[0] ?? "");
  const [isZooming, setIsZooming] = useState(false);
  const [isOverNavButtons, setIsOverNavButtons] = useState(false);
  const [supportsHover, setSupportsHover] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 });
  const [lensPosition, setLensPosition] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLDivElement>(null);

  // Reset active image when image list changes (e.g. product/variant switch).
  useEffect(() => {
    setActiveImage(resolvedImages[0] ?? "");
  }, [resolvedImages]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const updateHoverSupport = () => setSupportsHover(mediaQuery.matches);

    updateHoverSupport();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateHoverSupport);
      return () => mediaQuery.removeEventListener("change", updateHoverSupport);
    }

    mediaQuery.addListener(updateHoverSupport);
    return () => mediaQuery.removeListener(updateHoverSupport);
  }, []);

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

  // Handle mouse move for zoom effect
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!supportsHover || !imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Lens size (30% of image)
    const lensSize = 150;

    // Calculate lens position (centered on cursor)
    let lensX = x - lensSize / 2;
    let lensY = y - lensSize / 2;

    // Keep lens within bounds
    lensX = Math.max(0, Math.min(lensX, rect.width - lensSize));
    lensY = Math.max(0, Math.min(lensY, rect.height - lensSize));

    setLensPosition({ x: lensX, y: lensY });

    // Calculate zoom position for the zoomed window (percentage)
    const zoomX = (lensX + lensSize / 2) / rect.width * 100;
    const zoomY = (lensY + lensSize / 2) / rect.height * 100;

    setZoomPosition({ x: zoomX, y: zoomY });
  };

  const handleMouseEnter = () => {
    if (supportsHover && !isOverNavButtons) {
      setIsZooming(true);
    }
  };

  const handleMouseLeave = () => {
    setIsZooming(false);
  };

  if (!resolvedImages.length) {
    return (
      <div className="aspect-square bg-muted rounded-2xl grid place-items-center">
        <span className="text-sm text-muted-foreground">No images</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col-reverse lg:flex-row gap-3 sm:gap-4">
      {/* Thumbnails */}
      <div className="flex lg:flex-col gap-2 sm:gap-3 overflow-x-auto lg:overflow-y-auto lg:max-h-[500px] scrollbar-hide">
        {resolvedImages.map((img, idx) => (
          <button
            key={img}
            onClick={() => setActiveImage(img)}
            onMouseEnter={() => setActiveImage(img)}
            className={`relative w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
              activeImage === img ? "border-primary" : "border-transparent hover:border-border"
            }`}
          >
            <img src={img} alt={`${name} ${idx}`} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>

      {/* Main Image */}
      <div className="flex-1 relative">
        <div
          ref={imageRef}
          className="relative group bg-muted rounded-2xl overflow-hidden aspect-[4/3] sm:aspect-[5/4] lg:aspect-square max-h-[70vh]"
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: isZooming && !isOverNavButtons ? 'crosshair' : 'default' }}
        >
          <img src={activeImage} alt={name} className="w-full h-full object-contain p-2 sm:p-3 md:p-4" />

          {/* Lens overlay - shows which area is being magnified */}
          {supportsHover && isZooming && !isOverNavButtons && (
            <div
              className="absolute border-2 border-primary bg-primary/10 pointer-events-none z-20"
              style={{
                width: '150px',
                height: '150px',
                left: `${lensPosition.x}px`,
                top: `${lensPosition.y}px`,
              }}
            />
          )}

          {/* Navigation arrows only when there are multiple images */}
          {resolvedImages.length > 1 && (
            <div
              className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 flex gap-2 z-10"
              onMouseEnter={() => {
                setIsOverNavButtons(true);
                setIsZooming(false);
              }}
              onMouseLeave={() => {
                setIsOverNavButtons(false);
                if (supportsHover) setIsZooming(true);
              }}
            >
              {/* Previous Button */}
              <button
                onClick={goToPrevious}
                disabled={currentIndex === 0}
                className={`p-2.5 sm:p-3 rounded-full bg-white/90 dark:bg-black/90 backdrop-blur-sm border border-white/20 transition-all shadow-lg hover:scale-110 ${
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
                className={`p-2.5 sm:p-3 rounded-full bg-white/90 dark:bg-black/90 backdrop-blur-sm border border-white/20 transition-all shadow-lg hover:scale-110 ${
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

        {/* Zoom Window - absolute positioned, appears on the right when hovering */}
        {supportsHover && isZooming && !isOverNavButtons && imageRef.current && (
          <div
            className="fixed z-50 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border-2 border-primary animate-in fade-in zoom-in-95 duration-200"
            style={{
              width: '500px',
              height: '500px',
              top: `${imageRef.current.getBoundingClientRect().top}px`,
              left: `${imageRef.current.getBoundingClientRect().right + 20}px`,
            }}
          >
            <div
              className="w-full h-full"
              style={{
                backgroundImage: `url("${activeImage}")`,
                backgroundSize: '250%',
                backgroundPosition: `${zoomPosition.x}% ${zoomPosition.y}%`,
                backgroundRepeat: 'no-repeat',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
