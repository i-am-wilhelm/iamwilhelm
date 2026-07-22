/**
 * Shared sequencer-grid constants. Kept Tone-free so the UI module can load
 * (e.g. when restoring an open pit from sessionStorage) with zero audio cost;
 * engine.ts imports the same values so toy and score stay in one meter.
 */
import { meter } from '../../design/tokens';

/** Sequencer/score rows, in mix order. */
export const SEQ_ROW_NAMES = ['knock', 'tick', 'pluck', 'shimmer'] as const;

/** Steps per bar: 7 (one per eighth in 7/8). */
export const STEPS = meter.beatsPerBar;

/** Step indices that begin a 2+2+3 group — beats 1, 3, 5. */
export const GROUP_STARTS = [0, 2, 4] as const;

export function emptyPattern(): boolean[][] {
  return SEQ_ROW_NAMES.map(() => new Array<boolean>(STEPS).fill(false));
}
