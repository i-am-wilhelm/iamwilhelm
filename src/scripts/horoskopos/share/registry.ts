/**
 * The module registry: every major piece of Horoskopos that can be shared.
 *
 * One entry per module. An entry declares its id and title, how to derive
 * its content from decoded charts plus a focus, and three renderers:
 *   full   the existing in-engine view: go there, and hand back the element
 *   embed  the compact view the embed route shows
 *   card   the layout data an image card is drawn from
 * Cards (the browser canvas and the Worker's image), deep links, embeds and
 * unfurl tags all read this one table, so a module is shareable everywhere
 * the moment it is registered.
 *
 * Content is always derived from charts that came out of the codec, never
 * from a chart as cast, and always at the engine's default tuning, inside
 * `withShared`, which puts the visitor's own table back untouched.
 *
 * `deep: true` marks a deep reading. It shares as a teaser only (a line or
 * two and a pointer back). That is the paid-tier gate; it is a flag here so
 * it holds before payments exist. See DEEP_GATE.
 */
import type { Privacy } from './codec.ts';
import type { EngineChart, EngineLink, Natal, Stop } from './engine.ts';
import { focusToSteps, focusView } from './state.ts';
import { blocks, cap, esc, plain, pullLines, sentences, strip, type Block, type Line } from './text.ts';

/** The paid-tier gate. While true, modules flagged `deep` share as teasers. */
export const DEEP_GATE = true;
export const READ_MORE = 'Read the rest at iamwilhelm.com';
export const UNLOCK = 'The full reading opens at iamwilhelm.com';

export interface Glyph { path?: string; text?: string; svg48?: string }
export interface Row { glyph?: Glyph; color?: string; name: string; value: string; note?: string }
export type Layout = 'voice' | 'duo' | 'table' | 'chart';

export interface Content {
  module: string;
  focus: string;
  kicker: string;
  title: string;
  /** A name or epithet in the original, set beside the title. */
  greek?: string;
  sub?: string;
  color: string;
  glyph?: Glyph;
  glyph2?: Glyph;
  joiner?: string;
  /** The reading as plain paragraphs. */
  paras: string[];
  /** Lines that can be pulled onto a card, strongest first. */
  lines: Line[];
  rows?: Row[];
  /** The journey so far, for a trail step. */
  trail?: string[];
  /** Draw the staged chart view. */
  chart?: boolean;
  /** Who speaks, for the attribution. */
  voice: string;
  /** The chart's label; empty when it has none or the level hides it. */
  owner: string;
  deep: boolean;
}

export interface CardData {
  layout: Layout;
  kicker: string;
  title: string;
  greek?: string;
  sub?: string;
  color: string;
  glyph?: Glyph;
  glyph2?: Glyph;
  joiner?: string;
  line: Line | null;
  /** The pointer back, when the card shows less than the reading holds. */
  more: string;
  rows?: Row[];
  trail?: string[];
  chart: boolean;
  attribution: string;
}

export interface Ctx { api: Natal; charts: EngineChart[]; level: Privacy }
export interface StageOptions { view?: string; trail?: Stop[] }

export interface Module {
  id: string;
  title: string;
  /** One line for the share panel's module list. */
  blurb: string;
  /** How many charts it needs: 0 (the daily read and glossary can stand alone), 1 or 2. */
  charts: 0 | 1 | 2;
  /** Needs degrees: not available from a chart shared at sign level. */
  degrees?: boolean;
  /** A deep reading: shares as a teaser while DEEP_GATE holds. */
  deep?: boolean;
  layout: Layout;
  /** The engine view and trail to stage for this focus, given how many charts are on the table. */
  stage(focus: string, n: number): StageOptions;
  /** Light the focus on the staged chart (sets what the engine draws bright). */
  light?(api: Natal, focus: string): void;
  derive(ctx: Ctx, focus: string): Content | null;
  /** The existing in-engine view. Runs on the engine page only: goes to the module and returns its element. */
  full(api: Natal, focus: string, doc: Document): Element | null;
  embed(c: Content): string;
  card(c: Content, pick?: number): CardData;
}

/* ---------------- shared pieces ---------------- */

const PLANETS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
const EXTRAS = ['lilith', 'nn', 'sn', 'chiron', 'ceres', 'pallas', 'juno', 'vesta'];
const ICHOR = '#f2c56b';
const owner = (ch?: EngineChart) => (ch && ch.meta && ch.meta.named ? ch.name : '');
const sg = (lon: number) => Math.floor((((lon % 360) + 360) % 360) / 30);
const glyphOf = (api: Natal, id: string): Glyph => (api.D.PG[id === 'sn' ? 'nn' : id] ? { path: api.D.PG[id === 'sn' ? 'nn' : id] } : { text: api.D.TXT[id] || id.slice(0, 2).toUpperCase() });
const god = (api: Natal, id: string) => cap(api.gname(id));
/** A god's name inside a phrase: "the Midheaven" keeps its small t, and loses the article after a possessive. */
const named = (api: Natal, id: string, owned = false) => { const g = api.gname(id); return /^the /.test(g) ? (owned ? g.slice(4) : g) : cap(g); };

