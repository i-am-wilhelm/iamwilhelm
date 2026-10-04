/**
 * Aspect computation — pure functions over ChartData. The engine renders
 * whatever this returns; nothing here is Michael-specific.
 *
 * Rules (handoff §4):
 *   - Mercury is excluded from the web — his aspects ride the Sun's (cazimi).
 *   - Orbs: conj 8, sextile 5, square 7, trine 7, opposition 8. Sun–Moon pair
 *     +5; any other pair containing a luminary +2. Weight w = 1 − off/orb.
 *   - Sun–Moon opposition is the spine; render weight max(w, 0.75).
 *   - moon/vesta/nn trines are the circuit, excluded from generic beams.
 */
import type { ChartData } from './types';

export type AspectKind = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';
export type AspectRole = 'spine' | 'circuit' | 'conjunction' | 'beam';

export interface Aspect {
  a: string;
  b: string;
  kind: AspectKind;
  /** Exact angle of the aspect (0/60/90/120/180). */
  angle: number;
  /** Degrees off exact. */
  off: number;
  /** Orb allowed for this pair. */
  orb: number;
  /** 1 − off/orb, with the spine floored at 0.75. */
  w: number;
  role: AspectRole;
}

export const ASPECT_ANGLE: Record<AspectKind, number> = {
  conjunction: 0,
  sextile: 60,
  square: 90,
  trine: 120,
  opposition: 180,
};

export const BASE_ORB: Record<AspectKind, number> = {
  conjunction: 8,
  sextile: 5,
  square: 7,
  trine: 7,
  opposition: 8,
};

export interface AspectOptions {
  /** Bodies left out of the web entirely. Default ['mercury']. */
  exclude?: string[];
  /** Bodies that widen orbs. Default ['sun', 'moon']. */
  luminaries?: string[];
  /** The pair whose opposition is the spine. Default ['sun', 'moon']. */
  spine?: [string, string];
  /** Bodies whose mutual trines form the circuit. Default moon/vesta/nn. */
  circuit?: string[];
}

/** Shortest angular separation between two longitudes, 0–180. */
export function separation(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

export function computeAspects(chart: ChartData, options: AspectOptions = {}): Aspect[] {
  const exclude = new Set(options.exclude ?? ['mercury']);
  const luminaries = new Set(options.luminaries ?? ['sun', 'moon']);
  const spine = options.spine ?? ['sun', 'moon'];
  const circuit = new Set(options.circuit ?? ['moon', 'vesta', 'nn']);

  const ids = Object.keys(chart.bodies).filter((id) => !exclude.has(id));
  const out: Aspect[] = [];

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i];
      const b = ids[j];
      const sep = separation(chart.bodies[a].lon, chart.bodies[b].lon);
      const isSunMoon = luminaries.has(a) && luminaries.has(b);
      const hasLum = luminaries.has(a) || luminaries.has(b);
      const bonus = isSunMoon ? 5 : hasLum ? 2 : 0;

      let best: Aspect | null = null;
      for (const kind of Object.keys(ASPECT_ANGLE) as AspectKind[]) {
        const orb = BASE_ORB[kind] + bonus;
        const off = Math.abs(sep - ASPECT_ANGLE[kind]);
        if (off >= orb) continue;
        if (!best || off < best.off) {
          best = { a, b, kind, angle: ASPECT_ANGLE[kind], off, orb, w: 1 - off / orb, role: 'beam' };
        }
      }
      if (!best) continue;

      const pair = new Set([a, b]);
      if (best.kind === 'opposition' && pair.has(spine[0]) && pair.has(spine[1])) {
        best.role = 'spine';
        best.w = Math.max(best.w, 0.75); // the 12° orb is birth timing, never faintness
      } else if (best.kind === 'trine' && circuit.has(a) && circuit.has(b)) {
        best.role = 'circuit';
      } else if (best.kind === 'conjunction') {
        best.role = 'conjunction';
      }
      out.push(best);
    }
  }
  return out;
}

/** Every body that takes part in at least one aspect. */
export function connectedBodies(aspects: Aspect[]): string[] {
  const s = new Set<string>();
  for (const x of aspects) {
    s.add(x.a);
    s.add(x.b);
  }
  return Array.from(s);
}
