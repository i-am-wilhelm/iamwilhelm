/**
 * THE PLEIADES RECEIVE — the Cluster section's half of the natal handoff.
 *
 * The hero scatters its planets into a point-field and falls silent
 * (iw:natal-phase → dissolve); the WebGL constellation pass lifts the
 * Cluster sky to meet them. Here, the seven DOM sisters take their stations
 * as the section scrolls in: each falls from above (from the hero's
 * direction), brightening and growing, staggered in the site's 2+2+3 so the
 * seven land like a bar of 7/8. Scrubbed by iw:section-progress, so the
 * arrival is scroll-held, never a one-shot.
 *
 * No imports across subsystems; events only.
 */
import { meter } from '../design/tokens';
import { on } from './events';

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/** Cumulative 2+2+3 offset for the nth sister, normalized so the last lands at 1. */
function meterStagger(count: number): number[] {
  const pattern = meter.septuple;
  const raw: number[] = [];
  let t = 0;
  for (let i = 0; i < count; i++) {
    raw.push(t);
    t += pattern[i % pattern.length];
  }
  const max = raw[raw.length - 1] || 1;
  return raw.map((v) => v / max);
}

/** Deterministic hash → 0..1. */
function hash01(n: number, salt: number): number {
  let h = (2166136261 ^ salt) >>> 0;
  h = Math.imul(h ^ n, 16777619) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 16777619) >>> 0;
  return ((h >>> 0) % 10000) / 10000;
}

let booted = false;

export function initCluster(): void {
  if (booted || typeof window === 'undefined') return;
  const field = document.querySelector<HTMLElement>('.pleiades');
  if (!field) return;
  booted = true;

  const nodes = Array.from(field.querySelectorAll<HTMLElement>('.node'));
  if (!nodes.length) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return; // the stations are the CSS defaults — nothing to animate

  // Window of section progress over which the sisters arrive: the section's
  // top is at the viewport bottom at 0 and at the top at 0.5; the copy
  // reveal fires near 0.19, so the landing runs through it.
  const START = 0.1;
  const END = 0.42;
  const stagger = meterStagger(nodes.length);
  const seeds = nodes.map((_, i) => ({
    // Fall from above and a little aside — from the hero's sky.
    dx: (hash01(i, 11) - 0.5) * 110,
    dy: -(70 + hash01(i, 23) * 110),
  }));

  let last = -1;
  const apply = (progress: number) => {
    const t = smooth(START, END, progress);
    if (t === last) return;
    last = t;
    nodes.forEach((node, i) => {
      // Each sister's own landing spans 55% of the window, offset by the meter.
      const lo = stagger[i] * 0.45;
      const k = smooth(lo, lo + 0.55, t);
      const ease = 1 - Math.pow(1 - k, 3);
      node.style.setProperty('--dx', `${(seeds[i].dx * (1 - ease)).toFixed(1)}px`);
      node.style.setProperty('--dy', `${(seeds[i].dy * (1 - ease)).toFixed(1)}px`);
      node.style.setProperty('--s', (0.35 + 0.65 * ease).toFixed(3));
      node.style.setProperty('--o', (0.55 * ease).toFixed(3));
    });
  };

  // Start folded until the section reports progress.
  apply(0);

  on('iw:section-progress', ({ id, progress }) => {
    if (id === 'cluster') apply(progress);
  });
}