/** "12°04′ Pisces", or the sign alone at sign level. */
function where(api: Natal, ch: EngineChart, lon: number): string {
  const s = api.C.signOf(lon);
  return ch.signOnly ? s.name : `${s.deg}°${String(s.min).padStart(2, '0')}′ ${s.name}`;
}

/** The three placements people name first, with the gods' own names. */
function bigThree(api: Natal, ch: EngineChart): string {
  const S = api.C.SIGNS, rise = ch.timeKnown && ch.asc != null ? S[sg(ch.asc)] : ch.rising != null ? S[ch.rising] : '';
  return `Helios in ${S[sg(ch.bodies.sun.lon)]}, Selene in ${S[sg(ch.bodies.moon.lon)]}${rise ? `, ${rise} rising` : ''}.`;
}

function readingBlock(api: Natal, ch: EngineChart, key: string, value: string): Block | undefined {
  return blocks(api.html.reading(ch)).find((b) => b.attrs[key] === value);
}

function attribution(c: Content): string {
  const of = c.owner ? `in ${c.owner}’s chart` : '';
  if (c.voice && of) return `${c.voice}, ${of}`;
  return c.voice || (c.owner ? `${c.owner}’s chart` : '');
}

/** A card from content: the picked line, and a pointer back when the reading holds more. */
function cardOf(layout: Layout) {
  return (c: Content, pick = 0): CardData => {
    const line = c.lines.length ? c.lines[Math.max(0, Math.min(c.lines.length - 1, pick))] : null;
    const whole = c.paras.join(' ');
    const more = c.deep ? UNLOCK : layout === 'voice' || layout === 'duo' ? (line && whole.length > line.text.length + 8 ? READ_MORE : '') : c.paras.length > 1 ? READ_MORE : '';
    /* A card spells out the signs a text font may lack (aspect marks, sharps and flats); the aspect mark itself is drawn. */
    return {
      layout, kicker: plain(c.kicker), title: plain(c.title), greek: c.greek, sub: c.sub ? plain(c.sub) : undefined, color: c.color, glyph: c.glyph, glyph2: c.glyph2, joiner: c.joiner,
      line: line ? { ...line, text: plain(line.text) } : null, more, rows: c.rows && c.rows.map((r) => ({ ...r, value: plain(r.value), note: r.note ? plain(r.note) : r.note })), trail: c.trail && c.trail.map(plain), chart: !!c.chart,
      attribution: line && line.by ? (c.owner ? `${line.by}, in ${c.owner}’s chart` : line.by) : attribution(c),
    };
  };
}

/* The compact view. Plain markup under `.hk`; the embed route styles it (src/pages/horoskopos/embed.astro). */
const glyphHtml = (g: Glyph | undefined, color: string) =>
  !g ? '' : g.path ? `<svg class="hk-g" viewBox="0 0 24 24" aria-hidden="true" style="color:${esc(color)}"><path d="${esc(g.path)}"/></svg>`
    : g.svg48 ? `<svg class="hk-g" viewBox="0 0 48 48" aria-hidden="true" style="color:${esc(color)}">${g.svg48}</svg>`
    : `<span class="hk-g hk-gt" style="color:${esc(color)}">${esc(g.text || '')}</span>`;

function embedHead(c: Content): string {
  const glyphs = c.glyph2 ? `${glyphHtml(c.glyph, c.color)}<span class="hk-j" style="color:${esc(c.color)}">${esc(c.joiner || '')}</span>${glyphHtml(c.glyph2, c.color)}` : glyphHtml(c.glyph, c.color);
  return `<header class="hk-h">${glyphs ? `<div class="hk-gs">${glyphs}</div>` : ''}<div><p class="hk-k" style="color:${esc(c.color)}">${esc(c.kicker)}</p><h1>${esc(c.title)}${c.greek ? ` <span class="hk-gk" lang="grc">${esc(c.greek)}</span>` : ''}</h1>${c.sub ? `<p class="hk-s">${esc(c.sub)}</p>` : ''}</div></header>`
    + (c.trail && c.trail.length ? `<p class="hk-t">${['Start', ...c.trail].map(esc).join(' <span aria-hidden="true">›</span> ')}</p>` : '');
}

