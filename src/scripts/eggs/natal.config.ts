/**
 * Natal-chart placement hooks — config-driven, subtle, for a perceptive
 * educated eye. Nothing here is explained in the UI; the values surface only
 * as animation offsets, constellation rotations, and one coded sequence.
 *
 * Every value derives from the real chart in
 * src/scripts/natal/chart.michael.ts — the same data file the hero renders.
 * Change the chart there; nothing here needs editing.
 */
import { CHART } from '../natal/chart.michael';
import type { ChartData } from '../natal/types';

// ---------------------------------------------------------------------------
// Placements
// ---------------------------------------------------------------------------

export interface NatalPlacement {
  body: string;
  /** Zodiac sign, lowercase ('capricorn', …). */
  sign: string;
  house: number;
  /** Degree within the sign, 0–30. */
  degreeInSign: number;
}

const SIGNS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
] as const;

/** Absolute ecliptic longitude (0–360) of a placement. */
export function eclipticDeg(p: NatalPlacement): number {
  const i = Math.max(0, SIGNS.indexOf(p.sign as (typeof SIGNS)[number]));
  return i * 30 + p.degreeInSign;
}

/** Which house (1–12) a longitude falls in, from the chart's cusps. */
export function houseOf(lon: number, cusps: number[]): number {
  const n = cusps.length;
  for (let i = 0; i < n; i++) {
    const a = cusps[i];
    const b = cusps[(i + 1) % n];
    const span = ((b - a) % 360 + 360) % 360;
    const off = ((lon - a) % 360 + 360) % 360;
    if (off < span) return i + 1;
  }
  return 1;
}

function placement(chart: ChartData, body: string): NatalPlacement {
  const lon = ((chart.bodies[body]?.lon ?? 0) % 360 + 360) % 360;
  return {
    body,
    sign: SIGNS[Math.floor(lon / 30) % 12],
    house: houseOf(lon, chart.cusps),
    degreeInSign: lon % 30,
  };
}

export const natal = {
  // The Uranus–Neptune pair sits in the 9th house — its midpoint and orb
  // drive the constellation rotation and the drift on deconstruction-themed
  // content (elements marked data-natal-aspect="uranus-neptune").
  uranus: placement(CHART, 'uranus'),
  neptune: placement(CHART, 'neptune'),
  // Venus at dawn / 12th-house themes — phase value feeds the dawn-window
  // egg and a slow luminance offset the visual layer may read.
  venus: placement(CHART, 'venus'),
} as const;

/**
 * Local dawn window for the Phosphoros egg (Venus as morning star). The site
 * ships no geolocation; a fixed local-hour band keeps the gesture quiet.
 */
export const dawnWindow = {
  startHourLocal: 5,
  endHourLocal: 8,
} as const;

/** True while the visitor's local clock sits inside the dawn band. */
export function isDawn(now: Date = new Date()): boolean {
  const h = now.getHours();
  return h >= dawnWindow.startHourLocal && h < dawnWindow.endHourLocal;
}

// ---------------------------------------------------------------------------
// Derived hooks — consumed as CSS custom properties by the visual layer.
// ---------------------------------------------------------------------------

export interface NatalCssHooks {
  /** Uranus–Neptune midpoint longitude → constellation rotation, degrees. */
  '--iw-natal-un-rot': string;
  /** Uranus–Neptune orb (separation) → drift amplitude, degrees. */
  '--iw-natal-un-orb': string;
  /** 9th-house index → animation phase offset, 0–1. */
  '--iw-natal-house-phase': string;
  /** Venus degree within sign normalized 0–1 → dawn luminance offset. */
  '--iw-natal-venus-phase': string;
}

export function natalCssHooks(): NatalCssHooks {
  const u = eclipticDeg(natal.uranus);
  const n = eclipticDeg(natal.neptune);
  const midpoint = ((u + n) / 2) % 360;
  const orb = Math.abs(u - n);
  return {
    '--iw-natal-un-rot': `${midpoint.toFixed(2)}deg`,
    '--iw-natal-un-orb': `${orb.toFixed(2)}deg`,
    '--iw-natal-house-phase': (natal.uranus.house / 12).toFixed(4),
    '--iw-natal-venus-phase': (natal.venus.degreeInSign / 30).toFixed(4),
  };
}

// ---------------------------------------------------------------------------
// Birthday as coded easter egg — original mechanism.
// ---------------------------------------------------------------------------

/**
 * The date the sequence is derived from — the chart's birth date. It is
 * never rendered anywhere.
 */
export const keyDate = {
  month: CHART.birth?.month ?? 1,
  day: CHART.birth?.day ?? 1,
  year: CHART.birth?.year ?? 2000,
} as const;

/**
 * Derive the constellation click order from keyDate. Mechanism (original to
 * this site): fold month, day, and the year's last two digits modulo the
 * node count, then extend by successive pairwise sums until four distinct
 * node indices exist. The result reads as an arbitrary star-path; only
 * someone who knows the date and the fold can reconstruct it.
 */
export function birthdaySequence(nodeCount = 7): string[] {
  const seeds = [keyDate.month, keyDate.day, keyDate.year % 100];
  const out: number[] = [];
  let a = seeds[0];
  let b = seeds[1];
  let c = seeds[2];
  const push = (v: number) => {
    const idx = ((v % nodeCount) + nodeCount) % nodeCount;
    if (!out.includes(idx)) out.push(idx);
  };
  push(a);
  push(b);
  push(c);
  while (out.length < 4) {
    const next = a + b + c + out.length;
    push(next);
    a = b;
    b = c;
    c = next;
  }
  return out.slice(0, 4).map(String);
}
