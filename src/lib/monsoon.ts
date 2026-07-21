/**
 * The Monsoon — Phase 3.
 *
 * The memoir section's weather. Three states across the section's own
 * scroll, driven by section-relative progress; this module owns the
 * state machine and pushes weather into the memoir dither field through
 * the additive hooks on <glyph-dither> (setWeather / flash). The engine
 * stays generic — everything monsoon-shaped lives here.
 *
 * States (p = section-relative scroll progress):
 *   drought  p < 0.4    sparse static field, heat-shimmer wobble,
 *                       wide spacing, rust accent
 *   break    0.4 – 0.7  Greek glyph rain ramping dense and fast;
 *                       single-frame chromatic lightning
 *   release  0.7 – 1    field saturates, rain settles to a drizzle,
 *                       accent cools rust → storm-green
 *
 * Events on document (fire-and-forget; the audio engine listens):
 *   monsoon:state     { detail: { state } } on entering each state
 *   monsoon:lightning with each strike (sub-bass thunder)
 *
 * Lightning safety: at most FLASH_MAX strikes per pass through the
 * break, never closer than FLASH_GAP_MS apart, each lasting a single
 * paint (~one frame — see GlyphDither.flash). Reduced motion: no rain
 * animation, no wobble, no lightning — the three states render as
 * scroll-positioned stills.
 */

import type { DitherWeather } from './filters/dither';

export type MonsoonState = 'drought' | 'break' | 'release';

/** State thresholds on section-relative progress. */
export const BREAK_AT = 0.4;
export const RELEASE_AT = 0.7;

/** Photosensitivity floor: minimum ms between strikes. */
const FLASH_GAP_MS = 2000;
/** Maximum strikes per pass through the break. */
const FLASH_MAX = 3;
/**
 * Strike candidates as local break progress, and which are armed —
 * deterministic: the same visitor path replays the same storm. Two of
 * three armed keeps the count in the 1–3 band with the gap guard.
 */
const FLASH_POINTS = [0.22, 0.5, 0.78];
const FLASH_ARMED = [true, false, true];

/** Token fallbacks, kept in sync with tokens.css. */
type Rgb3 = [number, number, number];
const RUST: Rgb3 = [138, 74, 43]; // --smoke-monsoon
const STORM: Rgb3 = [74, 107, 90]; // --smoke-monsoon-late

