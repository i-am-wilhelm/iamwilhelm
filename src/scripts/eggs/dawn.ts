/**
 * THE DAWN GATE — the site's closing movement, ported from the Canvas-2D
 * prototype: the descent ends at first light.
 *
 * When the hunt is held (phase 'awaiting-seal' or 'sealed'), a door renders
 * in the homepage #dawn coda that did not previously exist: a tall
 * rectangle of ordered glyphs, pale rose, quiet. Whether it OPENS depends
 * on the hour — it opens only during the hour before local sunrise.
 *
 * Sunrise is computed locally with the NOAA/Almanac solar approximation —
 * no network, no dependency. Position comes from geolocation ONLY if
 * permission is already granted (queried via navigator.permissions; this
 * module never prompts). Otherwise it approximates: longitude from the
 * timezone offset (UTC offset hours × 15°), latitude 33.45 — the Phoenix
 * default, since the site's author watches this dawn from the Sonoran
 * desert. A wrong hemisphere guess simply shifts the hour; the door
 * forgives nothing and explains nothing.
 *
 * Testing / owner override: set localStorage 'iw:dawn.force' to '1' to
 * force the open-hour condition regardless of the clock.
 *
 * Opening is slow — one 7/8 bar per stage (2+2+3 at 84 bpm ≈ 2.5 s): the
 * glyphs wake, the leaves part, the inscription surfaces. Reduced motion
 * opens the door instantly.
 *
 * Everything no-ops cleanly when the hunt is unfinished, when #dawn is
 * absent (every page but home), or when storage is unavailable.
 */

import { glyphRamp, meter } from '../../design/tokens';
import { on } from '../events';
import { getState } from './hunt';

const FORCE_KEY = 'iw:dawn.force';
/** Fallback latitude when position is unknown: Phoenix, Arizona. */
const FALLBACK_LAT = 33.45;
/** One 7/8 bar in ms: seven eighth-notes at the site tempo. */
const BAR_MS = Math.round((7 * 60_000) / (meter.bpm * 2));
const STYLE_ID = 'iw-dawn-style';

/* ---------------------------------------------------------------- */
/* Sunrise — NOAA/Almanac solar position approximation               */
/* ---------------------------------------------------------------- */

const RAD = Math.PI / 180;
const sinD = (d: number) => Math.sin(d * RAD);
const cosD = (d: number) => Math.cos(d * RAD);
const tanD = (d: number) => Math.tan(d * RAD);
const asinD = (x: number) => Math.asin(x) / RAD;
const acosD = (x: number) => Math.acos(x) / RAD;
const atanD = (x: number) => Math.atan(x) / RAD;
const norm = (x: number, m: number) => ((x % m) + m) % m;

/**
 * Sunrise for the local calendar date of `date` at (lat, lon), as a Date,
 * or null in polar conditions where the sun does not rise. Classic
 * "Almanac for Computers" method (the NOAA approximation): accurate to a
 * minute or two, which is more than the hour needs.
 */
export function localSunrise(date: Date, lat: number, lon: number): Date | null {
  const year = date.getFullYear();
  const dayMs = 86_400_000;
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

  return new Date(Date.UTC(year, date.getMonth(), date.getDate()) + UT * 3_600_000);
}

/**
 * Best available position. Geolocation is used only when permission is
 * ALREADY granted — this module never raises a prompt. The fallback
 * derives longitude from the timezone offset and assumes the Phoenix
 * latitude; see the module comment.
 */
async function resolvePosition(): Promise<{ lat: number; lon: number }> {
  const fallback = {
    lat: FALLBACK_LAT,
    lon: (-new Date().getTimezoneOffset() / 60) * 15,
  };
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    if (status.state !== 'granted') return fallback;
    return await new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
        () => resolve(fallback),
        { maximumAge: 3_600_000, timeout: 4_000 },
      );
    });
  } catch {
    return fallback;
  }
}

/** True inside the hour before local sunrise (today's or tomorrow's). */
async function isDawnHour(now = new Date()): Promise<boolean> {
  try {
    if (localStorage.getItem(FORCE_KEY) === '1') return true;
  } catch {
    /* storage unavailable — the clock alone decides */
  }
  const { lat, lon } = await resolvePosition();
  for (const dayOffset of [0, 1]) {
    const day = new Date(now.getTime() + dayOffset * 86_400_000);
    const rise = localSunrise(day, lat, lon);
    if (!rise) continue;
    const delta = rise.getTime() - now.getTime();
    if (delta > 0 && delta <= 3_600_000) return true;
  }
  return false;
}

/* ---------------------------------------------------------------- */
/* The door                                                          */
/* ---------------------------------------------------------------- */

const DOOR_ROWS = 9;
const DOOR_COLS = 5;

function injectDawnStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.iw-dawn-gate {
  display: grid;
  place-items: center;
  min-height: 40vh;
  padding: 6vh 0 10vh;
}
.iw-dawn-door {
  position: relative;
  display: flex;
  gap: 0.15rem;
  padding: 1.1rem 1.4rem;
  border: 1px solid rgba(214, 160, 160, 0.35);
  background: rgba(214, 160, 160, 0.06);
  overflow: hidden;
}
.iw-dawn-leaf {
  display: grid;
  grid-template-columns: repeat(${Math.floor(DOOR_COLS / 2) + 1}, 1fr);
  gap: 0.15rem 0.4rem;
  transition: transform ${BAR_MS}ms cubic-bezier(0.32, 0, 0.24, 1),
              opacity ${BAR_MS}ms ease;
}
.iw-dawn-door span {
  font-family: var(--font-greek);
  font-size: 0.95rem;
  line-height: 1.35;
  color: rgb(214, 160, 160);
  opacity: 0.25;
  transition: opacity ${BAR_MS}ms ease;
}
.iw-dawn-gate.is-waking .iw-dawn-door span { opacity: 0.8; }
.iw-dawn-gate.is-parting .iw-dawn-leaf--l { transform: translateX(-140%); opacity: 0; }
.iw-dawn-gate.is-parting .iw-dawn-leaf--r { transform: translateX(140%); opacity: 0; }
.iw-dawn-inscription {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  text-align: center;
  opacity: 0;
  transition: opacity ${BAR_MS}ms ease;
  padding: 1rem;
}
.iw-dawn-gate.is-open .iw-dawn-inscription { opacity: 1; }
.iw-dawn-inscription .grc {
  font-family: var(--font-greek);
  color: rgb(214, 160, 160);
  font-size: 1.05rem;
  letter-spacing: 0.08em;
}
.iw-dawn-inscription .en {
  font-family: var(--font-ui);
  font-size: 0.7rem;
  letter-spacing: 0.14em;
  color: var(--ink-dim);
  margin-top: 0.6rem;
}
@media (prefers-reduced-motion: reduce) {
  .iw-dawn-leaf, .iw-dawn-door span, .iw-dawn-inscription { transition: none; }
}`;
  document.head.appendChild(style);
}

function buildDoor(host: HTMLElement): HTMLElement {
  injectDawnStyle();
  const gate = document.createElement('div');
  gate.className = 'iw-dawn-gate';

  const door = document.createElement('div');
  door.className = 'iw-dawn-door';

  // Two leaves of ordered glyphs — the ramp read in sequence, a text that
  // was always there once you can see it.
  const glyphs = Array.from(glyphRamp);
  for (const side of ['l', 'r'] as const) {
    const leaf = document.createElement('div');
    leaf.className = `iw-dawn-leaf iw-dawn-leaf--${side}`;
    const cols = side === 'l' ? Math.ceil(DOOR_COLS / 2) : Math.floor(DOOR_COLS / 2);
    for (let i = 0; i < DOOR_ROWS * cols; i++) {
      const span = document.createElement('span');
      span.textContent = glyphs[(i * (side === 'l' ? 1 : 7)) % glyphs.length];
      span.setAttribute('aria-hidden', 'true');
      leaf.appendChild(span);
    }
    door.appendChild(leaf);
  }

  const inscription = document.createElement('div');
  inscription.className = 'iw-dawn-inscription';
  const grc = document.createElement('p');
  grc.className = 'grc';
  grc.lang = 'grc';
  grc.textContent = 'Ἠὼς ῥοδοδάκτυλος';
  const en = document.createElement('p');
  en.className = 'en';
  en.textContent = 'Rosy-fingered dawn. The descent returns to light.';
  inscription.append(grc, en);
  door.appendChild(inscription);

  gate.appendChild(door);
  host.appendChild(gate);
  return gate;
}

/** Staged opening: wake → part → inscribe, one 7/8 bar per stage. */
function openGate(gate: HTMLElement) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    gate.classList.add('is-waking', 'is-parting', 'is-open');
    return;
  }
  gate.classList.add('is-waking');
  window.setTimeout(() => gate.classList.add('is-parting'), BAR_MS);
  window.setTimeout(() => gate.classList.add('is-open'), BAR_MS * 2);
}

/* ---------------------------------------------------------------- */
/* Entry                                                             */
/* ---------------------------------------------------------------- */

let gateEl: HTMLElement | null = null;
let opened = false;

async function evaluate(host: HTMLElement) {
  const phase = getState().phase;
  const held = phase === 'awaiting-seal' || phase === 'sealed';
  if (!held) return;

  if (!gateEl) gateEl = buildDoor(host);
  if (!opened && (await isDawnHour())) {
    opened = true;
    openGate(gateEl);
  }
}

/**
 * Mount the dawn gate. Call once from initEggs(); no-ops without a #dawn
 * host. Re-evaluates when an egg is found and once a minute (the hour
 * arrives on its own schedule).
 */
export function initDawnGate() {
  const host = document.getElementById('dawn');
  if (!host) return;
  void evaluate(host);
  on('iw:egg-found', () => void evaluate(host));
  window.setInterval(() => void evaluate(host), 60_000);
}
