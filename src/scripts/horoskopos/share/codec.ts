/**
 * The chart codec: what a Horoskopos share link carries.
 *
 * A link holds computed chart output only: where each body stands, the
 * angles, the house cusps and the house system. Birth date, time and place
 * are never an input here and never appear in the bytes. The output is
 * packed to a compact binary, then base64url.
 *
 * Privacy is applied before encoding (applyPrivacy), so whatever a level
 * hides is not in the link at all:
 *   full  everything, with the chart's label
 *   sign  signs only: no degrees, no houses, no lots (the label stays)
 *   anon  signs only, and no label or name
 * The two cuts are separate flags in the format (sign level, has a name),
 * so the levels can be recombined later without a new version.
 *
 * Format, version 1 (all integers big-endian):
 *   byte 0   version
 *   byte 1   flags: 1 sign level · 2 has name · 4 timed (angles known) ·
 *            8 Chiron and the asteroids present · 16 a Davison chart ·
 *            32|64 house system (0 Placidus, 1 whole sign, 2 equal)
 *   full     per body (ten planets, then the five small bodies when present):
 *              longitude u24 (a turn is 2^24), daily motion i16 (1/2000 degree)
 *            North Node u24, Black Moon u24
 *            when timed: Ascendant, Midheaven, Vertex u24 each, and for
 *              Placidus the four cusps that are not fixed by the angles
 *              (2, 3, 5, 6) u24 each
 *   sign     one nibble per sign: the bodies, the Node, the Black Moon, and
 *            when timed the rising and culminating signs; then a u16 of
 *            retrograde bits, one per body
 *   name     when present: length u8, then UTF-8
 *
 * A longitude survives the trip to under a tenth of an arcsecond.
 */

export const CODEC_VERSION = 1;

export const PLANETS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'] as const;
export const MINOR = ['chiron', 'ceres', 'pallas', 'juno', 'vesta'] as const;
export type BodyId = (typeof PLANETS)[number] | (typeof MINOR)[number];
export type HouseSystem = 'P' | 'W' | 'E';
export type Privacy = 'full' | 'sign' | 'anon';
export const PRIVACY: readonly Privacy[] = ['full', 'sign', 'anon'];

export interface Houses {
  asc: number;
  mc: number;
  vertex: number;
  hsys: HouseSystem;
  /** Twelve cusps, the first house first. */
  cusps: number[];
}

/** Computed chart output: everything a module needs to re-render, and nothing a chart was cast from. */
export interface ChartOutput {
  /** The chart's label. Empty when it has none or the level hides it. */
  name: string;
  davison: boolean;
  /** Sign level: every longitude is the middle of its sign and motion only carries direction. */
  signOnly: boolean;
  bodies: Partial<Record<BodyId, { lon: number; spd: number }>>;
  /** Whether Chiron and the four asteroids are present. */
  minor: boolean;
  nn: number;
  lilith: number;
  /** Angles and cusps; null without a birth time, and always null at sign level. */
  houses: Houses | null;
  /** Sign level only: the signs (0 to 11) of the Ascendant and the Midheaven, when the time was known. */
  rising: number | null;
  culm: number | null;
}

const TURN = 1 << 24;
const HSYS: HouseSystem[] = ['P', 'W', 'E'];
const NAME_MAX = 48;
const norm = (x: number) => ((x % 360) + 360) % 360;
const signOf = (lon: number) => Math.floor(norm(lon) / 30) % 12;
const mid = (sign: number) => sign * 30 + 15;

