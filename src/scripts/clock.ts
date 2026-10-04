/**
 * THE KNOCK — site-wide 7/8 clock, the visual sibling of the orchestra pit's
 * MembraneSynth knock (src/scripts/audio/engine.ts).
 *
 * One bar is seven eighths grouped 2+2+3. Accents fall on eighth indices
 * 0 / 2 / 4 (the group boundaries); index 0 is the knock proper. The hero,
 * future sections and the hidden music layer all read this one clock.
 *
 * Two ways to listen:
 *   - `now()` — pure read of the current state; the caller owns its own rAF
 *     (the natal hero does this: one loop, no second ticker).
 *   - `subscribe(cb)` — for subsystems without a loop; a lightweight internal
 *     rAF runs only while subscribers exist and the tab is visible.
 * Either path performs the accent detection, so `iw:knock` is emitted
 * exactly once per accented eighth no matter how many readers there are.
 *
 * Tempo: defaults to tokens.meter.eighthMs (300 ms — the tuned prototype
 * value). The Tone transport runs at meter.bpm (84, eighth ≈ 357 ms);
 * unifying the two is a documented follow-up. `setEighthMs` keeps the bar
 * phase continuous so a live tempo change never jumps.
 */
import { meter } from '../design/tokens';
import { emit } from './events';

export type AccentIndex = 0 | 2 | 4;

export interface ClockState {
  /** 0..1 across the bar. */
  barPhase: number;
  /** Eighth index 0..6 within the bar. */
  eighth: number;
  /** 0..1 within the current eighth. */
  eighthPhase: number;
  /** Envelope from the last knock (index 0): 1 at the knock, ~0 by bar end. */
  knockGlow: number;
  /** Envelope from the last accent of any index. */
  accentGlow: number;
  /** Which accent fired last. */
  lastAccent: AccentIndex;
  /** Increments on every accent — compare across reads to catch beats. */
  accentSerial: number;
  /** Milliseconds since the last knock. */
  sinceKnockMs: number;
  /** Bars elapsed since the clock began. */
  bar: number;
  eighthMs: number;
}

const EIGHTHS_PER_BAR = meter.beatsPerBar; // 7
const ACCENTS: ReadonlySet<number> = new Set([0, 2, 4]);

let eighthMs: number = meter.eighthMs;
let origin = -1; // performance.now() at absolute eighth 0
let lastAbsEighth = -1;
let knockAt = -Infinity;
let accentAt = -Infinity;
let lastAccent: AccentIndex = 0;
let accentSerial = 0;

const state: ClockState = {
  barPhase: 0,
  eighth: 0,
  eighthPhase: 0,
  knockGlow: 0,
  accentGlow: 0,
  lastAccent: 0,
  accentSerial: 0,
  sinceKnockMs: Infinity,
  bar: 0,
  eighthMs,
};

function ensureOrigin(t: number) {
  if (origin < 0) {
    origin = t;
    lastAbsEighth = -1; // so the first read fires the opening knock
  }
}

/** Read (and advance) the clock. Safe to call many times per frame. */
export function now(t: number = performance.now()): ClockState {
  ensureOrigin(t);
  const pos = (t - origin) / eighthMs; // absolute eighths since origin
  const abs = Math.floor(pos);

  // Walk every eighth boundary crossed since the last read so a slow frame
  // never swallows an accent.
  if (abs > lastAbsEighth) {
    const from = Math.max(lastAbsEighth + 1, abs - EIGHTHS_PER_BAR);
    for (let k = from; k <= abs; k++) {
      const idx = k % EIGHTHS_PER_BAR;
      if (!ACCENTS.has(idx)) continue;
      const at = origin + k * eighthMs;
      accentAt = at;
      lastAccent = idx as AccentIndex;
      accentSerial++;
      if (idx === 0) knockAt = at;
      emit('iw:knock', { index: idx as AccentIndex, barPhase: idx / EIGHTHS_PER_BAR });
    }
    lastAbsEighth = abs;
  }

  const barMs = eighthMs * EIGHTHS_PER_BAR;
  state.bar = Math.floor(pos / EIGHTHS_PER_BAR);
  state.eighth = ((abs % EIGHTHS_PER_BAR) + EIGHTHS_PER_BAR) % EIGHTHS_PER_BAR;
  state.eighthPhase = pos - abs;
  state.barPhase = (pos / EIGHTHS_PER_BAR) % 1;
  state.sinceKnockMs = t - knockAt;
  // Exponential decay tuned so the knock has faded to ~5% by the next one.
  state.knockGlow = Math.exp(-state.sinceKnockMs / (barMs * 0.33));
  state.accentGlow = Math.exp(-(t - accentAt) / (eighthMs * 0.9));
  state.lastAccent = lastAccent;
  state.accentSerial = accentSerial;
  state.eighthMs = eighthMs;
  return state;
}

/** Change tempo without a phase jump. */
export function setEighthMs(ms: number) {
  const t = performance.now();
  ensureOrigin(t);
  const pos = (t - origin) / eighthMs;
  eighthMs = Math.max(60, ms);
  origin = t - pos * eighthMs;
}

export function getEighthMs(): number {
  return eighthMs;
}

/* ------------------------------------------------------------------ */
/* Subscription loop (only for listeners without their own rAF)        */
/* ------------------------------------------------------------------ */

type Listener = (s: ClockState) => void;
const listeners = new Set<Listener>();
let raf = 0;

function loop(t: number) {
  raf = 0;
  if (listeners.size === 0 || document.hidden) return;
  const s = now(t);
  listeners.forEach((cb) => cb(s));
  raf = requestAnimationFrame(loop);
}

function wake() {
  if (!raf && listeners.size && !document.hidden) raf = requestAnimationFrame(loop);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', wake);
}

export function subscribe(cb: Listener): () => void {
  listeners.add(cb);
  wake();
  return () => {
    listeners.delete(cb);
  };
}
