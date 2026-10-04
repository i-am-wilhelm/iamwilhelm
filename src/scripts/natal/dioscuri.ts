/**
 * THE DIOSCURI FACECARD — two portrait layers in a circular crop, perfectly
 * registered (handoff §7).
 *
 *   Flesh  — the photo. Occludes.
 *   Signal — a runtime glyph-dither of the same photo drawn from the site's
 *            coverage-ranked Greek atlas (src/webgl/glyph-atlas.ts), with
 *            ±1 px R/B chromatic fringing, composited `lighter`. Transmits.
 *
 * Everything heavy happens once per disc size in `prepare()`: the crop, the
 * three channel-split copies (for the RGB tick), the luminance pass, the
 * glyph layer and its fringed composite, the eye mask. Per frame is
 * compositing plus the excitation buffer.
 *
 * The receiving surface: `exc` is a disc-sized canvas that beams stamp
 * colour into (streaks along the spine's direction, rose radials on Venus's
 * arrivals) and that decays ×0.94 each tick. At draw time the glyph layer is
 * masked by it, so the face lights — in the event's colour — only where the
 * sky actually touched it.
 */
import type { GlyphAtlas } from '../../webgl/glyph-atlas';
import type { PortraitConfig, PortraitDrawInput, PortraitLayer } from './types';

export interface DioscuriOpts {
  atlas: GlyphAtlas;
  /** Dither cell in CSS px (8 desktop, 6 mobile). */
  cellPx: number;
  /** Luminance steps across the ramp. */
  steps?: number;
}

const TAU = Math.PI * 2;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function mk(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = Math.max(1, Math.round(size));
  return [c, c.getContext('2d')!];
}

export class Dioscuri implements PortraitLayer {
  ready = false;

  private cfg: PortraitConfig;
  private atlas: GlyphAtlas;
  private cellPx: number;
  private steps: number;
  private img: HTMLImageElement | null = null;
  private D = 0; // device px across the disc
  private dpr = 1;
  private inverse = false;
  private dirty = true;

  private flesh!: HTMLCanvasElement;
  private fleshEyes!: HTMLCanvasElement;
  private chan: HTMLCanvasElement[] = [];
  private mono!: HTMLCanvasElement;
  private monoInv: HTMLCanvasElement | null = null;
  private signal!: HTMLCanvasElement;
  private signalInv: HTMLCanvasElement | null = null;
  private exc!: HTMLCanvasElement;
  private excCtx!: CanvasRenderingContext2D;
  private excGlyph!: HTMLCanvasElement;
  private excGlyphCtx!: CanvasRenderingContext2D;
  private lum: Float32Array = new Float32Array(0);
  private cols = 0;
  private rows = 0;
  private rampUsed: number[] = [];

  constructor(cfg: PortraitConfig, opts: DioscuriOpts) {
    this.cfg = cfg;
    this.atlas = opts.atlas;
    this.cellPx = opts.cellPx;
    this.steps = opts.steps ?? 12;
    // The ~12-step ramp: evenly spaced indices across the coverage-ranked
    // atlas ramp, dark → '·' … bright → 'Ψ Φ'.
    const n = this.atlas.rampCount;
    for (let i = 0; i < this.steps; i++) this.rampUsed.push(Math.round((i / (this.steps - 1)) * (n - 1)));
  }

