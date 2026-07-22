/**
 * Runtime glyph atlas for the dither pass.
 *
 * Draws the Greek glyph ramp (design tokens) onto an offscreen canvas —
 * white ink on transparent — measures each glyph's actual ink coverage,
 * and orders the atlas by coverage so the shader can map luminance
 * monotonically: dark scene → sparse glyph ('·'), bright scene → heavy
 * glyph ('Ψ', 'Φ'). Measuring instead of trusting the ramp's declared
 * order keeps the mapping correct across whatever Greek-capable font the
 * visitor actually has installed.
 */

import { glyphRamp, rareGlyphs } from '../design/tokens';

export interface GlyphAtlas {
  /** Offscreen canvas holding the glyph grid — upload as a GL texture. */
  canvas: HTMLCanvasElement;
  /** Grid dimensions in cells. */
  cols: number;
  rows: number;
  /** Total glyphs in the atlas (ramp + rares). */
  count: number;
  /** Ramp glyphs, ordered lightest→heaviest coverage (indices 0..rampCount-1). */
  rampCount: number;
  /** Rare glyphs (dead letters, outer-planet marks) at indices >= rampCount. */
  rareCount: number;
  /** Pixel size of one atlas cell. */
  cell: number;
}

/** Font stack mirrors --font-greek in global.css. */
const GREEK_FONT = "'GFS Neohellenic', 'New Athena Unicode', Georgia, serif";

export function buildGlyphAtlas(cell = 64): GlyphAtlas {
  const glyphs = Array.from(glyphRamp);
  const rares = Array.from(rareGlyphs);
  const count = glyphs.length + rares.length;
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);

  // Scratch canvas: draw one glyph at a time and integrate its alpha to
  // rank glyphs by real ink coverage.
  const scratch = document.createElement('canvas');
  scratch.width = scratch.height = cell;
  const sctx = scratch.getContext('2d', { willReadFrequently: true })!;

  const measure = (glyph: string): number => {
    sctx.clearRect(0, 0, cell, cell);
    sctx.fillStyle = '#fff';
    sctx.font = `${Math.floor(cell * 0.78)}px ${GREEK_FONT}`;
    sctx.textAlign = 'center';
    sctx.textBaseline = 'middle';
    sctx.fillText(glyph, cell / 2, cell / 2);
    const data = sctx.getImageData(0, 0, cell, cell).data;
    let ink = 0;
    for (let i = 3; i < data.length; i += 4) ink += data[i];
    return ink;
  };

  const ranked = glyphs
    .map((g) => ({ g, ink: measure(g) }))
    .sort((a, b) => a.ink - b.ink); // lightest first → index 0 = dark bucket

  const canvas = document.createElement('canvas');
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.font = `${Math.floor(cell * 0.78)}px ${GREEK_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Rares sit after the ramp, unranked: the shader addresses them directly
  // by index, never through the luminance mapping.
  ranked.map(({ g }) => g).concat(rares).forEach((g, i) => {
    const cx = (i % cols) * cell + cell / 2;
    const cy = Math.floor(i / cols) * cell + cell / 2;
    ctx.fillText(g, cx, cy);
  });

  return {
    canvas,
    cols,
    rows,
    count,
    rampCount: glyphs.length,
    rareCount: rares.length,
    cell,
  };
}
