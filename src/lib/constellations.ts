/**
 * Constellation geometry — the sky's twelve figures.
 *
 * Pure data + math, no DOM (imported by both the Astro frontmatter that
 * places the clickable overlays and the client script that draws). Each
 * symbol gets a designed star cluster — normalized 0..1 coordinates,
 * y down — with line segments evoking its form, plus a layout position
 * in the sky (percentages of the sky box) and a parallax depth.
 *
 * Special geometry lives here too:
 *   - the Cross is literally an unfolded cube net; foldCrossNet() folds
 *     its six faces about their shared edges into the Black Cube
 *   - Hermes carries a second form (Thoth with the Was-scepter) with a
 *     1:1 star correspondence for the morph; lingerEase() plateaus at
 *     the superimposed midpoint so the two gods hang doubled
 *   - the grand trine (egg #3): Babalon, Prometheus and Pan sit on an
 *     exact equilateral triangle in layout coordinates
 */

import { SYMBOLS } from './symbols';

export interface ConStar {
  x: number;
  y: number;
  /** 0..1 — visual weight (size and brightness). */
  w: number;
}

export type ConLine = readonly [number, number];

export interface ConstellationForm {
  stars: ReadonlyArray<ConStar>;
  lines: ReadonlyArray<ConLine>;
}

export interface ConstellationDef extends ConstellationForm {
  id: string;
  name: string;
  /** Cluster center in the sky, % of width / height. */
  cx: number;
  cy: number;
  /** Cluster box size as a fraction of min(skyW, skyH). */
  scale: number;
  /** Parallax depth: 0 far … 2 near. Trine members share a layer. */
  depth: 0 | 1 | 2;
  href: string;
}

const st = (x: number, y: number, w = 0.6): ConStar => ({ x, y, w });

/* ---------------------------------------------------------------- */
/* The grand trine (egg #3)                                          */
/* ---------------------------------------------------------------- */

/**
 * Babalon, Prometheus and Pan are the vertices of an equilateral
 * triangle in layout space: centroid (50, 56), circumradius 30, apex up.
 * Each vertex is one third of a turn from the next, so each pair
 * subtends exactly 120° at the centroid and every internal angle of the
 * triangle is exactly 60° — the aspect is exact in the sky's percentage
 * coordinate system (the screen's aspect ratio stretches the *render*;
 * the layout geometry is what the egg certifies). All three sit on the
 * same parallax layer so the triangle survives every translation.
 */
const TRINE_CX = 50;
const TRINE_CY = 56;
const TRINE_R = 30;

function trinePoint(third: 0 | 1 | 2): readonly [number, number] {
  const ang = (third * 2 * Math.PI) / 3; // 0 = apex, then clockwise
  return [
    TRINE_CX + TRINE_R * Math.sin(ang),
    TRINE_CY - TRINE_R * Math.cos(ang),
  ];
}

const BABALON_AT = trinePoint(0); // (50, 26)
const PAN_AT = trinePoint(1); // (≈75.98, 71)
const PROMETHEUS_AT = trinePoint(2); // (≈24.02, 71)

/** The three vertices, by symbol id. Click all three in one visit. */
export const TRINE_IDS = ['babalon', 'prometheus', 'pan'] as const;

/* ---------------------------------------------------------------- */
/* The Cross — an unfolded cube net                                  */
/* ---------------------------------------------------------------- */

/**
 * Net cells on a unit grid (col, row), a Latin cross: a column of four
 * squares with two arms at the second row. Cell [1,1] is the base face —
 * the cube's floor — and every other face folds toward it. The far face
 * [1,3] rides its parent [1,2] through two hinges.
 *
 *        [1,0]
 *  [0,1] [1,1] [2,1]
 *        [1,2]
 *        [1,3]
 */
const CROSS_CELLS: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [1, 0],
  [0, 1],
  [2, 1],
  [1, 2],
  [1, 3],
];

interface NetFold {
  /** 'x': hinge parallel to the x-axis at y = at; 'y': at x = at. */
  axis: 'x' | 'y';
  at: number;
  /** Which side of the hinge lifts out of the plane. */
  dir: 1 | -1;
}

/** Fold chains per face, innermost hinge first (applied face → base). */
const CROSS_FOLDS: ReadonlyArray<ReadonlyArray<NetFold>> = [
  [], // base — the cube's floor holds still
  [{ axis: 'x', at: 1, dir: -1 }],
  [{ axis: 'y', at: 1, dir: -1 }],
  [{ axis: 'y', at: 2, dir: 1 }],
  [{ axis: 'x', at: 2, dir: 1 }],
  [
    { axis: 'x', at: 3, dir: 1 },
    { axis: 'x', at: 2, dir: 1 },
  ],
];

