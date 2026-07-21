/**
 * The dawn gate (egg 10) — Phase 4.
 *
 * When the whole chain is held — all nine prior marks PLUS the
 * underworld passphrase — a door renders in the homepage #dawn section
 * that did not previously exist: a tall rectangle of ordered glyphs,
 * pale rose, quiet. Whether it OPENS depends on the hour. It opens
 * only during the hour before local sunrise.
 *
 * Sunrise is computed locally with the NOAA/Almanac solar approximation
 * — no network, no dependency. Position comes from geolocation ONLY if
 * permission is already granted (queried via navigator.permissions;
 * this module never prompts). Otherwise it approximates: longitude from
 * the timezone offset (UTC offset hours × 15°), latitude 33.45 — the
 * Phoenix default, since the site's author watches this dawn from the
 * Sonoran desert. Wrong hemisphere guesses simply shift the hour; the
 * door forgives nothing and explains nothing.
 *
 * Testing / Michael's override: set localStorage 'wilhelm.dawn.force'
 * to '1' to force the open-hour condition regardless of the clock.
 *
 * Opening is slow — one 7/8 bar per stage on the 2+2+3 grid: the
 * glyphs wake, the leaves part, the inscription surfaces. The opening
 * tone is the Seikilos epitaph (egg 12). Reduced motion opens the door
 * instantly; the tone still plays — audio is not motion.
 *
 * Everything no-ops cleanly when the chain is incomplete, when #dawn
 * is absent (every page but home), or when storage is unavailable.
 */

import { holdsAll, mark, type EggId } from './eggs';
import { PASSPHRASE_KEY } from './underworld';
import { isAwake, wake } from './audio/engine';
import { BAR } from './timing';

/** The chain — every mark that must be held before the door exists. */
const CHAIN: readonly EggId[] = [
  'mercury-cazimi',
  'saturn-mc',
  'grand-trine',
  'colophon',
  'eighth-house',
  'outer-glyphs',
  'golden-bough',
  'style-swap',
  'secret-knock',
];

/** localStorage flag that forces the open-hour condition (testing). */
const FORCE_KEY = 'wilhelm.dawn.force';

/** Fallback latitude when position is unknown: Phoenix, Arizona. */
const FALLBACK_LAT = 33.45;

const STYLE_ID = 'dawn-gate-style';
const EASE_VEIL = 'cubic-bezier(0.32, 0, 0.24, 1)';

/* ---------------------------------------------------------------- */
/* Sunrise — NOAA/Almanac solar position approximation               */
/* ---------------------------------------------------------------- */

const RAD = Math.PI / 180;
const sinD = (d: number): number => Math.sin(d * RAD);
const cosD = (d: number): number => Math.cos(d * RAD);
const tanD = (d: number): number => Math.tan(d * RAD);
const asinD = (x: number): number => Math.asin(x) / RAD;
const acosD = (x: number): number => Math.acos(x) / RAD;
const atanD = (x: number): number => Math.atan(x) / RAD;
const norm = (x: number, m: number): number => ((x % m) + m) % m;

/**
 * Sunrise for the local calendar date of `date` at (lat, lon), as a
 * Date, or null in polar conditions where the sun does not rise.
 * Classic "Almanac for Computers" method (the NOAA approximation):
 * accurate to a minute or two, which is more than the hour needs.
 */
function localSunrise(date: Date, lat: number, lon: number): Date | null {
  const year = date.getFullYear();
  const dayMs = 86400000;
  const localMidnight = new Date(year, date.getMonth(), date.getDate());
  const jan1 = new Date(year, 0, 1);
  const N = Math.round((localMidnight.getTime() - jan1.getTime()) / dayMs) + 1;

  const lngHour = lon / 15;
  const t = N + (6 - lngHour) / 24; // rising event, ~6h local solar

  // solar mean anomaly → true longitude
  const M = 0.9856 * t - 3.289;
  const L = norm(M + 1.916 * sinD(M) + 0.02 * sinD(2 * M) + 282.634, 360);

  // right ascension, folded into L's quadrant, in hours
  let RA = norm(atanD(0.91764 * tanD(L)), 360);
  RA = (RA + Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90) / 15;

  // declination → local hour angle at the official zenith (90.833°)
  const sinDec = 0.39782 * sinD(L);
  const cosDec = cosD(asinD(sinDec));
  const cosH = (cosD(90.833) - sinDec * sinD(lat)) / (cosDec * cosD(lat));
  if (cosH > 1 || cosH < -1) return null; // midnight sun / polar night

  const H = (360 - acosD(cosH)) / 15; // rising side
  const T = H + RA - 0.06571 * t - 6.622;
  const UT = norm(T - lngHour, 24);

  return new Date(
    Date.UTC(year, date.getMonth(), date.getDate()) + UT * 3600000
  );
}