function embedBody(c: Content): string {
  if (c.deep) {
    const tease = c.lines.slice(0, 1).map((l) => l.text).concat(sentences(c.paras[0] || '').slice(0, 1)).filter((t, i, a) => a.indexOf(t) === i).slice(0, 2);
    return tease.map((t) => `<p>${esc(t)}</p>`).join('') + `<p class="hk-more">${esc(UNLOCK)}</p>`;
  }
  return c.paras.map((p) => `<p>${esc(p)}</p>`).join('');
}

const embedReading = (c: Content) => `<article class="hk hk-read" style="--c:${esc(c.color)}">${embedHead(c)}<div class="hk-b">${embedBody(c)}</div></article>`;
const embedTable = (c: Content) =>
  `<article class="hk hk-table" style="--c:${esc(c.color)}">${embedHead(c)}<table><tbody>${(c.rows || []).map((r) => `<tr><th>${glyphHtml(r.glyph, r.color || c.color)}${esc(r.name)}</th><td>${esc(r.value)}</td><td>${esc(r.note || '')}</td></tr>`).join('')}</tbody></table>${c.paras.length ? `<div class="hk-b">${c.paras.map((p) => `<p>${esc(p)}</p>`).join('')}</div>` : ''}</article>`;
const embedChart = (c: Content) =>
  `<article class="hk hk-chart" style="--c:${esc(c.color)}">${embedHead(c)}<div class="hk-cv"><canvas data-chart role="img" aria-label="${esc(c.title)}: ${esc(c.kicker)}"></canvas></div><div class="hk-b">${c.paras.map((p) => `<p>${esc(p)}</p>`).join('')}</div></article>`;

/** A reading block as content: heading, paragraphs and the lines worth pulling. */
function fromBlock(api: Natal, m: Module, focus: string, ch: EngineChart, b: Block, o: { kicker: string; title?: string; id?: string; voice?: string; color?: string }): Content {
  const voice = o.voice ?? '';
  return {
    module: m.id, focus, kicker: o.kicker, title: o.title || b.name, greek: b.ep || undefined, sub: b.note || undefined,
    color: o.color || (o.id && api.D.PCOL[o.id]) || ICHOR, glyph: o.id ? glyphOf(api, o.id) : undefined,
    paras: b.paras, lines: pullLines(b.paras, voice || undefined), voice, owner: owner(ch), deep: !!m.deep && DEEP_GATE,
  };
}

const q = (doc: Document, sel: string) => doc.querySelector(sel);
/** Turn to a tab of the reading panel, and return one element of it. */
function tab(api: Natal, doc: Document, name: string, sel: string): Element | null {
  api.S.tab = name;
  api.renderPanel();
  return q(doc, sel) || q(doc, '#tabs');
}
function view(api: Natal, doc: Document, v: string): Element | null {
  api.S.view = v;
  api.renderAll();
  return q(doc, '.ne-stage');
}

/** The aspect a focus names ("venus-mars"): inside one chart, or from the first chart to the second. */
function findLink(api: Natal, focus: string): EngineLink | undefined {
  const [a, b] = focus.split('-');
  const two = api.charts().length > 1;
  return api.links().find((L) => (two ? L.ia !== L.ib && L.a === a && L.b === b : (L.a === a && L.b === b) || (L.a === b && L.b === a)));
}
const lightLink = (api: Natal, L: EngineLink | undefined) => { if (L) api.S.foc = { link: L.key, pts: new Set(L.key.split('|')) }; };

/* ---------------- the modules ---------------- */

const wheel: Module = {
  id: 'wheel', title: 'Chart wheel', blurb: 'The whole sky as a wheel, with its lines.', charts: 1, layout: 'chart',
  stage: () => ({ view: 'wheel' }),
  light(api, focus) { if (focus) api.S.foc = { pts: new Set(['0:' + focus]) }; },
  derive({ api, charts }, focus) {
    const ch = charts[0], n = api.links().length;
    const paras = [bigThree(api, ch)];
    if (ch.signOnly) paras.push('Shared at sign level: the wheel shows signs only, with no degrees, houses or lines.');
    else paras.push(`${n} ${n === 1 ? 'line runs' : 'lines run'} between the points${ch.timeKnown ? `, on ${{ P: 'Placidus', W: 'whole sign', E: 'equal' }[ch.hsys || 'P']} houses` : '. No birth time, so no houses'}.`);
    return { module: 'wheel', focus, kicker: ch.meta && ch.meta.davison ? 'The Davison chart' : 'The chart wheel', title: owner(ch) || 'A chart', sub: paras[0], color: ICHOR, paras, lines: [{ text: paras[0] }], chart: true, voice: '', owner: owner(ch), deep: false };
  },
  full(api, focus, doc) { const el = view(api, doc, 'wheel'); if (focus && api.D.PT[focus]) api.go('pt', '0:' + focus, 'canvas'); return el; },
  embed: embedChart, card: cardOf('chart'),
};

