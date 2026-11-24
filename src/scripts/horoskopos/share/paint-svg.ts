/**
 * The SVG painter: the same card layout (cards.ts) written out as SVG. The
 * Worker uses it for link previews, where there is no canvas; the SVG is
 * then rasterised to PNG there (worker/horoskopos.ts).
 *
 * SvgCtx is a recorder with the slice of the canvas 2D API the engine's
 * drawing code calls, so the chart on a preview card is drawn by the engine
 * itself (`natal.paint`), the same code that draws the page's wheel. What
 * the recorder leaves out is cosmetic: additive blending and the clipped
 * letter texture inside the wheel.
 */
import { INK, type CardSize, type Font, type Op } from './cards.ts';
import { estimate } from './cards.ts';

const n = (v: number) => (Math.round(v * 100) / 100).toString();
const x = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
/* The Worker's rasteriser reads each font file as its own family, so the two Plex Mono weights are named outright. */
const fam = (f: Font) => (f.family === 'serif' ? 'Literata, Georgia, serif' : `IBM Plex Mono ${f.weight >= 600 ? 'SemiBold' : 'Medium'}, IBM Plex Mono, monospace`);

/** "rgba(1,2,3,.5)" or "#abc" to an SVG colour and a separate opacity. */
function paintOf(style: unknown): { c: string; a: number } {
  const s = String(style);
  const m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (m) return { c: `rgb(${Math.round(+m[1])},${Math.round(+m[2])},${Math.round(+m[3])})`, a: m[4] == null ? 1 : +m[4] };
  return { c: s, a: 1 };
}

interface Grad { id: string; def: string; stops: string[] }
type M = [number, number, number, number, number, number];
interface State { fillStyle: unknown; strokeStyle: unknown; lineWidth: number; lineCap: string; lineJoin: string; globalAlpha: number; font: string; textAlign: string; textBaseline: string; dash: number[]; m: M }

export class SvgCtx {
  out: string[] = [];
  defs: string[] = [];
  private path = '';
  private open = false;
  private stack: State[] = [];
  private s: State = { fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', globalAlpha: 1, font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic', dash: [], m: [1, 0, 0, 1, 0, 0] };
  private ids: { n: number };
  /* Set by the drawing code and ignored here. */
  globalCompositeOperation = 'source-over';
  shadowBlur = 0;
  shadowColor = '';
  constructor(ids: { n: number }) { this.ids = ids; }

  get fillStyle() { return this.s.fillStyle; } set fillStyle(v) { this.s.fillStyle = v; }
  get strokeStyle() { return this.s.strokeStyle; } set strokeStyle(v) { this.s.strokeStyle = v; }
  get lineWidth() { return this.s.lineWidth; } set lineWidth(v) { this.s.lineWidth = v; }
  get lineCap() { return this.s.lineCap; } set lineCap(v) { this.s.lineCap = v; }
  get lineJoin() { return this.s.lineJoin; } set lineJoin(v) { this.s.lineJoin = v; }
  get globalAlpha() { return this.s.globalAlpha; } set globalAlpha(v) { this.s.globalAlpha = v; }
  get font() { return this.s.font; } set font(v) { this.s.font = v; }
  get textAlign() { return this.s.textAlign; } set textAlign(v) { this.s.textAlign = v; }
  get textBaseline() { return this.s.textBaseline; } set textBaseline(v) { this.s.textBaseline = v; }

