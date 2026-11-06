/**
 * Design tokens & section registry, the shared contract between the shader
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
  hero: '#0d0d10',        // Black Swan, near-black, iridescent in shader
  cluster: '#8fa8c8',     // Pleiades, faint star-silver blue
  philosophy: '#b8923a',  // Columbia/Pallas, aegis gold
  underworld: '#3d6b52',  // Orpheus, asphodel/laurel green over shade
  monsoon: '#2e5f6e',     // PNW rain, storm teal
  writings: '#6a3fa0',    // Pharmakon/Medea, fumigation purple (fixed by spec)
  lineage: '#6a3fa0',     // Citations/Pan, the same fumigation purple
  babalon: '#a01f1f',     // Babalon, red (fixed by spec)
} as const;

export type SectionId = keyof typeof accents;

/**
 * Section ids that borrow another section's accent. Writings pages mark
 * their movements with their own ids (pharmakon-0..6, unseen-0..5) so the
 * constellation pass seeds a distinct sky per movement, while the backdrop,
 * smoke, and the --active-accent tween read the colour registered here.
 * Resolve through accentFor(); never index `accents` with a raw DOM id.
 */
export const accentAliases: Record<string, SectionId> = {
  'pharmakon-0': 'writings', 'pharmakon-1': 'writings', 'pharmakon-2': 'writings',
  'pharmakon-3': 'writings', 'pharmakon-4': 'writings', 'pharmakon-5': 'writings',
  'pharmakon-6': 'writings',
  'unseen-0': 'underworld', 'unseen-1': 'underworld', 'unseen-2': 'underworld',
  'unseen-3': 'underworld', 'unseen-4': 'underworld', 'unseen-5': 'underworld',
};

/** Accent hex for any section id the DOM can carry, or undefined. */
export function accentFor(id: string): string | undefined {
  const key = (id in accents ? id : accentAliases[id]) as SectionId | undefined;
  return key ? accents[key] : undefined;
}

/** Homepage section registry, in scroll order. */
export interface SectionSpec {
  id: SectionId;
  title: string;
  /** Symbols drawn from the approved pool (see guardrails above). */
  symbols: string[];
  /** Which side the fumigation vapor enters from, alternates per section. */
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
  { id: 'lineage',     title: 'Lineage',       symbols: ['pan'],                                     smokeSide: 'right', drone: 'B2' },
];

/**
 * Wider homepage symbol pool (may grow): black-swan, janus, orpheus, babalon,
 * prometheus, hermes, medea, ouroboros, sol-niger, saturn, pleiades,
 * cross-to-cube, pan, thoth-hermes-trismegistus, columbia-pallas.
 * The Unseen One adds hades, persephone, pomegranate, asphodel, narcissus:
 * Homeric Hymn to Demeter material, inside the register.
 */

/**
 * Drones for sections that are not in the homepage registry. The Unseen One
 * continues the circle of fifths flatward from where the page lands (F, Bb,
 * Eb) and sits on the lowest drone on the site through the metamorphosis
 * and Elysium (Eb1, about 39 Hz), lifting a fifth for the return.
 * Resolve through droneFor().
 */
export const descentDrones: Record<string, string> = {
  'unseen-0': 'F1',
  'unseen-1': 'Bb1',
  'unseen-2': 'Eb1',
  'unseen-3': 'Eb1',
  'unseen-4': 'Eb1',
  'unseen-5': 'Ab1',
};

/** Drone pitch for any section id, or undefined when the section has none. */
export function droneFor(id: string): string | undefined {
  return sections.find((s) => s.id === id)?.drone ?? descentDrones[id];
}

/** One site tempo: the score, the reveals, and the visual clock all read it. */
const BPM = 84;

/** Odd-meter timing constants shared by animation and audio. */
export const meter = {
  /** The site's signature meter: 7/8, grouped 2+2+3. */
  septuple: [2, 2, 3],
  beatsPerBar: 7,
  /** Base tempo for the score and scroll-linked pulse work. */
  bpm: BPM,
  /**
   * One eighth-note in ms for the visual clock (src/scripts/clock.ts, "the
   * knock" the natal hero breathes to): derived from the same bpm as the
   * Tone transport (≈357 ms), and phase-locked to that transport whenever
   * the orchestra pit is playing (iw:transport-eighth). The tinker dial on
   * /lab/hero can detune it for comparison; the pit re-locks it.
   */
  eighthMs: 60000 / BPM / 2,
} as const;

/**
 * Global background fade: black at the top of the page, and at the bottom
 * the shade just before dawn, a warm rose-taupe that stops well short of
 * white (full white proved harsh on the eyes at the end of a long scroll).
 */
export const backgroundFade = {
  from: '#050505',
  to: '#bda898',
} as const;

/**
 * Per-page fade modes, chosen with `data-fade` on <html> (Base.astro's
 * `fade` prop). scroll.ts drives the body colour and the backdrop pass
 * reads the mode too, so a page can run dark without overriding the
 * site-wide dawn fade.
 *
 *   dawn     the default: black at the top, the shade before dawn below.
 *   descent  dark-first: a bruised near-black at the top, true black by the
 *            section marked [data-fade-floor], held black through the
 *            section marked [data-fade-lift], then lifting slightly for
 *            the return. The ink stays light the whole way.
 */
export const fadeModes = {
  dawn: { from: backgroundFade.from, to: backgroundFade.to },
  descent: { from: '#17141a', floor: '#000000', back: '#0c0a0d' },
} as const;

export type FadeMode = keyof typeof fadeModes;

/**
 * Natal engine palette, one colour per body, plus Venus's chromatic fringe
 * triplet (rose / emerald / pale gold) for packets that have passed through
 * the 12th-house glass. Classical planetary register only.
 */
export const natalPalette = {
  sun: '#ffcf6e',
  mercury: '#e6edf4',
  moon: '#eef2fb',
  venus: '#ff8fb0',
  mars: '#ff5a4d',
  jupiter: '#8fa8ff',
  saturn: '#c9a05e',
  uranus: '#6fe3ff',
  neptune: '#9a8cff',
  pluto: '#c04a63',
  nn: '#d8c9a0',
  vesta: '#ffb27a',
  /** Lilith is a lens, never an orb, this tints her rings only. */
  lilith: '#9b7bff',
  venusFringe: ['#ff8fb0', '#86e6b8', '#ffe9c9'],
} as const;

/** Greek glyph ramp for the dither field, dark→light coverage. */
export const glyphRamp = 'ΨΦΘΞΩΔΛΠΣΓαβγδεζηθικλμνξοπρστυφχψω·';

/**
 * The dead letters, ϝ (digamma), ϟ (koppa), ϡ (sampi): letters that fell
 * out of the living alphabet yet survived as numerals. They surface rarely
 * out of the bright dither field, most often in deconstruction contexts
 * (the Uranus–Neptune 9th-house register; see natal.config.ts).
 */
export const deadLetters = 'ϝϟϡ';

/** Full rare-glyph pool: the dead letters plus the outer-planet marks. */
export const rareGlyphs = deadLetters + '♅♆';
