/**
 * THE UNSEEN ONE: cue sheet. Mirrors docs/unseen-one-recording-script.md,
 * cue for cue. Each cue id is one file, public/audio/unseen/<id>.mp3; the
 * `hold` is the dead air after the take in milliseconds, and it is part of
 * the score: with audio present, the next line waits for cue end + hold.
 *
 * Mapping to the page. A litany part's cues run in script order; `line` is
 * the index of the printed <p> inside that .litany-part the cue belongs to,
 * or null for the lines that are heard but never printed (her small
 * answers in parts 02 and 03, and the two names in part 05). Metamorphosis
 * cues cover a run of printed .meta-lines lines, `lines: [first, last]`
 * over the non-gap lines in document order.
 */

export type Voice = 'him' | 'her';

export interface Cue {
  id: string;
  /** Dead air after the take, ms. */
  hold: number;
  who: Voice;
}

export interface LitanyCue extends Cue {
  /** Printed paragraph index within the part, or null when unprinted. */
  line: number | null;
}

export interface MetaCue extends Cue {
  /** Inclusive range of non-gap line indexes this cue speaks. */
  lines: [number, number];
}

const him = (id: string, hold: number, line: number | null): LitanyCue => ({ id, hold, who: 'him', line });
const her = (id: string, hold: number, line: number | null): LitanyCue => ({ id, hold, who: 'her', line });

/** Part 00: the couplets, read straight. One cue per printed .couplet. */
export const COUPLETS: Cue[] = [
  { id: 'U-00-01', hold: 1500, who: 'him' },
  { id: 'U-00-02', hold: 1500, who: 'him' },
  { id: 'U-00-03', hold: 1500, who: 'him' },
  { id: 'U-00-04', hold: 1500, who: 'him' },
  { id: 'U-00-05', hold: 1500, who: 'him' },
  { id: 'U-00-06', hold: 1500, who: 'him' },
  { id: 'U-00-07', hold: 2500, who: 'him' },
];

/** Parts 01 to 05, indexed by seed number. */
export const LITANY: Record<number, LitanyCue[]> = {
  1: [
    him('U-01-01', 1400, 0),
    him('U-01-02', 1200, 1),
    him('U-01-03', 800, 2),
    him('U-01-04', 2200, 3),
    him('U-01-05', 1000, 4),
    him('U-01-06', 1000, 5),
    him('U-01-07', 1200, 6),
    him('U-01-08', 1200, 7),
    him('U-01-09', 1000, 8),
    him('U-01-10', 2200, 9),
  ],
  2: [
    him('U-02-01', 1000, 0),
    him('U-02-02', 1200, 1),
    him('U-02-03', 2200, 2),
    her('U-02-04', 1000, null),
    him('U-02-05', 1800, 3),
    her('U-02-06', 1400, null),
    him('U-02-07', 1200, 4),
  ],
  3: [
    him('U-03-01', 1400, 0),
    him('U-03-02', 2200, 1),
    her('U-03-03', 1000, 2),
    him('U-03-04', 1400, 3),
    her('U-03-05', 1000, null),
    him('U-03-06', 2200, 4),
    her('U-03-07', 1400, null),
    him('U-03-08', 2000, 5),
    her('U-03-09', 1200, 6),
    him('U-03-10', 1400, 7),
    her('U-03-11', 2000, 8),
  ],
  4: [
    him('U-04-01', 1400, 0),
    him('U-04-02', 1400, 1),
    him('U-04-03', 1200, 2),
    him('U-04-04', 1600, 3),
  ],
  5: [
    him('U-05-01', 2400, 0),
    her('U-05-02', 1600, null),
    him('U-05-03', 2400, 1),
    her('U-05-04', 2000, null),
    him('U-05-05', 1600, 2),
  ],
};

/** "Take the Nth seed": spoken as seed N is taken, before its part. */
export const TAKE: Record<number, Cue> = {
  2: { id: 'U-01-11', hold: 900, who: 'him' },
  3: { id: 'U-02-08', hold: 900, who: 'him' },
  4: { id: 'U-03-12', hold: 900, who: 'him' },
  5: { id: 'U-04-05', hold: 900, who: 'him' },
};

