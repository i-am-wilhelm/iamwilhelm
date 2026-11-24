/**
 * The bridge between the share system and the Horoskopos engine
 * (public/machines/natal/engine.js). The engine hands out one object,
 * `self.__natal`; this file types the part of it the share system uses and
 * converts between the engine's cast chart and the codec's computed output.
 *
 * fromEngineChart is the one place a cast chart is read for sharing. It
 * copies positions, angles and cusps and nothing else: the cast chart's
 * Julian day, latitude, longitude and library entry stay behind.
 */
import { MINOR, PLANETS, type BodyId, type ChartOutput, type HouseSystem } from './codec.ts';

export interface EngineBody { lon: number; lat?: number; spd: number; retro: boolean; house?: number; minor?: boolean }
export interface EngineChart {
  name: string;
  fixed?: boolean;
  signOnly?: boolean;
  rising?: number | null;
  culm?: number | null;
  timeKnown: boolean;
  bodies: Record<string, EngineBody>;
  nn: number;
  lilith: number;
  asc: number | null;
  mc: number | null;
  vertex: number | null;
  cusps: number[] | null;
  hsys: HouseSystem | null;
  day?: boolean;
  lots?: { fortune: number; spirit: number; eros: number };
  minorOk: boolean;
  meta: Record<string, unknown> | null;
}
export interface EngineLink { a: string; b: string; ia: number; ib: number; kind: string; tone: 'flow' | 'grind' | 'fuse'; off: number; orb: number; w: number; key: string; applying?: boolean }
export interface Stop { t: string; k: string }
export interface StopCard { col: string; gl: string; eb: string; title: string; sub?: string; lesson?: string; here?: string; q?: string }
export interface Draw2D { [k: string]: unknown }

/** The engine's API, as far as the share system reaches into it. */
export interface Natal {
  LIVE: boolean;
  S: { charts: EngineChart[]; view: string; tab: string; trail: Stop[]; at: number; focus: number; still: boolean; specs: unknown[]; slotOf(ch: EngineChart): number; foc?: unknown };
  C: { SIGNS: string[]; PLANETS: string[]; MINOR: string[]; norm(x: number): number; houseOf(lon: number, cusps: number[]): number; signOf(lon: number): { sign: number; name: string; deg: number; min: number } };
  D: { PG: Record<string, string>; ZG: string[]; PT: Record<string, { n: string; g: string; k: string }>; PCOL: Record<string, string>; COL: Record<string, string>; TXT: Record<string, string> };
  FONT: { mono: string; serif: string; dpr?: number };
  charts(): EngineChart[];
  links(): EngineLink[];
  dav(): EngineChart | null;
  loadShared(charts: EngineChart[], o?: { view?: string; tab?: string; trail?: Stop[] }): void;
  withShared<T>(charts: EngineChart[], o: { view?: string; trail?: Stop[]; foc?: unknown } | null, fn: () => T): T;
  paint(ctx: unknown, w: number, h: number, t: number, font?: { mono: string; serif: string; dpr?: number }): void;
  go(t: string, k: string, src?: string): void;
  goTo(v: string): void;
  syncJourney(): void;
  renderAll(): void;
  renderPanel(): void;
  redraw(): void;
  shortName(ch: EngineChart): string;
  keyOf(ch: EngineChart): { t: number; name: string; from: string };
  sentence(link: EngineLink, charts: EngineChart[]): string;
  theme(a: string, b: string): string;
  says(id: string, link: EngineLink): string;
  gname(id: string): string;
  termOf(key: string): [string, string, string, string] | undefined;
  crumb(s: Stop): string;
  keyCond(ch: EngineChart, ruler: string): { out: string[]; score: number; v: number };
  GOD: Record<string, string>;
  OPEN: Record<string, string[]>;
  EXTRA: string[][];
  HNAME: string[][];
  HASK: string[];
  RULER: string[];
  NOTE: string[];
  INTERVAL: string[];
  ASYM: Record<string, string>;
  GL: Record<string, [string, string, string, string]>;
  TERMX: Record<string, [string, string, string, string]>;
  CARDS: Record<string, (k: string, links: EngineLink[]) => StopCard | null>;
  html: {
    placements(ch: EngineChart): string;
    reading(ch: EngineChart): string;
    housesRead(ch: EngineChart): string;
    music(ch: EngineChart): string;
    daily(ch: EngineChart | null): string;
  };
}