/** A label fit to travel: one line, no control characters, at most 48 bytes of UTF-8. */
export function cleanName(name: string): string {
  let s = String(name || '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim();
  const enc = new TextEncoder();
  while (enc.encode(s).length > NAME_MAX) s = [...s].slice(0, -1).join('').trim();
  return s;
}

/** Reduce a chart to what a privacy level allows. Run before encoding: what is cut never reaches the link. */
export function applyPrivacy(ch: ChartOutput, p: Privacy): ChartOutput {
  const name = p === 'anon' ? '' : cleanName(ch.name);
  if (p === 'full' && !ch.signOnly) return { ...ch, name, bodies: { ...ch.bodies }, houses: ch.houses ? { ...ch.houses, cusps: ch.houses.cusps.slice() } : null };
  const bodies: ChartOutput['bodies'] = {};
  for (const id of [...PLANETS, ...(ch.minor ? MINOR : [])]) {
    const b = ch.bodies[id];
    if (b) bodies[id] = { lon: mid(signOf(b.lon)), spd: b.spd < 0 ? -1 : 1 };
  }
  return {
    name,
    davison: ch.davison,
    signOnly: true,
    bodies,
    minor: ch.minor,
    nn: mid(signOf(ch.nn)),
    lilith: mid(signOf(ch.lilith)),
    houses: null,
    rising: ch.houses ? signOf(ch.houses.asc) : ch.rising,
    culm: ch.houses ? signOf(ch.houses.mc) : ch.culm,
  };
}

/* ---------------- bytes ---------------- */

class Writer {
  private b: number[] = [];
  u8(v: number) { this.b.push(v & 255); }
  u16(v: number) { this.u8(v >> 8); this.u8(v); }
  u24(v: number) { this.u8(v >> 16); this.u8(v >> 8); this.u8(v); }
  i16(v: number) { this.u16(v < 0 ? v + 65536 : v); }
  lon(deg: number) { this.u24(Math.round((norm(deg) / 360) * TURN) % TURN); }
  nibbles(list: number[]) { for (let i = 0; i < list.length; i += 2) this.u8(((list[i] & 15) << 4) | ((list[i + 1] ?? 0) & 15)); }
  bytes(list: Uint8Array) { for (const v of list) this.b.push(v); }
  done() { return Uint8Array.from(this.b); }
}

class Reader {
  private i = 0;
  private b: Uint8Array;
  constructor(b: Uint8Array) { this.b = b; }
  u8() { if (this.i >= this.b.length) throw new Error('chart code is cut short'); return this.b[this.i++]; }
  u16() { return (this.u8() << 8) | this.u8(); }
  u24() { return (this.u8() << 16) | (this.u8() << 8) | this.u8(); }
  i16() { const v = this.u16(); return v > 32767 ? v - 65536 : v; }
  lon() { return (this.u24() / TURN) * 360; }
  nibbles(n: number) { const out: number[] = []; for (let i = 0; i < n; i += 2) { const v = this.u8(); out.push(v >> 4, v & 15); } return out.slice(0, n); }
  bytes(n: number) { const out = new Uint8Array(n); for (let i = 0; i < n; i++) out[i] = this.u8(); return out; }
  get left() { return this.b.length - this.i; }
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function toBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    out += B64[a >> 2] + B64[((a & 3) << 4) | ((b ?? 0) >> 4)];
    if (i + 1 < bytes.length) out += B64[((b & 15) << 2) | ((c ?? 0) >> 6)];
    if (i + 2 < bytes.length) out += B64[c & 63];
  }
  return out;
}

export function fromBase64Url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) throw new Error('chart code is not base64url');
  const out: number[] = [];
  let acc = 0, bits = 0;
  for (const ch of text) {
    acc = (acc << 6) | B64.indexOf(ch);
    bits += 6;
    if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 255); }
  }
  return Uint8Array.from(out);
}

/* ---------------- encode, decode ---------------- */

/** Pack computed chart output into bytes, at the given privacy level. */
export function encodeChartBytes(chart: ChartOutput, privacy: Privacy = 'full'): Uint8Array {
  const ch = applyPrivacy(chart, privacy);
  const ids: BodyId[] = [...PLANETS, ...(ch.minor ? MINOR : [])];
  for (const id of ids) if (!ch.bodies[id]) throw new Error(`chart has no ${id}`);
  const name = new TextEncoder().encode(ch.name);
  const timed = ch.signOnly ? ch.rising != null && ch.culm != null : !!ch.houses;
  const hsys = ch.houses ? Math.max(0, HSYS.indexOf(ch.houses.hsys)) : 0;
  const w = new Writer();
  w.u8(CODEC_VERSION);
  w.u8((ch.signOnly ? 1 : 0) | (name.length ? 2 : 0) | (timed ? 4 : 0) | (ch.minor ? 8 : 0) | (ch.davison ? 16 : 0) | (hsys << 5));
  if (ch.signOnly) {
    const signs = ids.map((id) => signOf(ch.bodies[id]!.lon));
    signs.push(signOf(ch.nn), signOf(ch.lilith));
    if (timed) signs.push(ch.rising!, ch.culm!);
    w.nibbles(signs);
    let retro = 0;
    ids.forEach((id, i) => { if (ch.bodies[id]!.spd < 0) retro |= 1 << i; });
    w.u16(retro);
  } else {
    for (const id of ids) {
      const b = ch.bodies[id]!;
      w.lon(b.lon);
      w.i16(Math.max(-32767, Math.min(32767, Math.round(b.spd * 2000))));
    }
    w.lon(ch.nn);
    w.lon(ch.lilith);
    if (ch.houses) {
      const h = ch.houses;
      w.lon(h.asc); w.lon(h.mc); w.lon(h.vertex);
      if (h.hsys === 'P') for (const i of [1, 2, 4, 5]) w.lon(h.cusps[i]);
    }
  }
  if (name.length) { w.u8(name.length); w.bytes(name); }
  return w.done();
}