export const CROSS_FACES = 6;
export const CROSS_FACE_CORNERS = 4;

/**
 * Fold the net. t: 0 = flat cross, 1 = closed cube (every hinge at 90°).
 * Writes 6 faces × 4 corners × (x, y, z) = 72 floats into `out`,
 * centered on the fold's drifting centroid so the figure stays framed
 * as it closes. Corner order per face: (c,r) (c+1,r) (c+1,r+1) (c,r+1).
 * Coordinates are in net units (cube side = 1); at t=1 the cube spans
 * −0.5..0.5 on every axis.
 */
export function foldCrossNet(t: number, out: Float32Array): void {
  const tc = Math.max(0, Math.min(1, t));
  const a = tc * (Math.PI / 2);
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const cx = 1.5;
  const cy = 2 - 0.5 * tc; // net centroid → cube centroid
  const cz = 0.5 * tc;

  let o = 0;
  for (let f = 0; f < CROSS_FACES; f++) {
    const cell = CROSS_CELLS[f]!;
    const folds = CROSS_FOLDS[f]!;
    const c = cell[0];
    const r = cell[1];
    for (let k = 0; k < CROSS_FACE_CORNERS; k++) {
      let x = k === 1 || k === 2 ? c + 1 : c;
      let y = k === 2 || k === 3 ? r + 1 : r;
      let z = 0;
      for (const fold of folds) {
        const s = fold.dir * sin;
        if (fold.axis === 'x') {
          const dy = y - fold.at;
          const ny = fold.at + dy * cos - z * s;
          z = dy * s + z * cos;
          y = ny;
        } else {
          const dx = x - fold.at;
          const nx = fold.at + dx * cos - z * s;
          z = dx * s + z * cos;
          x = nx;
        }
      }
      out[o++] = x - cx;
      out[o++] = y - cy;
      out[o++] = z - cz;
    }
  }
}

/** The flat net as a constellation form — stars at the shared corners. */
const crossFlat: ConstellationForm = (() => {
  const stars: ConStar[] = [];
  const index = new Map<string, number>();
  const lines: Array<ConLine> = [];
  const seen = new Set<string>();
  const vert = (x: number, y: number): number => {
    const k = `${x},${y}`;
    let i = index.get(k);
    if (i === undefined) {
      i = stars.length;
      index.set(k, i);
      // net spans x 0..3, y 0..4 — normalize into a centered 0..1 box
      stars.push(st((x + 0.5) / 4, y / 4, 0.65));
    }
    return i;
  };
  for (const [c, r] of CROSS_CELLS) {
    const corners = [vert(c, r), vert(c + 1, r), vert(c + 1, r + 1), vert(c, r + 1)];
    for (let e = 0; e < 4; e++) {
      const a = corners[e]!;
      const b = corners[(e + 1) % 4]!;
      const ek = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (!seen.has(ek)) {
        seen.add(ek);
        lines.push([a, b]);
      }
    }
  }
  return { stars, lines };
})();

/* ---------------------------------------------------------------- */
/* Thoth → Hermes morph                                              */
/* ---------------------------------------------------------------- */

/**
 * Thoth, ibis-headed, gripping the Was-scepter — nine stars in 1:1
 * correspondence with the Hermes form below (staff↔scepter, wings↔head,
 * serpents↔body). The morph lerps star positions and crossfades the two
 * line sets.
 */
export const THOTH_FORM: ConstellationForm = {
  stars: [
    st(0.26, 0.08, 1), // Was-scepter head
    st(0.26, 0.5, 0.8), // shaft
    st(0.26, 0.92, 0.8), // forked base
    st(0.58, 0.12, 0.9), // ibis head
    st(0.78, 0.26, 0.7), // curve of the beak
    st(0.58, 0.34, 0.7), // shoulder
    st(0.42, 0.5, 0.6), // hand on the scepter
    st(0.58, 0.62, 0.6), // hip
    st(0.58, 0.92, 0.7), // feet
  ],
  lines: [
    [0, 1],
    [1, 2],
    [3, 4],
    [3, 5],
    [5, 6],
    [6, 1],
    [5, 7],
    [7, 8],
  ],
};

/**
 * Ease with a plateau: 0..1 in, holding flat at 0.5 through the middle
 * of the drive so the superimposed frame — Thoth over Hermes — lingers.
 */
