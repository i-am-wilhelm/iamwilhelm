/**
 * Card layouts. A card is drawn from the registry's CardData through a small
 * template system: five slots (title, glyph or wheel, voice line,
 * attribution, footer) arranged by one of four layouts, shared by every
 * module:
 *   voice  a glyph, a title and one pulled line        (speeches, houses, terms)
 *   duo    two glyphs across an aspect, and one line   (aspect exchange)
 *   table  a title and rows                            (placements, tones)
 *   chart  the wheel itself, with a line beside it     (wheel, synastry, Davison)
 *
 * layoutCard returns a flat list of drawing operations. Two painters read
 * that list: the browser's canvas (paint-canvas.ts) and an SVG writer
 * (paint-svg.ts) the Worker rasterises for link previews. The layout is the
 * same in both; only the painter differs.
 *
 * Text never shrinks to fit. A card takes one line (or short passage) of a
 * reading at a fixed size class, and says where the rest is.
 */
import { LITERATA, MONO_ADVANCE } from './metrics.ts';
import type { CardData, Glyph, Row } from './registry.ts';

export interface CardSize { id: string; label: string; use: string; w: number; h: number }
export const SIZES: readonly CardSize[] = [
  { id: 'story', label: 'Story', use: 'Stories, TikTok', w: 1080, h: 1920 },
  { id: 'feed', label: 'Feed', use: 'Instagram feed', w: 1080, h: 1350 },
  { id: 'wide', label: 'Wide', use: 'X, Facebook, link previews', w: 1200, h: 630 },
];
export const sizeById = (id: string) => SIZES.find((s) => s.id === id) || SIZES[2];

/* The engine's own palette (public/machines/natal/engine.js, COL). */
export const INK = { night: '#0b0a10', slab: '#15131c', ink: '#efe8d8', mute: '#aaa49b', rule: '#2d2935', ichor: '#f2c56b' };
/** The Horoskopos mark: the wheel, the horizon through it, and the rising point at nine o'clock, where the hour-marker sits. */
export const MARK = { ring: 'M20.5 12A8.5 8.5 0 1 0 3.5 12A8.5 8.5 0 1 0 20.5 12', horizon: 'M0.6 12H23.4', dot: [3.5, 12, 2.1] as const };
export const SITE_LINE = 'iamwilhelm.com';

export interface Font { family: 'serif' | 'mono'; size: number; weight: number; italic?: boolean; ls?: number }
export type Op =
  | { t: 'rect'; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; sw?: number; rx?: number; alpha?: number }
  | { t: 'glow'; x: number; y: number; r: number; color: string; alpha: number }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string; sw: number; alpha?: number }
  | { t: 'circle'; x: number; y: number; r: number; fill: string; alpha?: number }
  | { t: 'text'; x: number; y: number; text: string; font: Font; fill: string; align?: 'left' | 'center' | 'right'; alpha?: number }
  | { t: 'path'; d: string; x: number; y: number; scale: number; stroke: string; sw: number; alpha?: number }
  | { t: 'svg48'; markup: string; x: number; y: number; scale: number; color: string; sw: number }
  | { t: 'chart'; x: number; y: number; w: number; h: number };

export type Measure = (text: string, font: Font) => number;

