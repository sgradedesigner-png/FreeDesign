import { useEffect, useState } from 'react';

type LoadStatus = 'loading' | 'loaded' | 'failed';

/**
 * Loads an image for use with Konva <Image> node.
 * Returns the native HTMLImageElement once loaded.
 */
export function useKonvaImage(src: string | null | undefined): [HTMLImageElement | null, LoadStatus] {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');

  useEffect(() => {
    if (!src) {
      setImage(null);
      setStatus('failed');
      return;
    }

    setStatus('loading');
    setImage(null);

    const img = new window.Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      setImage(img);
      setStatus('loaded');
    };

    img.onerror = () => {
      setImage(null);
      setStatus('failed');
    };

    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return [image, status];
}
