/**
 * The glyph dither filter — the site's signature.
 *
 * Renders a source image (or a seeded procedural abstract) as a field of
 * characters with RGB chromatic fringing; the image resolves *out of*
 * glyphs. Canvas 2D. Our own implementation of a familiar family of
 * technique — no borrowed code, no borrowed styling.
 *
 * Modes:
 *   static   — the resolved image with a gentle shimmer
 *   resolve  — noise → image, driven by progress (scroll / hover)
 *   dissolve — image → noise (progress inverted)
 *   rain     — glyphs fall vertically in columns with brightness trails
 *              over a faint bed of the source image (Phase 3 — the
 *              monsoon; density/speed driven through setWeather)
 *
 * Performance: glyphs are drawn once per step to a mono layer, then that
 * layer is composited three times (R/G/B tint + horizontal offset) onto
 * the visible canvas. Steps tick at ~12fps inside requestAnimationFrame;
 * the loop only paints when something changed. Callers are responsible
 * for pausing offscreen instances (see DitherCanvas.astro).
 */

import { getPalette, type GlyphPalette } from '../palettes';

export type DitherMode = 'static' | 'resolve' | 'dissolve' | 'rain';

export interface DitherOptions {
  palette?: string;
  mode?: DitherMode;
  /** CSS px per glyph cell. */
  cell?: number;
  /** Base glyph color; channels are split from this for the fringe. */
  accent?: string;
  /** Chromatic aberration offset in px. */
  fringe?: number;
  seed?: number;
  /** 0..1 — how lively the shimmer is. */
  shimmer?: number;
  /** Render a single still frame and never animate. */
  reducedMotion?: boolean;
}

/**
 * Phase-3 weather hooks — the monsoon (src/lib/monsoon.ts) drives the
 * memoir field through this shape. Every field is optional; unset
 * fields keep their current value, and the defaults leave all
 * pre-existing modes exactly as they were.
 */
export interface DitherWeather {
  mode?: DitherMode;
  /** 0..1 — fraction of columns raining (rain mode). */
  rainDensity?: number;
  /** Multiplier on per-column fall speed (cells per step). */
  rainSpeed?: number;
  /** 0..1 — heat-shimmer horizontal row displacement (non-rain modes). */
  wobble?: number;
  /** >= 1 — only ~1/sparsity of cells draw (drought spacing). */
  sparsity?: number;
  /** Alpha gain on the field; 1 = normal, >1 saturates toward dense. */
  coverage?: number;
  /** Accent as [r,g,b] so callers can lerp without reparsing CSS. */
  accentRgb?: [number, number, number];
}

const STEP_MS = 1000 / 12; // shimmer tick rate
const DPR_CAP = 1.5;

/**
 * Minimum ms between `dither:rare` dispatches per instance — one 7/8 bar
 * (keep in sync with BAR in ../timing.ts). The event bubbles from the
 * canvas so page-level systems (the egg framework) can observe rare
 * glyphs without reaching into the engine.
 */
const RARE_EVENT_MS = 980;

/* ---------------------------------------------------------------- */
/* Deterministic noise                                              */
/* ---------------------------------------------------------------- */

function hash(n: number): number {
  let x = n | 0;
  x = (x ^ 61) ^ (x >>> 16);
  x = Math.imul(x, 9);
  x = x ^ (x >>> 4);
  x = Math.imul(x, 0x27d4eb2d);
  x = x ^ (x >>> 15);
  return (x >>> 0) / 4294967295;
}

function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------------------------------------------------------- */
/* Procedural placeholder sources                                    */
/* ---------------------------------------------------------------- */

export type PlaceholderVariant = 'form' | 'stars';

/**
 * Draws a grayscale dither-abstract to stand in until real art arrives:
 * 'form' suggests a single luminous shape out of darkness; 'stars' is a
 * sparse bright-point field for the constellation sky.
 */