const placements: Module = {
  id: 'placements', title: 'Placements', blurb: 'Every body by sign, degree and house.', charts: 1, layout: 'table',
  stage: () => ({ view: 'wheel' }),
  derive({ api, charts }, focus) {
    const ch = charts[0], rows: Row[] = [];
    for (const id of PLANETS) {
      const b = ch.bodies[id];
      rows.push({ glyph: glyphOf(api, id), color: api.D.PCOL[id], name: `${god(api, id)} · ${api.D.PT[id].n}`, value: where(api, ch, b.lon) + (b.retro ? ' R' : ''), note: b.house ? `house ${b.house}` : '' });
    }
    if (ch.timeKnown && ch.asc != null && ch.mc != null) rows.push({ glyph: glyphOf(api, 'asc'), name: 'Ascendant', value: where(api, ch, ch.asc), note: '' }, { glyph: glyphOf(api, 'mc'), name: 'Midheaven', value: where(api, ch, ch.mc), note: '' });
    else if (ch.signOnly && ch.rising != null && ch.culm != null) rows.push({ glyph: glyphOf(api, 'asc'), name: 'Ascendant', value: api.C.SIGNS[ch.rising], note: '' }, { glyph: glyphOf(api, 'mc'), name: 'Midheaven', value: api.C.SIGNS[ch.culm], note: '' });
    rows.push({ glyph: glyphOf(api, 'nn'), name: 'North Node', value: where(api, ch, ch.nn), note: ch.signOnly ? '' : 'mean' });
    const note = ch.signOnly ? 'Shared at sign level: signs only, with no degrees or houses.' : ch.timeKnown ? `${ch.day ? 'A day chart' : 'A night chart'}, on ${{ P: 'Placidus', W: 'whole sign', E: 'equal' }[ch.hsys || 'P']} houses.` : 'No birth time, so no Ascendant or houses.';
    return { module: 'placements', focus, kicker: 'Placements', title: owner(ch) || 'A chart', sub: bigThree(api, ch), color: ICHOR, paras: [note], lines: [{ text: bigThree(api, ch) }], rows, voice: '', owner: owner(ch), deep: false };
  },
  full(api, focus, doc) { const el = tab(api, doc, 'placements', '#body .pl-t'); const row = focus && q(doc, `#body tr[data-sel="0:${focus}"]`); if (row) row.classList.add('hot'); return el; },
  embed: embedTable, card: cardOf('table'),
};

const godModule: Module = {
  id: 'god', title: 'A god’s speech', blurb: 'One god speaking in the first person about its place in the chart.', charts: 1, layout: 'voice',
  stage: () => ({ view: 'wheel' }),
  light(api, focus) { if (PLANETS.includes(focus)) api.S.foc = { pts: new Set(['0:' + focus]) }; },
  derive({ api, charts }, focus) {
    if (!PLANETS.includes(focus) && !EXTRAS.includes(focus)) return null;
    const ch = charts[0], b = readingBlock(api, ch, 'god', focus);
    if (!b) return null;
    return fromBlock(api, godModule, focus, ch, b, { kicker: 'A god speaks', id: focus, voice: b.name });
  },
  full(api, focus, doc) { api.goTo('reading:' + focus); return q(doc, `#body [data-god="${focus}"]`); },
  embed: embedReading, card: cardOf('voice'),
};