/** The sixth seed: spoken as its gate appears, looped through the hold, and on release. */
export const SIXTH = {
  take: { id: 'U-05-06', hold: 900, who: 'him' } as Cue,
  hold: { id: 'U-05-07', hold: 1600, who: 'him' } as Cue,
  holdLoop: { id: 'U-05-08', hold: 1800, who: 'him' } as Cue,
  now: { id: 'U-05-09', hold: 1200, who: 'him' } as Cue,
};

/** Part 06: the metamorphosis, over the 38 non-gap lines of .meta-lines. */
const m = (id: string, hold: number, who: Voice, a: number, b = a): MetaCue => ({ id, hold, who, lines: [a, b] });
export const META: MetaCue[] = [
  m('U-06-01', 1400, 'him', 0),
  m('U-06-02', 1200, 'him', 1),
  m('U-06-03', 600, 'him', 2),
  m('U-06-04', 600, 'him', 3),
  m('U-06-05', 0, 'him', 4),
  m('U-06-06', 1200, 'him', 5),
  m('U-06-07', 800, 'him', 6),
  m('U-06-08', 1400, 'him', 7),
  m('U-06-09', 600, 'him', 8),
  m('U-06-10', 0, 'him', 9),
  m('U-06-11', 1400, 'him', 10),
  m('U-06-12', 800, 'him', 11),
  m('U-06-13', 800, 'him', 12),
  m('U-06-14', 0, 'him', 13),
  m('U-06-15', 0, 'him', 14),
  m('U-06-16', 400, 'him', 15),
  m('U-06-17', 400, 'him', 16),
  m('U-06-18', 1600, 'him', 17),
  m('U-06-19', 1400, 'her', 18),
  m('U-06-20', 1200, 'him', 19),
  m('U-06-21', 2000, 'her', 20),
  m('U-06-22', 1400, 'him', 21, 25),
  m('U-06-23', 1600, 'him', 26, 30),
  m('U-06-24', 1600, 'him', 31),
  m('U-06-25', 1600, 'him', 32, 34),
  m('U-06-26', 2400, 'him', 35),
  m('U-06-27', 1800, 'him', 36, 37),
  m('U-06-28', 3000, 'him', 38),
];

/** Part 07: as the seat-mirror appears. */
export const LOOK: Cue = { id: 'U-07-01', hold: 2400, who: 'him' };

/** Part 08: the return, one cue per printed .couplet. */
export const RETURN: Cue[] = [
  { id: 'U-08-01', hold: 1500, who: 'him' },
  { id: 'U-08-02', hold: 1500, who: 'him' },
  { id: 'U-08-03', hold: 1500, who: 'him' },
  { id: 'U-08-04', hold: 1500, who: 'him' },
  { id: 'U-08-05', hold: 1500, who: 'him' },
  { id: 'U-08-06', hold: 1500, who: 'him' },
  { id: 'U-08-07', hold: 1500, who: 'him' },
  { id: 'U-08-08', hold: 1500, who: 'him' },
  { id: 'U-08-09', hold: 1500, who: 'him' },
  { id: 'U-08-10', hold: 4000, who: 'him' },
];

/**
 * Timer cadence for the metamorphosis when no audio is present (the
 * prototype's values): time from one line's appearance to the next, by
 * line class. Audio replaces these with cue end + hold.
 */
export const META_CADENCE_MS = {
  base: 1100,
  gap: 500,
  split: 1500,
  small: 1500,
  word: 1800,
  rise: 0,
  /** Tail after "Rise." before Elysium opens. */
  tail: 1400,
} as const;

/** Press-and-hold duration for the sixth seed. */
export const HOLD_MS = 2600;

/** Where the cue files live; the probe file decides whether audio exists. */
export const AUDIO_BASE = '/audio/unseen/';
export const AUDIO_PROBE = 'U-00-01';