export function lingerEase(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  const s = (v: number) => v * v * (3 - 2 * v);
  if (u < 0.4) return 0.5 * s(u / 0.4);
  if (u > 0.6) return 0.5 + 0.5 * s((u - 0.6) / 0.4);
  return 0.5; // the doubled god holds
}

/* ---------------------------------------------------------------- */
/* The twelve                                                        */
/* ---------------------------------------------------------------- */

const WRITINGS = '/writings/';

const def = (
  id: string,
  cx: number,
  cy: number,
  scale: number,
  depth: 0 | 1 | 2,
  form: ConstellationForm,
  href: string = WRITINGS
): ConstellationDef => ({
  id,
  name: SYMBOLS[id]?.name ?? id,
  stars: form.stars,
  lines: form.lines,
  cx,
  cy,
  scale,
  depth,
  href,
});

/**
 * Layout notes:
 *   - Saturn culminates: pinned at the very top of the sky, the
 *     Medium Coeli (egg #2 checks the visitor meets it up there)
 *   - Sol Niger's star ring is EMPTY at its exact center — that void is
 *     where Mercury hides, cazimi (egg #1; the overlay button sits at
 *     the cluster's cx/cy, which is star-space (0.5, 0.5))
 *   - Babalon / Prometheus / Pan: see the trine constants above
 *   - ordered top → bottom so the reveal wave sweeps down the sky
 */
