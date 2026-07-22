/**
 * Natal-chart placement hooks — config-driven, subtle, for a perceptive
 * educated eye. Nothing here is explained in the UI; the values surface only
 * as animation offsets, constellation rotations, and one coded sequence.
 *
 * All degree/date values below are PLACEHOLDERS. The owner supplies the real
 * birth data; swapping the numbers in this file is the only change needed.
 */

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

export const natal = {
  // TODO(owner): replace every placeholder below with the real natal values.
  // The Uranus–Neptune pair sits in the 9th house — its midpoint and orb
  // drive the constellation rotation and the drift on deconstruction-themed
  // content (elements marked data-natal-aspect="uranus-neptune").
  uranus: {
    body: 'uranus',
    sign: 'capricorn',
    house: 9,
    degreeInSign: 15.0, // TODO(owner): placeholder degree
  } as NatalPlacement,
  neptune: {
    body: 'neptune',
    sign: 'capricorn',
    house: 9,
    degreeInSign: 17.0, // TODO(owner): placeholder degree
  } as NatalPlacement,
  // Venus at dawn / 12th-house themes — phase value feeds the dawn-window
  // egg and a slow luminance offset the visual layer may read.
  venus: {
    body: 'venus',
    sign: 'aries',      // TODO(owner): placeholder sign
    house: 12,
    degreeInSign: 3.0,  // TODO(owner): placeholder degree
  } as NatalPlacement,
} as const;

/**
 * Local dawn window for the Phosphoros egg (Venus as morning star). The site
 * ships no geolocation; a fixed local-hour band keeps the gesture quiet.
 */
export const dawnWindow = {
  startHourLocal: 5,  // TODO(owner): tune to taste
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
 * The date the sequence is derived from. Ships as a placeholder; the real
 * date is an owner-only config edit and is never rendered anywhere.
 */
export const keyDate = {
  month: 7,  // TODO(owner): placeholder month (1–12)
  day: 11,   // TODO(owner): placeholder day (1–31)
  year: 1990, // TODO(owner): placeholder year
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
