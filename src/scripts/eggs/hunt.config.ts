/**
 * Cross-page scavenger hunt — "little initiations". Steps unlock strictly in
 * order as their required eggs are found; marks (small classical glyphs)
 * accrue on the configured pages. The hunt wraps immediately before the
 * final mail-in step, which is wired later via `finalStep` below.
 *
 * Glyph register: classical astronomy/alchemy only (Sol, Saturn, the
 * alchemical water triangle, Mercury, the sextile aspect, circled Sol).
 */

export interface HuntStep {
  id: string;
  title: string;
  /** Egg ids that must all be found (and every prior step complete). */
  requires: string[];
  /** Path prefixes where this step's mark renders once complete ('/' is exact). */
  markPages: string[];
  /** Single classical glyph shown as the mark. */
  glyph: string;
  /** Affirmative line toasted when the step completes. */
  copy: string;
}

export const huntSteps: HuntStep[] = [
  {
    id: 'first-light',
    title: 'First Light',
    requires: ['swan-preen'],
    markPages: ['/', '/writings'],
    glyph: '☉', // ☉ Sol
    copy: 'First light is acknowledged.',
  },
  {
    id: 'katabasis',
    title: 'Katabasis',
    requires: ['maat-feather', 'orphic-lyre'],
    markPages: ['/', '/writings'],
    glyph: '♄', // ♄ Saturn
    copy: 'The descent is walked and sung.',
  },
  {
    id: 'storm-blessing',
    title: 'Storm Blessing',
    requires: ['monsoon-rainmaker'],
    markPages: ['/', '/writings'],
    glyph: '\u{1F704}', // 🜄 alchemical water
    copy: 'The rain arrives on its own appointed day.',
  },
  {
    id: 'pharmakon',
    title: 'Pharmakon',
    requires: ['pharmakon-sigil'],
    markPages: ['/', '/writings'],
    glyph: '☿', // ☿ Mercury
    copy: 'The measure is taken and the draught prepared.',
  },
  {
    id: 'heliacal-rising',
    title: 'Heliacal Rising',
    requires: ['natal-ascent'],
    markPages: ['/', '/writings'],
    glyph: '⚹', // ⚹ sextile
    copy: 'The seven stand where they stood at the beginning.',
  },
];

/** Glyph and copy for the completion sigil shown at 'awaiting-seal'. */
export const completionSigil = {
  glyph: '⊙', // ⊙ circled Sol
  copy: 'Every station is lit. One further mystery remains, and it will find the one who finished the walk.',
} as const;

// ---------------------------------------------------------------------------
// Final mail-in step — config slot. The hunt's terminal pre-final state is
// 'awaiting-seal'; supplying the object below is the ONLY change needed to
// wire the last step (password in an email subject line + a PO box).
// ---------------------------------------------------------------------------

export interface FinalStepConfig {
  /** Hint surfaced to the finisher pointing at the password. */
  passwordHint: string;
  /** Subject line the finisher mails in (carries the password). */
  mailtoSubject: string;
  /** PO box address for the physical leg. */
  poBox: string;
}

// TODO(owner): supply the final mail-in seal when ready, e.g.
//   export const finalStep: FinalStepConfig | null = {
//     passwordHint: '…', mailtoSubject: '…', poBox: '…',
//   };
export const finalStep: FinalStepConfig | null = null;
