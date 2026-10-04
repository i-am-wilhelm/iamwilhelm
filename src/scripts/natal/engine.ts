/**
 * THE NATAL ENGINE — framework-agnostic Canvas 2D renderer for a natal chart.
 *
 * `new NatalEngine(canvas, chart, opts)`; the host owns the rAF and calls
 * `tick(dt, clock)` each frame (or `renderStatic()` once under reduced
 * motion). The engine knows nothing about whose chart it draws, nothing
 * about scroll, DOM or events — it exposes numbers and callbacks.
 *
 * Geometry (handoff §4): MC fixed at the zenith, zodiac counterclockwise:
 *   theta = (−90 − (lon − mc)) · π/180
 * Planet ring R = min(vw, vh) · 0.40 (0.42 under 640 px). Portrait disc
 * 0.165R. Bodies within 5° of a neighbour stagger to 0.965R / 1.035R.
 *
 * Zero runtime deps. Palette comes in through opts (tokens.natalPalette by
 * default) so the engine stays portable.
 */
import { natalPalette } from '../../design/tokens';
import { computeAspects, connectedBodies, type Aspect } from './aspects';
import type { ChartData, PortraitLayer } from './types';
import type { ClockState } from '../clock';

export type { ChartData, ChartBody, PortraitConfig, EyeMask, PortraitLayer } from './types';
export type { Aspect, AspectKind } from './aspects';

/* ------------------------------------------------------------------ */
/* Options                                                             */
/* ------------------------------------------------------------------ */

export type LayerName =
  | 'chrome'
  | 'window'
  | 'spine'
  | 'circuit'
  | 'venus'
  | 'squares'
  | 'sextiles'
  | 'lens'
  | 'vertex'
  | 'portrait'
  | 'knock'
  | 'glyphAudit';

export const LAYER_NAMES: LayerName[] = [
  'chrome', 'window', 'spine', 'circuit', 'venus', 'squares', 'sextiles',
  'lens', 'vertex', 'portrait', 'knock', 'glyphAudit',
];

export interface EngineOpts {
  brilliance: number;      // 0.5–1.7
  density: number;         // 0.2–1.6
  flowSpeed: number;       // 0.4–2
  venusBpm: number;        // 40–84
  signalRest: number;      // portrait signal rest alpha
  signalSurge: number;     // portrait signal knock alpha
  tidePeriod: number;      // seconds
  /** Lilith's radius as a fraction of R. See note at `layout()`. */
  lilithRadius: number;
  layers: Record<LayerName, boolean>;
  palette: Record<string, string>;
  venusFringe: readonly [string, string, string];
  /** Called on every lub of Venus's heart. */
  onVenusBeat?: (env: number) => void;
}

export const DEFAULT_OPTS: EngineOpts = {
  brilliance: 1,
  density: 1,
  flowSpeed: 1,
  venusBpm: 52,
  signalRest: 0.15,
  signalSurge: 0.6,
  tidePeriod: 90,
  lilithRadius: 0.28,
  layers: Object.fromEntries(LAYER_NAMES.map((n) => [n, n !== 'glyphAudit'])) as Record<LayerName, boolean>,
  palette: natalPalette as unknown as Record<string, string>,
  venusFringe: natalPalette.venusFringe,
};

/* ------------------------------------------------------------------ */
/* Math helpers                                                        */
/* ------------------------------------------------------------------ */

const TAU = Math.PI * 2;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
const easeInOut = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

/** Log-normalized daily motion: Pluto (0.0045°/d) → 0, the Moon (13.64) → 1. */
export function lognorm(spd: number, lo = 0.0045, hi = 13.64): number {
  const v = Math.max(spd, lo);
  return clamp01((Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo)));
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const rgbaCache = new Map<string, [number, number, number]>();
function rgba(hex: string, a: number): string {
  let c = rgbaCache.get(hex);
  if (!c) {
    c = hexToRgb(hex);
    rgbaCache.set(hex, c);
  }
  return `rgba(${c[0]},${c[1]},${c[2]},${a < 0 ? 0 : a > 1 ? 1 : a})`;
}