  save() { this.stack.push({ ...this.s, dash: this.s.dash.slice(), m: this.s.m.slice() as M }); }
  restore() { const p = this.stack.pop(); if (p) this.s = p; }
  private mul(b: M) { const a = this.s.m; this.s.m = [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]]; }
  translate(tx: number, ty: number) { this.mul([1, 0, 0, 1, tx, ty]); }
  scale(sx: number, sy: number) { this.mul([sx, 0, 0, sy, 0, 0]); }
  rotate(r: number) { const c = Math.cos(r), s = Math.sin(r); this.mul([c, s, -s, c, 0, 0]); }
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number) { this.s.m = [a, b, c, d, e, f]; }
  setLineDash(d: number[]) { this.s.dash = d.slice(); }
  clip() {}
  drawImage() {}
  clearRect() {}

  beginPath() { this.path = ''; this.open = false; }
  moveTo(px: number, py: number) { this.path += `M${n(px)} ${n(py)}`; this.open = true; }
  lineTo(px: number, py: number) { this.path += `${this.open ? 'L' : 'M'}${n(px)} ${n(py)}`; this.open = true; }
  quadraticCurveTo(cx: number, cy: number, px: number, py: number) { this.path += `Q${n(cx)} ${n(cy)} ${n(px)} ${n(py)}`; }
  closePath() { this.path += 'Z'; }
  rect(px: number, py: number, w: number, h: number) { this.path += `M${n(px)} ${n(py)}h${n(w)}v${n(h)}h${n(-w)}Z`; this.open = true; }
  arc(cx: number, cy: number, r: number, a0: number, a1: number, ccw = false) {
    const TAU = Math.PI * 2, at = (a: number) => `${n(cx + r * Math.cos(a))} ${n(cy + r * Math.sin(a))}`;
    let d = ccw ? a0 - a1 : a1 - a0;
    this.lineTo(cx + r * Math.cos(a0), cy + r * Math.sin(a0));
    if (Math.abs(a1 - a0) >= TAU - 1e-9) { const mid = a0 + (ccw ? -Math.PI : Math.PI); this.path += `A${n(r)} ${n(r)} 0 1 ${ccw ? 0 : 1} ${at(mid)}A${n(r)} ${n(r)} 0 1 ${ccw ? 0 : 1} ${at(a0)}`; return; }
    d = ((d % TAU) + TAU) % TAU;
    this.path += `A${n(r)} ${n(r)} 0 ${d > Math.PI ? 1 : 0} ${ccw ? 0 : 1} ${at(a1)}`;
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, rot: number) {
    const c = Math.cos(rot), s = Math.sin(rot), deg = n((rot * 180) / Math.PI);
    this.path += `M${n(cx + rx * c)} ${n(cy + rx * s)}A${n(rx)} ${n(ry)} ${deg} 1 1 ${n(cx - rx * c)} ${n(cy - rx * s)}A${n(rx)} ${n(ry)} ${deg} 1 1 ${n(cx + rx * c)} ${n(cy + rx * s)}`;
    this.open = true;
  }

  createRadialGradient(_x0: number, _y0: number, _r0: number, x1: number, y1: number, r1: number): { addColorStop(o: number, c: string): void } {
    const g: Grad = { id: `g${this.ids.n++}`, def: `<radialGradient gradientUnits="userSpaceOnUse" cx="${n(x1)}" cy="${n(y1)}" r="${n(r1)}"`, stops: [] };
    return this.grad(g, 'radialGradient');
  }
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): { addColorStop(o: number, c: string): void } {
    const g: Grad = { id: `g${this.ids.n++}`, def: `<linearGradient gradientUnits="userSpaceOnUse" x1="${n(x0)}" y1="${n(y0)}" x2="${n(x1)}" y2="${n(y1)}"`, stops: [] };
    return this.grad(g, 'linearGradient');
  }
  private grad(g: Grad, tag: string) {
    const self = this, obj = {
      __grad: g,
      addColorStop(o: number, c: string) { const p = paintOf(c); g.stops.push(`<stop offset="${n(o)}" stop-color="${p.c}" stop-opacity="${n(p.a)}"/>`); },
      toString() { if (!self.defs.some((d) => d.includes(`id="${g.id}"`))) self.defs.push(`${g.def} id="${g.id}">${g.stops.join('')}</${tag}>`); return `url(#${g.id})`; },
    };
    return obj;
  }

  private tf() { const m = this.s.m; return m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1 && m[4] === 0 && m[5] === 0 ? '' : ` transform="matrix(${m.map(n).join(' ')})"`; }
  private strokeAttrs() {
    const p = paintOf(this.s.strokeStyle), a = p.a * this.s.globalAlpha;
    return ` fill="none" stroke="${p.c}" stroke-width="${n(this.s.lineWidth)}"${a < 1 ? ` stroke-opacity="${n(a)}"` : ''}${this.s.lineCap !== 'butt' ? ` stroke-linecap="${this.s.lineCap}"` : ''}${this.s.lineJoin !== 'miter' ? ` stroke-linejoin="${this.s.lineJoin}"` : ''}${this.s.dash.length ? ` stroke-dasharray="${this.s.dash.map(n).join(' ')}"` : ''}`;
  }
  private fillAttrs() { const p = paintOf(this.s.fillStyle), a = p.a * this.s.globalAlpha; return ` fill="${p.c}"${a < 1 ? ` fill-opacity="${n(a)}"` : ''}`; }
  stroke(p?: { d: string }) { const d = p ? p.d : this.path; if (d) this.out.push(`<path d="${d}"${this.strokeAttrs()}${this.tf()}/>`); }
  fill() { if (this.path) this.out.push(`<path d="${this.path}"${this.fillAttrs()}${this.tf()}/>`); }
  fillRect(px: number, py: number, w: number, h: number) { this.out.push(`<rect x="${n(px)}" y="${n(py)}" width="${n(w)}" height="${n(h)}"${this.fillAttrs()}${this.tf()}/>`); }
  private fontOf(): Font {
    const m = this.s.font.match(/(italic\s+)?(\d{3})?\s*([\d.]+)px\s+(.*)$/);
    return { family: m && /Literata|serif/.test(m[4]) && !/mono/i.test(m[4]) ? 'serif' : 'mono', size: m ? +m[3] : 10, weight: m && m[2] ? +m[2] : 400, italic: !!(m && m[1]) };
  }
  measureText(text: string) { return { width: estimate(text, this.fontOf()) }; }
  fillText(text: string, px: number, py: number) {
    const f = this.fontOf(), anchor = this.s.textAlign === 'center' ? 'middle' : this.s.textAlign === 'right' || this.s.textAlign === 'end' ? 'end' : 'start';
    const dy = this.s.textBaseline === 'middle' ? f.size * 0.35 : this.s.textBaseline === 'top' || this.s.textBaseline === 'hanging' ? f.size * 0.8 : 0;
    this.out.push(`<text x="${n(px)}" y="${n(py + dy)}" font-family="${fam(f)}" font-size="${n(f.size)}" font-weight="${f.weight}"${f.italic ? ' font-style="italic"' : ''} text-anchor="${anchor}"${this.fillAttrs()}${this.tf()}>${x(String(text))}</text>`);
  }
}

