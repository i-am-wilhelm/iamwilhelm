/**
 * The canvas painter: draws a laid-out card (cards.ts) onto a 2D canvas in
 * the browser, with the page's own fonts. The chart on a card is drawn by
 * the engine itself, through the `chart` callback.
 */
import type { Font, Measure, Op } from './cards.ts';

export const FAMILY = { serif: "'Literata', Georgia, serif", mono: "'IBM Plex Mono', ui-monospace, Menlo, Consolas, monospace" };
export const fontCss = (f: Font) => `${f.italic ? 'italic ' : ''}${f.weight} ${f.size}px ${FAMILY[f.family]}`;

type Ctx = CanvasRenderingContext2D;
const spaced = (ctx: Ctx, ls: number) => { if ('letterSpacing' in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${ls}px`; };

/** Text widths in the page's fonts. */
export function canvasMeasure(ctx: Ctx): Measure {
  return (text, font) => {
    ctx.save();
    ctx.font = fontCss(font);
    spaced(ctx, font.ls || 0);
    const w = ctx.measureText(text).width + ('letterSpacing' in ctx ? 0 : (font.ls || 0) * text.length);
    ctx.restore();
    return w;
  };
}

/** Every face a card can use, loaded before measuring or drawing. Greek rides in its own files, so it is asked for by sample. */
export async function loadCardFonts(): Promise<void> {
  if (!document.fonts || !document.fonts.load) return;
  const faces: Array<[string, string]> = [
    ["400 40px 'Literata'", 'Aa'], ["500 40px 'Literata'", 'Aa'], ["600 40px 'Literata'", 'Aa'], ["italic 400 40px 'Literata'", 'Aa'],
    ["400 40px 'Literata'", 'φιλομμειδής'], ["400 40px 'Literata'", 'ὡροσκόπος'], ["600 40px 'Literata'", 'Ἀφροδίτη'],
    ["500 30px 'IBM Plex Mono'", 'Aa'], ["600 30px 'IBM Plex Mono'", 'Aa'],
  ];
  await Promise.all(faces.map(([f, t]) => document.fonts.load(f, t).catch(() => [])));
}

/** The glossary's small drawings arrive as SVG markup on a 48 grid: circles, ellipses and paths. */
function svg48(ctx: Ctx, markup: string, color: string) {
  for (const m of markup.matchAll(/<(circle|ellipse|path)\s([^>]*?)\/?>/g)) {
    const a: Record<string, string> = {};
    for (const p of m[2].matchAll(/([a-z-]+)="([^"]*)"/g)) a[p[1]] = p[2];
    ctx.save();
    ctx.globalAlpha *= a.opacity ? +a.opacity : 1;
    let path: Path2D;
    if (m[1] === 'path') path = new Path2D(a.d);
    else { path = new Path2D(); path.ellipse(+a.cx, +a.cy, +(a.rx || a.r), +(a.ry || a.r), 0, 0, Math.PI * 2); }
    if (a.fill === 'currentColor') { ctx.fillStyle = color; ctx.fill(path); } else ctx.stroke(path);
    ctx.restore();
  }
}

export function paintCanvas(ctx: Ctx, ops: Op[], chart?: (ctx: Ctx, w: number, h: number) => void): void {
  for (const o of ops) {
    ctx.save();
    if ('alpha' in o && o.alpha != null) ctx.globalAlpha = o.alpha;
    if (o.t === 'rect') {
      ctx.beginPath();
      if (o.rx && ctx.roundRect) ctx.roundRect(o.x, o.y, o.w, o.h, o.rx); else ctx.rect(o.x, o.y, o.w, o.h);
      if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
      if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.sw || 1; ctx.stroke(); }
    } else if (o.t === 'glow') {
      const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
      ctx.globalAlpha = 1;
      g.addColorStop(0, o.color + Math.round(o.alpha * 255).toString(16).padStart(2, '0'));
      g.addColorStop(1, o.color + '00');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.fill();
    } else if (o.t === 'line') {
      ctx.strokeStyle = o.stroke; ctx.lineWidth = o.sw; ctx.beginPath(); ctx.moveTo(o.x1, o.y1); ctx.lineTo(o.x2, o.y2); ctx.stroke();
    } else if (o.t === 'circle') {
      ctx.fillStyle = o.fill; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.fill();
    } else if (o.t === 'text') {
      ctx.font = fontCss(o.font); ctx.fillStyle = o.fill; ctx.textAlign = o.align || 'left'; ctx.textBaseline = 'alphabetic';
      spaced(ctx, o.font.ls || 0);
      ctx.fillText(o.text, o.x, o.y);
    } else if (o.t === 'path' || o.t === 'svg48') {
      ctx.translate(o.x, o.y); ctx.scale(o.scale, o.scale);
      ctx.lineWidth = o.sw / o.scale; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (o.t === 'path') { ctx.strokeStyle = o.stroke; ctx.stroke(new Path2D(o.d)); } else { ctx.strokeStyle = o.color; svg48(ctx, o.markup, o.color); }
    } else if (o.t === 'chart' && chart) {
      ctx.translate(o.x, o.y);
      ctx.beginPath(); ctx.rect(0, 0, o.w, o.h); ctx.clip();
      chart(ctx, o.w, o.h);
    }
    ctx.restore();
  }
}
