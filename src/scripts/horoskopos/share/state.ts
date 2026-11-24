/**
 * Share state: the one URL shape every Horoskopos share uses.
 *
 *   ?c=<chart>&m=<moduleId>&f=<focus>&p=<privacy>      (+ c2 for a second chart)
 *
 * `c` and `c2` are chart codes (codec.ts). `m` names a registered module
 * (registry.ts). `f` is that module's focus: a body, an aspect pair, a
 * house number, a glossary term, a trail of steps. `p` is the privacy level
 * the link was made at; the chart code is already cut to it, and a reader
 * also applies it on the way in, so a link edited to say `full` shows no
 * more than its chart code holds.
 *
 * The same query string is read by the engine page, the embed route, the
 * Worker (unfurl tags, the card image) and the oEmbed endpoint.
 */
import { PRIVACY, applyPrivacy, decodeChart, privacyOf, type ChartOutput, type Privacy } from './codec.ts';

export const SHARE_PATH = '/gallery/horoskopos/';
export const EMBED_PATH = '/horoskopos/embed/';
export const OG_PATH = '/api/horoskopos/card.png';
export const OEMBED_PATH = '/api/horoskopos/oembed';
export const SITE_ORIGIN = 'https://iamwilhelm.com';

export interface ShareState {
  /** Chart code, absent for a module that needs no chart (the daily read, a glossary entry). */
  c?: string;
  /** Second chart: synastry views, an aspect between two people. */
  c2?: string;
  m: string;
  f: string;
  p: Privacy;
}

const SAFE = /^[A-Za-z0-9._~+ -]{0,240}$/;
const CODE = /^[A-Za-z0-9_-]{4,400}$/;
const ID = /^[a-z]{2,20}$/;

/** Read share state from a query string. Null when the query is not a share (no module named) or is malformed. */
export function parseShare(search: string | URLSearchParams): ShareState | null {
  const q = typeof search === 'string' ? new URLSearchParams(search) : search;
  const m = q.get('m');
  if (!m || !ID.test(m)) return null;
  const f = q.get('f') ?? '';
  if (!SAFE.test(f)) return null;
  const c = q.get('c') ?? undefined, c2 = q.get('c2') ?? undefined;
  if ((c != null && !CODE.test(c)) || (c2 != null && !CODE.test(c2)) || (c2 != null && c == null)) return null;
  const p = q.get('p') as Privacy | null;
  return { ...(c ? { c } : {}), ...(c2 ? { c2 } : {}), m, f, p: p && PRIVACY.includes(p) ? p : 'full' };
}

/** The query string for a share, in a fixed order so equal shares give equal strings (the card cache keys on it). */
export function shareQuery(s: ShareState): string {
  const q = new URLSearchParams();
  if (s.c) q.set('c', s.c);
  if (s.c2) q.set('c2', s.c2);
  q.set('m', s.m);
  if (s.f) q.set('f', s.f);
  q.set('p', s.p);
  return q.toString();
}

export const shareUrl = (s: ShareState, origin = SITE_ORIGIN) => `${origin}${SHARE_PATH}?${shareQuery(s)}`;

export type EmbedSize = 'auto' | 'square' | 'tall' | 'wide';
export interface EmbedOptions { size: EmbedSize; theme: 'dark' | 'light' }
export const EMBED_SIZES: Record<EmbedSize, { label: string; w: number | null; h: number | null }> = {
  auto: { label: 'Responsive', w: null, h: null },
  square: { label: 'Square', w: 480, h: 480 },
  tall: { label: 'Tall', w: 400, h: 640 },
  wide: { label: 'Wide', w: 720, h: 405 },
};

export function embedUrl(s: ShareState, o: Partial<EmbedOptions> = {}, origin = SITE_ORIGIN): string {
  const q = new URLSearchParams(shareQuery(s));
  if (o.size && o.size !== 'auto') q.set('size', o.size);
  if (o.theme && o.theme !== 'dark') q.set('theme', o.theme);
  return `${origin}${EMBED_PATH}?${q.toString()}`;
}

/** The charts a share carries, decoded and held to its stated level. Throws when a code does not decode. */
export function chartsOf(s: ShareState): ChartOutput[] {
  const out: ChartOutput[] = [];
  for (const code of [s.c, s.c2]) {
    if (!code) continue;
    const ch = decodeChart(code);
    const rank = (p: Privacy) => PRIVACY.indexOf(p);
    out.push(rank(s.p) > rank(privacyOf(ch)) ? applyPrivacy(ch, s.p) : ch);
  }
  return out;
}

/** The level a share actually shows: what it says, or sign level when its charts hold no more than signs. */
export function levelOf(s: ShareState, charts: ChartOutput[]): Privacy {
  let i = PRIVACY.indexOf(s.p);
  for (const ch of charts) if (ch.signOnly) i = Math.max(i, 1);
  return PRIVACY[i];
}

/* A trail of journey steps, as a focus. The engine names a step by type and key ("pt" + "0:venus",
   "link" + "0:venus|0:mars"); in a link ":" travels as "." and "|" as "_", and steps are joined by "~".
   A first part "v.<view>" names the engine view the trail was walked in, when it was not the wheel. */
export interface Step { t: string; k: string }
export function stepsToFocus(steps: Step[], view = 'wheel'): string {
  const parts = steps.map((s) => `${s.t}.${s.k.replace(/:/g, '.').replace(/\|/g, '_')}`);
  return (view && view !== 'wheel' ? [`v.${view}`, ...parts] : parts).join('~');
}
export function focusToSteps(f: string): Step[] {
  const out: Step[] = [];
  for (const part of f.split('~')) {
    const i = part.indexOf('.');
    if (i < 1 || part.slice(0, i) === 'v') continue;
    out.push({ t: part.slice(0, i), k: part.slice(i + 1).replace(/\./g, ':').replace(/_/g, '|') });
  }
  return out.slice(-14);
}
export function focusView(f: string): string {
  const m = f.match(/^v\.(wheel|biwheel|web|grid)(~|$)/);
  return m ? m[1] : '';
}