const aspect: Module = {
  id: 'aspect', title: 'An aspect exchange', blurb: 'Two gods, the line between them, and what each says of the other.', charts: 1, degrees: true, layout: 'duo',
  stage: (_f, n) => ({ view: n > 1 ? 'biwheel' : 'wheel' }),
  light(api, focus) { lightLink(api, findLink(api, focus)); },
  derive({ api, charts }, focus) {
    const L = findLink(api, focus);
    if (!L) return null;
    const two = L.ia !== L.ib, A = charts[L.ia], B = charts[L.ib];
    const card = api.CARDS.link(L.key, api.links().slice().sort((x, y) => x.off - y.off));
    const lines: Line[] = [], paras: string[] = [];
    if (!two) {
      /* Each god's own sentence about the other: the one in its speech when the pair is among its closest, else its default. */
      const all = blocks(api.html.reading(A));
      for (const [me, other] of [[L.a, L.b], [L.b, L.a]]) {
        if (!api.OPEN[me]) continue;
        const blk = all.find((x) => x.attrs.god === me);
        const m = blk && blk.html.match(new RegExp(`<span data-with="${other}">([\\s\\S]*?)</span>`));
        const said = m ? strip(m[1]) : api.says(me, L);
        lines.push({ text: said, by: god(api, me) });
        paras.push(`${god(api, me)}: “${said}”`);
      }
    }
    const said = strip(api.sentence(L, api.charts()));
    paras.push(said);
    if (two || !lines.length) lines.push({ text: said });
    if (card && card.lesson) { paras.push(strip(card.lesson)); lines.push(...pullLines([strip(card.lesson)]).slice(0, 2)); }
    if (card && card.here) paras.push(strip(card.here).replace(/ It is the [^.]*? lines on screen\./, ''));
    const names = two ? `${api.shortName(A)}’s ${named(api, L.a, true)} ${api.ASYM[L.kind]} ${api.shortName(B)}’s ${named(api, L.b, true)}` : `${god(api, L.a)} ${api.ASYM[L.kind]} ${named(api, L.b)}`;
    return {
      module: 'aspect', focus, kicker: `A line · ${L.kind}`, title: names, sub: `${L.off.toFixed(1)}° from exact${L.applying === true ? ' · closing' : L.applying === false && !two ? ' · parting' : ''} · about ${api.theme(L.a, L.b)}`,
      color: api.D.COL[L.tone] || ICHOR, glyph: glyphOf(api, L.a), glyph2: glyphOf(api, L.b), joiner: api.ASYM[L.kind], paras, lines, voice: '', owner: two ? '' : owner(A), deep: false,
    };
  },
  full(api, focus, doc) {
    if (api.S.charts.length > 1 && api.S.view === 'wheel') { api.S.view = 'biwheel'; api.renderAll(); }
    const L = findLink(api, focus);
    if (L) api.go('link', L.key, 'list');
    return q(doc, '#card');
  },
  embed: embedReading, card: cardOf('duo'),
};

const patterns: Module = {
  id: 'patterns', title: 'The patterns', blurb: 'Crowded signs, grand trines, T-squares and the lights’ phase.', charts: 1, layout: 'voice',
  stage: () => ({ view: 'wheel' }),
  derive({ api, charts }, focus) {
    const ch = charts[0], b = readingBlock(api, ch, 'god', 'patterns');
    const blk: Block = b || { attrs: {}, name: 'The patterns', ep: '', note: '', paras: ['No crowd, grand trine or T-square stands out in this chart. Its story is told by single lines.'], html: '' };
    return fromBlock(api, patterns, focus, ch, blk, { kicker: 'Pattern speeches', title: 'The patterns' });
  },
  full(api, _f, doc) { api.goTo('reading:patterns'); return q(doc, '#body [data-god="patterns"]'); },
  embed: embedReading, card: cardOf('voice'),
};

const house: Module = {
  id: 'house', title: 'A house', blurb: 'One of the twelve places: its Greek name, its essay, and who keeps it in this chart.', charts: 1, deep: true, layout: 'voice',
  stage: (f) => ({ view: 'wheel', trail: [{ t: 'house', k: '0:' + (+f || 1) }] }),
  derive({ api, charts }, focus) {
    const n = +focus;
    if (!(n >= 1 && n <= 12)) return null;
    const ch = charts[0], b = blocks(api.html.housesRead(ch)).find((x) => x.attrs.house === String(n));
    if (!b) return null;
    const c = fromBlock(api, house, focus, ch, b, { kicker: `House ${n}`, title: cap(api.HNAME[n - 1][2]) });
    c.glyph = { text: String(n) };
    c.greek = api.HNAME[n - 1][0];
    /* The question each house closes on is its strongest single line. */
    c.lines = [{ text: api.HASK[n - 1] }, ...c.lines.filter((l) => l.text !== api.HASK[n - 1])];
    return c;
  },
  full(api, focus, doc) { api.goTo('houses:' + focus); return q(doc, `#body [data-house="${focus}"]`); },
  embed: embedReading, card: cardOf('voice'),
};

const keyholder: Module = {
  id: 'keyholder', title: 'A key-holder', blurb: 'The god who rules a house: its condition, its aspects, its score and its receptions.', charts: 1, degrees: true, deep: true, layout: 'voice',
  stage: () => ({ view: 'wheel' }),
  light(api, focus) { api.S.foc = { pts: new Set(['0:' + focus]) }; },
  derive({ api, charts }, focus) {
    const ch = charts[0];
    if (!ch.timeKnown || !ch.cusps || !PLANETS.includes(focus)) return null;
    const b = blocks(api.html.housesRead(ch)).find((x) => x.attrs.key === focus);
    if (!b) return null;
    const k = api.keyCond(ch, focus);
    const c = fromBlock(api, keyholder, focus, ch, b, { kicker: 'A key-holder', id: focus, title: god(api, focus) });
    c.sub = `${b.note} · condition score ${k.score > 0 ? '+' : ''}${k.score}`;
    return c;
  },
  full(api, focus, doc) { return tab(api, doc, 'houses', `#body [data-key="${focus}"]`); },
  embed: embedReading, card: cardOf('voice'),
};