/** Deterministic hash → 0..1, for per-body seeds without Math.random. */
function hash01(s: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/* ------------------------------------------------------------------ */
/* Internal types                                                      */
/* ------------------------------------------------------------------ */

interface Body {
  id: string;
  lon: number;
  spd: number;
  retro: boolean;
  color: string;
  theta: number;
  rScale: number;
  x: number;
  y: number;
  halo: number;
  core: number;
  breathPeriod: number;
  seed: number;
  blush: number;
  hit: number;
}

interface Crossing {
  t: number; // arc-length param from endpoint a
  edge: 0 | 1;
  x: number;
  y: number;
}

interface Beam {
  aspect: Aspect;
  a: Body;
  b: Body;
  /** Bent polyline, flat [x0,y0,x1,y1,…]. */
  pts: number[];
  /** Cumulative arc length per point. */
  cum: number[];
  len: number;
  crossings: Crossing[];
  /** For straight beams: unit normal. */
  nx: number;
  ny: number;
}

type ParticleKind = 'flow' | 'circuit' | 'packet' | 'burst' | 'sextile';

interface Particle {
  kind: ParticleKind;
  beam: Beam;
  /** 0..1 arc-length param measured from beam.a. */
  t: number;
  /** +1 travels a→b, −1 travels b→a. */
  dir: 1 | -1;
  speed: number; // px/s
  color: string;
  size: number;
  split: boolean;
  leg: number;
  /** Packets: 0 before the glass, 1 at, 2 after. */
  state: 0 | 1 | 2;
  crossIdx: number;
  life: number;
}

interface Seeker {
  x: number;
  y: number;
  sx: number;
  sy: number;
  target: Body;
  speed: number;
  color: string;
  p: number;
  len: number;
}

interface Ripple {
  x: number;
  y: number;
  r: number;
  alpha: number;
  color: string;
}

interface Sparkle {
  x: number;
  y: number;
  life: number;
  color: string;
}

export interface EngineStats {
  particles: number;
  seekers: number;
  frames: number;
  bends: number;
}

export type NatalPhase = 'face' | 'ascent' | 'dissolve';

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

export class NatalEngine {
  readonly canvas: HTMLCanvasElement;
  readonly chart: ChartData;
  readonly opts: EngineOpts;
  readonly aspects: Aspect[];
  readonly stats: EngineStats = { particles: 0, seekers: 0, frames: 0, bends: 0 };

  private ctx: CanvasRenderingContext2D;
  private W = 1;
  private H = 1;
  private dpr = 1;
  private R = 100;
  private cx = 0;
  private cy = 0;
  private baseCy = 0;

  private bodies = new Map<string, Body>();
  private bodyList: Body[] = [];
  private connected: Body[] = [];
  private beams: Beam[] = [];
  private spine: Beam | null = null;
  private circuitLegs: { beam: Beam; dir: 1 | -1 }[] = [];
  private venusBeams: { beam: Beam; dir: 1 | -1 }[] = [];
  private lilithX = 0;
  private lilithY = 0;
  private lensR = 0;
  private vertexX = 0;
  private vertexY = 0;
  private windowEdges: [number, number, number, number][] = [];

  private particles: Particle[] = [];
  private seekers: Seeker[] = [];
  private ripples: Ripple[] = [];
  private sparkles: Sparkle[] = [];

  private portrait: PortraitLayer | null = null;
  private discX = 0;
  private discY = 0;
  private discR = 0;

  private progress = 0;
  private phase: NatalPhase = 'face';
  private ascent = 0;
  private dissolve = 0;
  private signalShare = 0;

  private time = 0;
  private lastAccentSerial = -1;
  private knockGlow = 0;
  private sinceKnockMs = 1e9;
  private venusPhase = 0;
  private venusEnv = 0;
  private lift = 0;
  private lensAlpha = 0;
  private lensArcRot = 0;
  private edgeGlow = [0, 0];
  private vertexHeat = 0;
  private vertexHold = 0;
  private pointer: { x: number; y: number } | null = null;
  private spawnAcc = 0;
  private circuitAcc = 0;
  private flicker = 0;

  private sprites = new Map<string, HTMLCanvasElement>();
  private wispSeeds: number[] = [];

  constructor(canvas: HTMLCanvasElement, chart: ChartData, opts: Partial<EngineOpts> = {}) {
    this.canvas = canvas;
    this.chart = chart;
    this.opts = { ...DEFAULT_OPTS, ...opts, layers: { ...DEFAULT_OPTS.layers, ...(opts.layers ?? {}) } };
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('NatalEngine: 2d context unavailable');
    this.ctx = ctx;
    this.aspects = computeAspects(chart);
    for (let i = 0; i < 6; i++) this.wispSeeds.push(hash01('wisp', i * 7));
    this.buildBodies();
  }

  /* ---------------------------------------------------------------- */
  /* Public surface                                                    */
  /* ---------------------------------------------------------------- */

  setPortrait(p: PortraitLayer | null) {
    this.portrait = p;
    if (p && this.discR > 0) p.prepare(this.discR, this.dpr);
  }

  resize(w: number, h: number, dpr: number) {
    this.W = Math.max(1, w);
    this.H = Math.max(1, h);
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.layout();
  }

  /** Scroll progress 0..1 across the pinned hero. */
  setProgress(p: number) {
    const v = clamp01(p);
    if (v === this.progress) return;
    this.progress = v;
    this.phase = v < 0.25 ? 'face' : v < 0.75 ? 'ascent' : 'dissolve';
    this.ascent = easeInOut((v - 0.25) / 0.5);
    this.dissolve = smooth((v - 0.75) / 0.25);
    this.signalShare = clamp01((v - 0.25) / 0.45); // fully the twin by p = 0.7
    this.layout();
  }

  getPhase(): NatalPhase {
    return this.phase;
  }

  getProgress(): number {
    return this.progress;
  }

  /** Portrait disc in CSS px — the egg hit-area tracks this. */
  get disc(): { x: number; y: number; r: number } {
    return { x: this.discX, y: this.discY, r: this.discR };
  }

  setPointer(x: number | null, y = 0) {
    this.pointer = x === null ? null : { x, y };
  }

  /** Touch: a tap within the Vertex radius ignites it for one bar. */
  tap(x: number, y: number) {
    const d = Math.hypot(x - this.vertexX, y - this.vertexY);
    if (d < 58) {
      this.vertexHeat = 1;
      this.vertexHold = 1;
    }
  }

  /** One lit frame of the face state — no particles, no breath. */
  renderStatic() {
    this.time = 0;
    this.knockGlow = 0;
    this.sinceKnockMs = 1e9;
    this.venusEnv = 0;
    this.render(true);
  }

  tick(dt: number, clock: ClockState) {
    const d = Math.min(dt, 0.05);
    this.time += d;
    const knockOn = this.opts.layers.knock;
    this.knockGlow = knockOn ? clock.knockGlow : 0;
    this.sinceKnockMs = knockOn ? clock.sinceKnockMs : 1e9;

    // Accents crossed since last frame.
    if (clock.accentSerial !== this.lastAccentSerial) {
      this.lastAccentSerial = clock.accentSerial;
      if (knockOn) this.onAccent(clock.lastAccent);
    }

    this.update(d);
    this.render(false);
    this.stats.frames++;
  }

  dispose() {
    this.particles.length = 0;
    this.seekers.length = 0;
    this.sprites.clear();
  }

  /* ---------------------------------------------------------------- */
  /* Geometry                                                          */
  /* ---------------------------------------------------------------- */

  private theta(lon: number): number {
    return ((-90 - (lon - this.chart.mc)) * Math.PI) / 180;
  }

  private pos(lon: number, r: number): [number, number] {
    const th = this.theta(lon);
    return [this.cx + Math.cos(th) * r, this.cy + Math.sin(th) * r];
  }

  private buildBodies() {
    const pal = this.opts.palette;
    const ids = Object.keys(this.chart.bodies);
    const list: Body[] = [];
    for (const id of ids) {
      const b = this.chart.bodies[id];
      const ln = lognorm(b.spd);
      list.push({
        id,
        lon: b.lon,
        spd: b.spd,
        retro: b.retro,
        color: pal[id] ?? '#dddddd',
        theta: 0,
        rScale: 1,
        x: 0,
        y: 0,
        halo: id === 'saturn' ? 52 : id === 'sun' ? 40 : id === 'moon' ? 34 : id === 'mercury' ? 10 : 24 + ln * 6,
        core: id === 'sun' ? 4.2 : id === 'moon' ? 3.8 : id === 'mercury' ? 1.8 : 2.6,
        breathPeriod: lerp(9, 1.4, ln),
        seed: hash01(id),
        blush: 0,
        hit: 0,
      });
    }
    // Radial stagger for crowded neighbours (within 5°), Mercury excepted —
    // he rides inside the Sun.
    const ring = list.filter((b) => b.id !== 'mercury').sort((a, b) => a.lon - b.lon);
    for (let i = 0; i < ring.length; i++) {
      const cur = ring[i];
      const next = ring[(i + 1) % ring.length];
      const gap = ((next.lon - cur.lon) % 360 + 360) % 360;
      if (gap < 5 && cur.rScale === 1 && next.rScale === 1) {
        cur.rScale = 0.965;
        next.rScale = 1.035;
      }
    }
    this.bodyList = list;
    this.bodies = new Map(list.map((b) => [b.id, b]));
    this.connected = connectedBodies(this.aspects)
      .map((id) => this.bodies.get(id)!)
      .filter(Boolean);
  }

  /**
   * Recompute every position from W/H/progress. Cheap (12 bodies, ~30
   * polylines), so it simply reruns on resize and on every scroll change.
   *
   * Lilith's radius: her longitude is exact, her radius is a rendering
   * choice (like the 0.965/1.035 stagger). At R no chord passes within her
   * 0.17R reach in most charts; at ~0.28R she sits where the spine and the
   * centre-born seekers actually travel — a lens where the light is.
   */
  private layout() {
    const { W, H } = this;
    const minDim = Math.min(W, H);
    this.R = minDim * (W < 640 ? 0.42 : 0.4);
    const R = this.R;
    this.cx = W / 2;
    // The wheel sits a touch above centre so the copy band clears the disc,
    // and drifts up behind the copy during the ascent.
    this.baseCy = H * 0.46;
    this.cy = this.baseCy - this.ascent * H * 0.08;

    // Bodies.
    const sun = this.bodies.get('sun');
    for (const b of this.bodyList) {
      b.theta = this.theta(b.lon);
      if (b.id === 'mercury' && sun) {
        // Cazimi: positioned per frame around the Sun; park at the Sun.
        b.x = this.cx + Math.cos(this.theta(sun.lon)) * R * sun.rScale;
        b.y = this.cy + Math.sin(this.theta(sun.lon)) * R * sun.rScale;
        continue;
      }
      b.x = this.cx + Math.cos(b.theta) * R * b.rScale;
      b.y = this.cy + Math.sin(b.theta) * R * b.rScale;
    }

    // Lilith, Vertex.
    this.lensR = 0.17 * R;
    [this.lilithX, this.lilithY] = this.pos(this.chart.lilith, this.opts.lilithRadius * R);
    [this.vertexX, this.vertexY] = this.pos(this.chart.vertex, R);

    // The Window's two pane edges (12th house: cusp 12 → ASC), 0.32R–1.08R.
    const e0a = this.pos(this.chart.house12cusp, 0.32 * R);
    const e0b = this.pos(this.chart.house12cusp, 1.08 * R);
    const e1a = this.pos(this.chart.asc, 0.32 * R);
    const e1b = this.pos(this.chart.asc, 1.08 * R);
    this.windowEdges = [
      [e0a[0], e0a[1], e0b[0], e0b[1]],
      [e1a[0], e1a[1], e1b[0], e1b[1]],
    ];

    // Portrait disc: centre in the face phase; an eased curved path to the
    // Ascendant during the ascent; parked on the horizon after.
    const faceR = 0.165 * R;
    const [ax, ay] = this.pos(this.chart.asc, R);
    const t = this.ascent;
    // Quadratic bezier: control point pushed perpendicular to the chord so
    // the medallion swings rather than slides.
    const mx = (this.cx + ax) / 2;
    const my = (this.cy + ay) / 2;
    const dx = ax - this.cx;
    const dy = ay - this.cy;
    const L = Math.hypot(dx, dy) || 1;
    const px = -dy / L;
    const py = dx / L;
    const kx = mx + px * 0.35 * R;
    const ky = my + py * 0.35 * R;
    const u = 1 - t;
    this.discX = u * u * this.cx + 2 * u * t * kx + t * t * ax;
    this.discY = u * u * this.cy + 2 * u * t * ky + t * t * ay;
    this.discR = lerp(faceR, 0.1 * R, t);
    if (this.portrait) this.portrait.prepare(this.discR, this.dpr);

    this.buildBeams();
  }

  private bend(x: number, y: number): [number, number, number] {
    const dx = this.lilithX - x;
    const dy = this.lilithY - y;
    const d = Math.hypot(dx, dy);
    if (d >= this.lensR || d < 1e-3) return [x, y, 0];
    const k = Math.pow(1 - d / this.lensR, 2) * 0.035 * this.R;
    return [x + (dx / d) * k, y + (dy / d) * k, k];
  }

  private buildBeams() {
    const N = 32;
    const R = this.R;
    const beams: Beam[] = [];
    const lensOn = this.opts.layers.lens;
    for (const asp of this.aspects) {
      const a = this.bodies.get(asp.a);
      const b = this.bodies.get(asp.b);
      if (!a || !b) continue;
      const pts: number[] = [];
      const isTrine = asp.kind === 'trine';
      // Trine: quadratic bow, control point pulled 17% toward centre.
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const kx = lerp(mx, this.cx, 0.17);
      const ky = lerp(my, this.cy, 0.17);
      for (let i = 0; i <= N; i++) {
        const s = i / N;
        let x: number;
        let y: number;
        if (isTrine) {
          const u = 1 - s;
          x = u * u * a.x + 2 * u * s * kx + s * s * b.x;
          y = u * u * a.y + 2 * u * s * ky + s * s * b.y;
        } else {
          x = lerp(a.x, b.x, s);
          y = lerp(a.y, b.y, s);
        }
        if (lensOn) [x, y] = this.bend(x, y);
        pts.push(x, y);
      }
      const cum = [0];
      for (let i = 1; i <= N; i++) {
        cum.push(cum[i - 1] + Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]));
      }
      const len = cum[N] || 1;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const L = Math.hypot(dx, dy) || 1;
      const beam: Beam = { aspect: asp, a, b, pts, cum, len, crossings: [], nx: -dy / L, ny: dx / L };
      // Window crossings on the actual (curved, bent) path.
      for (let e = 0; e < 2; e++) {
        const [x1, y1, x2, y2] = this.windowEdges[e];
        for (let i = 0; i < N; i++) {
          const hit = segHit(pts[i * 2], pts[i * 2 + 1], pts[i * 2 + 2], pts[i * 2 + 3], x1, y1, x2, y2);
          if (hit) {
            const t = (cum[i] + hit[2] * (cum[i + 1] - cum[i])) / len;
            beam.crossings.push({ t, edge: e as 0 | 1, x: hit[0], y: hit[1] });
          }
        }
      }
      beam.crossings.sort((p, q) => p.t - q.t);
      beams.push(beam);
    }
    this.beams = beams;
    this.spine = beams.find((b) => b.aspect.role === 'spine') ?? null;

    // Circuit legs moon→vesta→nn→moon (one direction).
    const order = ['moon', 'vesta', 'nn'];
    this.circuitLegs = [];
    for (let i = 0; i < 3; i++) {
      const from = order[i];
      const to = order[(i + 1) % 3];
      const beam = beams.find(
        (b) => b.aspect.role === 'circuit' && ((b.a.id === from && b.b.id === to) || (b.a.id === to && b.b.id === from)),
      );
      if (beam) this.circuitLegs.push({ beam, dir: beam.a.id === from ? 1 : -1 });
    }

    // Venus's beams, oriented from her end.
    this.venusBeams = beams
      .filter((b) => (b.a.id === 'venus' || b.b.id === 'venus') && b.aspect.role !== 'conjunction')
      .map((b) => ({ beam: b, dir: b.a.id === 'venus' ? 1 : -1 }));

    // Particles keep their param; their beam object must be refreshed.
    const byKey = new Map(beams.map((b) => [b.aspect.a + '|' + b.aspect.b, b]));
    this.particles = this.particles.filter((p) => {
      const nb = byKey.get(p.beam.aspect.a + '|' + p.beam.aspect.b);
      if (!nb) return false;
      p.beam = nb;
      return true;
    });
    for (const leg of this.circuitLegs) void leg;
    void R;
  }

  /** Point on a beam at arc-length param t (0 at a, 1 at b). */
  private pointAt(beam: Beam, t: number, out: [number, number]): [number, number] {
    const target = clamp01(t) * beam.len;
    const cum = beam.cum;
    let lo = 0;
    let hi = cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= target) lo = mid;
      else hi = mid;
    }
    const seg = cum[hi] - cum[lo] || 1;
    const f = (target - cum[lo]) / seg;
    out[0] = lerp(beam.pts[lo * 2], beam.pts[hi * 2], f);
    out[1] = lerp(beam.pts[lo * 2 + 1], beam.pts[hi * 2 + 1], f);
    return out;
  }

  private speedFor(body: Body): number {
    return lerp(55, 330, lognorm(body.spd)) * this.opts.flowSpeed;
  }

  /* ---------------------------------------------------------------- */
  /* Simulation                                                        */
  /* ---------------------------------------------------------------- */

  private onAccent(index: 0 | 2 | 4) {
    const L = this.opts.layers;
    if (this.dissolve > 0.3) return;
    if (index === 4 && L.squares) {
      // Staccato bursts + endpoint sparkles on the squares.
      for (const beam of this.beams) {
        if (beam.aspect.kind !== 'square') continue;
        for (let i = 0; i < 3; i++) {
          this.particles.push(this.makeParticle('burst', beam, 1, beam.a, 1.4 + i * 0.25, 0.02 * i));
          this.particles.push(this.makeParticle('burst', beam, -1, beam.b, 1.4 + i * 0.25, 1 - 0.02 * i));
        }
        this.sparkles.push({ x: beam.a.x, y: beam.a.y, life: 1, color: beam.a.color });
        this.sparkles.push({ x: beam.b.x, y: beam.b.y, life: 1, color: beam.b.color });
      }
    }
    if (index === 2 && L.sextiles) {
      for (const beam of this.beams) {
        if (beam.aspect.kind !== 'sextile') continue;
        this.particles.push(this.makeParticle('sextile', beam, 1, beam.a, 1.1, 0));
        this.particles.push(this.makeParticle('sextile', beam, -1, beam.b, 1.1, 1));
      }
    }
  }

  private makeParticle(
    kind: ParticleKind,
    beam: Beam,
    dir: 1 | -1,
    source: Body,
    speedMul: number,
    t: number,
  ): Particle {
    return {
      kind,
      beam,
      t,
      dir,
      speed: this.speedFor(source) * speedMul,
      color: source.color,
      size: kind === 'packet' ? 3.2 : kind === 'burst' ? 2.4 : 2,
      split: false,
      leg: 0,
      state: 0,
      crossIdx: 0,
      life: 1,
    };
  }

  private update(dt: number) {
    const L = this.opts.layers;
    const density = this.opts.density;
    const quiet = this.dissolve > 0.2;

    // Venus's heart — her own clock, a polyrhythm against the 7/8.
    if (L.venus) {
      const prev = this.venusPhase;
      this.venusPhase = (this.venusPhase + (dt * this.opts.venusBpm) / 60) % 1;
      const g = (p: number, c: number, s: number) => Math.exp(-0.5 * Math.pow(((p - c + 0.5) % 1) - 0.5, 2) / (s * s));
      this.venusEnv = g(this.venusPhase, 0.02, 0.085) + 0.62 * g(this.venusPhase, 0.3, 0.085);
      const lubNow = this.venusPhase >= 0.02 && (prev < 0.02 || prev > this.venusPhase);
      if (lubNow && !quiet) {
        for (const { beam, dir } of this.venusBeams) {
          const venus = dir === 1 ? beam.a : beam.b;
          const p = this.makeParticle('packet', beam, dir, venus, 0.9, dir === 1 ? 0 : 1);
          p.speed = 190 * this.opts.flowSpeed;
          this.particles.push(p);
        }
        this.opts.onVenusBeat?.(this.venusEnv);
      }
    } else {
      this.venusEnv = 0;
    }

    // Continuous flow on oppositions and non-circuit trines.
    const flowCap = Math.round(340 * density);
    if (!quiet) {
      let flowCount = 0;
      for (const p of this.particles) if (p.kind === 'flow') flowCount++;
      this.spawnAcc += dt * 26 * density;
      while (this.spawnAcc >= 1 && flowCount < flowCap) {
        this.spawnAcc -= 1;
        const candidates = this.beams.filter((b) => {
          const k = b.aspect.kind;
          if (b.aspect.role === 'circuit' || b.aspect.role === 'conjunction') return false;
          if (b.aspect.role === 'spine') return L.spine;
          return k === 'opposition' || k === 'trine';
        });
        if (!candidates.length) break;
        // Weighted by aspect strength.
        let total = 0;
        for (const c of candidates) total += c.aspect.w;
        let r = Math.random() * total;
        let pick = candidates[0];
        for (const c of candidates) {
          r -= c.aspect.w;
          if (r <= 0) {
            pick = c;
            break;
          }
        }
        const fromA = Math.random() < 0.5;
        this.particles.push(this.makeParticle('flow', pick, fromA ? 1 : -1, fromA ? pick.a : pick.b, 1, fromA ? 0 : 1));
        flowCount++;
      }
      // The circuit: moon→vesta→nn→moon.
      if (L.circuit && this.circuitLegs.length === 3) {
        this.circuitAcc += dt * 2.4 * density;
        while (this.circuitAcc >= 1) {
          this.circuitAcc -= 1;
          const leg = this.circuitLegs[0];
          const p = this.makeParticle('circuit', leg.beam, leg.dir, this.bodies.get('moon')!, 0.55, leg.dir === 1 ? 0 : 1);
          p.leg = 0;
          p.color = this.opts.palette.moon ?? '#eef2fb';
          this.particles.push(p);
        }
      }
    }

    // Advance particles.
    const knock = this.knockGlow;
    const pt: [number, number] = [0, 0];
    const splitR = 0.88 * this.discR;
    const seekerCap = 36;
    const next: Particle[] = [];
    for (const p of this.particles) {
      const surge = p.beam.aspect.kind === 'opposition' ? 1 + 0.9 * knock : 1;
      p.t += (p.dir * p.speed * surge * dt) / p.beam.len;

      // Packets: the glass.
      if (p.kind === 'packet') {
        const crossings = p.beam.crossings;
        const idx = p.crossIdx;
        const list = p.dir === 1 ? crossings : crossings.slice().reverse();
        if (p.state === 0 && idx < list.length) {
          const c = list[idx];
          const passed = p.dir === 1 ? p.t >= c.t : p.t <= c.t;
          if (passed) {
            p.state = 2;
            p.crossIdx++;
            this.edgeGlow[c.edge] = 1;
            this.ripples.push({ x: c.x, y: c.y, r: 2, alpha: 0.55, color: this.opts.venusFringe[0] });
          }
        }
      }

      // Spine splits: particles near the centre flare and seed seekers.
      if (p.beam.aspect.role === 'spine' && !p.split && this.dissolve === 0) {
        this.pointAt(p.beam, p.t, pt);
        const d = Math.hypot(pt[0] - this.discX, pt[1] - this.discY);
        if (d < splitR) {
          p.split = true;
          if (this.seekers.length < seekerCap && Math.random() < 0.55 && this.connected.length) {
            const n = Math.random() < 0.5 ? 1 : 2;
            for (let i = 0; i < n && this.seekers.length < seekerCap; i++) {
              const target = this.connected[Math.floor(Math.random() * this.connected.length)];
              if (target.id === 'mercury') continue;
              const len = Math.hypot(target.x - pt[0], target.y - pt[1]);
              this.seekers.push({ x: pt[0], y: pt[1], sx: pt[0], sy: pt[1], target, speed: 300, color: p.color, p: 0, len });
            }
          }
          // Light through the head: stamp the streak along the beam.
          if (this.portrait && this.discR > 0) {
            const nx = (pt[0] - (this.discX - this.discR)) / (2 * this.discR);
            const ny = (pt[1] - (this.discY - this.discR)) / (2 * this.discR);
            this.portrait.stampStreak(nx, ny, -p.beam.ny, p.beam.nx, p.color, 0.5 + 0.5 * knock);
          }
        }
      }

      const done = p.t > 1 || p.t < 0;
      if (done) {
        if (p.kind === 'circuit') {
          p.leg = (p.leg + 1) % 3;
          const leg = this.circuitLegs[p.leg];
          if (leg) {
            p.beam = leg.beam;
            p.dir = leg.dir;
            p.t = leg.dir === 1 ? 0 : 1;
            next.push(p);
          }
          continue;
        }
        if (p.kind === 'packet') {
          const target = p.dir === 1 ? p.beam.b : p.beam.a;
          target.blush = 1;
          this.lift = Math.min(1, this.lift + 0.7);
          if (this.portrait && this.discR > 0) {
            // The face blushes on the side that faces the arriving target.
            const ang = Math.atan2(target.y - this.discY, target.x - this.discX);
            this.portrait.stampRadial(0.5 + Math.cos(ang) * 0.38, 0.5 + Math.sin(ang) * 0.38, this.opts.venusFringe[0], 0.7);
          }
        }
        continue;
      }
      next.push(p);
    }
    this.particles = next;

    // Seekers.
    const keep: Seeker[] = [];
    for (const s of this.seekers) {
      s.p += (s.speed * dt) / (s.len || 1);
      if (s.p >= 1) {
        s.target.hit = 1;
        continue;
      }
      s.x = lerp(s.sx, s.target.x, s.p);
      s.y = lerp(s.sy, s.target.y, s.p);
      keep.push(s);
    }
    this.seekers = keep;

    // Decays.
    for (const b of this.bodyList) {
      b.blush *= 0.94;
      b.hit *= 0.9;
    }
    this.lift *= 0.9;
    this.edgeGlow[0] *= 0.93;
    this.edgeGlow[1] *= 0.93;
    this.lensAlpha = Math.max(0, this.lensAlpha - 0.012);
    this.lensArcRot += dt * 0.25;
    for (const r of this.ripples) {
      r.r += dt * 120;
      r.alpha *= 0.95;
    }
    this.ripples = this.ripples.filter((r) => r.alpha > 0.02);
    for (const s of this.sparkles) s.life -= dt * 3.2;
    this.sparkles = this.sparkles.filter((s) => s.life > 0);

    // Vertex heat.
    if (L.vertex) {
      let near = false;
      if (this.pointer) near = Math.hypot(this.pointer.x - this.vertexX, this.pointer.y - this.vertexY) < 58;
      if (this.vertexHold > 0) {
        this.vertexHold -= dt / 2.1; // one bar at 300 ms eighths
        near = true;
      }
      this.vertexHeat = near ? Math.min(1, this.vertexHeat + dt * 1.6) : Math.max(0, this.vertexHeat - dt * 0.45);
    }
    this.flicker = 0.5 + 0.5 * Math.sin(this.time * 17.3) * Math.sin(this.time * 7.1 + 1.3);

    if (this.portrait) this.portrait.tick(dt);
    this.stats.particles = this.particles.length;
    this.stats.seekers = this.seekers.length;
  }

  /* ---------------------------------------------------------------- */
  /* Rendering                                                         */
  /* ---------------------------------------------------------------- */

  private sprite(color: string): HTMLCanvasElement {
    let s = this.sprites.get(color);
    if (s) return s;
    s = document.createElement('canvas');
    s.width = s.height = 64;
    const g = s.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, rgba(color, 1));
    grad.addColorStop(0.22, rgba(color, 0.55));
    grad.addColorStop(0.55, rgba(color, 0.12));
    grad.addColorStop(1, rgba(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    this.sprites.set(color, s);
    return s;
  }

  private glow(x: number, y: number, r: number, color: string, alpha: number) {
    if (alpha <= 0.002 || r <= 0) return;
    const ctx = this.ctx;
    ctx.globalAlpha = alpha;
    ctx.drawImage(this.sprite(color), x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }

  private render(still: boolean) {
    const ctx = this.ctx;
    const { W, H, R } = this;
    const L = this.opts.layers;
    const bril = this.opts.brilliance;
    const knock = this.knockGlow;
    const dis = this.dissolve;
    const beamFade = Math.pow(1 - dis, 2);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    // True black behind the hero; the host fades the whole canvas out in the
    // dissolve so the WebGL constellation beneath shows through at p = 1.
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    if (L.window) this.drawWindow();
    if (L.chrome) this.drawChrome(knock);

    // Beams (under everything that lives on them).
    ctx.globalCompositeOperation = 'lighter';
    for (const beam of this.beams) {
      const role = beam.aspect.role;
      const kind = beam.aspect.kind;
      if (role === 'spine' && !L.spine) continue;
      if (role === 'circuit' && !L.circuit) continue;
      if (kind === 'square' && !L.squares) continue;
      if (kind === 'sextile' && !L.sextiles) continue;
      this.drawBeam(beam, knock, bril, beamFade, still);
    }

    if (!still) {
      this.drawParticles(bril, beamFade);
      this.drawSeekers(bril);
    }

    // Portrait stack — beams → portrait. The photo occludes; the glyph layer
    // transmits.
    if (L.portrait && this.portrait && this.discR > 0) {
      ctx.globalCompositeOperation = 'source-over';
      this.portrait.draw(ctx, this.discX, this.discY, this.discR, {
        knockGlow: knock,
        sinceKnockMs: this.sinceKnockMs,
        timeS: this.time,
        share: this.signalShare,
        signalRest: this.opts.signalRest,
        signalSurge: this.opts.signalSurge,
        tidePeriod: this.opts.tidePeriod,
        still,
      });
    }

    ctx.globalCompositeOperation = 'lighter';
    this.drawOrbs(bril, still);
    if (L.lens) this.drawLens();
    if (L.vertex) this.drawVertex(bril);

    // Ripples on the glass.
    for (const r of this.ripples) {
      ctx.strokeStyle = rgba(r.color, r.alpha * 0.8);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, TAU);
      ctx.stroke();
    }
    for (const s of this.sparkles) {
      this.glow(s.x, s.y, 10 + 10 * (1 - s.life), s.color, s.life * 0.5);
    }

    // The room lifts on Venus's arrivals.
    if (this.lift > 0.01) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,205,220,${0.045 * this.lift})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (L.glyphAudit && this.portrait) {
      ctx.globalCompositeOperation = 'source-over';
      this.portrait.drawAudit(ctx, 16, H - 56);
    }
    ctx.globalCompositeOperation = 'source-over';
    void R;
  }

  private drawChrome(knock: number) {
    const ctx = this.ctx;
    const { cx, cy, R } = this;
    const bright = 1 + 0.7 * knock;
    const fade = 1 - this.dissolve;
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(220,226,240,${0.09 * bright * fade})`;
    ctx.beginPath();
    ctx.arc(cx, cy, 1.05 * R, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = `rgba(220,226,240,${0.07 * bright * fade})`;
    ctx.beginPath();
    ctx.arc(cx, cy, 0.9 * R, 0, TAU);
    ctx.stroke();
    // Sign ticks every 30°, 5° minors, ASC/MC axis.
    for (let d = 0; d < 360; d += 5) {
      const th = this.theta(d);
      const major = d % 30 === 0;
      const a = (major ? 0.16 : 0.05) * bright * fade;
      const r0 = major ? 0.9 * R : 1.0 * R;
      const r1 = 1.05 * R;
      ctx.strokeStyle = `rgba(220,226,240,${a})`;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(th) * r0, cy + Math.sin(th) * r0);
      ctx.lineTo(cx + Math.cos(th) * r1, cy + Math.sin(th) * r1);
      ctx.stroke();
    }
    for (const lon of [this.chart.asc, (this.chart.asc + 180) % 360, this.chart.mc, (this.chart.mc + 180) % 360]) {
      const th = this.theta(lon);
      ctx.strokeStyle = `rgba(220,226,240,${0.12 * bright * fade})`;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(th) * 0.86 * R, cy + Math.sin(th) * 0.86 * R);
      ctx.lineTo(cx + Math.cos(th) * 1.09 * R, cy + Math.sin(th) * 1.09 * R);
      ctx.stroke();
    }
  }

  private windowPath() {
    const ctx = this.ctx;
    const { cx, cy, R } = this;
    const t0 = this.theta(this.chart.house12cusp);
    const t1 = this.theta(this.chart.asc);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(t0) * 0.32 * R, cy + Math.sin(t0) * 0.32 * R);
    ctx.lineTo(cx + Math.cos(t0) * 1.08 * R, cy + Math.sin(t0) * 1.08 * R);
    ctx.arc(cx, cy, 1.08 * R, t0, t1, true);
    ctx.lineTo(cx + Math.cos(t1) * 0.32 * R, cy + Math.sin(t1) * 0.32 * R);
    ctx.arc(cx, cy, 0.32 * R, t1, t0, false);
    ctx.closePath();
  }

  private drawWindow() {
    const ctx = this.ctx;
    const { cx, cy, R } = this;
    const fade = 1 - this.dissolve;
    ctx.globalCompositeOperation = 'source-over';
    // Veil.
    this.windowPath();
    ctx.fillStyle = `rgba(205,218,245,${0.03 * fade})`;
    ctx.fill();
    // Sheen sweep: a soft diagonal band crossing the pane every ~14 s.
    ctx.save();
    this.windowPath();
    ctx.clip();
    const sweep = (this.time / 14) % 1;
    const sx = cx - R * 1.3 + sweep * R * 2.6;
    const g = ctx.createLinearGradient(sx - 0.35 * R, cy - R, sx + 0.35 * R, cy + R);
    g.addColorStop(0, 'rgba(225,234,250,0)');
    g.addColorStop(0.5, `rgba(225,234,250,${0.05 * fade})`);
    g.addColorStop(1, 'rgba(225,234,250,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 1.2 * R, cy - 1.2 * R, 2.4 * R, 2.4 * R);
    // Striae.
    const t0 = this.theta(this.chart.house12cusp);
    const t1 = this.theta(this.chart.asc);
    ctx.lineWidth = 1;
    for (const f of [0.5, 0.68, 0.86]) {
      ctx.strokeStyle = `rgba(205,218,245,${0.06 * fade})`;
      ctx.beginPath();
      ctx.arc(cx, cy, f * R, t0, t1, true);
      ctx.stroke();
    }
    ctx.restore();
    // Edge lines, glowing on crossings.
    for (let e = 0; e < 2; e++) {
      const [x1, y1, x2, y2] = this.windowEdges[e];
      const gl = this.edgeGlow[e];
      ctx.strokeStyle = `rgba(210,222,245,${(0.14 + 0.5 * gl) * fade})`;
      ctx.lineWidth = 1 + gl * 1.2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      if (gl > 0.02) {
        ctx.globalCompositeOperation = 'lighter';
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        this.glow(mx, my, 0.4 * R, this.opts.venusFringe[0], gl * 0.18);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  private drawBeam(beam: Beam, knock: number, bril: number, fade: number, still: boolean) {
    const ctx = this.ctx;
    const { aspect, a, b, pts } = beam;
    const w = aspect.w;
    const base = (0.1 + 0.26 * w) * bril * fade;
    const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    const N = pts.length / 2 - 1;

    if (aspect.role === 'conjunction') {
      // Corona: 10 px round-cap gradient stroke + midpoint glow; no beam.
      grad.addColorStop(0, rgba(a.color, 0.22 * bril * fade));
      grad.addColorStop(1, rgba(b.color, 0.22 * bril * fade));
      ctx.strokeStyle = grad;
      ctx.lineCap = 'round';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.lineCap = 'butt';
      this.glow((a.x + b.x) / 2, (a.y + b.y) / 2, 22, a.color, 0.3 * bril * fade);
      return;
    }

    if (aspect.kind === 'opposition') {
      const spine = aspect.role === 'spine';
      const alpha = base * (spine ? 1.5 * (1 + 0.8 * knock) : 1);
      grad.addColorStop(0, rgba(a.color, alpha));
      grad.addColorStop(1, rgba(b.color, alpha));
      // Standing wave: two antinodes, surging on the knock.
      const amp = (spine ? 3.2 : 2.2) * (1 + 1.2 * knock);
      const osc = still ? 0 : Math.sin(this.time * 4.1);
      ctx.strokeStyle = grad;
      ctx.lineWidth = spine ? 1.4 : 1.1;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const s = i / N;
        const off = amp * Math.sin(TAU * s) * osc;
        const x = pts[i * 2] + beam.nx * off;
        const y = pts[i * 2 + 1] + beam.ny * off;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      if (spine) {
        ctx.lineWidth = 5;
        ctx.globalAlpha = 0.28;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      return;
    }

    if (aspect.kind === 'trine') {
      grad.addColorStop(0, rgba(a.color, base));
      grad.addColorStop(1, rgba(b.color, base));
      ctx.strokeStyle = grad;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        if (i === 0) ctx.moveTo(pts[0], pts[1]);
        else ctx.lineTo(pts[i * 2], pts[i * 2 + 1]);
      }
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.3;
      ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }

    if (aspect.kind === 'square') {
      grad.addColorStop(0, rgba(a.color, base * 0.9));
      grad.addColorStop(1, rgba(b.color, base * 0.9));
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1;
      ctx.setLineDash([7, 9]);
      ctx.lineDashOffset = -Math.floor((this.time % 1) * 6) * 4;
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (let i = 1; i <= N; i++) ctx.lineTo(pts[i * 2], pts[i * 2 + 1]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
      return;
    }

    // Sextile: faint line.
    grad.addColorStop(0, rgba(a.color, base * 0.55));
    grad.addColorStop(1, rgba(b.color, base * 0.55));
    ctx.strokeStyle = grad;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 1; i <= N; i++) ctx.lineTo(pts[i * 2], pts[i * 2 + 1]);
    ctx.stroke();
  }

  private drawParticles(bril: number, fade: number) {
    const ctx = this.ctx;
    const pt: [number, number] = [0, 0];
    const lensOn = this.opts.layers.lens;
    let bends = 0;
    for (const p of this.particles) {
      this.pointAt(p.beam, p.t, pt);
      let [x, y] = pt;
      if (lensOn) {
        const [bx, by, k] = this.bend(x, y);
        if (k > 0.3) {
          bends++;
          this.lensAlpha = Math.min(1, this.lensAlpha + 0.05);
        }
        x = bx;
        y = by;
      }
      const spineFlare = p.beam.aspect.role === 'spine' && Math.hypot(x - this.discX, y - this.discY) < this.discR * 1.1;
      if (p.kind === 'packet') {
        if (p.state === 2) {
          // Chromatic triplet after the glass, perpendicular offsets ±2.6 px.
          const nx = p.beam.nx;
          const ny = p.beam.ny;
          const [c0, c1, c2] = this.opts.venusFringe;
          this.glow(x - nx * 2.6, y - ny * 2.6, 7, c0, 0.7 * bril * fade);
          this.glow(x, y, 7, c1, 0.6 * bril * fade);
          this.glow(x + nx * 2.6, y + ny * 2.6, 7, c2, 0.7 * bril * fade);
        } else {
          this.glow(x, y, 8, p.color, 0.4 * bril * fade);
        }
        continue;
      }
      const size = p.size * (spineFlare ? 2.6 : 1) * (p.kind === 'sextile' ? 1.6 : 1);
      const a = (p.kind === 'burst' ? 0.7 : p.kind === 'sextile' ? 0.75 : 0.45) * bril * fade * (spineFlare ? 1.6 : 1);
      this.glow(x, y, size * 3, p.color, a);
      if (spineFlare) {
        ctx.fillStyle = rgba('#ffffff', 0.6 * fade);
        ctx.beginPath();
        ctx.arc(x, y, 1.1, 0, TAU);
        ctx.fill();
      }
    }
    this.stats.bends = bends;
  }

  private drawSeekers(bril: number) {
    const lensOn = this.opts.layers.lens;
    for (const s of this.seekers) {
      let x = s.x;
      let y = s.y;
      if (lensOn) {
        const [bx, by, k] = this.bend(x, y);
        if (k > 0.3) this.lensAlpha = Math.min(1, this.lensAlpha + 0.05);
        x = bx;
        y = by;
      }
      this.glow(x, y, 6, s.color, 0.55 * bril);
      // Short trail.
      const tx = lerp(s.sx, s.target.x, Math.max(0, s.p - 0.04));
      const ty = lerp(s.sy, s.target.y, Math.max(0, s.p - 0.04));
      this.ctx.strokeStyle = rgba(s.color, 0.35 * bril);
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(tx, ty);
      this.ctx.lineTo(x, y);
      this.ctx.stroke();
    }
  }

  private drawOrbs(bril: number, still: boolean) {
    const ctx = this.ctx;
    const t = this.time;
    const dis = this.dissolve;
    const sun = this.bodies.get('sun');
    const pal = this.opts.palette;
    for (const b of this.bodyList) {
      if (b.id === 'mercury') continue;
      // Dissolve: scatter outward into a point-field and shrink.
      let x = b.x;
      let y = b.y;
      let scale = 1;
      if (dis > 0) {
        const k = dis * (0.5 + 0.5 * b.seed) * 0.55 * this.R;
        x += Math.cos(b.theta + (b.seed - 0.5) * 0.6) * k;
        y += Math.sin(b.theta + (b.seed - 0.5) * 0.6) * k;
        scale = 1 - 0.7 * dis;
      }
      const breath = still ? 1 : 0.86 + 0.14 * Math.sin((TAU * t) / b.breathPeriod + b.seed * TAU);
      const venusScale = b.id === 'venus' ? 1 + 0.26 * this.venusEnv : 1;
      const halo = b.halo * breath * venusScale * scale;
      const glowA = (b.id === 'saturn' ? 0.5 : 0.42) * bril * (1 - dis * 0.6);
      this.glow(x, y, halo, b.color, glowA);
      if (b.blush > 0.02) this.glow(x, y, halo * 1.4, this.opts.venusFringe[0], 0.5 * b.blush * bril);
      if (b.hit > 0.02) this.glow(x, y, halo * 0.8, '#ffffff', 0.35 * b.hit);
      // Core.
      ctx.fillStyle = rgba('#ffffff', 0.85 * (1 - dis * 0.4));
      ctx.beginPath();
      ctx.arc(x, y, b.core * venusScale * scale, 0, TAU);
      ctx.fill();
      ctx.fillStyle = rgba(b.color, 0.9);
      ctx.beginPath();
      ctx.arc(x, y, b.core * 0.65 * venusScale * scale, 0, TAU);
      ctx.fill();

      // Highlight arc — retrograde bodies run it backward.
      if (!still) {
        const dir = b.retro ? -1 : 1;
        const ang = dir * ((TAU * t) / b.breathPeriod) + b.seed * TAU;
        ctx.strokeStyle = rgba('#ffffff', 0.35 * (1 - dis));
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, b.core + 3.2, ang, ang + 0.9);
        ctx.stroke();
      }

      // Saturn's Crown: the tilted ring at the zenith.
      if (b.id === 'saturn') {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-0.42);
        ctx.scale(1, 0.36);
        ctx.strokeStyle = rgba(b.color, 0.75 * (1 - dis));
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(0, 0, 15.5 * scale, 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = rgba('#ffffff', 0.18 * (1 - dis));
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.arc(0, 0, 12.5 * scale, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }

      // Cazimi: the silver Mercury core orbits inside the Sun's corona.
      if (b.id === 'sun' && this.bodies.has('mercury')) {
        const m = this.bodies.get('mercury')!;
        const ang = still ? 0.6 : t * 0.9;
        const ox = x + Math.cos(ang) * 9.5 * scale;
        const oy = y + Math.sin(ang) * 9.5 * scale;
        m.x = ox;
        m.y = oy;
        if (!still) {
          ctx.strokeStyle = rgba(pal.mercury ?? '#e6edf4', 0.45);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x, y, 9.5 * scale, ang - 1.1, ang);
          ctx.stroke();
        }
        this.glow(ox, oy, 7, pal.mercury ?? '#e6edf4', 0.55 * bril);
        ctx.fillStyle = rgba('#ffffff', 0.95);
        ctx.beginPath();
        ctx.arc(ox, oy, 1.6, 0, TAU);
        ctx.fill();
      }
    }
    void sun;
  }

  private drawLens() {
    if (this.lensAlpha <= 0.005) return;
    const ctx = this.ctx;
    const a = this.lensAlpha * (1 - this.dissolve);
    const col = this.opts.palette.lilith ?? '#9b7bff';
    const breathe = 1 + 0.08 * Math.sin(this.time * 1.7);
    ctx.strokeStyle = rgba(col, 0.5 * a);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(this.lilithX, this.lilithY, 0.05 * this.R * breathe, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = rgba(col, 0.35 * a);
    ctx.beginPath();
    ctx.arc(this.lilithX, this.lilithY, 0.085 * this.R, this.lensArcRot, this.lensArcRot + Math.PI * 1.1);
    ctx.stroke();
    this.glow(this.lilithX, this.lilithY, 0.06 * this.R, col, 0.12 * a);
  }

  private drawVertex(bril: number) {
    const ctx = this.ctx;
    const heat = this.vertexHeat;
    const x = this.vertexX;
    const y = this.vertexY;
    const fade = 1 - this.dissolve;
    const ember = '#ffb27a';
    const base = (0.12 + 0.1 * this.flicker) * fade;
    this.glow(x, y, 9, ember, base * bril);
    ctx.fillStyle = rgba('#ffe2c8', (0.35 + 0.3 * this.flicker) * fade);
    ctx.beginPath();
    ctx.arc(x, y, 1.1, 0, TAU);
    ctx.fill();
    if (heat > 0.01) {
      this.glow(x, y, 18 + 40 * heat, ember, 0.5 * heat * bril * fade);
      // Six quadratic filament wisps.
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const s = this.wispSeeds[i];
        const ang = s * TAU + Math.sin(this.time * (1.3 + s) + i) * 0.4;
        const len = (26 + 34 * s) * heat;
        const cx1 = x + Math.cos(ang + 0.6) * len * 0.5;
        const cy1 = y + Math.sin(ang + 0.6) * len * 0.5;
        const ex = x + Math.cos(ang) * len;
        const ey = y + Math.sin(ang) * len;
        const g = ctx.createLinearGradient(x, y, ex, ey);
        g.addColorStop(0, rgba(ember, 0.6 * heat * fade));
        g.addColorStop(1, rgba(ember, 0));
        ctx.strokeStyle = g;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(cx1, cy1, ex, ey);
        ctx.stroke();
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Segment intersection (window crossings)                             */
/* ------------------------------------------------------------------ */

function segHit(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): [number, number, number] | null {
  const r1x = bx - ax;
  const r1y = by - ay;
  const r2x = dx - cx;
  const r2y = dy - cy;
  const den = r1x * r2y - r1y * r2x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((cx - ax) * r2y - (cy - ay) * r2x) / den;
  const u = ((cx - ax) * r1y - (cy - ay) * r1x) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return [ax + r1x * t, ay + r1y * t, t];
}
