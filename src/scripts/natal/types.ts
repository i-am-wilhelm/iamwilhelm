/**
 * Natal engine data contract. The engine (engine.ts) knows nothing about
 * whose chart it draws — any object satisfying ChartData renders. These
 * types are re-exported from engine.ts and are the stable interface for the
 * later public chart tool and the music-engine sibling.
 *
 * Longitudes are ecliptic degrees 0–360 (0 = 0° Aries). Speeds are degrees
 * per day (absolute value; direction lives in `retro`).
 */

export interface ChartBody {
  lon: number;
  spd: number;
  retro: boolean;
}

/** Normalized ellipse in portrait-crop space (0..1 across the disc). */
export interface EyeMask {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

export interface PortraitConfig {
  /** Image URL — square source expected. */
  src: string;
  /**
   * Square crop of the source that fills the disc: centre and half-size in
   * normalized source coordinates (0..1).
   */
  crop: { cx: number; cy: number; half: number };
  /** Where the flesh layer floors at 0.9 regardless of breath or tide. */
  eyes: EyeMask[];
}

export interface ChartData {
  mc: number;
  asc: number;
  vertex: number;
  house12cusp: number;
  /** Twelve house cusps, index 0 = cusp of house 1 (the Ascendant). */
  cusps: number[];
  bodies: Record<string, ChartBody>;
  /** Black Moon Lilith — rendered as a lens, never an orb. */
  lilith: number;
  /** Optional birth metadata (derived config like keyDate reads this). */
  birth?: { year: number; month: number; day: number; hourUT: number; lat: number; lon: number };
  portrait?: PortraitConfig;
}

/* ------------------------------------------------------------------ */
/* Portrait layer contract (engine ↔ dioscuri)                         */
/* ------------------------------------------------------------------ */

export interface PortraitDrawInput {
  /** Knock envelope 0..1 from the clock (1 at the knock). */
  knockGlow: number;
  /** Milliseconds since the last knock. */
  sinceKnockMs: number;
  /** Engine time in seconds (drives the 90 s tide). */
  timeS: number;
  /** Scroll-driven signal share 0..1 (1 = fully the glyph twin). */
  share: number;
  /** Rest alpha of the signal layer (tinker dial). */
  signalRest: number;
  /** Knock-surge alpha of the signal layer (tinker dial). */
  signalSurge: number;
  /** Tide period in seconds. */
  tidePeriod: number;
  /** When true: no breath, no tide, no tick — one lit frame. */
  still: boolean;
}

export interface PortraitLayer {
  readonly ready: boolean;
  /** (Re)build cached bitmaps for a disc of CSS radius r at device ratio dpr. */
  prepare(rCss: number, dpr: number): void;
  draw(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, s: PortraitDrawInput): void;
  /** Excitation: a streak through normalized disc point (nx,ny) along (dx,dy). */
  stampStreak(nx: number, ny: number, dx: number, dy: number, color: string, strength: number): void;
  /** Excitation: a radial bloom at normalized disc point (nx,ny). */
  stampRadial(nx: number, ny: number, color: string, strength: number): void;
  /** Per-frame decay of the excitation buffer. */
  tick(dt: number): void;
  setInverse(on: boolean): void;
  /** Debug: draw the luminance→glyph ramp actually in use. */
  drawAudit(ctx: CanvasRenderingContext2D, x: number, y: number): void;
}
