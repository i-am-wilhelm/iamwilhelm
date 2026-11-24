import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CODEC_VERSION, MINOR, PLANETS, applyPrivacy, decodeChart, decodeChartBytes, encodeChart, encodeChartBytes, fromBase64Url, privacyOf, toBase64Url, type ChartOutput } from '../../src/scripts/horoskopos/share/codec.ts';
import { fromEngineChart, toEngineChart } from '../../src/scripts/horoskopos/share/engine.ts';
import { FIGURES, cast, natal } from './helpers.ts';

const arc = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
const TIGHT = 1e-4; // degrees: a third of an arcsecond

function same(a: ChartOutput, b: ChartOutput) {
  assert.equal(b.name, a.name);
  assert.equal(b.davison, a.davison);
  assert.equal(b.signOnly, a.signOnly);
  assert.equal(b.minor, a.minor);
  for (const id of [...PLANETS, ...(a.minor ? MINOR : [])]) {
    assert.ok(arc(a.bodies[id]!.lon, b.bodies[id]!.lon) < TIGHT, `${id} longitude`);
    assert.ok(Math.abs(a.bodies[id]!.spd - b.bodies[id]!.spd) < 6e-4, `${id} motion`);
    assert.equal(a.bodies[id]!.spd < 0, b.bodies[id]!.spd < 0, `${id} direction`);
  }
  assert.ok(arc(a.nn, b.nn) < TIGHT && arc(a.lilith, b.lilith) < TIGHT);
  assert.equal(!!b.houses, !!a.houses);
  if (a.houses && b.houses) {
    assert.equal(b.houses.hsys, a.houses.hsys);
    for (const k of ['asc', 'mc', 'vertex'] as const) assert.ok(arc(a.houses[k], b.houses[k]) < TIGHT, k);
    a.houses.cusps.forEach((c, i) => assert.ok(arc(c, b.houses!.cusps[i]) < (a.houses!.hsys === 'W' ? 1e-9 : TIGHT), `cusp ${i + 1}`));
  }
}

test('every library chart round-trips in every house system', () => {
  let n = 0;
  for (const id of FIGURES) for (const hsys of ['P', 'W', 'E']) {
    const out = fromEngineChart(cast(id, hsys));
    const code = encodeChart(out);
    const back = decodeChart(code);
    same(out, back);
    assert.equal(encodeChart(back), code, 'a decoded chart encodes to the same text');
    assert.match(code, /^[A-Za-z0-9_-]+$/);
    n++;
  }
  assert.ok(n > 150);
});

test('a decoded chart reads the same in the engine: signs, houses, sect, lots', () => {
  for (const id of FIGURES) {
    const ch = cast(id), back = toEngineChart(decodeChart(encodeChart(fromEngineChart(ch))));
    assert.equal(back.timeKnown, ch.timeKnown);
    for (const p of PLANETS) {
      assert.equal(Math.floor(back.bodies[p].lon / 30), Math.floor(ch.bodies[p].lon / 30), `${id} ${p} sign`);
      assert.equal(back.bodies[p].retro, ch.bodies[p].retro);
      if (ch.timeKnown) assert.equal(back.bodies[p].house, ch.bodies[p].house, `${id} ${p} house`);
    }
    if (ch.timeKnown) {
      assert.equal(back.day, ch.day);
      for (const k of ['fortune', 'spirit', 'eros'] as const) assert.ok(arc(back.lots![k], ch.lots![k]) < 5e-4, `${id} ${k}`);
    }
    assert.equal(back.fixed, true);
  }
});

test('the first byte is the version, and other versions are refused', () => {
  const bytes = encodeChartBytes(fromEngineChart(cast('wilhelm')));
  assert.equal(bytes[0], CODEC_VERSION);
  const next = bytes.slice(); next[0] = CODEC_VERSION + 1;
  assert.throws(() => decodeChartBytes(next), /version/);
});

test('damaged codes throw instead of decoding to nonsense', () => {
  const code = encodeChart(fromEngineChart(cast('wilhelm')));
  assert.throws(() => decodeChart(code.slice(0, 40)));
  assert.throws(() => decodeChart(code + 'AAAA'));
  assert.throws(() => decodeChart('not a chart!'));
  assert.throws(() => decodeChart(''));
  assert.throws(() => decodeChart('A'.repeat(401)));
});

