/**
 * Shared audio plumbing — the context every audio module receives.
 *
 * Everything in this directory except engine.ts lives in the lazy chunk:
 * it may import Tone freely because the whole chunk only loads inside
 * wake(), after the visitor's first gesture. engine.ts must never import
 * from here except as `import type`.
 */

import type * as Tone from 'tone';

export interface AudioCtx {
  /** Pre-limiter mix bus. All dry signal connects here. */
  master: Tone.Gain;
  /** Shared long-tail reverb, wet 100%. Connect send gains to it. */
  reverb: Tone.Reverb;
}

export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** One 7/8 bar in seconds. Mirrors BAR in lib/timing.ts (980ms). */
export const BAR_S = 0.98;

/** One eighth-note pulse in seconds. Mirrors PULSE in lib/timing.ts. */
export const PULSE_S = 0.14;

/** Scroll-crossfades breathe over two bars. */
export const CROSSFADE_S = BAR_S * 2;
