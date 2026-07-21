/**
 * Live weather — Phase 4.
 *
 * When it is actually raining in Phoenix, the rain state runs site-wide,
 * subtly. Open-Meteo current conditions (free, keyless) for the site's
 * home coordinates; raining means measurable precipitation or a WMO
 * rain / drizzle / thunderstorm code (51–67, 80–82, 95–99). The verdict
 * is fetched once per page load and cached in sessionStorage for thirty
 * minutes (`wilhelm.weather`, `{ raining, at }`), so navigating the site
 * never re-asks the sky. Every failure — network, CORS, timeout (a 4s
 * AbortController), malformed body — silently resolves to "not raining";
 * the site never waits on and never breaks over weather.
 *
 * Flag and overrides:
 *   LIVE_WEATHER_ENABLED          compile-time master switch (below)
 *   localStorage 'wilhelm.weather.force'
 *     '1'  force rain — no fetch, the storm runs (testing / demo)
 *     '0'  disable the feature entirely — no fetch, no overlay
 *
 * The rain itself: one fixed full-viewport canvas, created at runtime
 * (house pattern — see eggs-wiring.ts), pointer-events none, aria-hidden,
 * running a cheap GlyphDither in rain mode — greek palette, low density,
 * slow fall, wide cells. It sits IN FRONT of the content at very low
 * opacity (z-index 30, opacity 0.12) rather than behind it: the Great
 * Fade owns the body background and sections paint their own surfaces
 * over it, so a behind-content layer would be swallowed by any opaque
 * surface and lost against the black end of the fade. In front at ~12%,
 * a neutral silver reads as weather over both the black and white ends
 * without ever obscuring a word. (The egg acknowledgment veil lives at
 * z-index 999 and stays above the rain.)
 *
 * The engine pauses under document.hidden and never mounts at all under
 * prefers-reduced-motion. On the homepage, live rain also nudges the
 * memoir through the monsoon's forced-state seam — forceState('release')
 * — so the section weather agrees with the sky; the monsoon dispatches
 * its own monsoon:state events (the audio bed already listens) and the
 * scroll driver resumes untouched on any page load without live rain.
 */

import { GlyphDither } from './filters/dither';
import { forceState } from './monsoon';

/** Master switch for the live-weather feature. */
export const LIVE_WEATHER_ENABLED = true;

/** Phoenix, AZ — the site's home coordinates. */
const API_URL =
  'https://api.open-meteo.com/v1/forecast' +
  '?latitude=33.45&longitude=-112.07&current=weather_code,precipitation';

const CACHE_KEY = 'wilhelm.weather';
const FORCE_KEY = 'wilhelm.weather.force';
const CACHE_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 4000;

/**
 * A neutral silver that reads on both ends of the Great Fade: light
 * enough to surface from the void, dark enough to survive the paper.
 */
const RAIN_SILVER = '#b7b5b0';

/** Overlay engine tuning — deliberately cheap and deliberately quiet. */
const RAIN_CELL = 16;
const RAIN_DENSITY = 0.08;
const RAIN_SPEED = 0.6;
const RAIN_COVERAGE = 0.7; // keeps the placeholder bed nearly silent
const RAIN_OPACITY = '0.12';
const RAIN_Z = '30';
const RAIN_SEED = 214;

interface WeatherVerdict {
  raining: boolean;
  at: number;
}

/** WMO rain / drizzle / thunderstorm codes. */
function isRainCode(code: number): boolean {
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99);
}

/* ---------------------------------------------------------------- */
/* The check                                                         */
/* ---------------------------------------------------------------- */

/**
 * Ask Open-Meteo whether it is raining right now. Exported raw so the
 * failure path is testable in isolation; every failure mode resolves
 * false — this promise never rejects.
 */
export async function fetchRainingVerdict(
  url: string = API_URL,
  timeoutMs: number = FETCH_TIMEOUT_MS
): Promise<boolean> {
  const abort = new AbortController();
  const timer = window.setTimeout(() => abort.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: abort.signal });
    if (!res.ok) return false;
    const body: unknown = await res.json();
    const current = (body as { current?: unknown }).current;
    if (typeof current !== 'object' || current === null) return false;
    const { weather_code, precipitation } = current as {
      weather_code?: unknown;
      precipitation?: unknown;
    };
    return (
      (typeof precipitation === 'number' && precipitation > 0) ||
      (typeof weather_code === 'number' && isRainCode(weather_code))
    );
  } catch {
    return false; // network, CORS, abort, bad JSON — all mean clear skies
  } finally {
    window.clearTimeout(timer);
  }
}

function readCache(): boolean | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<WeatherVerdict>;
    if (typeof v.raining !== 'boolean' || typeof v.at !== 'number') return null;
    if (Date.now() - v.at > CACHE_MS) return null;
    return v.raining;
  } catch {
    return null;
  }
}

function writeCache(raining: boolean): void {
  try {
    const v: WeatherVerdict = { raining, at: Date.now() };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(v));
  } catch {
    /* storage unavailable — the fetch just repeats next page */
  }
}

function readForce(): string | null {
  try {
    return localStorage.getItem(FORCE_KEY);
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------- */
/* The rain                                                          */
/* ---------------------------------------------------------------- */

function mountRainOverlay(): void {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.dataset.weatherRain = '';
  canvas.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;' +
    `z-index:${RAIN_Z};opacity:${RAIN_OPACITY};`;
  document.body.appendChild(canvas);

  const engine = new GlyphDither(canvas, {
    palette: 'greek',
    mode: 'rain',
    cell: RAIN_CELL,
    accent: RAIN_SILVER,
    seed: RAIN_SEED,
    shimmer: 0,
  });

  void engine.load(null, 'stars').then(() => {
    engine.setWeather({
      rainDensity: RAIN_DENSITY,
      rainSpeed: RAIN_SPEED,
      coverage: RAIN_COVERAGE,
    });
    if (!document.hidden) engine.start();
  });

  window.addEventListener('resize', () => engine.resize(), { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) engine.stop();
    else engine.start();
  });
}

/* ---------------------------------------------------------------- */

let initialized = false;

async function run(): Promise<void> {
  if (!LIVE_WEATHER_ENABLED) return;
  const force = readForce();
  if (force === '0') return; // killed at runtime — nothing happens at all

  let raining: boolean;
  if (force === '1') {
    raining = true;
  } else {
    const cached = readCache();
    if (cached === null) {
      raining = await fetchRainingVerdict();
      writeCache(raining);
    } else {
      raining = cached;
    }
  }
  if (!raining) return;

  // the memoir agrees with the sky — through the monsoon seam only.
  // A no-op on pages without the section; never called when clear, so
  // the scroll driver keeps every page load without live rain.
  forceState('release');

  // reduced motion: the section still settles to release (a still),
  // but no site-wide animation mounts at all
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  mountRainOverlay();
}

/** Called by Base.astro on every page. Fire-and-forget; never throws. */
export function initWeather(): void {
  if (initialized) return;
  initialized = true;
  void run();
}
