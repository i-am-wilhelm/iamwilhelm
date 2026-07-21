/**
 * Egg wiring — Phase 2.
 *
 * Connects the hidden interactions to the registry (eggs.ts). Eggs 4, 5,
 * 6, and 8 live here; the constellation eggs (1–3) are wired inside the
 * constellation system. Nothing in this module may look like a control:
 * no cursor changes, no tooltips, no tab stops — hotspots are aria-hidden
 * and unfocusable. Every egg no-ops cleanly when its target element is
 * absent, so initEggs() runs safely on every page.
 *
 * Acknowledgment: finding any egg breathes one faint bar (7/8, 980ms) of
 * light across the page. Reduced motion gets a static acknowledgment —
 * no pulse.
 */

import { mark } from './eggs';
import { BAR, SEVEN_EIGHT } from './timing';

/** Matches --ease-veil in tokens.css. */
const EASE_VEIL = 'cubic-bezier(0.32, 0, 0.24, 1)';

/** The outer-planet glyphs that count for egg #6. */
const OUTER_GLYPHS = new Set(['♅', '♆']);

/** How long after a ♅/♆ sighting a click on its field still counts. */
const SIGHTING_WINDOW_MS = BAR * 4;

/** Options accepted by the glyph-dither swap hook. */
interface SwapOpts {
  palette?: string;
  accent?: string;
  seed?: number;
  src?: string;
}

