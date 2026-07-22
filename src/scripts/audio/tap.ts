/**
 * 7/8 TAP DETECTION — tempo-invariant onset matcher.
 *
 * ACCEPTED PATTERNS (the site's signature meter, 7/8 grouped 2+2+3 at
 * ~meter.bpm from src/design/tokens.ts):
 *
 *   A. GROUP-ACCENT PATTERN — 4 taps, one on each group boundary plus the
 *      next downbeat. Inter-onset intervals (IOIs) in eighth-note units:
 *
 *          tap:   1     2     3        4
 *          beat:  1 .   3 .   5 . .  | 1
 *          IOIs:    2     2     3
 *
 *      i.e. three IOIs in the ratio 2 : 2 : 3 ("short short long").
 *
 *   B. TWO-BAR ACCENT PATTERN — 7 taps, the group boundaries of two
 *      consecutive bars plus the following downbeat:
 *
 *          IOIs: 2 : 2 : 3 : 2 : 2 : 3
 *
 * MATCHING is tempo-invariant with a tolerance band:
 *   1. Collect pointer timestamps into a rolling buffer.
 *   2. For each candidate suffix (last 4 taps, last 7 taps) compute IOIs.
 *   3. Estimate the eighth-note unit as totalDuration / expectedUnits
 *      (7 units for pattern A, 14 for pattern B).
 *   4. Accept when every IOI is within RATIO_TOLERANCE (default 25%) of
 *      its expected multiple of the unit, AND the implied tempo sits in a
 *      generous band around tokens.meter.bpm (half to double speed), AND
 *      IOIs are plausibly deliberate taps (unit between ~150ms and ~900ms).
 *
 * Ratios, not absolute times, decide the match — a user tapping the figure
 * anywhere near the site tempo (84 bpm ⇒ eighth ≈ 357ms, so pattern A spans
 * about 2.5s) opens the pit.
 */

import { meter } from '../../design/tokens';

/** Relative tolerance per IOI against its expected multiple of the unit. */
const RATIO_TOLERANCE = 0.25;
/** Implied eighth-note duration must fall inside this band (ms). Nominal at
 * 84 bpm is 60000 / 84 / 2 ≈ 357ms; the band spans half to double tempo. */
const NOMINAL_EIGHTH_MS = 60000 / meter.bpm / 2;
const MIN_EIGHTH_MS = NOMINAL_EIGHTH_MS / 2;
const MAX_EIGHTH_MS = NOMINAL_EIGHTH_MS * 2.5;
/** Taps further apart than this reset nothing — the suffix scan simply
 * fails — but we cap the buffer so memory stays bounded. */
const BUFFER_SIZE = 12;

/** The accent figure of one 2+2+3 bar, in eighth-note units. */
const BAR_ACCENT_IOIS = meter.septuple; // [2, 2, 3]
const PATTERNS: number[][] = [
  [...BAR_ACCENT_IOIS], // pattern A: 4 taps
  [...BAR_ACCENT_IOIS, ...BAR_ACCENT_IOIS], // pattern B: 7 taps
];

function matchesPattern(iois: number[], expected: number[]): boolean {
  const expectedUnits = expected.reduce((a, b) => a + b, 0);
  const total = iois.reduce((a, b) => a + b, 0);
  const unit = total / expectedUnits;
  if (unit < MIN_EIGHTH_MS || unit > MAX_EIGHTH_MS) return false;
  return iois.every((ioi, i) => {
    const target = expected[i] * unit;
    return Math.abs(ioi - target) / target <= RATIO_TOLERANCE;
  });
}

export interface TapDetector {
  /** Feed one onset (ms timestamp, e.g. performance.now()). Returns true
   * when the buffer's newest taps complete an accepted 7/8 figure. */
  onset(timeMs: number): boolean;
  /** Clear the buffer (e.g. after a successful match). */
  reset(): void;
}

export function createTapDetector(): TapDetector {
  let taps: number[] = [];
  return {
    onset(timeMs: number): boolean {
      taps.push(timeMs);
      if (taps.length > BUFFER_SIZE) taps = taps.slice(-BUFFER_SIZE);
      for (const expected of PATTERNS) {
        const need = expected.length + 1; // N IOIs need N+1 taps
        if (taps.length < need) continue;
        const suffix = taps.slice(-need);
        const iois = suffix.slice(1).map((t, i) => t - suffix[i]);
        if (matchesPattern(iois, expected)) return true;
      }
      return false;
    },
    reset() {
      taps = [];
    },
  };
}
