/**
 * Janus, the doorkeeper, as hairline stroke paths: the threshold's coin
 * (240-unit grid) and a small mark on the zodiac glyphs' 24-unit grid. The
 * coin is the Roman as: Janus on the obverse, a ship's prow on the reverse
 * with the mark of value (I) above it. Same engraving weight as the
 * foyer's zodiac ring; no fills anywhere.
 *
 * Two details carry meaning and nothing on the page explains them:
 *   - The faces differ. The elder, bearded, looks left; the youth looks
 *     right. One god, both ways.
 *   - The rim carries 365 marks, not 360. Pliny (Natural History 34.33)
 *     and Macrobius (Saturnalia 1.9.10) describe a statue of Janus whose
 *     fingers counted the days of the year.
 *
 * The geometry is computed once at build time, as ZodiacRing does.
 */

const C = 120;
const n = (v: number) => +v.toFixed(2);
const rad = (deg: number) => ((deg - 90) * Math.PI) / 180;
const pt = (r: number, deg: number) => `${n(C + r * Math.cos(rad(deg)))} ${n(C + r * Math.sin(rad(deg)))}`;

type P = [number, number];

/** Small arcs strung along a polyline: curls, the way an archaic chisel cuts them. */
function curls(points: P[], bulge = 0.55): string {
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const dx = x1 - x0;
    const dy = y1 - y0;
    d += `Q${n((x0 + x1) / 2 + dy * bulge)} ${n((y0 + y1) / 2 - dx * bulge)} ${x1} ${y1}`;
  }
  return d;
}

/** One laurel leaf from (x, y), pointing along `deg`. */
function leaf(x: number, y: number, deg: number, len = 9, w = 2.4): string {
  const a = (deg * Math.PI) / 180;
  const tx = x + len * Math.cos(a);
  const ty = y + len * Math.sin(a);
  const mx = (x + tx) / 2;
  const my = (y + ty) / 2;
  const nx = -Math.sin(a) * w;
  const ny = Math.cos(a) * w;
  return `M${n(x)} ${n(y)}Q${n(mx + nx)} ${n(my + ny)} ${n(tx)} ${n(ty)}Q${n(mx - nx)} ${n(my - ny)} ${n(x)} ${n(y)}`;
}

function waves(y: number, x0: number, count: number): string {
  let d = `M${x0} ${y}`;
  for (let i = 0; i < count; i++) d += 'q5 -4.5 10 0';
  return d;
}

/* ---- The rim: 365 marks, every fifth one longer -------------------- */

let ticks = '';
for (let i = 0; i < 365; i++) {
  const deg = (i * 360) / 365;
  ticks += `M${pt(106, deg)}L${pt(106 + (i % 5 === 0 ? 5 : 2.6), deg)}`;
}
export const RIM = { outer: 116, scale: 106, inner: 98, ticks };

/* ---- Obverse: one profile, drawn facing right ----------------------- */
/* The elder is the same drawing mirrored, with the beard in place of the chin. */

/** Forehead, brow, nose. */
const brow = [
  'M152 60',
  'C160 66 166 78 168 92',
  'C168.5 95 169 97 170 99',
  'C173 108 177.5 118 181 126',
  'C182.5 129.5 180.5 132.5 177 132.5',
  'C175 132.5 174 133.5 174 135.5',
].join('');
const nostril = 'M176.5 128.2C174.4 127.2 172.8 128.8 173.8 131.4';
/** A frontal eye in a profile face, as the archaic painters set it. */
const eye =
  'M156.5 103C159.4 99.8 165 99.8 168.2 102.6C165 104.9 159.4 105.3 156.5 103M153.5 96C158.4 92.2 165 91.7 170 94';
const ear = 'M139 120C134 113 136 105 142 107C147 109 146 119 141 125';
const hair =
  curls([[150, 68], [146, 76], [144, 85], [143, 94], [144, 103]], -0.45) +
  curls([[142, 66], [137, 75], [135, 85], [134, 95], [135, 104]], -0.45) +
  curls([[133, 66], [129, 76], [127, 87], [127, 98], [128, 109]], -0.45);
const laurel = (
  [
    [124, 49, 10],
    [132, 50, 22],
    [139.5, 53, 36],
    [146, 57.5, 50],
    [151, 63.5, 66],
  ] as [number, number, number][]
)
  .map(([x, y, deg]) => leaf(x, y, deg - 30))
  .join('');

export const FACE = { brow, nostril, eye, ear, hair, laurel };

