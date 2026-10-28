/**
 * 16-bit style pixel sprites, one per portfolio project, plus the site mark.
 * Each sprite is a 16x16 grid of palette letters, rendered at build time as
 * crisp inline SVG (see spriteSvg). No image files, no requests.
 *
 * Palette letters: . transparent, k carbon, s smoke, w bone, g gold,
 * G gold-hot, d gold-deep, e ember, E ember-hot, r ember-deep, c spark.
 */
export const PALETTE: Record<string, string> = {
  k: "#0A0908",
  s: "#4A3F36",
  w: "#F3EADB",
  g: "#F2B72E",
  G: "#FFD766",
  d: "#B8830F",
  e: "#FF5A1F",
  E: "#FF8A3D",
  r: "#C8330E",
  c: "#22E3FF",
};

export const sprites: Record<string, string[]> = {
  /** The site mark: a torch. Also the favicon. */
  torch: [
    "......EE........",
    ".....EGGE.......",
    "....EGGGGE......",
    "....EGGGGE......",
    "...EGGGGGGE.....",
    "...EGGGGGGE.....",
    "....EGGGGE......",
    ".....EGGE.......",
    "....kkkkkk......",
    "....kwwwwk......",
    ".....kddk.......",
    ".....kddk.......",
    ".....kddk.......",
    ".....kddk.......",
    ".....kddk.......",
    "......kk........",
  ],
  /** The Manifesto: an open book with a flame rising from the gutter. */
  "the-manifesto": [
    ".......e........",
    "......eEe.......",
    ".....eEGEe......",
    ".....eGGGe......",
    "......eGe.......",
    ".......g........",
    "................",
    ".kkkkkk..kkkkkk.",
    "kwwwwwwkkwwwwwwk",
    "kwssswwkkwwssswk",
    "kwwwwwwkkwwwwwwk",
    "kwsswwwkkwwwsswk",
    "kwwwwwwkkwwwwwwk",
    ".kkkkkkkkkkkkkk.",
    "..kddddddddddk..",
    "...kkkkkkkkkk...",
  ],
  /** Libertarian Leadership Academy: a raised torch. */
  libertarianleadership: [
    "......EE........",
    ".....EGGE.......",
    "....EGGGGE......",
    "....EGGGGE......",
    "...EGGGGGGE.....",
    "...EGGGGGGE.....",
    "....EGGGGE......",
    ".....EGGE.......",
    "....kkkkkk......",
    "....kwwwwk......",
    ".....kddk.......",
    ".....kddk.......",
    ".....kddk.......",
    ".....kddk.......",
    ".....kddk.......",
    "......kk........",
  ],
  /** Libertarian Party of Washington: the Space Needle. */
  lpwa: [
    ".......ww.......",
    ".......ww.......",
    "......wwww......",
    "....wwwwwwww....",
    "...wggggggggw...",
    "..wgggcggcgggw..",
    "...wggggggggw...",
    "....wwwwwwww....",
    ".......ss.......",
    ".......ss.......",
    "......s..s......",
    "......s..s......",
    ".....s....s.....",
    ".....s....s.....",
    "....s......s....",
    "...ssssssssss...",
  ],
  /** Libertarian Tool Suite: a wrench. */
  libertariantoolsuite: [
    "...........ggg..",
    "..........gGGGg.",
    ".........gGG.GG.",
    "........gGGG.Gg.",
    ".......gGGGGGG..",
    "......gGGGGGG...",
    ".....gGGGGG.....",
    "....gGGGGg......",
    "...gGGGGg.......",
    "..gGGGGg........",
    ".gGGGGg.........",
    "gGGGGg..........",
    "GGGGg...........",
    "GGGg............",
    "gg..............",
    "................",
  ],
  /** Pattie Gray, Pacific County: a lighthouse on the water. */
  electpattiegray: [
    ".......ee.......",
    "......eGGe......",
    ".....eGGGGe.....",
    "......eGGe......",
    ".......gg.......",
    "......kwwk......",
    "......kwwk......",
    ".....kwwwwk.....",
    ".....kwwwwk.....",
    "....kwrrrrwk....",
    "....kwwwwwwk....",
    "...kwrrrrrrwk...",
    "...kwwwwwwwwk...",
    "..kkkkkkkkkkkk..",
    ".ccccccccccccc..",
    "cccccccccccccccc",
  ],
  /** Justin Peroli, Ohio: a ballot box with the check going in. */
  justinperoli: [
    "................",
    "............cc..",
    "...........cc...",
    "..........cc....",
    "......cc.cc.....",
    ".......ccc......",
    "........c.......",
    "..kkkkkkkkkkkk..",
    ".kwwwwwwwwwwwwk.",
    ".kwwwkkkkkkwwwk.",
    ".kwwwwwwwwwwwwk.",
    ".kkkkkkkkkkkkkk.",
    ".kggggggggggggk.",
    ".kggggggggggggk.",
    ".kggggggggggggk.",
    ".kkkkkkkkkkkkkk.",
  ],
  /** Ryan Shollenberger, Wyoming: a mountain under the sun. */
  ryanforwyoming: [
    "................",
    "....GGG.........",
    "...GGGGG........",
    "....GGG.........",
    "................",
    ".........w......",
    "........www.....",
    ".......wsssw....",
    "......wsssssw...",
    ".....wsssssssw..",
    "....wsssdsssssw.",
    "...wsssddddssssw",
    "..wssdddddddssss",
    ".wsdddddddddddds",
    "dddddddddddddddd",
    "rrrrrrrrrrrrrrrr",
  ],
  /** Don Myers, Washington House: the capitol dome. */
  donmyers: [
    ".......g........",
    ".......g........",
    "......www.......",
    ".....wwwww......",
    "....wwwwwww.....",
    "...wwwwwwwww....",
    "..wwwwwwwwwww...",
    "..kkkkkkkkkkk...",
    "..kcckcckcckk...",
    ".kkkkkkkkkkkkk..",
    ".kwwwwwwwwwwwk..",
    ".kwskwskwskwsk..",
    ".kwskwskwskwsk..",
    ".kwwwwwwwwwwwk..",
    "kkkkkkkkkkkkkkk.",
    "dddddddddddddddd",
  ],
  /** Greasy Porcupines: a porcupine, quills up, one headlight for an eye. */
  greasyporcupines: [
    "................",
    "......g.g.g.g...",
    ".....g.g.g.g.g..",
    "....gGgGgGgGgG..",
    "...gGsGsGsGsGsg.",
    "..gGsssssssssssg",
    "..GssssssssssssG",
    ".gsssssssssssssG",
    ".kssssssssssssss",
    "kssscssssssssss.",
    "kssssssssssssse.",
    ".kssssssssssse..",
    "..kssssssssse...",
    "...kkkkkkkkk....",
    "....kk...kk.....",
    "....kk...kk.....",
  ],
  /** Michael Wilhelm: the natal wheel, Saturn crowning the zenith. */
  iamwilhelm: [
    ".......gg.......",
    ".....wwGGww.....",
    "...ww..gg..ww...",
    "..w..........w..",
    ".w............w.",
    ".w....c.......w.",
    "w......ssss....w",
    "w.....s....s...w",
    "w.....s.ee.s...w",
    "w.....s.ee.s.e.w",
    ".w.....ssss...w.",
    ".w............w.",
    "..w.....c....w..",
    "...ww......ww...",
    ".....wwwwww.....",
    "................",
  ],
  /** Saturn: the crown on the MC. The Easter egg mark (see console.ts). */
  saturn: [
    "................",
    "................",
    "..............d.",
    "......GGGG...d..",
    ".....GGGGGG.d...",
    "....GGGGGGGd....",
    "....GGGGGGdG....",
    "...dGGGGGdGGG...",
    "..d.GGGGdGGGG...",
    ".d..GGGdGGGG....",
    "d....GdGGGG.....",
    ".....d.GGG......",
    "....d...........",
    "...d............",
    "................",
    "................",
  ],
  /** The Existentialist Republic PAC: an open eye. */
  terpac: [
    "................",
    "................",
    ".....wwwwww.....",
    "...wwGGGGGGww...",
    "..wwGGkkkkGGww..",
    ".wwGGkkeekkGGww.",
    ".wGGkkeeeekkGGw.",
    ".wGGkkeeeekkGGw.",
    ".wwGGkkeekkGGww.",
    "..wwGGkkkkGGww..",
    "...wwGGGGGGww...",
    ".....wwwwww.....",
    "................",
    "................",
    "................",
    "................",
  ],
};

/** Render a sprite grid as a crisp inline SVG string. */
export function spriteSvg(name: string, opts: { class?: string; title?: string } = {}): string {
  const grid = sprites[name] ?? sprites.torch;
  const rows = grid.length;
  const cols = grid[0].length;
  let rects = "";
  for (let y = 0; y < rows; y++) {
    // Run-length merge horizontally so the SVG stays small.
    let x = 0;
    while (x < cols) {
      const ch = grid[y][x];
      if (ch === "." || !PALETTE[ch]) { x++; continue; }
      let w = 1;
      while (x + w < cols && grid[y][x + w] === ch) w++;
      rects += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${PALETTE[ch]}"/>`;
      x += w;
    }
  }
  const cls = opts.class ? ` class="${opts.class}"` : "";
  const title = opts.title ? `<title>${opts.title}</title>` : "";
  const aria = opts.title ? ` role="img"` : ` aria-hidden="true"`;
  return `<svg${cls} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols} ${rows}" shape-rendering="crispEdges"${aria}>${title}${rects}</svg>`;
}