const inner: Module = {
  id: 'inner', title: 'Anima / Animus', blurb: 'Jung’s two inner figures, as this chart wears them.', charts: 1, layout: 'voice',
  stage: () => ({ view: 'wheel' }),
  light(api, focus) { api.S.foc = { pts: new Set(focus === 'animus' ? ['0:mars', '0:sun'] : ['0:venus', '0:moon']) }; },
  derive({ api, charts }, focus) {
    const which = focus === 'animus' ? 'animus' : 'anima', ch = charts[0], b = readingBlock(api, ch, 'god', which);
    if (!b) return null;
    const c = fromBlock(api, inner, which, ch, b, { kicker: 'The inner figures', title: cap(which) });
    c.glyph = { svg48: '<circle cx="18" cy="24" r="12"/><circle cx="30" cy="24" r="12" opacity=".6"/>' };
    return c;
  },
  full(api, focus, doc) { const w = focus === 'animus' ? 'animus' : 'anima'; api.goTo('reading:' + w); return q(doc, `#body [data-god="${w}"]`); },
  embed: embedReading, card: cardOf('voice'),
};

const lots: Module = {
  id: 'lots', title: 'The lots', blurb: 'Fortune, Spirit and Eros, by the Hellenistic rule.', charts: 1, degrees: true, layout: 'voice',
  stage: () => ({ view: 'wheel' }),
  derive({ api, charts }, focus) {
    const ch = charts[0], b = readingBlock(api, ch, 'god', 'lots');
    if (!b) return null;
    const c = fromBlock(api, lots, focus, ch, b, { kicker: 'The Hellenistic lots', title: 'The lots' });
    c.glyph = glyphOf(api, 'fortune');
    return c;
  },
  full(api, _f, doc) { api.goTo('reading:lots'); return q(doc, '#body [data-god="lots"]'); },
  embed: embedReading, card: cardOf('voice'),
};

const fate: Module = {
  id: 'fate', title: 'Fate and direction', blurb: 'Gods on the angles, the Vertex and the nodes, and the road the chart leans along.', charts: 1, layout: 'voice',
  stage: () => ({ view: 'wheel' }),
  derive({ api, charts }, focus) {
    const ch = charts[0], b = readingBlock(api, ch, 'god', 'fate');
    if (!b) return null;
    const c = fromBlock(api, fate, focus, ch, b, { kicker: 'The fate points', title: 'Fate and direction' });
    c.glyph = glyphOf(api, 'nn');
    return c;
  },
  full(api, _f, doc) { api.goTo('reading:fate'); return q(doc, '#body [data-god="fate"]'); },
  embed: embedReading, card: cardOf('voice'),
};

const key: Module = {
  id: 'key', title: 'Chart key and tones', blurb: 'The key the chart sounds in, and each planet’s note.', charts: 1, layout: 'table',
  stage: () => ({ view: 'wheel' }),
  derive({ api, charts }, focus) {
    const ch = charts[0], k = api.keyOf(ch), rows: Row[] = [];
    const up = (s: number) => ((((s - k.t) * 7) % 12) + 12) % 12;
    for (const id of PLANETS) {
      const s = sg(ch.bodies[id].lon), st = up(s);
      rows.push({ glyph: glyphOf(api, id), color: api.D.PCOL[id], name: god(api, id), value: api.NOTE[s], note: st ? `${api.INTERVAL[st]} above the tonic` : 'the tonic' });
    }
    const tri = [...new Set([sg(ch.bodies.sun.lon), sg(ch.bodies.moon.lon), ...(ch.timeKnown && ch.asc != null ? [sg(ch.asc)] : [])].map((s) => api.NOTE[s]))];
    const line = `Helios${ch.timeKnown ? ', Selene and the Ascendant' : ' and Selene'} together sound ${tri.join(' · ')}.`;
    return {
      module: 'key', focus, kicker: 'The music of the chart', title: k.name, sub: `From the ${k.from}${ch.timeKnown ? ` · ${ch.day ? 'a day chart sounds major' : 'a night chart sounds minor'}` : ''}`, color: ICHOR,
      glyph: { svg48: '<path d="M4 16H44M4 22H44M4 28H44M4 34H44" opacity=".45"/><ellipse cx="22" cy="31" rx="5" ry="3.6" fill="currentColor"/><path d="M27 31V10"/>' },
      paras: [line, 'The twelve signs sit on the circle of fifths from Aries at C. The sign on the Ascendant is the home note.'], lines: [{ text: line }], rows, voice: '', owner: owner(ch), deep: false,
    };
  },
  full(api, _f, doc) { return tab(api, doc, 'music', '#body .key'); },
  embed: embedTable, card: cardOf('table'),
};