const norm = (x: number) => ((x % 360) + 360) % 360;
function houseOf(lon: number, cusps: number[]): number {
  for (let i = 0; i < 12; i++) { const a = cusps[i], b = cusps[(i + 1) % 12]; if (norm(lon - a) < norm(b - a)) return i + 1; }
  return 12;
}

/** A cast chart's computed output. `name` overrides the label (a Davison chart names its pair). */
export function fromEngineChart(ch: EngineChart, name?: string): ChartOutput {
  const meta = ch.meta || {};
  const bodies: ChartOutput['bodies'] = {};
  const ids: BodyId[] = [...PLANETS, ...(ch.minorOk ? MINOR : [])];
  for (const id of ids) bodies[id] = { lon: ch.bodies[id].lon, spd: ch.bodies[id].spd };
  const timed = ch.timeKnown && ch.cusps != null && ch.asc != null && ch.mc != null && ch.vertex != null && ch.hsys != null;
  let label = name ?? ch.name ?? '';
  if (name == null) {
    if (meta.davison) label = 'Davison';
    else if (meta.now) label = 'A moment’s sky';
    else if (meta.src === 'self' && /^Your chart$/i.test(label)) label = '';
  }
  return {
    name: label,
    davison: !!meta.davison,
    signOnly: !!ch.signOnly,
    bodies,
    minor: !!ch.minorOk,
    nn: ch.nn,
    lilith: ch.lilith,
    houses: timed ? { asc: ch.asc!, mc: ch.mc!, vertex: ch.vertex!, hsys: ch.hsys!, cusps: ch.cusps!.slice() } : null,
    rising: ch.signOnly ? ch.rising ?? null : null,
    culm: ch.signOnly ? ch.culm ?? null : null,
  };
}

/** Computed output back to a chart the engine can read. It is marked fixed: the engine never recasts it. */
export function toEngineChart(out: ChartOutput): EngineChart {
  const h = out.houses;
  const bodies: Record<string, EngineBody> = {};
  for (const id of [...PLANETS, ...(out.minor ? MINOR : [])]) {
    const b = out.bodies[id]!;
    bodies[id] = { lon: b.lon, lat: 0, spd: b.spd, retro: b.spd < 0, ...(MINOR.includes(id as (typeof MINOR)[number]) ? { minor: true } : {}), ...(h ? { house: houseOf(b.lon, h.cusps) } : {}) };
  }
  const ch: EngineChart = {
    name: out.name || (out.davison ? 'Davison' : 'A shared chart'),
    fixed: true,
    signOnly: out.signOnly,
    rising: out.rising,
    culm: out.culm,
    timeKnown: !!h,
    bodies,
    nn: out.nn,
    lilith: out.lilith,
    asc: h ? h.asc : null,
    mc: h ? h.mc : null,
    vertex: h ? h.vertex : null,
    cusps: h ? h.cusps.slice() : null,
    hsys: h ? h.hsys : null,
    minorOk: out.minor,
    meta: { id: 'shared', shared: true, davison: out.davison, named: !!out.name },
  };
  if (h) {
    /* Sect and the three lots follow from the angles and the lights, as the engine works them out when it casts. */
    const sun = bodies.sun.lon, moon = bodies.moon.lon, ven = bodies.venus.lon;
    ch.day = norm(sun - h.asc) >= 180;
    const fortune = norm(ch.day ? h.asc + moon - sun : h.asc + sun - moon), spirit = norm(ch.day ? h.asc + sun - moon : h.asc + moon - sun);
    ch.lots = { fortune, spirit, eros: norm(ch.day ? h.asc + ven - spirit : h.asc + spirit - ven) };
  }
  return ch;
}
