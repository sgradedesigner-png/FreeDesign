import { useMemo, useState, useEffect } from "react";
import { r2Url } from "@/lib/r2";

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
      <div className="flex lg:flex-col gap-4 overflow-x-auto lg:overflow-y-auto lg:max-h-[500px] hide-scrollbar">
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
      <div className="flex-1 aspect-square bg-muted rounded-2xl overflow-hidden relative">
        <img src={activeImage} alt={name} className="w-full h-full object-cover" />
      </div>
    </div>
  );
}
