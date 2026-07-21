/**
 * The site's symbol registry — the constellations of the sky and the
 * governing symbols of writings. Placeholder glyphs stand in until the
 * real constellation art arrives (Phase 2 draws these as star clusters).
 */

export interface SiteSymbol {
  id: string;
  name: string;
  /** Placeholder mark until constellation art exists. */
  glyph: string;
  /** The symbol's smoke — a CSS color value. */
  accent: string;
  /** Seed for its placeholder dither art. */
  seed: number;
}

const S = (
  id: string,
  name: string,
  glyph: string,
  accent: string,
  seed: number
): SiteSymbol => ({ id, name, glyph, accent, seed });

export const SYMBOLS: Record<string, SiteSymbol> = {
  janus: S('janus', 'Janus', '⧉', 'var(--smoke-sky)', 101),
  orpheus: S('orpheus', 'Orpheus', '♪', 'var(--smoke-sky)', 102),
  babalon: S('babalon', 'Babalon', '✷', 'var(--smoke-babalon)', 103),
  prometheus: S('prometheus', 'Prometheus', '🜂', 'var(--smoke-babalon)', 104),
  hermes: S('hermes', 'Hermes', '☿', 'var(--smoke-sky)', 105),
  medea: S('medea', 'Medea', '🜍', 'var(--smoke-medea)', 106),
  ouroboros: S('ouroboros', 'Ouroboros', '⟲', 'var(--smoke-saturn)', 107),
  solniger: S('solniger', 'Sol Niger', '☉', 'var(--smoke-saturn)', 108),
  saturn: S('saturn', 'Saturn', '♄', 'var(--smoke-saturn)', 109),
  pleiades: S('pleiades', 'Pleiades', '⁂', 'var(--smoke-sky)', 110),
  cross: S('cross', 'The Cross', '☩', 'var(--smoke-sky)', 111),
  pan: S('pan', 'Pan', '⚶', 'var(--smoke-monsoon)', 112),
  pallas: S('pallas', 'Pallas', '⚵', 'var(--smoke-pallas)', 113),
  venus: S('venus', 'Venus', '♀', 'var(--smoke-venus)', 114),
};

export type SymbolId = keyof typeof SYMBOLS;

export const SYMBOL_IDS = Object.keys(SYMBOLS) as SymbolId[];

export function getSymbol(id: string): SiteSymbol {
  return SYMBOLS[id] ?? SYMBOLS.medea!;
}