interface MonsoonHost extends HTMLElement {
  setWeather?: (w: DitherWeather) => boolean;
  flash?: () => boolean;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function lerpRgb(a: Rgb3, b: Rgb3, t: number): Rgb3 {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/** Read a --smoke-* hex token off :root, falling back to the constant. */
function tokenRgb(name: string, fallback: Rgb3): Rgb3 {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const m = /^#([0-9a-f]{6})$/i.exec(raw);
  if (!m) return fallback;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

export function stateFor(p: number): MonsoonState {
  if (p < BREAK_AT) return 'drought';
  if (p < RELEASE_AT) return 'break';
  return 'release';
}

/**
 * The weather each progress value asks of the field. Boundary values
 * are continuous across states (density/speed/coverage meet at the
 * thresholds) so crossing never pops.
 */
export function weatherFor(p: number, reduced: boolean, rust: Rgb3, storm: Rgb3): DitherWeather {
  if (p < BREAK_AT) {
    return {
      mode: 'static',
      sparsity: 3,
      wobble: reduced ? 0 : 0.6,
      coverage: 0.85,
      rainDensity: 0,
      rainSpeed: 1,
      accentRgb: rust,
    };
  }
  if (p < RELEASE_AT) {
    const t = (p - BREAK_AT) / (RELEASE_AT - BREAK_AT);
    return {
      mode: 'rain',
      sparsity: 1,
      wobble: 0,
      coverage: 0.9 + t * 0.3,
      rainDensity: 0.15 + t * 0.55,
      rainSpeed: 0.8 + t * 0.5,
      accentRgb: rust,
    };
  }
  const t = clamp01((p - RELEASE_AT) / (1 - RELEASE_AT));
  return {
    mode: 'rain',
    sparsity: 1,
    wobble: 0,
    coverage: 1.2 + t * 1.0, // the field saturates
    rainDensity: 0.7 - t * 0.55, // the rain settles to a drizzle
    rainSpeed: 1.3 - t * 0.75,
    accentRgb: lerpRgb(rust, storm, t),
  };
}

/* ---------------------------------------------------------------- */
/* Driver                                                            */
/* ---------------------------------------------------------------- */

let initialized = false;
let forced: MonsoonState | null = null;
let requestUpdate: (() => void) | null = null;

/** Representative progress for a forced state. */
const FORCED_P: Record<MonsoonState, number> = {
  drought: 0.2,
  break: 0.55,
  release: 0.9,
};

/**
 * Forced-state seam for live weather (Phase 4 — see weather.ts).
 *
 * When the live-weather flag confirms real precipitation at the site's
 * home coordinates (Phoenix), weather.ts calls forceState('release') to
 * settle the memoir into the storm — the scroll driver yields until
 * forceState(null). Safe before initMonsoon() runs (the first update
 * reads the forced state) and a silent no-op on pages without the
 * memoir section. All monsoon:state events dispatch from the driver
 * below; callers never fabricate their own.
 */
export function forceState(next: MonsoonState | null): void {
  forced = next;
  requestUpdate?.();
}

export function initMonsoon(): void {
  if (initialized) return;
  initialized = true;

  const section = document.querySelector<HTMLElement>('#memoir');
  const host = section?.querySelector<MonsoonHost>('glyph-dither');
  if (!section || !host) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rust = tokenRgb('--smoke-monsoon', RUST);
  const storm = tokenRgb('--smoke-monsoon-late', STORM);

  let state: MonsoonState | null = null;
  let lastP = 0;
  let lastAccent = '';
  const flashFired = [false, false, false];
  let flashCount = 0;
  let lastFlashAt = 0;
  let raf = 0;

  /** 0 as the section top meets the viewport bottom; 1 as its bottom leaves the top. */
  const progressOf = (): number => {
    const rect = section.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    return clamp01((vh - rect.top) / (rect.height + vh));
  };

  const tryFlash = (i: number): void => {
    const now = performance.now();
    if (flashCount >= FLASH_MAX || now - lastFlashAt < FLASH_GAP_MS) return;
    flashFired[i] = true;
    if (!host.flash?.()) return; // dormant engine: no visual, no thunder
    flashCount++;
    lastFlashAt = now;
    document.dispatchEvent(new CustomEvent('monsoon:lightning'));
  };

  const update = (): void => {
    const p = forced !== null ? FORCED_P[forced] : progressOf();
    const next = stateFor(p);

    if (next !== state) {
      // leaving the break re-arms the storm for the next pass
      if (state === 'break') {
        flashFired.fill(false);
        flashCount = 0;
      }
      state = next;
      document.dispatchEvent(
        new CustomEvent('monsoon:state', { detail: { state: next } })
      );
    } else if (Math.abs(p - lastP) < 0.003) {
      return; // quantize: nothing meaningful moved
    }

    // lightning fires as the visitor crosses armed points in the break
    if (next === 'break' && !reduced && forced === null) {
      const span = RELEASE_AT - BREAK_AT;
      const t = (p - BREAK_AT) / span;
      const prevT = (lastP - BREAK_AT) / span;
      for (let i = 0; i < FLASH_POINTS.length; i++) {
        if (!FLASH_ARMED[i] || flashFired[i]) continue;
        const pt = FLASH_POINTS[i]!;
        if ((prevT < pt && t >= pt) || (prevT > pt && t <= pt)) tryFlash(i);
      }
    }
    lastP = p;

    const w = weatherFor(p, reduced, rust, storm);
    host.setWeather?.(w);

    // the section's smoke cools with the field, so prose accents follow
    const [r, g, b] = w.accentRgb!;
    const accent = `rgb(${r},${g},${b})`;
    if (accent !== lastAccent) {
      lastAccent = accent;
      section.style.setProperty('--accent', accent);
    }
  };

  const schedule = (): void => {
    if (!raf) {
      raf = requestAnimationFrame(() => {
        raf = 0;
        update();
      });
    }
  };
  // forceState is an explicit driver call — apply synchronously
  requestUpdate = update;

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  // the field wakes lazily; push the current state the moment it does
  host.addEventListener('dither:ready', update);
  update();
}