  load(): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        const done = () => {
          this.img = img;
          this.ready = true;
          this.dirty = true;
          resolve();
        };
        if ('decode' in img) img.decode().then(done, done);
        else done();
      };
      img.onerror = () => resolve(); // graceful absence: no portrait, disc stays open
      img.src = this.cfg.src;
    });
  }

  setInverse(on: boolean) {
    this.inverse = on;
  }

  /** Eye masks are owner-tunable from the tinker overlay. */
  setEyes(eyes: PortraitConfig['eyes']) {
    this.cfg = { ...this.cfg, eyes };
    this.dirty = true;
  }

  getConfig(): PortraitConfig {
    return this.cfg;
  }

  prepare(rCss: number, dpr: number) {
    if (!this.img) return;
    const D = Math.round(2 * rCss * dpr);
    if (!this.dirty && D === this.D && dpr === this.dpr) return;
    if (D < 8) return;
    this.D = D;
    this.dpr = dpr;
    this.dirty = false;
    this.rebuild();
  }

  /* ---------------------------------------------------------------- */
  /* Build                                                             */
  /* ---------------------------------------------------------------- */

  private rebuild() {
    const img = this.img!;
    const D = this.D;
    const { crop } = this.cfg;
    const sw = img.naturalWidth;
    const sh = img.naturalHeight;
    const side = crop.half * 2;
    const sx = (crop.cx - crop.half) * sw;
    const sy = (crop.cy - crop.half) * sh;

    // Flesh: circular crop.
    const [flesh, fctx] = mk(D);
    fctx.beginPath();
    fctx.arc(D / 2, D / 2, D / 2, 0, TAU);
    fctx.clip();
    fctx.drawImage(img, sx, sy, side * sw, side * sh, 0, 0, D, D);
    this.flesh = flesh;

    // Channel splits for the RGB tick: R+G+B (lighter) reconstructs the photo.
    this.chan = ['#ff0000', '#00ff00', '#0000ff'].map((c) => {
      const [cv, cc] = mk(D);
      cc.drawImage(flesh, 0, 0);
      cc.globalCompositeOperation = 'multiply';
      cc.fillStyle = c;
      cc.fillRect(0, 0, D, D);
      cc.globalCompositeOperation = 'destination-in';
      cc.drawImage(flesh, 0, 0);
      return cv;
    });

    // Eyes: flesh × feathered ellipse masks.
    const [eyes, ectx] = mk(D);
    for (const e of this.cfg.eyes) {
      ectx.save();
      ectx.translate(e.x * D, e.y * D);
      ectx.scale(e.rx * D, e.ry * D);
      const g = ectx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.6, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ectx.fillStyle = g;
      ectx.beginPath();
      ectx.arc(0, 0, 1, 0, TAU);
      ectx.fill();
      ectx.restore();
    }
    ectx.globalCompositeOperation = 'source-in';
    ectx.drawImage(flesh, 0, 0);
    this.fleshEyes = eyes;

    // Luminance per cell.
    const cell = Math.max(3, Math.round(this.cellPx * this.dpr));
    const cols = Math.ceil(D / cell);
    const rows = cols;
    this.cols = cols;
    this.rows = rows;
    const [, tctx] = mk(cols);
    tctx.drawImage(flesh, 0, 0, cols, rows);
    const data = tctx.getImageData(0, 0, cols, rows).data;
    const lum = new Float32Array(cols * rows);
    for (let i = 0; i < cols * rows; i++) {
      const a = data[i * 4 + 3] / 255;
      lum[i] = a * (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255;
    }
    this.lum = lum;

    this.mono = this.buildMono(false);
    this.monoInv = null;
    this.signal = this.buildSignal(this.mono);
    this.signalInv = null;

    // Excitation buffers.
    const [exc, excCtx] = mk(D);
    this.exc = exc;
    this.excCtx = excCtx;
    const [eg, egCtx] = mk(D);
    this.excGlyph = eg;
    this.excGlyphCtx = egCtx;
  }

  private buildMono(invert: boolean): HTMLCanvasElement {
    const D = this.D;
    const { cols, rows, lum, atlas } = this;
    const cell = D / cols;
    const [mono, mctx] = mk(D);
    mctx.beginPath();
    mctx.arc(D / 2, D / 2, D / 2, 0, TAU);
    mctx.clip();
    const steps = this.steps;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        let l = lum[j * cols + i];
        if (invert) l = 1 - l;
        // Gentle gamma so mid-tones read; skip true black.
        l = Math.pow(clamp01(l), 0.85);
        if (l < 0.04) continue;
        const step = Math.min(steps - 1, Math.floor(l * steps));
        const idx = this.rampUsed[step];
        const ax = (idx % atlas.cols) * atlas.cell;
        const ay = Math.floor(idx / atlas.cols) * atlas.cell;
        mctx.globalAlpha = 0.5 + 0.5 * l;
        mctx.drawImage(atlas.canvas, ax, ay, atlas.cell, atlas.cell, i * cell, j * cell, cell, cell);
      }
    }
    mctx.globalAlpha = 1;
    return mono;
  }

  private buildSignal(mono: HTMLCanvasElement): HTMLCanvasElement {
    const D = this.D;
    const off = Math.max(1, Math.round(this.dpr));
    const tint = (c: string, dx: number) => {
      const [cv, cc] = mk(D);
      cc.drawImage(mono, dx, 0);
      cc.globalCompositeOperation = 'source-in';
      cc.fillStyle = c;
      cc.fillRect(0, 0, D, D);
      return cv;
    };
    const [sig, sctx] = mk(D);
    sctx.globalCompositeOperation = 'lighter';
    sctx.drawImage(tint('#ff0000', -off), 0, 0);
    sctx.drawImage(tint('#00ff00', 0), 0, 0);
    sctx.drawImage(tint('#0000ff', off), 0, 0);
    return sig;
  }

  /* ---------------------------------------------------------------- */
  /* Excitation                                                        */
  /* ---------------------------------------------------------------- */

  stampStreak(nx: number, ny: number, dx: number, dy: number, color: string, strength: number) {
    if (!this.excCtx) return;
    const D = this.D;
    const ctx = this.excCtx;
    const L = Math.hypot(dx, dy) || 1;
    const ux = dx / L;
    const uy = dy / L;
    const x = nx * D;
    const y = ny * D;
    const half = 0.7 * D;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const [w, a] of [
      [0.2, 0.08],
      [0.1, 0.14],
      [0.035, 0.3],
    ] as const) {
      ctx.strokeStyle = color;
      ctx.globalAlpha = a * strength;
      ctx.lineWidth = w * D;
      ctx.beginPath();
      ctx.moveTo(x - ux * half, y - uy * half);
      ctx.lineTo(x + ux * half, y + uy * half);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  stampRadial(nx: number, ny: number, color: string, strength: number) {
    if (!this.excCtx) return;
    const D = this.D;
    const ctx = this.excCtx;
    const x = nx * D;
    const y = ny * D;
    const rad = 0.42 * D;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5 * strength;
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    ctx.globalAlpha = 1;
  }

  tick(_dt: number) {
    if (!this.excCtx) return;
    // ×0.94 decay: knock 6% of the buffer out each frame.
    this.excCtx.globalCompositeOperation = 'destination-out';
    this.excCtx.fillStyle = 'rgba(0,0,0,0.06)';
    this.excCtx.fillRect(0, 0, this.D, this.D);
    this.excCtx.globalCompositeOperation = 'source-over';
  }

  /* ---------------------------------------------------------------- */
  /* Draw                                                              */
  /* ---------------------------------------------------------------- */

  draw(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, s: PortraitDrawInput) {
    if (!this.ready || !this.flesh || this.D === 0) return;

    // The tide: a 90 s seesaw of the rest values. Phase starts with the
    // flesh in command.
    const tide = s.still ? 0 : (1 - Math.cos((TAU * s.timeS) / s.tidePeriod)) / 2;
    const fleshRest = lerp(1.0, 0.35, tide);
    const signalRest = lerp(s.signalRest, 0.75, tide);
    // The breath: knock → signal surges, flesh dips, both decaying over the bar.
    const breath = s.still ? 0 : s.knockGlow;
    let flesh = Math.min(fleshRest, lerp(fleshRest, 0.55, breath));
    let signal = Math.max(signalRest, lerp(signalRest, s.signalSurge, breath));
    // Scroll: the twin takes the face by p = 0.7; keep a faint knock-breath.
    const share = s.share;
    flesh *= 1 - share;
    signal = Math.max(signal, share * (0.85 + 0.15 * breath));
    // The RGB tick: channels separate ±2 px on the knock, snap back in ~180 ms.
    const tick = !s.still && s.sinceKnockMs < 180 ? 2 * (1 - s.sinceKnockMs / 180) : 0;

    const d = r * 2;
    const x0 = cx - r;
    const y0 = cy - r;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.clip();

    if (flesh > 0.003) {
      if (tick > 0.05) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = flesh;
        ctx.drawImage(this.chan[0], x0 - tick, y0, d, d);
        ctx.drawImage(this.chan[1], x0, y0, d, d);
        ctx.drawImage(this.chan[2], x0 + tick, y0, d, d);
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = flesh;
        ctx.drawImage(this.flesh, x0, y0, d, d);
      }
    }

    // Eyes hold out longest: floor at 0.9 regardless of breath or tide (the
    // scroll share still releases them — the twin takes the whole face).
    const floor = 0.9 * (1 - share);
    if (flesh < floor && flesh < 0.999) {
      const b = (floor - flesh) / (1 - flesh);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = clamp01(b);
      ctx.drawImage(this.fleshEyes, x0, y0, d, d);
    }

    // Signal.
    const sig = this.inverse ? (this.signalInv ??= this.buildSignal((this.monoInv ??= this.buildMono(true)))) : this.signal;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = clamp01(signal);
    ctx.drawImage(sig, x0, y0, d, d);

    // Receiving surface: glyphs lit in the event colour where the sky touched.
    if (!s.still && this.excGlyph) {
      const g = this.excGlyphCtx;
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, this.D, this.D);
      g.drawImage(this.exc, 0, 0);
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(this.inverse && this.monoInv ? this.monoInv : this.mono, 0, 0);
      ctx.globalAlpha = 1;
      ctx.drawImage(this.excGlyph, x0, y0, d, d);
    }

    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  }

  drawAudit(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const { atlas } = this;
    const size = 28;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - 6, y - 6, this.rampUsed.length * (size + 4) + 12, size + 26);
    ctx.font = '9px ui-monospace, monospace';
    ctx.fillStyle = '#9a958c';
    ctx.textAlign = 'left';
    ctx.fillText(`glyph ramp · ${this.rampUsed.length} steps · cell ${this.cellPx}px${this.inverse ? ' · inverse' : ''}`, x, y + size + 12);
    this.rampUsed.forEach((idx, i) => {
      const ax = (idx % atlas.cols) * atlas.cell;
      const ay = Math.floor(idx / atlas.cols) * atlas.cell;
      ctx.drawImage(atlas.canvas, ax, ay, atlas.cell, atlas.cell, x + i * (size + 4), y, size, size);
    });
    ctx.restore();
  }
}