export const CONSTELLATIONS: ReadonlyArray<ConstellationDef> = [
  // ♄ at the MC — a ringed body: pentagon planet, four ring stars aslant
  def('saturn', 50, 7, 0.15, 1, {
    stars: [
      st(0.5, 0.24, 0.9),
      st(0.69, 0.378, 0.7),
      st(0.618, 0.602, 0.7),
      st(0.382, 0.602, 0.7),
      st(0.31, 0.378, 0.7),
      st(0.08, 0.62, 0.8),
      st(0.34, 0.55, 0.5),
      st(0.66, 0.42, 0.5),
      st(0.92, 0.34, 0.9),
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 0],
      [5, 6],
      [6, 7],
      [7, 8],
    ],
  }),

  // the seven sisters — a tight knot, barely lined
  def('pleiades', 86, 10, 0.09, 0, {
    stars: [
      st(0.44, 0.56, 0.9),
      st(0.54, 0.5, 1),
      st(0.64, 0.54, 0.7),
      st(0.56, 0.38, 0.8),
      st(0.46, 0.34, 0.7),
      st(0.34, 0.42, 0.6),
      st(0.6, 0.68, 0.6),
    ],
    lines: [
      [5, 4],
      [4, 3],
      [3, 1],
      [1, 0],
      [1, 2],
      [2, 6],
    ],
  }),

  // two faces from one spine — the gate that looks both ways
  def('janus', 12, 12, 0.16, 0, {
    stars: [
      st(0.5, 0.14, 1),
      st(0.5, 0.86, 0.9),
      st(0.3, 0.3, 0.7),
      st(0.18, 0.5, 0.8),
      st(0.3, 0.7, 0.7),
      st(0.7, 0.3, 0.7),
      st(0.82, 0.5, 0.8),
      st(0.7, 0.7, 0.7),
    ],
    lines: [
      [0, 1],
      [0, 2],
      [2, 3],
      [3, 4],
      [4, 1],
      [0, 5],
      [5, 6],
      [6, 7],
      [7, 1],
    ],
  }),

  // the chalice — trine apex
  def('babalon', BABALON_AT[0], BABALON_AT[1], 0.16, 2, {
    stars: [
      st(0.18, 0.24, 0.9),
      st(0.82, 0.24, 0.9),
      st(0.32, 0.44, 0.6),
      st(0.68, 0.44, 0.6),
      st(0.5, 0.54, 1),
      st(0.5, 0.74, 0.6),
      st(0.3, 0.9, 0.7),
      st(0.7, 0.9, 0.7),
    ],
    lines: [
      [0, 2],
      [2, 4],
      [4, 3],
      [3, 1],
      [4, 5],
      [6, 5],
      [5, 7],
    ],
  }),

  // the vessel with vapor rising — pharmakon
  def(
    'medea',
    72,
    28,
    0.14,
    0,
    {
      stars: [
        st(0.24, 0.58, 0.8),
        st(0.76, 0.58, 0.8),
        st(0.34, 0.84, 0.7),
        st(0.66, 0.84, 0.7),
        st(0.5, 0.42, 0.7),
        st(0.42, 0.26, 0.6),
        st(0.56, 0.1, 1),
      ],
      lines: [
        [0, 1],
        [0, 2],
        [2, 3],
        [3, 1],
        [4, 5],
        [5, 6],
      ],
    },
    '/writings/pharmakon/'
  ),

  // the lyre
  def('orpheus', 28, 32, 0.15, 1, {
    stars: [
      st(0.5, 0.92, 1),
      st(0.32, 0.6, 0.7),
      st(0.68, 0.6, 0.7),
      st(0.24, 0.18, 0.8),
      st(0.76, 0.18, 0.8),
      st(0.5, 0.24, 0.6),
    ],
    lines: [
      [0, 1],
      [0, 2],
      [1, 3],
      [2, 4],
      [3, 5],
      [5, 4],
      [0, 5],
    ],
  }),

  // the unfolded cube — drawn through foldCrossNet, this flat form is t=0
  def('cross', 11, 46, 0.2, 2, crossFlat),

  // caduceus end-state; begins as THOTH_FORM (see the morph above)
  def('hermes', 86, 46, 0.18, 1, {
    stars: [
      st(0.5, 0.08, 1), // staff crown
      st(0.5, 0.48, 0.8), // crossing point
      st(0.5, 0.9, 0.8), // staff foot
      st(0.32, 0.14, 0.7), // wing
      st(0.68, 0.14, 0.7), // wing
      st(0.34, 0.32, 0.6), // serpent
      st(0.34, 0.66, 0.6),
      st(0.66, 0.32, 0.6),
      st(0.66, 0.66, 0.6),
    ],
    lines: [
      [0, 1],
      [1, 2],
      [3, 0],
      [0, 4],
      [5, 1],
      [1, 8],
      [7, 1],
      [1, 6],
    ],
  }),

  // the black sun — a ray-crowned ring whose center holds NO star;
  // that empty heart is where Mercury sits cazimi (egg #1)
  def('solniger', 38, 52, 0.18, 1, {
    stars: [
      st(0.66, 0.5, 0.7),
      st(0.58, 0.639, 0.7),
      st(0.42, 0.639, 0.7),
      st(0.34, 0.5, 0.7),
      st(0.42, 0.361, 0.7),
      st(0.58, 0.361, 0.7),
      st(0.864, 0.71, 0.5),
      st(0.5, 0.92, 0.5),
      st(0.136, 0.71, 0.5),
      st(0.136, 0.29, 0.5),
      st(0.5, 0.08, 0.5),
      st(0.864, 0.29, 0.5),
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 0],
      // pinwheel spokes — the black sun turns
      [0, 6],
      [1, 7],
      [2, 8],
      [3, 9],
      [4, 10],
      [5, 11],
    ],
  }),

  // the tail-eater — eight on the ring, the head closing the circle
  def('ouroboros', 62, 58, 0.15, 0, {
    stars: [
      st(0.5, 0.12, 0.8),
      st(0.769, 0.231, 0.6),
      st(0.88, 0.5, 0.65),
      st(0.769, 0.769, 0.6),
      st(0.5, 0.88, 0.65),
      st(0.231, 0.769, 0.6),
      st(0.12, 0.5, 0.65),
      st(0.231, 0.231, 0.6),
      st(0.62, 0.2, 1), // the head, jaw at the tail
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 0],
      [0, 8],
    ],
  }),

  // fire carried down — trine lower-left
  def('prometheus', PROMETHEUS_AT[0], PROMETHEUS_AT[1], 0.16, 2, {
    stars: [
      st(0.5, 0.06, 1), // the flame
      st(0.38, 0.2, 0.7),
      st(0.62, 0.2, 0.7),
      st(0.5, 0.36, 0.8), // the hand
      st(0.5, 0.58, 0.7),
      st(0.36, 0.92, 0.7),
      st(0.64, 0.92, 0.7),
    ],
    lines: [
      [1, 0],
      [0, 2],
      [1, 3],
      [2, 3],
      [3, 4],
      [4, 5],
      [4, 6],
    ],
  }),

  // horns, torso, goat legs — trine lower-right
  def('pan', PAN_AT[0], PAN_AT[1], 0.16, 2, {
    stars: [
      st(0.28, 0.1, 0.8),
      st(0.72, 0.1, 0.8),
      st(0.5, 0.28, 1),
      st(0.34, 0.44, 0.7),
      st(0.66, 0.44, 0.7),
      st(0.5, 0.62, 0.7),
      st(0.38, 0.92, 0.7),
      st(0.62, 0.92, 0.7),
    ],
    lines: [
      [0, 2],
      [1, 2],
      [2, 3],
      [2, 4],
      [3, 5],
      [4, 5],
      [5, 6],
      [5, 7],
    ],
  }),
];
