import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeChart, encodeChart, type Privacy } from '../../src/scripts/horoskopos/share/codec.ts';
import { fromEngineChart, toEngineChart, type EngineChart } from '../../src/scripts/horoskopos/share/engine.ts';
import { MODULES, REGISTRY, derive, type Content } from '../../src/scripts/horoskopos/share/registry.ts';
import { chartsOf, focusToSteps, focusView, parseShare, shareQuery, shareUrl, stepsToFocus, embedUrl } from '../../src/scripts/horoskopos/share/state.ts';
import { cast, natal } from './helpers.ts';

/** A chart as a share link delivers it: through the codec, at a level. */
const shared = (id: string, p: Privacy = 'full'): EngineChart => toEngineChart(decodeChart(encodeChart(fromEngineChart(cast(id)), p)));

/** One focus per module that exists in the given chart. */
function focuses(a: EngineChart, b?: EngineChart): Record<string, string> {
  const link = natal.withShared([a], { view: 'wheel' }, () => natal.links()[0]);
  const ruler = a.cusps ? natal.RULER[Math.floor(a.cusps[9] / 30)] : 'saturn';
  return {
    wheel: 'venus', placements: '', god: 'venus', aspect: link ? `${link.a}-${link.b}` : 'sun-moon', patterns: '', house: '10', keyholder: ruler, inner: 'anima', lots: '', fate: '', key: '', daily: '',
    synastry: 'web', davison: '', glossary: 'orb', step: stepsToFocus([{ t: 'pt', k: '0:venus' }, { t: 'sign', k: '0:11' }, ...(link ? [{ t: 'link', k: link.key }] : [])]),
    ...(b ? {} : {}),
  };
}
const everything = (c: Content) => JSON.stringify(c);

test('every registered module derives content, a card and an embed from a shared chart', () => {
  const a = shared('kahlo'), b = shared('rivera'), f = focuses(a, b);
  for (const m of MODULES) {
    const charts = m.id === 'davison' ? [toEngineChart(decodeChart(encodeChart(fromEngineChart(Object.assign(natal.C.davison(cast('kahlo'), cast('rivera')), { name: 'Davison' }), 'Davison · Frida & Diego'))))] : m.charts === 2 ? [a, b] : [a];
    const d = derive(natal, m.id, f[m.id], charts, 'full');
    assert.ok(d.ok, `${m.id}: ${d.ok ? '' : d.why}`);
    if (!d.ok) continue;
    const c = d.content;
    assert.ok(c.title && c.kicker, `${m.id} has a title and a kicker`);
    assert.ok(c.paras.length > 0, `${m.id} has text`);
    const card = m.card(c);
    assert.equal(card.layout, m.layout);
    assert.ok(card.chart || card.rows || card.line, `${m.id} card has something to show`);
    const html = m.embed(c);
    assert.match(html, /^<article class="hk /);
    assert.ok(!/<script/i.test(html));
  }
  assert.equal(MODULES.length, 16);
});

test('deriving leaves the engine table exactly as it was', () => {
  natal.loadShared([shared('wilhelm')], { view: 'wheel', trail: [{ t: 'pt', k: '0:sun' }] });
  const before = JSON.stringify({ n: natal.S.charts.length, name: natal.S.charts[0].name, view: natal.S.view, trail: natal.S.trail, links: natal.links().length });
  for (const m of MODULES) derive(natal, m.id, focuses(shared('kahlo'))[m.id], [shared('kahlo'), shared('rivera')], 'full');
  assert.equal(JSON.stringify({ n: natal.S.charts.length, name: natal.S.charts[0].name, view: natal.S.view, trail: natal.S.trail, links: natal.links().length }), before);
  natal.loadShared([], {});
});

test('sign level: no degrees and no houses anywhere in what is shown', () => {
  const a = shared('kahlo', 'sign'), f = focuses(shared('kahlo'));
  let shown = 0;
  for (const m of MODULES) {
    if (m.charts === 2 || m.id === 'davison') continue;
    const d = derive(natal, m.id, f[m.id], [a], 'sign');
    if (m.degrees) { assert.equal(d.ok, false, `${m.id} is withheld at sign level`); continue; }
    if (!d.ok) { assert.ok(m.id === 'step' || m.id === 'aspect', `${m.id}: ${d.why}`); continue; }
    shown++;
    const text = everything(d.content) + m.embed(d.content) + JSON.stringify(m.card(d.content));
    /* The daily read quotes today's sky (its own degrees are public); everything about the chart must be degree-free. */
    const own = m.id === 'daily' ? text.replace(/[\d.]+°/g, '') : text;
    assert.ok(!/\d\s*°|\d′/.test(own), `${m.id} shows a degree: ${(own.match(/.{30}\d\s*°.{10}/) || [''])[0]}`);
    assert.ok(!/\bhouse \d|\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth) house\b.*\bIn your chart/i.test(own.replace(/House \d+/g, '')), `${m.id} names a house placement`);
    assert.ok(!/In your chart\./.test(own), `${m.id} has a chart-specific house reading`);
  }
  assert.ok(shown >= 8);
});

