/**
 * Section tunings — the circle of fifths laid across the homepage.
 *
 * The scroll walks fifths in pitch-class space: D → A → E → B → F♯ → C♯,
 * each section one fifth sharper than the last, so every scroll-crossfade
 * is a perfect-fifth modulation. Sharpening toward the dawn mirrors the
 * Great Fade (nigredo → albedo): each added sharp is a little more light.
 * Registers fold up-a-fifth / down-a-fourth so the roots stay inside one
 * low octave band (~73–139 Hz) instead of climbing off the top.
 *
 * Each drone is root + just fifth + octave + one modal color tone; the
 * color tone is the mode's characteristic degree, tuned in just
 * intonation, and is what makes each section's Greek mode legible.
 */

export interface SectionTuning {
  /** Homepage section id (no '#'). */
  id: string;
  /** Root frequency in Hz (equal-tempered pitch class anchor). */
  root: number;
  /** Greek mode name — for the record; the sound is root/5th/8ve + color. */
  mode: string;
  /** The mode's characteristic degree, as a just ratio to the root. */
  color: number;
  /** Crossfade target level for this section's voice (0..1). */
  level: number;
}

export const SECTIONS: readonly SectionTuning[] = [
  {
    // Hero — the Black Swan. Aeolian: the plain natural minor, cold and
    // open — night water before any color has entered it. Color tone is
    // the minor sixth (8/5), the mode's darkest identifying degree.
    id: 'hero',
    root: 73.42, // D2
    mode: 'aeolian',
    color: 8 / 5,
    level: 1,
  },
  {
    // Sky — the constellations. Mixolydian: major brightness with the
    // lowered seventh (9/5) — luminous but ancient, light that left its
    // star a long time ago. No leading tone; nothing resolves up here.
    id: 'sky',
    root: 110.0, // A2 — up a fifth from D
    mode: 'mixolydian',
    color: 9 / 5,
    level: 0.9,
  },
  {
    // Writings — Medea, the pharmakon. Phrygian: the flat second is the
    // poison in the cup, Babalon-adjacent scarlet. Voiced as a minor
    // ninth (32/15, up an octave) so it stings without curdling the bed.
    id: 'writings',
    root: 82.41, // E2 — a fifth above A, folded down a fourth
    mode: 'phrygian',
    color: 32 / 15,
    level: 0.95,
  },
  {
    // Philosophy — Atlas, Pallas. Dorian per the spec: minor labor with
    // the raised sixth (5/3) — weight carried with dignity, the one
    // bright degree in a dark scale. The torch after the sphere.
    id: 'philosophy',
    root: 123.47, // B2 — up a fifth from E
    mode: 'dorian',
    color: 5 / 3,
    level: 0.95,
  },
  {
    // Memoir — the monsoon. Lydian, voiced melancholic: the raised
    // fourth (45/32) is heat-shimmer over the drought — brightness that
    // aches. Kept low in the voicing; monsoon:state opens or parches it.
    id: 'memoir',
    root: 92.5, // F♯2 — a fifth above B, folded down a fourth
    mode: 'lydian',
    color: 45 / 32,
    level: 0.9,
  },
  {
    // Dawn — Venus as morning star. Ionian: plain major at last, the
    // just third up an octave (5/2) — resolution after five modes of
    // shadow. The only section allowed to sound finished.
    id: 'dawn',
    root: 138.59, // C♯3 — up a fifth from F♯
    mode: 'ionian',
    color: 5 / 2,
    level: 0.85,
  },
];