/** The youth: lips, chin, throat, and the line of the jaw. */
export const YOUTH = {
  profile: [
    'M174 135.5',
    'C174 138.5 176 140.5 176.5 142.5',
    'C176.5 144.5 175 145.5 172.5 146',
    'C175 146.5 176.3 149 175.8 151',
    'C175.3 153.2 173.4 154.3 173 156.3',
    'C172.5 160 174.6 162.5 174 166.5',
    'C173.4 171 168 174 162 173',
    'C158 172.5 155.5 174 154 177',
    'C153 186 152.5 195 153 204',
  ].join(''),
  lips: 'M172.5 146C169.5 146.6 167 146.2 165.2 145.2',
  jaw: 'M162 173C154 170 148 163 145 152',
};

/** The elder: a moustache over the lip and a beard cut in curls. */
export const ELDER = {
  lip: 'M174 135.5C174 137.5 175 139 176.5 140.5M174.5 146C176 147.2 176.2 149.2 175.2 150.6',
  moustache: 'M176.5 140.5C172 139.5 166.5 141.5 163.5 147C167.5 145 171.5 144.8 174.5 146',
  beard: curls([
    [175.2, 150.6],
    [177.4, 157],
    [177.6, 164.5],
    [175.6, 172],
    [172.4, 179],
    [167.6, 185],
    [161.6, 188.6],
    [155.8, 187.6],
    [151, 183.6],
    [147.2, 178],
    [144.4, 171.4],
    [142.6, 164.4],
    [141.6, 157.2],
    [141.4, 150],
    [142, 143],
  ]),
  beardCurls:
    curls([[169.5, 155.5], [170.5, 162.5], [168.6, 169.5], [164.8, 175.6], [160, 179.6]], 0.5) +
    curls([[161.6, 157.5], [161.6, 164.5], [158.8, 170.5], [154.8, 174.6]], 0.5) +
    curls([[153.6, 151.6], [152.8, 158.6], [150.8, 164.8]], 0.5) +
    curls([[147, 149.6], [146.8, 156.6]], 0.5),
  throat: 'M153 186.5C152.6 192 152.6 198 153 204',
};

/** What the two faces share: the crown of the head, the seam, the cut of the bust. */
export const SHARED = {
  crown: 'M88 60C96 40 144 40 152 60',
  seam: 'M120 45V52M120 62V150',
  bust: 'M87 204C100 212 140 212 153 204',
};

/* ---- Reverse: the prow, right, with the mark of value above --------- */

export const PROW = {
  hull: [
    'M52 104V151', // the cut at the stern side
    'M52 104H148', // gunwale
    'M148 104C160 103 169 96 172 85C174 77 170 69 163 69.6C157.6 70.2 155.6 76 159 79.4C161.4 81.6 165 80.4 165.2 77.6', // the stem and its curl
    'M172 85C171.4 98 175 110 187 116L178.6 122.6C179 131 186 138 205 141', // the upper beak, then down to the ram
    'M205 141L209.5 146.5L204 151.6', // the ram's point
    'M204 151.6C194 152 185 152.6 177 154.6C150 161 100 160 52 151', // keel
    'M52 117C100 117 150 122 178.6 130.6', // upper wale
    'M52 132C100 133 150 138 186 143.4', // lower wale
    'M186 143.4H209.5', // the ram's middle tooth
  ].join(''),
  /** The eye every ancient bow carried, to see its own way. */
  eye: 'M143 113.6C146.4 109.8 153.6 109.8 157 113.6C153.6 117 146.4 117 143 113.6M150 111.6A2 2 0 1 0 150.01 111.6',
  deck: 'M62 104V89H98V104M62 96.5H98M74 89V104M86 89V104M110 104V80M110 80C116 81 119 83.6 122 82.6C119 86 116 86.6 110 87',
  /** I: one as. */
  value: 'M120 40V62M114.6 40H125.4M114.6 62H125.4',
  sea: waves(174, 56, 13) + waves(184, 71, 10),
};

/* ---- The small mark (24-unit grid): two profiles and the seam -------- */

/** The right-hand profile; the left is its mirror (translate(24 0) scale(-1 1)). */
export const MARK_HALF =
  'M12 3.4C14.5 3.4 16.3 4.6 16.8 7.4L17 9.2L19.9 13.3L17.7 13.8L18.2 15.3L17.5 15.9L17.9 17.7C17 19.1 15.6 19.6 14.4 19.6V21.4H12';
export const MARK_SEAM = 'M12 6.4V17.2';