/** Write a laid-out card as an SVG document. `chart` draws the staged chart view into a recorder the size of its box. */
export function paintSvg(ops: Op[], size: CardSize, chart?: (ctx: SvgCtx, w: number, h: number) => void): string {
  const ids = { n: 0 }, defs: string[] = [], out: string[] = [];
  for (const o of ops) {
    const al = 'alpha' in o && o.alpha != null && o.alpha < 1 ? ` opacity="${n(o.alpha)}"` : '';
    if (o.t === 'rect') out.push(`<rect x="${n(o.x)}" y="${n(o.y)}" width="${n(o.w)}" height="${n(o.h)}"${o.rx ? ` rx="${n(o.rx)}"` : ''} fill="${o.fill || 'none'}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${n(o.sw || 1)}"` : ''}${al}/>`);
    else if (o.t === 'glow') { const id = `g${ids.n++}`; defs.push(`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${n(o.x)}" cy="${n(o.y)}" r="${n(o.r)}"><stop offset="0" stop-color="${o.color}" stop-opacity="${n(o.alpha)}"/><stop offset="1" stop-color="${o.color}" stop-opacity="0"/></radialGradient>`); out.push(`<circle cx="${n(o.x)}" cy="${n(o.y)}" r="${n(o.r)}" fill="url(#${id})"/>`); }
    else if (o.t === 'line') out.push(`<path d="M${n(o.x1)} ${n(o.y1)}L${n(o.x2)} ${n(o.y2)}" stroke="${o.stroke}" stroke-width="${n(o.sw)}" fill="none"${al}/>`);
    else if (o.t === 'circle') out.push(`<circle cx="${n(o.x)}" cy="${n(o.y)}" r="${n(o.r)}" fill="${o.fill}"${al}/>`);
    else if (o.t === 'text') out.push(`<text x="${n(o.x)}" y="${n(o.y)}" font-family="${fam(o.font)}" font-size="${n(o.font.size)}" font-weight="${o.font.weight}"${o.font.italic ? ' font-style="italic"' : ''}${o.font.ls ? ` letter-spacing="${n(o.font.ls)}"` : ''} text-anchor="${o.align === 'center' ? 'middle' : o.align === 'right' ? 'end' : 'start'}" fill="${o.fill}"${al}>${x(o.text)}</text>`);
    else if (o.t === 'path') out.push(`<path d="${o.d}" transform="translate(${n(o.x)} ${n(o.y)}) scale(${n(o.scale)})" fill="none" stroke="${o.stroke}" stroke-width="${n(o.sw / o.scale)}" stroke-linecap="round" stroke-linejoin="round"${al}/>`);
    else if (o.t === 'svg48') out.push(`<g transform="translate(${n(o.x)} ${n(o.y)}) scale(${n(o.scale)})" fill="none" stroke="${o.color}" color="${o.color}" stroke-width="${n(o.sw / o.scale)}" stroke-linecap="round" stroke-linejoin="round">${o.markup}</g>`);
    else if (o.t === 'chart' && chart) {
      const ctx = new SvgCtx(ids);
      chart(ctx, o.w, o.h);
      defs.push(...ctx.defs);
      out.push(`<g transform="translate(${n(o.x)} ${n(o.y)})">${ctx.out.join('')}</g>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size.w}" height="${size.h}" viewBox="0 0 ${size.w} ${size.h}"><defs>${defs.join('')}</defs><rect width="${size.w}" height="${size.h}" fill="${INK.night}"/>${out.join('')}</svg>`;
}