interface LatLon {
  lat: number;
  lon: number;
}

/**
 * Best available position. Geolocation is used only when permission is
 * ALREADY granted — this module never raises a prompt. The fallback
 * derives longitude from the timezone offset (offset hours × 15°) and
 * assumes the Phoenix latitude; see the module comment.
 */
async function position(): Promise<LatLon> {
  try {
    if (navigator.permissions && navigator.geolocation) {
      const status = await navigator.permissions.query({ name: 'geolocation' });
      if (status.state === 'granted') {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
            maximumAge: 6 * 3600000,
          })
        );
        return { lat: pos.coords.latitude, lon: pos.coords.longitude };
      }
    }
  } catch {
    /* permissions API or fix unavailable — fall through */
  }
  return {
    lat: FALLBACK_LAT,
    lon: (-new Date().getTimezoneOffset() / 60) * 15,
  };
}

function forceOpen(): boolean {
  try {
    return localStorage.getItem(FORCE_KEY) === '1';
  } catch {
    return false;
  }
}

/** True during the hour before local sunrise (or when forced). */
function inOpenHour(nowMs: number, at: LatLon): boolean {
  if (forceOpen()) return true;
  // check yesterday/today/tomorrow so the window straddling local
  // midnight (or a UT date seam) is never missed
  for (const dayShift of [-1, 0, 1]) {
    const d = new Date(nowMs + dayShift * 86400000);
    const sunrise = localSunrise(d, at.lat, at.lon);
    if (!sunrise) continue;
    const rise = sunrise.getTime();
    if (nowMs >= rise - 3600000 && nowMs < rise) return true;
  }
  return false;
}

/* ---------------------------------------------------------------- */
/* The door                                                          */
/* ---------------------------------------------------------------- */

/** Ordered glyphs, sparse to dense — the greek ramp's ascent. */
const ORDER = ['·', 'ι', 'ς', 'τ', 'ϝ', 'ε', 'ζ', 'ϟ', 'ξ', 'ᾳ', 'ϡ', 'ᾧ', 'θ', 'Ξ', 'Θ', 'Ψ'];

