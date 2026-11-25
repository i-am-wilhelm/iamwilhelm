/**
 * The Gallery page's tiles (GalleryGrid.astro): each preview's loop plays
 * while the reader is looking at that tile, and only then.
 *
 *   - With a pointer that hovers: while it rests on the tile, or the tile
 *     has keyboard focus. Leaving pauses it; the poster comes back.
 *   - On a touch screen: the tile nearest the middle of the screen, once
 *     it is at least three-quarters in view, plays; the rest are paused.
 *   - Never under reduced motion or Save-Data: the poster stays.
 *
 * A loop's file is fetched the first time it is asked to play (the video
 * carries data-src and preload="none"), so the wall costs only its posters
 * until someone looks closer.
 */
export function initGalleryGrid() {
  const root = document.querySelector<HTMLElement>('[data-gallery-grid]');
  if (!root) return;
  const still =
    matchMedia('(prefers-reduced-motion: reduce)').matches ||
    Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
  if (still) return;

  const tiles = [...root.querySelectorAll<HTMLAnchorElement>('[data-tile]')]
    .map((a) => ({ a, v: a.querySelector<HTMLVideoElement>('video[data-src]') }))
    .filter((t): t is { a: HTMLAnchorElement; v: HTMLVideoElement } => !!t.v);

  const play = (v: HTMLVideoElement) => {
    if (!v.src) v.src = v.dataset.src!;
    v.play()
      .then(() => v.classList.add('is-playing'))
      .catch(() => {});
  };
  const stop = (v: HTMLVideoElement) => {
    v.pause();
    v.classList.remove('is-playing');
  };
  for (const { v } of tiles) v.addEventListener('playing', () => v.classList.add('is-playing'));

  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    for (const { a, v } of tiles) {
      a.addEventListener('pointerenter', () => play(v));
      a.addEventListener('pointerleave', () => stop(v));
      a.addEventListener('focus', () => play(v));
      a.addEventListener('blur', () => stop(v));
    }
    return;
  }

  /* Touch: the one most in view plays. */
  const seen = new Map<HTMLVideoElement, number>();
  let current: HTMLVideoElement | null = null;
  let frame = 0;
  const choose = () => {
    frame = 0;
    const mid = innerHeight / 2;
    let best: HTMLVideoElement | null = null;
    let bestD = Infinity;
    for (const [v, ratio] of seen) {
      if (ratio < 0.75) continue;
      const r = v.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - mid);
      if (d < bestD) [best, bestD] = [v, d];
    }
    if (best === current) return;
    if (current) stop(current);
    current = best;
    if (current) play(current);
  };
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const v = e.target.querySelector('video') as HTMLVideoElement;
        if (e.isIntersecting) seen.set(v, e.intersectionRatio);
        else seen.delete(v);
      }
      if (!frame) frame = requestAnimationFrame(choose);
    },
    { threshold: [0, 0.75, 1] },
  );
  for (const { a } of tiles) io.observe(a.querySelector('.tile__frame')!);
  addEventListener(
    'scroll',
    () => {
      if (!frame) frame = requestAnimationFrame(choose);
    },
    { passive: true },
  );
}