/** Break text into lines no wider than `width`. Words are never split. */
export function wrap(text: string, font: Font, width: number, measure: Measure): string[] {
  const words = text.split(/\s+/).filter(Boolean), lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (cur && measure(next, font) > width) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Keep at most `max` lines, closing the last with an ellipsis when something was cut. */
function clamp(lines: string[], max: number): string[] {
  if (lines.length <= max) return lines;
  const out = lines.slice(0, Math.max(1, max));
  out[out.length - 1] = out[out.length - 1].replace(/[\s,;:.]*$/, '') + '…';
  return out;
}

const serif = (size: number, weight = 400, italic = false): Font => ({ family: 'serif', size, weight, italic });
const mono = (size: number, weight = 500, ls = 0): Font => ({ family: 'mono', size, weight, ls });

function glyphOps(g: Glyph | undefined, cx: number, cy: number, size: number, color: string): Op[] {
  if (!g) return [];
  /* Strokes stay sturdy at every size: never under a fortieth of the glyph. */
  const sw = Math.max(2.5, size / 15);
  if (g.path) return [{ t: 'path', d: g.path, x: cx - size / 2, y: cy - size / 2, scale: size / 24, stroke: color, sw }];
  if (g.svg48) return [{ t: 'svg48', markup: g.svg48, x: cx - size / 2, y: cy - size / 2, scale: size / 48, color, sw }];
  return [{ t: 'text', x: cx, y: cy + size * 0.2, text: g.text || '', font: mono(size * 0.56, 600), fill: color, align: 'center' }];
}

/** A scatter of faint stars, the same on every painter (a fixed sequence, as on the engine's own canvas). */
function stars(w: number, h: number): Op[] {
  const out: Op[] = [];
  for (let i = 0; i < 90; i++) {
    const x = Math.abs((Math.sin(i * 12.9898) * 43758.5453) % 1) * w, y = Math.abs((Math.sin(i * 78.233) * 12345.678) % 1) * h;
    out.push({ t: 'circle', x, y, r: 1.3, fill: INK.ink, alpha: 0.1 + 0.25 * Math.abs(Math.sin(i * 3.3)) });
  }
  return out;
}

interface Box { x: number; y: number; w: number; h: number }

/** The five aspect signs as strokes on the 24 grid, so a card never depends on a font having them. */
export const ASPECT_GLYPH: Record<string, string> = {
  '☌': 'M14 15A5 5 0 1 0 4 15A5 5 0 1 0 14 15M12.6 11.4L20 4',
  '☍': 'M10 17.5A3.5 3.5 0 1 0 3 17.5A3.5 3.5 0 1 0 10 17.5M21 6.5A3.5 3.5 0 1 0 14 6.5A3.5 3.5 0 1 0 21 6.5M9 15L15 9',
  '△': 'M12 4L21 20H3Z',
  '□': 'M5 5H19V19H5Z',
  '✶': 'M12 3V21M4.2 7.5L19.8 16.5M19.8 7.5L4.2 16.5',
};

/** The footer every card carries: the Horoskopos mark, its name, and the URL. Returns the y the content must stop above. */
function footer(ops: Op[], W: number, floor: number, m: number, k: number): number {
  const fh = 74 * k, y = floor - fh, cy = y + fh / 2 + 10 * k, s = 46 * k;
  ops.push({ t: 'line', x1: m, y1: y, x2: W - m, y2: y, stroke: INK.rule, sw: 2 });
  ops.push({ t: 'path', d: MARK.ring, x: m, y: cy - s / 2, scale: s / 24, stroke: INK.ichor, sw: 3 * k });
  ops.push({ t: 'path', d: MARK.horizon, x: m, y: cy - s / 2, scale: s / 24, stroke: INK.ichor, sw: 3 * k });
  ops.push({ t: 'circle', x: m + (MARK.dot[0] * s) / 24, y: cy, r: (MARK.dot[2] * s) / 24, fill: INK.ichor });
  ops.push({ t: 'text', x: m + s + 18 * k, y: cy + 9 * k, text: 'HOROSKOPOS', font: mono(26 * k, 600, 3 * k), fill: INK.ichor });
  ops.push({ t: 'text', x: W - m, y: cy + 9 * k, text: SITE_LINE, font: mono(26 * k, 500, 0.5 * k), fill: INK.ink, align: 'right' });
  return y;
}

/** Kicker, title (with its Greek) and the small note under it. Returns the y below the block. */
function heading(ops: Op[], c: CardData, box: Box, k: number, measure: Measure, o: { titleSize: number; subLines: number; align?: 'left' | 'center' }): number {
  const align = o.align || 'left', x = align === 'center' ? box.x + box.w / 2 : box.x;
  let y = box.y;
  const kf = mono(24 * k, 600, 3 * k);
  for (const ln of clamp(wrap(c.kicker.toUpperCase(), kf, box.w, measure), 2)) { y += 32 * k; ops.push({ t: 'text', x, y, text: ln, font: kf, fill: c.color, align }); }
  y += 12 * k;
  let tf = serif(o.titleSize * k, 600);
  if (measure(c.title, tf) > box.w * 1.9) tf = serif(o.titleSize * k * 0.72, 600); // a long title steps down one class; it is a name, not a reading
  const tl = clamp(wrap(c.title, tf, box.w, measure), 2);
  for (const ln of tl) { y += tf.size * 1.14; ops.push({ t: 'text', x, y, text: ln, font: tf, fill: INK.ink, align }); }
  if (c.greek) {
    const gf = serif(tf.size * 0.5, 400), last = tl[tl.length - 1] || '', lw = measure(last, tf), gw = measure(c.greek, gf);
    if (align === 'left' && lw + 26 * k + gw <= box.w) ops.push({ t: 'text', x: x + lw + 26 * k, y, text: c.greek, font: gf, fill: c.color });
    else { y += gf.size * 1.35; ops.push({ t: 'text', x, y, text: c.greek, font: gf, fill: c.color, align }); }
  }
  if (c.sub && o.subLines > 0) {
    const sf = mono(22 * k, 500);
    y += 14 * k;
    for (const ln of clamp(wrap(c.sub, sf, box.w, measure), o.subLines)) { y += 33 * k; ops.push({ t: 'text', x, y, text: ln, font: sf, fill: INK.mute, align }); }
  }
  if (c.trail && c.trail.length) {
    const sf = mono(20 * k, 500);
    y += 12 * k;
    for (const ln of clamp(wrap(['Start', ...c.trail].join(' › '), sf, box.w, measure), 2)) { y += 30 * k; ops.push({ t: 'text', x, y, text: ln, font: sf, fill: INK.mute, align }); }
  }
  return y;
}

/** The pulled line with its attribution and the pointer back, centred in `box`. One of three fixed size classes, by length. */
function voice(ops: Op[], c: CardData, box: Box, k: number, measure: Measure, base: number) {
  if (!c.line) return;
  const n = c.line.text.length, inset = 34 * k, af = mono(22 * k, 500), mf = serif(27 * k, 400, true);
  const tail = (c.attribution ? 58 * k : 0) + (c.more ? 52 * k : 0);
  /* Three fixed classes. A line takes the class its length earns, or the next one down when the box is short;
     below the smallest it is cut with an ellipsis, never scaled. */
  const classes = [1, 0.84, 0.7].map((f) => Math.round(base * f * k));
  let vf = serif(classes[2], 500), lh = classes[2] * 1.34, lines: string[] = [];
  for (let i = n <= 90 ? 0 : n <= 160 ? 1 : 2; i < 3; i++) {
    vf = serif(classes[i], 500); lh = classes[i] * 1.34;
    lines = wrap(c.line.text, vf, box.w - inset, measure);
    if (lines.length * lh + tail <= box.h) break;
  }
  lines = clamp(lines, Math.max(2, Math.floor((box.h - tail) / lh)));
  const blockH = lines.length * lh + tail;
  let y = box.y + Math.max(0, (box.h - blockH) / 2);
  ops.push({ t: 'rect', x: box.x, y: y + lh * 0.16, w: 5 * k, h: lines.length * lh - lh * 0.1, fill: c.color });
  for (const ln of lines) { y += lh; ops.push({ t: 'text', x: box.x + inset, y: y - lh * 0.22, text: ln, font: vf, fill: INK.ink }); }
  if (c.attribution) { y += 52 * k; ops.push({ t: 'text', x: box.x + inset, y: y - 6 * k, text: '— ' + clamp(wrap(c.attribution, af, box.w - inset - 40 * k, measure), 1)[0], font: af, fill: c.color }); }
  if (c.more) { y += 50 * k; ops.push({ t: 'text', x: box.x + inset, y: y - 6 * k, text: c.more, font: mf, fill: INK.mute }); }
}

function rows(ops: Op[], list: Row[], box: Box, k: number, measure: Measure, cols: number) {
  const per = Math.ceil(list.length / cols), gap = 44 * k, cw = (box.w - gap * (cols - 1)) / cols;
  const rh = box.h / per;
  let fs = Math.min(34 * k, rh * 0.42);
  /* A table may tighten its type so the longest row fits its column (rows are data, not a reading). */
  const need = (f: number) => Math.max(...list.map((r) => measure(r.name.split(' · ')[0], serif(f, 600)) + measure(r.value, serif(f, 400)) + Math.min(rh * 0.58, f * 1.5) + 44 * k));
  if (need(fs) > cw) fs = Math.max(fs * 0.62, (fs * cw) / need(fs));
  const nf = serif(fs, 600), vf = serif(fs, 400), tf = mono(fs * 0.62, 500);
  /* The small note column shows for every row or for none. */
  const g0 = Math.min(rh * 0.58, fs * 1.5), notes = list.every((r) => !r.note || measure(r.name.split(' · ')[0], nf) + measure(r.value, vf) + measure(r.note, tf) + g0 + 66 * k <= cw);
  list.forEach((r, i) => {
    const col = Math.floor(i / per), x = box.x + col * (cw + gap), y = box.y + (i % per) * rh, base = y + rh / 2 + fs * 0.34, g = Math.min(rh * 0.58, fs * 1.5);
    if (i % per) ops.push({ t: 'line', x1: x, y1: y, x2: x + cw, y2: y, stroke: INK.rule, sw: 1.5 });
    ops.push(...glyphOps(r.glyph, x + g / 2, y + rh / 2, g, r.color || INK.ichor));
    const nx = x + g + 18 * k, room = cw - (nx - x), vw = measure(r.value, vf), note = r.note || '', noteW = note ? measure(note, tf) + 22 * k : 0;
    /* The name gives way first ("Helios · Sun" falls back to "Helios"), then the note. */
    let name = r.name;
    if (measure(name, nf) + vw + (notes ? noteW : 0) + 26 * k > room) name = name.split(' · ')[0];
    const showNote = !!note && notes;
    ops.push({ t: 'text', x: nx, y: base, text: name, font: nf, fill: INK.ink });
    ops.push({ t: 'text', x: x + cw - (showNote ? noteW : 0), y: base, text: r.value, font: vf, fill: INK.ink, align: 'right' });
    if (showNote) ops.push({ t: 'text', x: x + cw, y: base - 1, text: note, font: tf, fill: INK.mute, align: 'right' });
  });
}

function joinerOps(sym: string, cx: number, cy: number, size: number, color: string): Op[] {
  const d = ASPECT_GLYPH[sym];
  return d ? [{ t: 'path', d, x: cx - size / 2, y: cy - size / 2, scale: size / 24, stroke: color, sw: Math.max(2.5, size / 13) }] : [];
}

export interface LayoutOptions {
  /** The Worker's rasteriser only has the site's Literata: leave out a name in a script it cannot set (Lilith's, in Hebrew). */
  latinGreekOnly?: boolean;
}

/** Lay a card out at a size. `measure` gives text widths in the painter's own fonts. */
export function layoutCard(card: CardData, size: CardSize, measure: Measure, o: LayoutOptions = {}): Op[] {
  const c = o.latinGreekOnly && card.greek && !settable(card.greek) ? { ...card, greek: undefined } : card;
  const { w: W, h: H } = size, wide = W > H, story = H / W > 1.6;
  /* A story keeps clear of the bands an app lays its own controls over, top and bottom. */
  const k = wide ? 0.86 : story ? 1.12 : 1, m = wide ? 54 : story ? 84 : 78, padTop = story ? 170 : 0, padBottom = story ? 190 : 0;
  const ops: Op[] = [{ t: 'rect', x: 0, y: 0, w: W, h: H, fill: INK.night }, ...stars(W, H)];
  ops.push({ t: 'rect', x: m / 2.6, y: m / 2.6, w: W - m / 1.3, h: H - m / 1.3, stroke: INK.rule, sw: 2, rx: 22 });
  const bottom = footer(ops, W, H - m - padBottom, m, k) - 30 * k, top = m + padTop;
  const full: Box = { x: m, y: top, w: W - 2 * m, h: bottom - top };

  if (c.layout === 'chart') {
    if (wide) {
      const side = full.h, text: Box = { x: m + side + 44, y: top, w: W - 2 * m - side - 44, h: full.h };
      ops.push({ t: 'glow', x: m + side / 2, y: top + side / 2, r: side * 0.62, color: c.color, alpha: 0.1 }, { t: 'chart', x: m, y: top, w: side, h: side });
      const y = heading(ops, c, text, k, measure, { titleSize: 66, subLines: 0 });
      voice(ops, { ...c, attribution: '' }, { x: text.x, y: y + 16, w: text.w, h: bottom - y - 16 }, k, measure, 46);
    } else {
      const y = heading(ops, c, full, k, measure, { titleSize: 84, subLines: 0 });
      const side = Math.min(full.w, bottom - y - 250 * k), cy = y + 34 * k;
      ops.push({ t: 'glow', x: W / 2, y: cy + side / 2, r: side * 0.62, color: c.color, alpha: 0.1 }, { t: 'chart', x: (W - side) / 2, y: cy, w: side, h: side });
      voice(ops, { ...c, attribution: '' }, { x: m, y: cy + side + 10, w: full.w, h: bottom - cy - side - 10 }, k, measure, 46);
    }
    return ops;
  }

  if (c.layout === 'table') {
    const list = (c.rows || []).slice(0, 14);
    if (wide) {
      const left: Box = { x: m, y: top, w: 330, h: full.h };
      ops.push({ t: 'glow', x: m + 120, y: top + 120, r: 300, color: c.color, alpha: 0.1 });
      heading(ops, c, left, k, measure, { titleSize: 62, subLines: 4 });
      rows(ops, list, { x: m + 372, y: top + 4, w: W - 2 * m - 372, h: full.h - 4 }, k, measure, 2);
    } else {
      ops.push({ t: 'glow', x: m + 160, y: top + 140, r: 420, color: c.color, alpha: 0.1 });
      const y = heading(ops, c, full, k, measure, { titleSize: 84, subLines: 2 }) + 34 * k;
      const tail = c.more ? 76 * k : 0, rh = Math.min(104 * k, (bottom - y - tail) / Math.max(1, list.length));
      rows(ops, list, { x: m, y, w: full.w, h: rh * list.length }, k, measure, 1);
      if (c.more) ops.push({ t: 'text', x: m, y: y + rh * list.length + 56 * k, text: c.more, font: serif(27 * k, 400, true), fill: INK.mute });
    }
    return ops;
  }

  /* voice and duo */
  const duo = c.layout === 'duo' && !!c.glyph2;
  if (wide) {
    const left: Box = { x: m, y: top, w: 372, h: full.h }, g = duo ? 104 : 150;
    ops.push({ t: 'glow', x: m + (duo ? 170 : g / 2), y: top + g / 2 + 6, r: 280, color: c.color, alpha: 0.16 });
    if (duo) ops.push(...glyphOps(c.glyph, m + g / 2, top + g / 2 + 6, g, c.color), ...joinerOps(c.joiner || '', m + g + 62, top + g / 2 + 6, 58, c.color), ...glyphOps(c.glyph2, m + g + 124 + g / 2, top + g / 2 + 6, g, c.color));
    else ops.push(...glyphOps(c.glyph, m + g / 2, top + g / 2 + 6, g, c.color));
    heading(ops, c, { ...left, y: top + (c.glyph ? g + 18 : 0) }, k, measure, { titleSize: duo ? 46 : 56, subLines: 3 });
    ops.push({ t: 'line', x1: m + 408, y1: top + 6, x2: m + 408, y2: bottom - 6, stroke: INK.rule, sw: 2 });
    voice(ops, c, { x: m + 444, y: top, w: W - 2 * m - 444, h: full.h }, k, measure, 50);
    return ops;
  }
  const g = (duo ? 170 : 200) * k, gy = top + g / 2 + 8;
  ops.push({ t: 'glow', x: duo ? W / 2 : m + g / 2, y: gy, r: g * 2.4, color: c.color, alpha: 0.16 });
  if (duo) {
    const gap = g * 0.66;
    ops.push(...glyphOps(c.glyph, W / 2 - g / 2 - gap, gy, g, c.color), ...joinerOps(c.joiner || '', W / 2, gy, g * 0.6, c.color), ...glyphOps(c.glyph2, W / 2 + g / 2 + gap, gy, g, c.color));
  } else ops.push(...glyphOps(c.glyph, m + g / 2, gy, g, c.color));
  const y = heading(ops, c, { x: m, y: top + (c.glyph ? g + 40 * k : 0), w: full.w, h: 0 }, k, measure, { titleSize: duo ? 64 : 96, subLines: 3, align: duo ? 'center' : 'left' });
  ops.push({ t: 'line', x1: m, y1: y + 44 * k, x2: W - m, y2: y + 44 * k, stroke: INK.rule, sw: 2 });
  voice(ops, c, { x: m, y: y + 60 * k, w: full.w, h: bottom - y - 60 * k }, k, measure, 60);
  return ops;
}

/* ---------------- measuring without a canvas ---------------- */

/** Whether the site's Literata can set a string: Latin and Greek, the ranges its files cover. */
export const settable = (text: string) => [...text].every((ch) => LITERATA[ch] != null);

/** Text width from the font's own advance widths (metrics.ts). Used wherever there is no canvas to ask. */
export const estimate: Measure = (text, font) => {
  let w = 0;
  if (font.family === 'mono') w = [...text].length * MONO_ADVANCE;
  else for (const ch of text) w += LITERATA[ch] ?? 600;
  return (w / 1000) * font.size * 1.01 + (font.ls || 0) * [...text].length;
};
