import { useEffect, useRef, useState } from 'react';
import { cn } from '@dreamward/design-system';

/** The onboarding loops rendered from /motion (Remotion). Text-free, so they work in both languages. */
export type MotionName = 'welcome' | 'chapter' | 'wheel' | 'ikigai' | 'steps' | 'clarity';

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * A short, silent, looping illustration for a first-run moment, on its night-ink tile.
 * Decorative (the copy next to it carries the meaning). With reduced motion, or before the
 * video can play, it shows the still poster; it pauses while scrolled out of view.
 */
export function OnboardingMotion({ name, className }: { name: MotionName; className?: string }) {
  const base = `${import.meta.env.BASE_URL}motion/${name}`;
  const [still] = useState(reducedMotion);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) void video.play().catch(() => {});
      else video.pause();
    });
    io.observe(video);
    return () => io.disconnect();
  }, []);

  const tile = cn('aspect-[16/10] w-full overflow-hidden rounded-xl border border-border bg-[#0a0a0f] object-cover', className);
  if (still) return <img src={`${base}.webp`} alt="" aria-hidden="true" className={tile} />;
  return (
    <video ref={ref} className={tile} poster={`${base}.webp`} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1}>
      <source src={`${base}.webm`} type="video/webm" />
      <source src={`${base}.mp4`} type="video/mp4" />
    </video>
  );
}