/** Unpack bytes into computed chart output. Throws on anything that is not a chart of a known version. */
export function decodeChartBytes(bytes: Uint8Array): ChartOutput {
  const r = new Reader(bytes);
  const version = r.u8();
  if (version !== CODEC_VERSION) throw new Error(`chart code version ${version} is not one this page reads`);
  const flags = r.u8();
  const signOnly = !!(flags & 1), hasName = !!(flags & 2), timed = !!(flags & 4), minor = !!(flags & 8), davison = !!(flags & 16);
  const hsys = HSYS[(flags >> 5) & 3];
  if (!hsys) throw new Error('chart code names no house system');
  const ids: BodyId[] = [...PLANETS, ...(minor ? MINOR : [])];
  const bodies: ChartOutput['bodies'] = {};
  let nn = 0, lilith = 0, houses: Houses | null = null, rising: number | null = null, culm: number | null = null;
  if (signOnly) {
    const signs = r.nibbles(ids.length + 2 + (timed ? 2 : 0));
    if (signs.some((s) => s > 11)) throw new Error('chart code holds a sign that does not exist');
    const retro = r.u16();
    ids.forEach((id, i) => { bodies[id] = { lon: mid(signs[i]), spd: retro & (1 << i) ? -1 : 1 }; });
    nn = mid(signs[ids.length]);
    lilith = mid(signs[ids.length + 1]);
    if (timed) { rising = signs[ids.length + 2]; culm = signs[ids.length + 3]; }
  } else {
    for (const id of ids) bodies[id] = { lon: r.lon(), spd: r.i16() / 2000 };
    nn = r.lon();
    lilith = r.lon();
    if (timed) {
      const asc = r.lon(), mc = r.lon(), vertex = r.lon();
      const cusps = new Array<number>(12);
      if (hsys === 'P') {
        const [c2, c3, c5, c6] = [r.lon(), r.lon(), r.lon(), r.lon()];
        cusps[0] = asc; cusps[1] = c2; cusps[2] = c3; cusps[3] = norm(mc + 180); cusps[4] = c5; cusps[5] = c6;
        for (let i = 0; i < 6; i++) cusps[i + 6] = norm(cusps[i] + 180);
      } else {
        const base = hsys === 'W' ? Math.floor(asc / 30) * 30 : asc;
        for (let i = 0; i < 12; i++) cusps[i] = norm(base + 30 * i);
      }
      houses = { asc, mc, vertex, hsys, cusps };
    }
  }
  let name = '';
  if (hasName) name = cleanName(new TextDecoder().decode(r.bytes(r.u8())));
  if (r.left) throw new Error('chart code runs long');
  return { name, davison, signOnly, bodies, minor, nn, lilith, houses, rising, culm };
}

/** Computed chart output to the text a link carries. */
export function encodeChart(chart: ChartOutput, privacy: Privacy = 'full'): string {
  return toBase64Url(encodeChartBytes(chart, privacy));
}

/** The text a link carries back to computed chart output. */
export function decodeChart(text: string): ChartOutput {
  if (text.length > 400) throw new Error('chart code is too long');
  return decodeChartBytes(fromBase64Url(text));
}

/** The level a decoded chart was shared at, read from the chart itself. */
export function privacyOf(ch: ChartOutput): Privacy {
  return !ch.signOnly ? 'full' : ch.name ? 'sign' : 'anon';
}