test('nothing a chart was cast from reaches the code', () => {
  const ch = cast('wilhelm');
  const out = fromEngineChart(ch);
  assert.deepEqual(Object.keys(out).sort(), ['bodies', 'culm', 'davison', 'houses', 'lilith', 'minor', 'name', 'nn', 'rising', 'signOnly']);
  /* The same sky under a different birth record gives the same code: the code is a function of positions alone. */
  const moved = { ...ch, jd: ch.jd! + 5000, lat: -12.3, lon: 77.7, meta: { id: 'x', y: 1900, m: 1, d: 1, place: 'Nowhere' } } as typeof ch;
  assert.equal(encodeChart(fromEngineChart(moved)), encodeChart(out));
});

test('sign level carries signs only', () => {
  const out = fromEngineChart(cast('wilhelm'));
  const code = encodeChart(out, 'sign'), back = decodeChart(code);
  assert.equal(back.signOnly, true);
  assert.equal(back.houses, null);
  assert.equal(privacyOf(back), 'sign');
  for (const id of [...PLANETS, ...MINOR]) assert.equal(back.bodies[id]!.lon % 30, 15, `${id} sits mid-sign`);
  assert.equal(back.rising, Math.floor(out.houses!.asc / 30));
  /* Move every body inside its sign: the code must not change, so no degree is in it. */
  const nudged: ChartOutput = { ...out, bodies: Object.fromEntries(Object.entries(out.bodies).map(([k, b]) => [k, { lon: Math.floor(b!.lon / 30) * 30 + 0.5, spd: b!.spd * 0.5 }])), nn: Math.floor(out.nn / 30) * 30 + 29, lilith: Math.floor(out.lilith / 30) * 30 + 1, houses: { ...out.houses!, asc: Math.floor(out.houses!.asc / 30) * 30 + 2, mc: Math.floor(out.houses!.mc / 30) * 30 + 28, vertex: 3, cusps: out.houses!.cusps.map((c) => (c + 7) % 360) } };
  assert.equal(encodeChart(nudged, 'sign'), code);
  assert.ok(encodeChart(out, 'anon').length < 24, 'a sign-level code is short');
  assert.equal(encodeChart(back, 'full'), code, 'a sign-level chart cannot be widened back');
});

test('anon drops the label and stays at sign level', () => {
  const out = fromEngineChart(cast('kahlo'));
  assert.ok(out.name.length > 0);
  const back = decodeChart(encodeChart(out, 'anon'));
  assert.equal(back.name, '');
  assert.equal(back.signOnly, true);
  assert.equal(privacyOf(back), 'anon');
  const bytes = encodeChartBytes(out, 'anon');
  assert.ok(!new TextDecoder().decode(bytes).includes('Kahlo'));
  assert.equal(applyPrivacy(out, 'anon').name, '');
});

test('a Davison chart and an untimed chart round-trip', () => {
  const dav = natal.C.davison(cast('kahlo'), cast('rivera'));
  dav.name = 'Davison';
  const d = decodeChart(encodeChart(fromEngineChart(dav, 'Davison · Frida & Diego')));
  assert.equal(d.davison, true);
  assert.equal(d.name, 'Davison · Frida & Diego');
  const untimed = natal.L.FIGURES.find((f) => !f.t);
  if (untimed) { const out = fromEngineChart(cast(untimed.id)); assert.equal(out.houses, null); same(out, decodeChart(encodeChart(out))); }
});

test('labels are cleaned and capped', () => {
  const out = fromEngineChart(cast('wilhelm'), '  <b>Ada</b>\n Lovelace ' + 'x'.repeat(80));
  const back = decodeChart(encodeChart(out));
  assert.ok(!/[<>\n]/.test(back.name));
  assert.ok(new TextEncoder().encode(back.name).length <= 48);
  assert.ok(back.name.startsWith('b Ada /b Lovelace'));
});

test('base64url both ways, every length', () => {
  for (let n = 0; n < 40; n++) {
    const b = Uint8Array.from({ length: n }, (_, i) => (i * 73 + n * 11) & 255);
    assert.deepEqual([...fromBase64Url(toBase64Url(b))], [...b]);
  }
});
