/**
 * Character palettes for the glyph dither filter.
 *
 * Each palette is a ramp ordered from empty (dark) to dense (bright);
 * the engine maps cell luminance onto ramp position. `rare` glyphs are
 * substituted with low probability during shimmer — this is where ♅ and ♆
 * live in the deconstruction palettes (see the egg framework, Phase 2).
 */

export interface GlyphPalette {
  /** Ramp from sparsest to densest glyph. */
  ramp: string[];
  /** Glyphs that surface rarely inside the field. */
  rare: string[];
  /** Probability per cell per shimmer step that a rare glyph surfaces. */
  rareChance: number;
}

/** Default palette: ASCII. */
const ascii: GlyphPalette = {
  ramp: [' ', ' ', '.', ':', '-', '~', '=', '+', '*', 'x', '%', '#', '@'],
  rare: [],
  rareChance: 0,
};

/**
 * Deconstruction palette: polytonic Greek, breathings and subscripts
 * included, seeded with the dead letters — ϝ (digamma), ϟ (koppa),
 * ϡ (sampi). Used in all deconstruction / writings contexts.
 * ♅ and ♆ pass through rarely (Phase 2 egg #6).
 */
const greek: GlyphPalette = {
  ramp: [
    ' ',
    ' ',
    '᾿',
    '῾',
    '·',
    'ι',
    'ͺ',
    'ς',
    'τ',
    'ϝ',
    'ε',
    'ζ',
    'ϟ',
    'ξ',
    'ᾳ',
    'ϡ',
    'ᾧ',
    'θ',
    'Ξ',
    'Θ',
    'Ψ',
  ],
  rare: ['♅', '♆', 'ϝ', 'ϟ', 'ϡ'],
  rareChance: 0.0012,
};

export const PALETTES: Record<string, GlyphPalette> = { ascii, greek };

export type PaletteName = keyof typeof PALETTES;

export function getPalette(name: string | null | undefined): GlyphPalette {
  return PALETTES[name ?? 'ascii'] ?? ascii;
}
