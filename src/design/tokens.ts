/**
 * Design tokens & section registry — the shared contract between the shader
 * core, scroll choreography, sections, blog, easter-egg engine, and audio.
 *
 * Symbology guardrails (audit every addition against these):
 *   - NO kabbalah symbolism
 *   - NO "new age" symbolism
 *   - NO modern secret-society symbols
 *   Register is classical, alchemical, Greco-Egyptian: Greek epic and
 *   pharmacological tradition, Roman/Virgilian material, Egyptian funerary
 *   tradition.
 */

/** Accent colors, one per section, contrasting the primary dither. */
export const accents = {
  hero: '#0d0d10',        // Black Swan — near-black, iridescent in shader
  cluster: '#8fa8c8',     // Pleiades — faint star-silver blue
  philosophy: '#b8923a',  // Columbia/Pallas — aegis gold
  underworld: '#3d6b52',  // Orpheus — asphodel/laurel green over shade
  monsoon: '#2e5f6e',     // PNW rain — storm teal
  writings: '#6a3fa0',    // Pharmakon/Medea — fumigation purple (fixed by spec)
  babalon: '#a01f1f',     // Babalon — red (fixed by spec)
} as const;

export type SectionId = keyof typeof accents;

/** Homepage section registry, in scroll order. */
export interface SectionSpec {
  id: SectionId;
  title: string;
  /** Symbols drawn from the approved pool (see guardrails above). */
  symbols: string[];
  /** Which side the fumigation vapor enters from — alternates per section. */
  smokeSide: 'left' | 'right';
  /**
   * Drone pitch class for the orchestra pit: descending the page walks the
   * circle of fifths (music of the spheres).
   */
  drone: string;
}

export const sections: SectionSpec[] = [
  { id: 'hero',        title: 'Facecard',      symbols: ['black-swan'],                              smokeSide: 'left',  drone: 'C2' },
  { id: 'cluster',     title: 'Constellation', symbols: ['pleiades', 'ouroboros'],                   smokeSide: 'right', drone: 'G2' },
  { id: 'philosophy',  title: 'Philosophy',    symbols: ['atlas', 'columbia', 'pallas-athena'],      smokeSide: 'left',  drone: 'D2' },
  { id: 'underworld',  title: 'Underworld',    symbols: ['orpheus', 'eurydice', 'furies', 'maat'],   smokeSide: 'right', drone: 'A2' },
  { id: 'monsoon',     title: 'Monsoon',       symbols: ['saturn', 'sol-niger'],                     smokeSide: 'left',  drone: 'E2' },
];

/**
 * Wider homepage symbol pool (may grow): black-swan, janus, orpheus, babalon,
 * prometheus, hermes, medea, ouroboros, sol-niger, saturn, pleiades,
 * cross-to-cube, pan, thoth-hermes-trismegistus, columbia-pallas.
 */

/** Odd-meter timing constants shared by animation and audio. */
export const meter = {
  /** The site's signature meter: 7/8, grouped 2+2+3. */
  septuple: [2, 2, 3],
  beatsPerBar: 7,
  /** Base tempo for the score and scroll-linked pulse work. */
  bpm: 84,
} as const;

/** Global background fade: black at top of page → white at the bottom. */
export const backgroundFade = {
  from: '#050505',
  to: '#f5f2ec',
} as const;

/** Greek glyph ramp for the dither field, dark→light coverage. */
export const glyphRamp = 'ΨΦΘΞΩΔΛΠΣΓαβγδεζηθικλμνξοπρστυφχψω·';

/**
 * The dead letters — ϝ (digamma), ϟ (koppa), ϡ (sampi): letters that fell
 * out of the living alphabet yet survived as numerals. They surface rarely
 * out of the bright dither field, most often in deconstruction contexts
 * (the Uranus–Neptune 9th-house register; see natal.config.ts).
 */
export const deadLetters = 'ϝϟϡ';

/** Full rare-glyph pool: the dead letters plus the outer-planet marks. */
export const rareGlyphs = deadLetters + '♅♆';