test('anon: the label is nowhere', () => {
  const a = shared('kahlo', 'anon'), f = focuses(shared('kahlo'));
  for (const m of MODULES) {
    if (m.charts === 2 || m.id === 'davison' || m.degrees) continue;
    const d = derive(natal, m.id, f[m.id], [a], 'anon');
    if (!d.ok) continue;
    const text = everything(d.content) + m.embed(d.content) + JSON.stringify(m.card(d.content));
    assert.ok(!/Kahlo|Frida/.test(text), `${m.id} names the chart`);
    assert.equal(d.content.owner, '');
  }
});

test('deep readings share as a teaser', () => {
  const d = derive(natal, 'house', '10', [shared('kahlo')], 'full');
  assert.ok(d.ok && d.content.deep && REGISTRY.house.deep);
  if (!d.ok) return;
  const html = REGISTRY.house.embed(d.content);
  assert.match(html, /hk-more/);
  assert.ok(html.length < d.content.paras.join(' ').length, 'the embed holds less than the reading');
  assert.match(REGISTRY.house.card(d.content).more, /iamwilhelm\.com/);
});

test('the daily read stands without a chart', () => {
  const d = derive(natal, 'daily', '', [], 'full');
  assert.ok(d.ok && d.content.paras.length > 0);
});

test('share state reads and writes one URL shape', () => {
  const c = encodeChart(fromEngineChart(cast('kahlo'))), c2 = encodeChart(fromEngineChart(cast('rivera')));
  const s = { c, c2, m: 'aspect', f: 'venus-mars', p: 'full' as const };
  const q = shareQuery(s);
  assert.deepEqual(parseShare(q), s);
  assert.match(q, /^c=[\w-]+&c2=[\w-]+&m=aspect&f=venus-mars&p=full$/);
  assert.ok(shareUrl(s).startsWith('https://iamwilhelm.com/gallery/horoskopos/?c='));
  assert.ok(embedUrl(s, { theme: 'light', size: 'square' }).includes('/horoskopos/embed/?c='));
  assert.equal(chartsOf(s).length, 2);
  assert.equal(parseShare(''), null);
  assert.equal(parseShare('m=<script>'), null);
  assert.equal(parseShare('m=god&f=%3Cb%3E'), null);
  assert.equal(parseShare('m=god&c=!!!'), null);
  assert.equal(parseShare('m=god&c2=' + c2), null, 'a second chart needs a first');
  assert.deepEqual(parseShare('m=daily'), { m: 'daily', f: '', p: 'full' });
  /* A link edited to claim more than its code holds shows no more; one that claims less is cut on the way in. */
  const signed = encodeChart(fromEngineChart(cast('kahlo')), 'sign');
  assert.equal(chartsOf({ c: signed, m: 'god', f: 'venus', p: 'full' })[0].signOnly, true);
  assert.equal(chartsOf({ c, m: 'god', f: 'venus', p: 'anon' })[0].name, '');
});

test('a trail of steps survives the trip as a focus', () => {
  const steps = [{ t: 'pt', k: '0:venus' }, { t: 'link', k: '0:venus|1:mars' }, { t: 'term', k: 'grand trine' }, { t: 'kind', k: 't-square' }, { t: 'el', k: '0:water' }];
  const f = stepsToFocus(steps, 'biwheel');
  assert.deepEqual(focusToSteps(f), steps);
  assert.equal(focusView(f), 'biwheel');
  assert.equal(focusView(stepsToFocus(steps)), '');
  assert.deepEqual(parseShare(shareQuery({ m: 'step', f, p: 'full' }))!.f, f);
});