const daily: Module = {
  id: 'daily', title: 'The daily read', blurb: 'Today’s sky, on its own or against a chart. It changes every day.', charts: 0, layout: 'voice',
  stage: () => ({ view: 'wheel' }),
  derive({ api, charts }, focus) {
    const ch = charts[0] || null, html = api.html.daily(ch);
    const pick = (re: RegExp) => { const m = html.match(re); return m ? strip(m[1]) : ''; };
    const moon = pick(/<p class="day-m">([\s\S]*?)<\/p>/), items = [...html.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => strip(m[1].replace(/<i>[\s\S]*?<\/i>/, '')));
    const quiet = items.length ? '' : pick(/<\/p><p>([\s\S]*?)<\/p>/);
    const paras = [moon, ...items, quiet].filter(Boolean);
    return {
      module: 'daily', focus, kicker: `The daily read · ${pick(/<span class="day-k">([\s\S]*?)<\/span>/)}`, title: pick(/<h4>([\s\S]*?)<\/h4>/), sub: ch ? (owner(ch) ? `Today’s sky against ${owner(ch)}’s chart` : 'Today’s sky against one chart') : 'Today’s sky, the same for everyone',
      color: ICHOR, glyph: glyphOf(api, 'moon'), paras, lines: [...items.map((t) => ({ text: t })), { text: moon }, ...(quiet ? [{ text: quiet }] : [])], voice: '', owner: owner(ch || undefined), deep: false,
    };
  },
  full(api, _f, doc) { return api.S.charts.length ? tab(api, doc, 'today', '#body .day') : null; },
  embed: embedReading, card: cardOf('voice'),
};

const SYN: Record<string, string> = { biwheel: 'Biwheel', web: 'Web', grid: 'Grid' };
const synastry: Module = {
  id: 'synastry', title: 'Synastry', blurb: 'Two charts laid together: as rings, as wired wheels or as a grid.', charts: 2, degrees: true, layout: 'chart',
  stage: (f) => ({ view: SYN[f] ? f : 'biwheel' }),
  derive({ api, charts }, focus) {
    if (charts.length < 2) return null;
    const v = SYN[focus] ? focus : 'biwheel', [A, B] = charts, links = api.links().filter((L) => L.ia !== L.ib).sort((x, y) => x.off - y.off);
    const said = links.slice(0, 4).map((L) => `${god(api, L.a)} ${L.kind} ${named(api, L.b)} (${L.off.toFixed(1)}°). ${strip(api.sentence(L, api.charts()))}`);
    const names = owner(A) && owner(B) ? `${api.shortName(A)} and ${api.shortName(B)}` : 'Two charts';
    return {
      module: 'synastry', focus: v, kicker: `Synastry · ${SYN[v]}`, title: names, sub: `${links.length} ${links.length === 1 ? 'line' : 'lines'} between them`, color: ICHOR,
      paras: said.length ? said : ['No lines between these two at this tightness.'], lines: links.slice(0, 6).map((L) => ({ text: strip(api.sentence(L, api.charts())) })), chart: true, voice: '', owner: '', deep: false,
    };
  },
  full(api, focus, doc) { return api.S.charts.length > 1 ? view(api, doc, SYN[focus] ? focus : 'biwheel') : q(doc, '.ne-stage'); },
  embed: embedChart, card: cardOf('chart'),
};

const davison: Module = {
  id: 'davison', title: 'The Davison chart', blurb: 'The midpoint of two births, in time and in place, as a chart of its own.', charts: 1, layout: 'chart',
  stage: () => ({ view: 'wheel' }),
  derive(ctx, focus) {
    const c = wheel.derive(ctx, '');
    if (!c) return null;
    const ch = ctx.charts[0], pair = ch.name.replace(/^Davison\s*(·\s*)?/, '');
    return { ...c, module: 'davison', focus, kicker: 'The Davison chart', title: pair || 'Davison', owner: '', paras: ['The midpoint of two births, in time and in place, cast as a chart of its own.', ...c.paras] };
  },
  full(api, _f, doc) { return view(api, doc, 'wheel'); },
  embed: embedChart, card: cardOf('chart'),
};

