import { useEffect, useState } from 'react';

const cache = new Map<string, HTMLImageElement>();

/** Load (and cache) an image element for Konva. */
export function useImage(src: string | undefined): HTMLImageElement | undefined {
  const [img, setImg] = useState<HTMLImageElement | undefined>(() => (src ? cache.get(src) : undefined));

  useEffect(() => {
    if (!src) return;
    const cached = cache.get(src);
    if (cached) {
      setImg(cached);
      return;
    }
    const el = new window.Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => {
      cache.set(src, el);
      setImg(el);
    };
    el.src = src;
  }, [src]);

  return img;
}

/** Promise variant used by the exporter. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = cache.get(src);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const el = new window.Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => {
      cache.set(src, el);
      resolve(el);
    };
    el.onerror = reject;
    el.src = src;
  });
}