/** One door leaf: `cols` × `rows` of ordered glyphs, drifting by row. */
function leafText(cols: number, rows: number, phase: number): string {
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    let line = '';
    for (let c = 0; c < cols; c++) {
      line += ORDER[(r + c + phase) % ORDER.length]!;
    }
    lines.push(line);
  }
  return lines.join('\n');
}

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.dawn-gate {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: var(--space-3, 3rem);
}
.dawn-door {
  display: flex;
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  overflow: hidden;
  font: inherit;
}
.dawn-door-leaf {
  font-family: var(--font-mono, monospace);
  font-size: 0.75rem;
  line-height: 1.45;
  letter-spacing: 0.35em;
  white-space: pre;
  color: var(--smoke-venus, #dcb8bc);
  opacity: 0.35;
  transition:
    transform var(--bar-7-8, 980ms) ${EASE_VEIL},
    opacity var(--bar-7-8, 980ms) ${EASE_VEIL};
}
.dawn-gate.is-waking .dawn-door-leaf { opacity: 0.8; }
.dawn-gate.is-parting .dawn-door-leaf--l { transform: translateX(-140%); opacity: 0; }
.dawn-gate.is-parting .dawn-door-leaf--r { transform: translateX(140%); opacity: 0; }
.dawn-gate-line {
  color: var(--smoke-venus, #dcb8bc);
  opacity: 0.5;
}
.dawn-gate.is-open .dawn-gate-line { display: none; }
.dawn-inscription {
  font-family: var(--font-mono, monospace);
  font-size: var(--text-xs, 0.75rem);
  letter-spacing: var(--tracking-wide, 0.08em);
  color: var(--smoke-venus, #dcb8bc);
  opacity: 0;
  margin-block: var(--space-2, 1.5rem);
  transition: opacity var(--bar-7-8, 980ms) ${EASE_VEIL};
}
.dawn-gate.is-open .dawn-inscription { opacity: 0.9; }
@media (prefers-reduced-motion: reduce) {
  .dawn-door-leaf, .dawn-inscription { transition: none; }
}`;
  document.head.appendChild(style);
}

function chainComplete(): boolean {
  if (!holdsAll([...CHAIN])) return false;
  try {
    // the passphrase banked at the underworld's exit is the tenth link
    return Boolean(localStorage.getItem(PASSPHRASE_KEY));
  } catch {
    return false;
  }
}

export function initDawn(): void {
  const host = document.querySelector<HTMLElement>('#dawn .dawn-inner, #dawn');
  if (!host) return; // every page but home
  if (!chainComplete()) return; // the door does not yet exist
  if (host.querySelector('.dawn-gate')) return; // already rendered

  injectStyles();

  const root = document.createElement('div');
  root.className = 'dawn-gate';

  const door = document.createElement('button');
  door.type = 'button';
  door.className = 'dawn-door';
  door.setAttribute('aria-label', 'a door');

  const left = document.createElement('span');
  left.className = 'dawn-door-leaf dawn-door-leaf--l';
  left.setAttribute('aria-hidden', 'true');
  left.textContent = leafText(4, 15, 0);

  const right = document.createElement('span');
  right.className = 'dawn-door-leaf dawn-door-leaf--r';
  right.setAttribute('aria-hidden', 'true');
  right.textContent = leafText(4, 15, 8);

  door.append(left, right);

  const shutLine = document.createElement('p');
  shutLine.className = 'marginalia dawn-gate-line';
  shutLine.setAttribute('aria-hidden', 'true');
  shutLine.textContent = 'It opens before the sun.';

  // TODO(copy): placeholder inscription — a physical final step gets
  // appended here later (the chain's true terminus is off-screen).
  const inscription = document.createElement('p');
  inscription.className = 'dawn-inscription';
  inscription.textContent = 'The chain ends here, for now.';

  root.append(door, shutLine, inscription);
  host.appendChild(root);

  let opened = false;
  let at: LatLon = {
    lat: FALLBACK_LAT,
    lon: (-new Date().getTimezoneOffset() / 60) * 15,
  };
  void position().then((p) => {
    at = p;
    // during the hour the door needs no caption; shut, it gets its line
    shutLine.hidden = inOpenHour(Date.now(), at);
  });

  const open = (): void => {
    opened = true;

    // the click is a gesture: wake the shared engine, then the tone
    if (!isAwake()) void wake();
    void import('./audio/seikilos')
      .then((m) => m.playSeikilos())
      .catch(() => {
        /* silent dawn */
      });

    // the visitor is now an initiate; initiate.ts hears the mark below
    try {
      localStorage.setItem('wilhelm.initiate', '1');
    } catch {
      /* storage unavailable — this dawn is theirs alone */
    }
    mark('dawn-gate');
    mark('seikilos');

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      // instant open — no staged animation; the tone still plays
      root.classList.add('is-waking', 'is-parting', 'is-open');
      return;
    }
    // one bar per stage on the 2+2+3 grid: wake, part, inscribe
    root.classList.add('is-waking');
    window.setTimeout(() => root.classList.add('is-parting'), BAR);
    window.setTimeout(() => root.classList.add('is-open'), BAR * 2);
  };

  door.addEventListener('click', () => {
    if (opened) return;
    if (!inOpenHour(Date.now(), at)) return; // shut — it explains nothing
    open();
  });
}