/** The runtime shape of <glyph-dither> once its Phase-2 swap hook exists. */
interface SwappableDither extends HTMLElement {
  swap?: (opts: SwapOpts) => boolean;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Offsets (0..1) of the 2+2+3 beat onsets within one bar: 0, 2/7, 4/7. */
const beatOffsets = ((): number[] => {
  const out: number[] = [];
  let t = 0;
  for (const beat of SEVEN_EIGHT) {
    out.push(t / 7);
    t += beat;
  }
  return out;
})();

/* ---------------------------------------------------------------- */
/* Global acknowledgment — one near-subliminal bar of light          */
/* ---------------------------------------------------------------- */

function initAcknowledgment(): void {
  document.addEventListener('egg:found', () => {
    const veil = document.createElement('div');
    veil.setAttribute('aria-hidden', 'true');
    veil.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:999;' +
      'background:var(--ink,#e8e6e1);opacity:0;';
    document.body.appendChild(veil);

    if (prefersReducedMotion()) {
      // static acknowledgment: one faint still frame, no pulse
      veil.style.opacity = '0.03';
      window.setTimeout(() => veil.remove(), BAR);
      return;
    }

    const pulse = veil.animate(
      [
        { opacity: 0 },
        { opacity: 0.02, offset: beatOffsets[1]! },
        { opacity: 0.045, offset: beatOffsets[2]! },
        { opacity: 0 },
      ],
      { duration: BAR, easing: EASE_VEIL }
    );
    pulse.onfinish = () => veil.remove();
  });
}

/* ---------------------------------------------------------------- */
/* Egg 4 — the colophon (α´ Μαρτίου ͵αϡϟα)                            */
/* ---------------------------------------------------------------- */

/**
 * Triple-click the colophon line. Acknowledged with a brief glow in the
 * current section accent, shaped on the 2+2+3 grid: rises over the two
 * short beats, releases across the long one.
 */
function initColophon(): void {
  const colophon = document.querySelector<HTMLElement>('.site-footer .colophon');
  if (!colophon) return;

  colophon.addEventListener('click', (e) => {
    if (e.detail !== 3) return;
    mark('colophon');
    if (prefersReducedMotion()) return;
    const accent =
      getComputedStyle(colophon).getPropertyValue('--accent').trim() || 'currentColor';
    colophon.animate(
      [
        { textShadow: '0 0 0 transparent' },
        { textShadow: `0 0 0.4em ${accent}`, offset: beatOffsets[1]! },
        { textShadow: `0 0 0.4em ${accent}`, offset: beatOffsets[2]! },
        { textShadow: '0 0 0 transparent' },
      ],
      { duration: BAR, easing: EASE_VEIL }
    );
  });
}

/* ---------------------------------------------------------------- */
/* Egg 5 — 23°52′, the eighth house                                   */
/* ---------------------------------------------------------------- */

/** A single click on the tilted § ornament in the writings template. */
function initEighthHouse(): void {
  const ornament = document.querySelector<HTMLElement>('.post-meta .ornament');
  if (!ornament) return;
  ornament.addEventListener('click', () => mark('eighth-house'));
}

/* ---------------------------------------------------------------- */
/* Egg 6 — ♅ ♆ surfacing in the dither                                */
/* ---------------------------------------------------------------- */

/**
 * The engine announces rare glyphs via `dither:rare` (bubbling from its
 * canvas). When ♅ or ♆ has surfaced in a field within the last few bars,
 * a click anywhere on that field counts as the catch.
 */
function initOuterGlyphs(): void {
  const sightings = new WeakMap<Element, number>();

  document.addEventListener('dither:rare', (e) => {
    const detail = (e as CustomEvent<{ glyph?: string }>).detail;
    if (!detail?.glyph || !OUTER_GLYPHS.has(detail.glyph)) return;
    const host = e.target instanceof Element ? e.target.closest('glyph-dither') : null;
    if (host) sightings.set(host, performance.now());
  });

  document.addEventListener('click', (e) => {
    const host = e.target instanceof Element ? e.target.closest('glyph-dither') : null;
    if (!host) return;
    const seenAt = sightings.get(host);
    if (seenAt !== undefined && performance.now() - seenAt <= SIGHTING_WINDOW_MS) {
      mark('outer-glyphs');
    }
  });
}

/* ---------------------------------------------------------------- */
/* Egg 8 — style-swap hotspots (Homestar mode)                        */
/* ---------------------------------------------------------------- */

interface SwapSpot {
  /** The dither field the hotspot sits over. */
  selector: string;
  /** Which corner of the field carries the invisible zone. */
  corner: 'tl' | 'tr' | 'bl' | 'br';
  /**
   * The alternate skin — only the fields named here toggle. Home values
   * are read back from the element's data-* attributes.
   */
  alt: { palette?: string; accent?: string; seedShift?: number; src?: string };
}

const SWAP_SPOTS: SwapSpot[] = [
  {
    // the hero portrait — pose swap, serious ↔ smile
    selector: '#hero glyph-dither[data-src="/img/facecard.jpg"]',
    corner: 'br',
    alt: { src: '/img/facecard-smile.jpg' },
  },
  {
    selector: '#philosophy glyph-dither',
    corner: 'br',
    alt: { palette: 'ascii', accent: 'var(--smoke-babalon)', seedShift: 1 },
  },
  {
    selector: '#memoir glyph-dither',
    corner: 'tl',
    alt: { palette: 'ascii', accent: 'var(--smoke-monsoon-late)', seedShift: 1 },
  },
];

function cornerCss(corner: SwapSpot['corner']): string {
  switch (corner) {
    case 'tl':
      return 'top:0;left:0;';
    case 'tr':
      return 'top:0;right:0;';
    case 'bl':
      return 'bottom:0;left:0;';
    case 'br':
      return 'bottom:0;right:0;';
  }
}

/**
 * Invisible corner zones over chosen dither fields. Clicking one swaps
 * that field's palette/accent/seed to an alternate skin; clicking again
 * swaps it home. The zones are aria-hidden, unfocusable, and carry no
 * affordance of any kind.
 */
function initStyleSwap(): void {
  for (const spot of SWAP_SPOTS) {
    const host = document.querySelector<SwappableDither>(spot.selector);
    if (!host) continue;

    const zone = document.createElement('div');
    zone.setAttribute('aria-hidden', 'true');
    zone.style.cssText =
      'position:absolute;width:16%;height:24%;' +
      'min-width:44px;min-height:44px;max-width:120px;max-height:120px;' +
      `${cornerCss(spot.corner)}z-index:1;`;

    zone.addEventListener('click', (e) => {
      e.stopPropagation(); // hotspot clicks belong to this egg alone
      if (typeof host.swap !== 'function') return;
      const d = host.dataset;
      const alt = spot.alt;
      const swapped = d.eggSwapped === 'true';

      // toggle only the fields this spot declares; home comes from data-*
      const target: SwapOpts = {};
      if (alt.palette !== undefined) {
        target.palette = swapped ? (d.palette ?? 'ascii') : alt.palette;
      }
      if (alt.accent !== undefined) {
        target.accent = swapped ? (d.accent ?? '#e8e6e1') : alt.accent;
      }
      if (alt.seedShift !== undefined) {
        const homeSeed = Number(d.seed) || 1;
        target.seed = swapped ? homeSeed : homeSeed + alt.seedShift;
      }
      if (alt.src !== undefined && d.src) {
        target.src = swapped ? d.src : alt.src;
      }

      if (!host.swap(target)) return; // engine not awake yet — no mark
      d.eggSwapped = String(!swapped);
      mark('style-swap');
    });

    host.appendChild(zone);
  }
}

/* ---------------------------------------------------------------- */

/** Wire every non-constellation egg present on the current page. */
export function initEggs(): void {
  initAcknowledgment();
  initColophon();
  initEighthHouse();
  initOuterGlyphs();
  initStyleSwap();
}