export function drawPlaceholder(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  seed: number,
  variant: PlaceholderVariant = 'form'
): void {
  const rnd = mulberry32(seed);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);

  if (variant === 'stars') {
    const count = 90 + Math.floor(rnd() * 40);
    for (let i = 0; i < count; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      const r = 0.5 + rnd() * (rnd() < 0.08 ? 6 : 2);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
      g.addColorStop(0, `rgba(255,255,255,${0.5 + rnd() * 0.5})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
    }
    return;
  }

  // 'form': one dominant luminous mass plus faint satellites
  const cx = w * (0.35 + rnd() * 0.3);
  const cy = h * (0.35 + rnd() * 0.3);
  const blobs = 7;
  for (let i = 0; i < blobs; i++) {
    const major = i === 0;
    const x = major ? cx : cx + (rnd() - 0.5) * w * 0.7;
    const y = major ? cy : cy + (rnd() - 0.5) * h * 0.7;
    const r = (major ? 0.42 : 0.06 + rnd() * 0.16) * Math.min(w, h);
    const peak = major ? 0.95 : 0.15 + rnd() * 0.35;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${peak})`);
    g.addColorStop(0.55, `rgba(255,255,255,${peak * 0.25})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // a dark cut through the form keeps it from reading as a plain glow
  ctx.globalCompositeOperation = 'destination-out';
  const cutW = w * (0.05 + rnd() * 0.08);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rnd() * Math.PI);
  const cut = ctx.createLinearGradient(-cutW, 0, cutW, 0);
  cut.addColorStop(0, 'rgba(0,0,0,0)');
  cut.addColorStop(0.5, 'rgba(0,0,0,0.85)');
  cut.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = cut;
  ctx.fillRect(-cutW, -h, cutW * 2, h * 2);
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
}

/* ---------------------------------------------------------------- */
/* Engine                                                            */
/* ---------------------------------------------------------------- */

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseColor(color: string): Rgb {
  const probe = document.createElement('canvas');
  probe.width = probe.height = 1;
  const ctx = probe.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return { r: r!, g: g!, b: b! };
}

export class GlyphDither {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private glyphLayer: HTMLCanvasElement;
  private glyphCtx: CanvasRenderingContext2D;
  private tintLayer: HTMLCanvasElement;
  private tintCtx: CanvasRenderingContext2D;
  private source: HTMLCanvasElement;

  private palette: GlyphPalette;
  private mode: DitherMode;
  private cell: number;
  private fringe: number;
  private seed: number;
  private shimmer: number;
  private reducedMotion: boolean;
  private accent: Rgb;

  private cols = 0;
  private rows = 0;
  private luma: Float32Array = new Float32Array(0);
  private dpr = 1;

  private progress: number;
  private dirty = true;
  private running = false;
  private rafId = 0;
  private lastStep = 0;
  private tick = 0;
  private lastRareAt = 0;

  /* Phase-3 weather state — defaults keep pre-monsoon behavior intact */
  private wobble = 0;
  private sparsity = 1;
  private coverage = 1;
  private rainDensity = 0.35;
  private rainSpeed = 1;
  private flashArmed = false;

  /* Rain column state — preallocated typed arrays, sized on resize */
  private rainHead = new Float32Array(0);
  private rainVel = new Float32Array(0);
  private rainLen = new Float32Array(0);
  private rainSpawn = new Uint32Array(0);
  private rainTick = 0;

  constructor(canvas: HTMLCanvasElement, opts: DitherOptions = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.glyphLayer = document.createElement('canvas');
    this.glyphCtx = this.glyphLayer.getContext('2d')!;
    this.tintLayer = document.createElement('canvas');
    this.tintCtx = this.tintLayer.getContext('2d')!;
    this.source = document.createElement('canvas');

    this.palette = getPalette(opts.palette);
    this.mode = opts.mode ?? 'static';
    this.cell = opts.cell ?? 12;
    this.fringe = opts.fringe ?? 1.5;
    this.seed = opts.seed ?? 1;
    this.shimmer = opts.shimmer ?? 0.5;
    this.reducedMotion = opts.reducedMotion ?? false;
    this.accent = parseColor(opts.accent || '#e8e6e1');

    // static begins resolved; resolve begins as noise; dissolve as image
    this.progress = this.mode === 'resolve' ? 0 : 1;
  }

  /** Load an image URL as the source, or draw a seeded placeholder. */
  async load(src?: string | null, variant: PlaceholderVariant = 'form'): Promise<void> {
    const sctx = this.source.getContext('2d')!;
    if (src) {
      const img = new Image();
      img.decoding = 'async';
      try {
        // wait on the load event, not decode(): decode() can defer
        // indefinitely in hidden/background tabs, while drawImage on a
        // loaded image forces synchronous decode reliably
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(`image failed: ${src}`));
          img.src = src;
        });
        // cover-fit into a modest sampling buffer
        const sw = 480;
        const sh = Math.round((sw * 9) / 16);
        this.source.width = sw;
        this.source.height = sh;
        const scale = Math.max(sw / img.naturalWidth, sh / img.naturalHeight);
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        sctx.fillStyle = '#000';
        sctx.fillRect(0, 0, sw, sh);
        sctx.drawImage(img, (sw - dw) / 2, (sh - dh) / 2, dw, dh);
      } catch {
        this.source.width = 480;
        this.source.height = 270;
        drawPlaceholder(sctx, 480, 270, this.seed, variant);
      }
    } else {
      this.source.width = 480;
      this.source.height = 270;
      drawPlaceholder(sctx, 480, 270, this.seed, variant);
    }
    this.resize();
  }

  /** Re-measure the canvas box and resample the source into the luma grid. */
  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);

    this.cols = Math.max(4, Math.floor(rect.width / this.cell));
    this.rows = Math.max(4, Math.floor(rect.height / this.cell));

    const pw = Math.round(rect.width * this.dpr);
    const ph = Math.round(rect.height * this.dpr);
    for (const c of [this.canvas, this.glyphLayer, this.tintLayer]) {
      c.width = pw;
      c.height = ph;
    }

    // sample: cover-fit the source into a cols×rows grid, read luminance
    const sample = document.createElement('canvas');
    sample.width = this.cols;
    sample.height = this.rows;
    const sctx = sample.getContext('2d', { willReadFrequently: true })!;
    const scale = Math.max(this.cols / this.source.width, this.rows / this.source.height);
    const dw = this.source.width * scale;
    const dh = this.source.height * scale;
    sctx.drawImage(this.source, (this.cols - dw) / 2, (this.rows - dh) / 2, dw, dh);
    const data = sctx.getImageData(0, 0, this.cols, this.rows).data;
    this.luma = new Float32Array(this.cols * this.rows);
    for (let i = 0; i < this.luma.length; i++) {
      const o = i * 4;
      this.luma[i] =
        (0.2126 * data[o]! + 0.7152 * data[o + 1]! + 0.0722 * data[o + 2]!) / 255;
    }
    // rain column state follows the grid; scattered so rain never
    // starts as an empty sky after a resize mid-storm
    if (this.rainHead.length !== this.cols) {
      this.rainHead = new Float32Array(this.cols);
      this.rainVel = new Float32Array(this.cols);
      this.rainLen = new Float32Array(this.cols);
      this.rainSpawn = new Uint32Array(this.cols);
      for (let x = 0; x < this.cols; x++) this.spawnColumn(x, true);
    }
    this.dirty = true;
    if (!this.running) this.paint();
  }

  setProgress(p: number): void {
    const clamped = Math.max(0, Math.min(1, p));
    const effective = this.mode === 'dissolve' ? 1 - clamped : clamped;
    if (Math.abs(effective - this.progress) > 0.002) {
      this.progress = effective;
      this.dirty = true;
    }
  }

  start(): void {
    if (this.reducedMotion) {
      // one still, fully resolved frame — no loop, no shimmer
      this.progress = this.mode === 'dissolve' ? 0 : 1;
      this.paint();
      return;
    }
    if (this.running) return;
    this.running = true;
    const loop = (t: number) => {
      if (!this.running) return;
      if (t - this.lastStep >= STEP_MS) {
        this.lastStep = t;
        this.tick++;
        if (this.shimmer > 0 || this.mode === 'rain' || this.wobble > 0) {
          this.dirty = true;
        }
      }
      if (this.dirty) this.paint();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  destroy(): void {
    this.stop();
    this.luma = new Float32Array(0);
  }

  /**
   * Additive Phase-2 hook: re-skin the running engine in place.
   * Only the provided fields change; mode and resolve progress are
   * untouched. Passing `src` reloads the source image asynchronously
   * (load() ends in resize(), which resamples and repaints); the sync
   * fields repaint immediately when the loop is idle.
   */
  swap(opts: { palette?: string; accent?: string; seed?: number; src?: string } = {}): void {
    if (opts.palette !== undefined) this.palette = getPalette(opts.palette);
    if (opts.accent !== undefined) this.accent = parseColor(opts.accent);
    if (opts.seed !== undefined) this.seed = opts.seed;
    if (opts.src !== undefined) {
      void this.load(opts.src);
      return;
    }
    this.dirty = true;
    if (!this.running) this.paint();
  }

  /**
   * Additive Phase-3 hook: the monsoon drives the field through this.
   * Only provided fields change; a repaint follows immediately when the
   * loop is idle (reduced-motion stills update through here on scroll).
   */
  setWeather(w: DitherWeather): void {
    if (w.mode !== undefined) this.mode = w.mode;
    if (w.rainDensity !== undefined) this.rainDensity = Math.max(0, Math.min(1, w.rainDensity));
    if (w.rainSpeed !== undefined) this.rainSpeed = Math.max(0, w.rainSpeed);
    if (w.wobble !== undefined) this.wobble = Math.max(0, Math.min(1, w.wobble));
    if (w.sparsity !== undefined) this.sparsity = Math.max(1, w.sparsity);
    if (w.coverage !== undefined) this.coverage = Math.max(0, w.coverage);
    if (w.accentRgb !== undefined) {
      this.accent = { r: w.accentRgb[0], g: w.accentRgb[1], b: w.accentRgb[2] };
    }
    this.dirty = true;
    if (!this.running) this.paint();
  }

  /**
   * Phase-3 lightning: arm a single-paint chromatic strike. The very
   * next paint renders the blown-out inverted field; the frame after
   * restores the normal field, so the flash never exceeds one frame
   * (≤ one ~83ms step — photosensitivity cadence is the caller's job,
   * see monsoon.ts). No-op under reduced motion.
   */
  flash(): void {
    if (this.reducedMotion) return;
    this.flashArmed = true;
    this.dirty = true;
    if (!this.running) {
      this.paint();
      // idle engines still restore on the next frame the browser grants
      requestAnimationFrame(() => {
        if (!this.running && this.dirty) this.paint();
      });
    }
  }

  /**
   * Advance one step and paint synchronously. For callers that own
   * their own cadence (verification harnesses, forced stills).
   */
  step(): void {
    this.tick++;
    this.dirty = true;
    this.paint();
  }

  /* -------------------------------------------------------------- */

  /**
   * (Re)seed one rain column. Deterministic per (seed, column, spawn
   * count): the same visitor path replays the same storm. `scatter`
   * places the head mid-field (first fill); otherwise above the top.
   */
  private spawnColumn(x: number, scatter: boolean): void {
    const n = this.rainSpawn[x]!;
    const h = (k: number) => hash(this.seed * 7919 + x * 977 + n * 131 + k);
    this.rainVel[x] = 0.45 + h(1) * 1.35; // cells per step
    this.rainLen[x] = 3 + Math.floor(h(2) * 11); // trail cells
    this.rainHead[x] = scatter ? h(3) * this.rows : -h(3) * this.rows * 0.7;
    this.rainSpawn[x] = n + 1;
  }

  private paint(): void {
    this.dirty = false;
    const { cols, rows, palette } = this;
    if (cols === 0 || this.luma.length === 0) return;

    const g = this.glyphCtx;
    const cellPx = this.cell * this.dpr;
    g.clearRect(0, 0, this.glyphLayer.width, this.glyphLayer.height);
    g.font = `${cellPx}px ui-monospace, Consolas, monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#fff';

    const ramp = palette.ramp;
    const last = ramp.length - 1;
    const t = this.tick;
    const p = this.progress;
    const shimmerP = 0.03 * this.shimmer;
    const skipP = this.sparsity > 1 ? 1 / this.sparsity : 1;
    let rareHit: { glyph: string; col: number; row: number } | null = null;

    if (this.mode === 'rain') {
      this.paintRainLayer(g, cellPx);
    } else {
      for (let y = 0; y < rows; y++) {
        // heat shimmer: subtle per-row sine displacement (the drought).
        // Under reduced motion t never advances, so this is a still.
        const rowDx =
          this.wobble > 0
            ? Math.sin(t * 0.45 + y * 0.85) * this.wobble * cellPx * 0.35
            : 0;
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          const cellSeed = this.seed * 7919 + i * 131;
          // drought spacing: a hashed fraction of cells sit out entirely
          if (skipP < 1 && hash(cellSeed ^ 0x5eedc0de) > skipP) continue;
          const threshold = hash(cellSeed); // per-cell resolve order
          const resolved = p >= threshold;

          let glyph: string;
          let alpha: number;

          if (resolved) {
            const l = this.luma[i]!;
            let idx = Math.round(l * last);
            // gentle shimmer: a few cells breathe ±1 ramp step per tick
            if (hash(cellSeed ^ (t * 2654435761)) < shimmerP) {
              idx = Math.max(0, Math.min(last, idx + (hash(cellSeed + t) < 0.5 ? -1 : 1)));
            }
            glyph = ramp[idx]!;
            alpha = 0.25 + l * 0.75;
            // rare glyphs surface out of the bright field (♅ ♆, dead letters)
            if (
              palette.rareChance > 0 &&
              l > 0.35 &&
              hash(cellSeed ^ 0x9e3779b9 ^ Math.floor(t / 8)) < palette.rareChance * 40
            ) {
              glyph = palette.rare[Math.floor(hash(cellSeed + 17) * palette.rare.length)]!;
              if (!rareHit) rareHit = { glyph, col: x, row: y };
            }
          } else {
            // unresolved: dim noise, churning slowly
            const n = hash(cellSeed ^ ((t >> 2) * 40503));
            glyph = ramp[Math.floor(n * ramp.length)]!;
            alpha = 0.05 + n * 0.12;
          }

          if (glyph === ' ') continue;
          g.globalAlpha = Math.min(1, alpha * this.coverage);
          g.fillText(glyph, (x + 0.5) * cellPx + rowDx, (y + 0.5) * cellPx);
        }
      }
    }
    g.globalAlpha = 1;

    // Phase-2 hook: announce a surfaced rare glyph, throttled to one bar
    if (rareHit && performance.now() - this.lastRareAt >= RARE_EVENT_MS) {
      this.lastRareAt = performance.now();
      this.canvas.dispatchEvent(
        new CustomEvent('dither:rare', { detail: rareHit, bubbles: true })
      );
    }

    // chromatic fringe: composite the mono layer per channel with offsets
    const out = this.ctx;

    // lightning: exactly one paint — the field blows out near-white and
    // the channels tear apart; 'difference' inverts the glyphs into it.
    // dirty stays set so the very next frame restores the normal field.
    if (this.flashArmed) {
      this.flashArmed = false;
      out.globalCompositeOperation = 'source-over';
      out.fillStyle = 'rgb(238,241,245)';
      out.fillRect(0, 0, this.canvas.width, this.canvas.height);
      const F = Math.max(6, this.fringe * 6) * this.dpr;
      const strike: Array<[string, number]> = [
        ['rgb(255,40,40)', -F],
        ['rgb(40,255,40)', F * 0.4],
        ['rgb(40,40,255)', F],
      ];
      out.globalCompositeOperation = 'difference';
      for (const [css, dx] of strike) {
        const tc = this.tintCtx;
        tc.globalCompositeOperation = 'source-over';
        tc.clearRect(0, 0, this.tintLayer.width, this.tintLayer.height);
        tc.drawImage(this.glyphLayer, 0, 0);
        tc.globalCompositeOperation = 'source-in';
        tc.fillStyle = css;
        tc.fillRect(0, 0, this.tintLayer.width, this.tintLayer.height);
        out.drawImage(this.tintLayer, dx, 0);
      }
      out.globalCompositeOperation = 'source-over';
      this.dirty = true;
      return;
    }

    out.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const f = this.fringe * this.dpr;
    const channels: Array<[Rgb, number]> = [
      [{ r: this.accent.r, g: 0, b: 0 }, -f],
      [{ r: 0, g: this.accent.g, b: 0 }, 0],
      [{ r: 0, g: 0, b: this.accent.b }, f],
    ];
    out.globalCompositeOperation = 'lighter';
    for (const [rgb, dx] of channels) {
      const tc = this.tintCtx;
      tc.globalCompositeOperation = 'source-over';
      tc.clearRect(0, 0, this.tintLayer.width, this.tintLayer.height);
      tc.drawImage(this.glyphLayer, 0, 0);
      tc.globalCompositeOperation = 'source-in';
      tc.fillStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
      tc.fillRect(0, 0, this.tintLayer.width, this.tintLayer.height);
      out.drawImage(this.tintLayer, dx, 0);
    }
    out.globalCompositeOperation = 'source-over';
  }

  /**
   * Rain mode's glyph layer: a faint bed of the source image with
   * falling columns over it. Column state advances once per step tick
   * (never under reduced motion — heads freeze where seeded, so the
   * still reads as streaks, not motion). No allocation in here.
   */
  private paintRainLayer(g: CanvasRenderingContext2D, cellPx: number): void {
    const { cols, rows } = this;
    const ramp = this.palette.ramp;
    const last = ramp.length - 1;

    // advance heads by the steps elapsed since the last rain paint
    // (clamped so a long pause doesn't teleport the storm)
    if (!this.reducedMotion && this.tick !== this.rainTick) {
      const dt = Math.max(1, Math.min(4, this.tick - this.rainTick));
      this.rainTick = this.tick;
      for (let x = 0; x < cols; x++) {
        this.rainHead[x] = this.rainHead[x]! + this.rainVel[x]! * this.rainSpeed * dt;
        if (this.rainHead[x]! - this.rainLen[x]! > rows) this.spawnColumn(x, false);
      }
    }

    // the bed: the image faintly present under the storm; coverage
    // saturates it toward dense in the release
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const l = this.luma[i]!;
        const a = Math.min(0.85, (0.05 + l * 0.25) * this.coverage);
        if (a < 0.03) continue;
        const n = hash(this.seed * 7919 + i * 131);
        const idx = Math.max(0, Math.min(last, Math.round(l * last + (n - 0.5) * 2)));
        const glyph = ramp[idx]!;
        if (glyph === ' ') continue;
        g.globalAlpha = a;
        g.fillText(glyph, (x + 0.5) * cellPx, (y + 0.5) * cellPx);
      }
    }

    // the columns: density gates which columns rain (hash < density, so
    // ramping density wakes more of them deterministically); the head
    // burns brightest and the trail decays behind it, glyphs mutating
    // slowly as the column passes
    for (let x = 0; x < cols; x++) {
      if (hash(this.seed * 31 + x * 2417) >= this.rainDensity) continue;
      const head = Math.floor(this.rainHead[x]!);
      const len = this.rainLen[x]!;
      for (let k = 0; k <= len; k++) {
        const y = head - k;
        if (y < 0 || y >= rows) continue;
        const fade = 1 - k / (len + 1);
        const n = hash(x * 8191 + y * 131 + (this.tick >> 1) * 40503);
        const idx =
          k === 0
            ? last - Math.floor(n * 2)
            : Math.max(2, Math.floor(fade * last * (0.5 + n * 0.5)));
        const glyph = ramp[idx]!;
        if (glyph === ' ') continue;
        g.globalAlpha = k === 0 ? 0.95 : Math.min(1, (0.1 + fade * 0.7) * this.coverage);
        g.fillText(glyph, (x + 0.5) * cellPx, (y + 0.5) * cellPx);
      }
    }
  }
}