const glossary: Module = {
  id: 'glossary', title: 'A glossary entry', blurb: 'One term or god, in a sentence anyone can follow.', charts: 0, layout: 'voice',
  stage: () => ({ view: 'wheel' }),
  derive({ api, charts }, focus) {
    const k = focus.toLowerCase(), g = api.termOf(k);
    if (!g) return null;
    const paras = [g[2]], ch = charts[0];
    if (ch) { const card = api.CARDS.term(k, api.links().slice().sort((x, y) => x.off - y.off)); if (card && card.here) paras.push('In this chart. ' + strip(card.here)); }
    return {
      module: 'glossary', focus: k, kicker: 'The glossary', title: g[0], sub: cap(g[1]), color: (api.D.PT[g[3]] && api.D.PCOL[g[3]]) || ICHOR,
      glyph: api.D.PG[g[3]] ? { path: api.D.PG[g[3]] } : { svg48: g[3] }, paras, lines: pullLines([g[2]]), voice: '', owner: ch ? owner(ch) : '', deep: false,
    };
  },
  full(api, focus, doc) { if (!api.S.charts.length) return null; api.go('term', focus.toLowerCase(), 'list'); return q(doc, '#card'); },
  embed: embedReading, card: cardOf('voice'),
};

const VAR = /^var\(--([a-z]+)\)$/;
const step: Module = {
  id: 'step', title: 'A step on the trail', blurb: 'One stop of the journey, with the breadcrumbs that led to it.', charts: 1, layout: 'voice',
  stage: (f, n) => ({ view: focusView(f) || (n > 1 ? 'biwheel' : 'wheel'), trail: focusToSteps(f) }),
  derive({ api, charts }, focus) {
    const trail = focusToSteps(focus), st = trail[trail.length - 1];
    if (!st || !api.CARDS[st.t]) return null;
    let c = null;
    try { c = api.CARDS[st.t](st.k, api.links().slice().sort((x, y) => x.off - y.off)); } catch { c = null; }
    if (!c) return null;
    const col = VAR.test(c.col) ? api.D.COL[c.col.replace(VAR, '$1')] || ICHOR : c.col;
    const path = c.gl.match(/viewBox="0 0 24 24"[^>]*><path d="([^"]+)"/), tx = c.gl.match(/<span class="gl tx[^"]*">([\s\S]*?)<\/span>/), s48 = c.gl.match(/viewBox="0 0 48 48"[^>]*>([\s\S]*?)<\/svg>/);
    const paras = [c.lesson, c.here ? 'In this chart. ' + c.here : '', c.q].filter(Boolean).map((p) => strip(p as string).replace(/ ?(\d+ lines? touch it on screen\.|No lines touch it at this tightness\.)/, ''));
    return {
      module: 'step', focus, kicker: strip(c.eb), title: strip(c.title), sub: c.sub ? strip(c.sub) : undefined, color: col,
      glyph: path ? { path: path[1] } : s48 ? { svg48: s48[1] } : tx ? { text: strip(tx[1]) } : undefined,
      paras, lines: pullLines(paras), trail: trail.map((s) => strip(api.crumb(s))), voice: '', owner: owner(charts[0]), deep: false,
    };
  },
  full(_api, _f, doc) { return q(doc, '#card'); },
  embed: embedReading, card: cardOf('voice'),
};

export const MODULES: readonly Module[] = [wheel, placements, godModule, aspect, patterns, house, keyholder, inner, lots, fate, key, daily, synastry, davison, glossary, step];
export const REGISTRY: Readonly<Record<string, Module>> = Object.fromEntries(MODULES.map((m) => [m.id, m]));

/** What deriving gives back. One shape, so it reads the same with or without strict null checks: when `ok`, `content` is set; when not, `why` says why. */
export interface Derived<T = undefined> { ok: boolean; module: Module | null; content: Content | null; why: string; used?: T }

/**
 * Derive a module's content from decoded charts and a focus. The charts go on the engine's table only for the
 * length of the call. `use` runs with the same staging still in place, for painting the chart view.
 */
export function derive<T = undefined>(api: Natal, moduleId: string, focus: string, charts: EngineChart[], level: Privacy, use?: (c: Content) => T): Derived<T> {
  const m = REGISTRY[moduleId];
  if (!m) return { ok: false, module: null, content: null, why: 'This link names a view this page does not have.' };
  if (charts.length < m.charts) return { ok: false, module: m, content: null, why: m.charts === 2 ? `${m.title} needs two charts.` : `${m.title} needs a chart.` };
  if (m.degrees && charts.slice(0, Math.max(1, m.charts)).some((c) => c.signOnly)) return { ok: false, module: m, content: null, why: `${m.title}: this view needs degrees, so it cannot be shown at sign level.` };
  const staged = m.charts === 2 || (m.id === 'aspect' && charts.length > 1) || (m.id === 'step' && charts.length > 1) ? charts.slice(0, 2) : charts.slice(0, 1);
  return api.withShared(staged, m.stage(focus, staged.length), (): Derived<T> => {
    const content = m.derive({ api, charts: staged, level }, focus);
    if (!content) return { ok: false, module: m, content: null, why: `${m.title}: that focus is not in this chart.` };
    if (m.light) m.light(api, content.focus);
    const used = use ? use(content) : undefined;
    return { ok: true, module: m, content, why: '', used };
  });
}
