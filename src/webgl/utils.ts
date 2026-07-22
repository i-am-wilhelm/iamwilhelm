/**
 * Small shared helpers for the shader core. No DOM, no GL — pure math.
 */

/** Parse '#rrggbb' into normalized [r, g, b] (0..1). */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(
    h.length === 3 ? h.split('').map((c) => c + c).join('') : h,
    16,
  );
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** FNV-1a string hash → uint32. Used to seed per-section randomness. */
export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic PRNG (mulberry32). Same seed → same constellation. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Framerate-independent exponential approach: moves `current` toward
 * `target` with rate `lambda` (higher = snappier) over `dt` seconds.
 */
export function damp(current: number, target: number, lambda: number, dt: number) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/** damp() applied component-wise to a 3-vector, in place. */
export function damp3(
  current: [number, number, number],
  target: [number, number, number],
  lambda: number,
  dt: number,
) {
  const k = 1 - Math.exp(-lambda * dt);
  current[0] += (target[0] - current[0]) * k;
  current[1] += (target[1] - current[1]) * k;
  current[2] += (target[2] - current[2]) * k;
}
