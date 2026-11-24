/**
 * The share system on the engine page (/gallery/horoskopos/).
 *
 * Three jobs, all through the registry:
 *   1. Arrival. A share link in the address bar is decoded, the engine is
 *      loaded around its charts, and the named module is brought into view
 *      with its focus lit. Until then the page loads nothing, as before.
 *   2. Share buttons. After each render of the reading panel, every
 *      registered module on screen gets one button in the same place.
 *   3. The panel. One dialog with Card, Link and Embed tabs and the privacy
 *      selector. Whatever it shows is built from charts that have been
 *      through the codec at the chosen level, the same bytes a link carries,
 *      so the preview is what a recipient gets and nothing else leaves.
 *
 * Nothing here stores or sends anything. A card is drawn on a canvas in
 * this tab; a link is text.
 */
import { SIZES, layoutCard, sizeById } from './cards.ts';
import { decodeChart, encodeChart, type ChartOutput, type Privacy } from './codec.ts';
import { fromEngineChart, toEngineChart, type EngineChart, type Natal, type Stop } from './engine.ts';
import { canvasMeasure, loadCardFonts, paintCanvas } from './paint-canvas.ts';
import { REGISTRY, derive, type Content, type Module } from './registry.ts';
import { EMBED_SIZES, chartsOf, embedUrl, levelOf, parseShare, shareQuery, shareUrl, stepsToFocus, type EmbedSize, type ShareState } from './state.ts';
import { esc } from './text.ts';

const api = (window as unknown as { __natal?: Natal }).__natal;
const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];
const ORIGIN = location.origin;
const PLANETS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
const EXTRAS = ['lilith', 'nn', 'sn', 'chiron', 'ceres', 'pallas', 'juno', 'vesta'];
const NOTE = 'Placements can reveal an approximate birth date. The privacy selector controls how much is shown.';

/** What a share button asks for: a module, a focus, and the charts (as they sit on the table) it is about. */
interface Ask { module: string; focus: string; charts: EngineChart[]; labels?: string[] }

/* ---------------- arrival ---------------- */

/** Bring an element into view and mark it for a few seconds. */
function lit(el: Element | null) {
  if (!el) return;
  el.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  el.classList.add('shr-lit');
  setTimeout(() => el.classList.remove('shr-lit'), 4200);
}

function banner(html: string) {
  let box = $('#shr-note');
  if (!box) {
    box = document.createElement('aside');
    box.id = 'shr-note';
    box.className = 'shr-note';
    box.setAttribute('aria-label', 'Shared link');
    const main = $('.ne-main'), top = main && $('.top', main);
    if (top) top.after(box);
  }
  box.innerHTML = html + '<button class="x" data-shr-dismiss aria-label="Dismiss">×</button>';
  box.hidden = false;
}

const LEVEL: Record<Privacy, string> = { full: '', sign: ' It was shared at sign level: signs only, with no degrees or houses.', anon: ' It was shared anonymously: signs only, with no name.' };

function arrive(st: ShareState) {
  if (!api) return;
  const m = REGISTRY[st.m];
  let outs: ChartOutput[];
  try { outs = chartsOf(st); } catch {
    banner('<p><b>This share link could not be read.</b> It may have been cut short on the way. The engine below is empty: cast your own chart, or pick one.</p>');
    return;
  }
  if (!m) { banner('<p><b>This share link names a view this page does not have.</b> The engine below is empty: cast your own chart, or pick one.</p>'); return; }
  const level = levelOf(st, outs), charts = outs.map(toEngineChart);
  const d = derive(api, st.m, st.f, charts, level);
  const cta = '<button class="chip" data-start="self">Cast your own chart</button>';
  if (!charts.length) {
    /* A module that stands without a chart (the daily read, a glossary entry): shown here, the engine stays empty. */
    banner(d.ok ? `<div class="shr-solo">${m.embed(d.content)}</div><p class="fine">A shared ${esc(m.title.toLowerCase())}. Nothing is loaded below until you cast a chart or choose one. ${cta}</p>` : `<p><b>${esc(d.why)}</b></p>`);
    return;
  }
  const stage = m.stage(st.f, charts.length);
  api.loadShared(charts, { view: stage.view || 'wheel', trail: st.m === 'step' ? stage.trail : [] });
  const what = d.ok ? `${d.content.title} · ${d.content.kicker}` : m.title;
  banner(`<p><b>You arrived on a shared link:</b> ${esc(what)}.${LEVEL[level]} A link carries a chart’s positions, never a birth date, time or place.${d.ok ? '' : ` <b>${esc(d.why)}</b>`}</p><p class="fine">${cta}</p>`);
  /* The engine has just drawn; let the layout settle, then go to the module and light its focus. */
  requestAnimationFrame(() => requestAnimationFrame(() => {
    let el: Element | null = null;
    try { el = d.ok ? m.full(api, d.content.focus, document) : null; } catch { el = null; }
    lit(el || $('.bench'));
  }));
}

/* ---------------- share buttons ---------------- */

const label = (m: Module, focus: string) => {
  if (!api) return m.title;
  if (m.id === 'god') return `${api.gname(focus)}’s speech`;
  if (m.id === 'house') return `house ${focus}`;
  if (m.id === 'keyholder') return `${api.gname(focus)} as key-holder`;
  return m.title.toLowerCase();
};

function button(el: Element, module: string, focus: string, chart: string, cls = '') {
  const m = REGISTRY[module];
  if (!m || el.querySelector(':scope > .shr-b')) return;
  el.classList.add('shr');
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'shr-b ' + cls;
  b.dataset.share = module;
  b.dataset.f = focus;
  b.dataset.ch = chart;
  b.title = NOTE;
  b.setAttribute('aria-label', `Share ${label(m, focus)}`);
  b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3.5M7.5 8L12 3.5L16.5 8M5 12.5V19.5H19V12.5"/></svg><span>Share</span>';
  el.appendChild(b);
}

/** The chart a block of the reading belongs to: blocks follow a heading per chart when several are in view. */
function chartIndex(el: Element, body: Element): number {
  let n = -1;
  for (const h of $$('h4.sub', body)) if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) n++;
  return Math.max(0, n);
}

function decorate() {
  if (!api || !api.S.charts.length) return;
  const body = $('#body'), S = api.S, vc = api.charts();
  if (!body || !vc.length) return;
  const slot = (ch: EngineChart) => String(S.slotOf(ch));
  const stage = $('.ne-stage');
  if (stage) {
    const old = stage.querySelector(':scope > .shr-b');
    if (old) old.remove();
    if (S.view === 'davison') button(stage, 'davison', '', '4', 'shr-b-stage');
    else if (vc.length > 1 && S.view !== 'wheel') button(stage, 'synastry', S.view, '0,1', 'shr-b-stage');
    else button(stage, 'wheel', '', slot(vc[0]), 'shr-b-stage');
  }
  const lists = { all: vc, born: vc.filter((c) => !(c.meta && c.meta.now)), read: vc.filter((c) => !(c.meta && (c.meta.now || c.meta.davison))) };
  if (S.tab === 'placements') $$('.pl-t', body).forEach((t, i) => { const w = document.createElement('div'); w.className = 'shr-wrap'; t.before(w); w.appendChild(t); button(w, 'placements', '', slot(lists.all[i] || vc[0])); });
  if (S.tab === 'music') $$('.key', body).forEach((k, i) => button(k, 'key', '', slot(lists.all[i] || vc[0])));
  if (S.tab === 'today') $$('.day', body).forEach((d, i) => button(d, 'daily', '', slot(lists.read[i] || vc[0])));
  if (S.tab === 'reading') for (const g of $$('.god[data-god]', body)) {
    const id = g.dataset.god || '', ch = slot(lists.all[chartIndex(g, body)] || vc[0]);
    if (PLANETS.includes(id) || EXTRAS.includes(id)) button(g, 'god', id, ch);
    else if (id === 'anima' || id === 'animus') button(g, 'inner', id, ch);
    else if (REGISTRY[id]) button(g, id, '', ch);
  }
  if (S.tab === 'houses') {
    const many = lists.all.length > 1;
    for (const g of $$('.god[data-key]', body)) button(g, 'keyholder', g.dataset.key || '', slot(lists.born[many ? chartIndex(g, body) : 0] || vc[0]));
    for (const g of $$('.god.house[data-house]', body)) button(g, 'house', g.dataset.house || '', slot(lists.born[many ? chartIndex(g, body) : 0] || vc[0]));
  }
  if (S.tab === 'aspects') for (const li of $$('.lk[data-k]', body)) {
    const [ka, kb] = (li.dataset.k || '').split('|').map((k) => k.split(':'));
    if (ka && kb) button(li, 'aspect', `${ka[1]}-${kb[1]}`, ka[0] === kb[0] ? ka[0] : `${ka[0]},${kb[0]}`, 'shr-b-row');
  }
  const stop = $('#card .stop'), st = S.trail[S.at];
  if (stop && st && !/Not on screen/.test(stop.textContent || '')) {
    if (st.t === 'term') button(stop, 'glossary', st.k, slot(vc[0]), 'shr-b-card');
    else button(stop, 'step', '', vc.map(slot).join(','), 'shr-b-card');
  }
}

/** The charts a share button points at, and for a trail step the steps themselves, renumbered for the charts sent. */
function askOf(b: HTMLElement): Ask | null {
  if (!api) return null;
  const S = api.S, slots = (b.dataset.ch || '0').split(',').map(Number), pick = (s: number) => (s === 4 ? api.dav() : S.charts[s]);
  let charts = slots.map(pick).filter((c): c is EngineChart => !!c).slice(0, 2);
  if (!charts.length) return null;
  const labels = charts.map((c) => (c.meta && c.meta.davison && S.charts.length > 1 ? `Davison · ${api.shortName(S.charts[0])} & ${api.shortName(S.charts[1])}` : ''));
  let focus = b.dataset.f || '';
  const module = b.dataset.share || 'wheel';
  if (module === 'step') {
    /* Keep the steps that speak of the charts being sent, and renumber their slots to 0 and 1. */
    const map = new Map(slots.slice(0, 2).map((s, i) => [String(s), String(i)]));
    const steps: Stop[] = [];
    for (const st of S.trail.slice(0, S.at + 1)) {
      const k = st.k.replace(/(^|\|)(\d):/g, (all, pre: string, s: string) => (map.has(s) ? `${pre}${map.get(s)}:` : `${pre}?:`));
      if (!k.includes('?')) steps.push({ t: st.t, k });
    }
    if (!steps.length) return null;
    focus = stepsToFocus(steps, charts.length > 1 ? S.view : 'wheel');
    if (charts.length > 1 && S.view === 'wheel') charts = charts.slice(0, 1);
  }
  return { module, focus, charts, labels };
}

/* ---------------- the panel ---------------- */

const P = {
  ask: null as Ask | null,
  outs: [] as ChartOutput[],
  privacy: 'full' as Privacy,
  tab: 'card' as 'card' | 'link' | 'embed',
  size: 'feed',
  pick: 0,
  esize: 'auto' as EmbedSize,
  theme: 'dark' as 'dark' | 'light',
  auto: false,
  state: null as ShareState | null,
  content: null as Content | null,
  blob: null as Blob | null,
  seq: 0,
};

const dlg = () => $<HTMLDialogElement>('#share');

/** Everything the panel can switch to from here: each registered module, with the focuses this table offers. */
function views(): Array<{ group: string; label: string; module: string; focus: string; n: 0 | 1 | 2 }> {
  if (!api || !P.ask) return [];
  const out: ReturnType<typeof views> = [], S = api.S, A = P.ask.charts[0], two = S.charts.length > 1 && S.charts.includes(A);
  const add = (group: string, lab: string, module: string, focus: string, n: 0 | 1 | 2 = 1) => out.push({ group, label: lab, module, focus, n });
  add('', 'Chart wheel', 'wheel', '');
  add('', 'Placements', 'placements', '');
  for (const id of PLANETS) add('A god’s speech', api.gname(id), 'god', id);
  for (const id of EXTRAS) if (id !== 'chiron' && id !== 'ceres' && id !== 'pallas' && id !== 'juno' && id !== 'vesta' || A.minorOk) add('A god’s speech', id === 'sn' ? 'The South Node' : id === 'nn' ? 'The North Node' : id === 'lilith' ? 'Lilith' : api.gname(id), 'god', id);
  const links = api.withShared([toEngineChart(decodeChart(encodeChart(fromEngineChart(A), 'full')))], { view: 'wheel' }, () => api.links().slice().sort((x, y) => x.off - y.off).slice(0, 8).map((L) => [L.a, L.b]));
  for (const [a, b] of links) add('An aspect exchange', `${api.gname(a)} and ${api.gname(b)}`, 'aspect', `${a}-${b}`);
  add('', 'The patterns', 'patterns', '');
  for (let i = 1; i <= 12; i++) add('A house', `${i} · ${api.HNAME[i - 1][2]}`, 'house', String(i));
  if (A.timeKnown && A.cusps) for (const r of [...new Set(A.cusps.map((c) => api.RULER[Math.floor(c / 30)]))]) add('A key-holder', api.gname(r), 'keyholder', r);
  add('', 'Anima', 'inner', 'anima');
  add('', 'Animus', 'inner', 'animus');
  add('', 'The lots', 'lots', '');
  add('', 'Fate and direction', 'fate', '');
  add('', 'Chart key and tones', 'key', '');
  add('The daily read', 'Against this chart', 'daily', '');
  add('The daily read', 'The sky itself (no chart)', 'daily', '', 0);
  if (two) for (const v of ['biwheel', 'web', 'grid']) add('Synastry', v.charAt(0).toUpperCase() + v.slice(1), 'synastry', v, 2);
  for (const k of Object.keys({ ...api.GL, ...api.TERMX })) add('A glossary entry', (api.termOf(k) || [k])[0], 'glossary', k, 0);
  return out;
}

function fillViews() {
  const sel = $<HTMLSelectElement>('#shr-view');
  if (!sel || !P.ask) return;
  const list = views(), cur = `${P.ask.module}|${P.ask.focus}`;
  let html = '', group = '';
  const known = list.some((v) => `${v.module}|${v.focus}` === cur);
  if (!known) html += `<option value="${esc(cur)}|keep" selected>${esc(REGISTRY[P.ask.module] ? REGISTRY[P.ask.module].title : 'This view')}</option>`;
  for (const v of list) {
    if (v.group !== group) { if (group) html += '</optgroup>'; if (v.group) html += `<optgroup label="${esc(v.group)}">`; group = v.group; }
    const val = `${v.module}|${v.focus}|${v.n}`;
    const here = known && `${v.module}|${v.focus}` === cur && (v.module !== 'daily' || (v.n === 0) === (P.ask.charts.length === 0));
    html += `<option value="${esc(val)}"${here ? ' selected' : ''}>${esc(v.label)}</option>`;
  }
  if (group) html += '</optgroup>';
  sel.innerHTML = html;
}

function msg(text: string) { const el = $('#shr-msg'); if (el) { el.textContent = text; el.hidden = !text; } }
function done(text: string) { const el = $('#shr-done'); if (el) { el.textContent = text; if (text) setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, 2600); } }

async function copy(text: string, said: string) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const t = document.createElement('textarea');
    t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
    (dlg() || document.body).appendChild(t); t.select();
    try { document.execCommand('copy'); } finally { t.remove(); }
  }
  done(said);
}

function iframeCode(): string {
  if (!P.state || !P.content) return '';
  const src = embedUrl(P.state, { size: P.esize, theme: P.theme }, ORIGIN), z = EMBED_SIZES[P.esize];
  const dims = z.w ? `width="${z.w}" height="${z.h}" style="border:0;max-width:100%"` : 'width="100%" height="560" style="border:0;max-width:640px"';
  const frame = `<iframe src="${esc(src)}" ${dims} loading="lazy" title="${esc(`Horoskopos: ${P.content.title}`)}"></iframe>`;
  return P.auto && !z.w ? `${frame}\n<script async src="${ORIGIN}/machines/natal/embed.js"></script>` : frame;
}

/** Build the share from the codec's output at the chosen level, and redraw whichever tab is open. */
async function refresh() {
  const d0 = dlg();
  if (!api || !P.ask || !d0) return;
  const seq = ++P.seq, m = REGISTRY[P.ask.module];
  const codes = P.outs.map((o) => encodeChart(o, P.privacy));
  P.state = { ...(codes[0] ? { c: codes[0] } : {}), ...(codes[1] ? { c2: codes[1] } : {}), m: P.ask.module, f: P.ask.focus, p: P.privacy };
  /* Decode what was just encoded: from here on the panel only ever sees what the link carries. */
  const decoded = chartsOf(P.state), charts = decoded.map(toEngineChart), level = levelOf(P.state, decoded);
  const size = sizeById(P.size), cv = $<HTMLCanvasElement>('#shr-cv');
  await loadCardFonts();
  if (seq !== P.seq) return;
  P.blob = null;
  const d = derive(api, P.ask.module, P.ask.focus, charts, level, (content) => {
    if (!cv) return;
    cv.width = size.w; cv.height = size.h;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    paintCanvas(ctx, layoutCard(m.card(content, P.pick), size, canvasMeasure(ctx)), (c, w, h) => api.paint(c, w, h, 2.4, { ...api.FONT, dpr: 1 }));
  });
  d0.classList.toggle('shr-off', !d.ok);
  if (!d.ok) {
    P.content = null;
    msg(d.why + (P.privacy !== 'full' && m && m.degrees ? ' Choose Full to share it, or pick another view.' : ''));
    $$('[data-shr-pane]', d0).forEach((p) => { p.hidden = true; });
    return;
  }
  P.content = d.content;
  P.state.f = d.content.focus;
  msg(d.content.deep ? 'This is a deep reading. It shares as a teaser: a line or two, and the way back to the full reading.' : '');
  const title = $('#shr-title'), eb = $('#shr-eb');
  if (title) title.textContent = d.content.title;
  if (eb) eb.textContent = `Share · ${m.title}`;
  $$('[data-shr-pane]', d0).forEach((p) => { p.hidden = p.dataset.shrPane !== P.tab; });
  $$('[data-shr-tab]', d0).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.shrTab === P.tab)));
  $$('#shr-sizes button', d0).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.size === P.size)));
  const url = shareUrl(P.state, ORIGIN), input = $<HTMLInputElement>('#shr-url');
  if (input) input.value = url;
  /* line picker: only when the module has several lines to offer, and never for a table or a wheel alone */
  const lines = $('#shr-lines');
  if (lines) {
    const list = m.layout === 'table' ? [] : d.content.lines;
    lines.hidden = list.length < 2;
    lines.innerHTML = list.length < 2 ? '' : '<p class="lab">Which line</p>' + list.map((l, i) => `<label><input type="radio" name="shr-line" value="${i}"${i === Math.min(P.pick, list.length - 1) ? ' checked' : ''}><span>${l.by ? `<b>${esc(l.by)}:</b> ` : ''}${esc(l.text)}</span></label>`).join('');
  }
  if (cv) {
    cv.style.aspectRatio = `${size.w} / ${size.h}`;
    cv.setAttribute('aria-label', `Card preview: ${d.content.title}, ${size.label.toLowerCase()} size, ${size.w} by ${size.h}`);
    cv.toBlob((b) => { if (seq === P.seq) { P.blob = b; sharable(); } }, 'image/png');
  }
  if (P.tab === 'embed') {
    const fr = $<HTMLIFrameElement>('#shr-if'), code = $<HTMLTextAreaElement>('#shr-code'), z = EMBED_SIZES[P.esize];
    const src = embedUrl(P.state, { size: P.esize, theme: P.theme }, ORIGIN);
    if (fr && fr.dataset.src !== src) { fr.dataset.src = src; fr.src = src; }
    if (fr) { fr.style.aspectRatio = z.w ? `${z.w} / ${z.h}` : ''; fr.style.height = z.w ? 'auto' : '460px'; fr.style.maxWidth = z.w ? `${z.w}px` : ''; }
    if (code) code.value = iframeCode();
  }
}

function file(): File | null {
  if (!P.blob || !P.ask) return null;
  return new File([P.blob], `horoskopos-${P.ask.module}-${P.size}.png`, { type: 'image/png' });
}
/** Whether this browser can hand the image to its share sheet. */
function sharable() {
  const b = $('#shr-share'), f = file();
  let ok = false;
  try { ok = !!(f && navigator.canShare && navigator.canShare({ files: [f] })); } catch { ok = false; }
  if (b) b.hidden = !ok;
  const dl = $('#shr-dl');
  if (dl) dl.classList.toggle('go', !ok);
}

async function shareImage() {
  const f = file();
  if (!f || !P.state || !P.content) return;
  const url = shareUrl(P.state, ORIGIN);
  try { await navigator.share({ files: [f], title: `${P.content.title} · Horoskopos`, text: `${P.content.title} · Horoskopos ${url}` }); }
  catch (e) { if ((e as Error).name !== 'AbortError') { download(); done('Sharing was not available here, so the image was downloaded.'); } }
}
function download() {
  const f = file();
  if (!f) return;
  const a = document.createElement('a'), href = URL.createObjectURL(f);
  a.href = href; a.download = f.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 4000);
  done('Image downloaded.');
}

function open(ask: Ask) {
  const d = dlg();
  if (!d || !api) return;
  P.ask = ask;
  P.outs = ask.charts.map((c, i) => fromEngineChart(c, (ask.labels && ask.labels[i]) || undefined));
  P.pick = 0;
  P.tab = 'card';
  /* A chart that arrived at sign level cannot be shared wider than it came. */
  const floor: Privacy = P.outs.some((o) => o.signOnly) ? (P.outs.every((o) => !o.name) ? 'anon' : 'sign') : 'full';
  if (floor !== 'full' && P.privacy === 'full') P.privacy = floor;
  $$<HTMLInputElement>('input[name="shr-p"]', d).forEach((r) => { r.checked = r.value === P.privacy; r.disabled = floor !== 'full' && r.value === 'full'; });
  fillViews();
  if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  void refresh();
}
function close() { const d = dlg(); if (!d) return; if (d.close) d.close(); else d.removeAttribute('open'); const fr = $<HTMLIFrameElement>('#shr-if'); if (fr) { fr.removeAttribute('src'); fr.dataset.src = ''; } }

function wire() {
  const d = dlg();
  if (!d || !api) return;
  const sizes = $('#shr-sizes');
  if (sizes) sizes.innerHTML = SIZES.map((s) => `<button type="button" class="chip" data-size="${s.id}" aria-pressed="false">${s.label}<small>${s.w}×${s.h} · ${s.use}</small></button>`).join('');
  const es = $<HTMLSelectElement>('#shr-esize');
  if (es) es.innerHTML = (Object.keys(EMBED_SIZES) as EmbedSize[]).map((k) => `<option value="${k}">${EMBED_SIZES[k].label}${EMBED_SIZES[k].w ? ` · ${EMBED_SIZES[k].w}×${EMBED_SIZES[k].h}` : ''}</option>`).join('');
  $$('.shr-warn').forEach((p) => { p.textContent = NOTE; });

  /* Share buttons anywhere on the page. Capture, so a button inside a clickable row does not also follow the row. */
  document.addEventListener('click', (e) => {
    const t = e.target as Element;
    const dismiss = t.closest && t.closest('[data-shr-dismiss]');
    if (dismiss) { const n = $('#shr-note'); if (n) n.hidden = true; return; }
    const b = t.closest && t.closest<HTMLElement>('.shr-b,[data-share-main]');
    if (!b || d.contains(b)) return;
    e.preventDefault(); e.stopPropagation();
    const ask = askOf(b.matches('[data-share-main]') ? ($<HTMLElement>('.ne-stage > .shr-b') || b) : b);
    if (ask) open(ask);
  }, true);

  d.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === d || t.closest('[data-shr-close]')) return close();
    const tab = t.closest<HTMLElement>('[data-shr-tab]');
    if (tab) { P.tab = tab.dataset.shrTab as typeof P.tab; return void refresh(); }
    const size = t.closest<HTMLElement>('[data-size]');
    if (size) { P.size = size.dataset.size || 'feed'; return void refresh(); }
    if (t.closest('#shr-share')) return void shareImage();
    if (t.closest('#shr-dl')) return download();
    if (t.closest('#shr-copy') && P.state) return void copy(shareUrl(P.state, ORIGIN), 'Link copied.');
    if (t.closest('#shr-copycode')) return void copy(iframeCode(), 'Embed code copied.');
  });
  d.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement | HTMLSelectElement;
    if (t.name === 'shr-p') { P.privacy = t.value as Privacy; P.pick = 0; }
    else if (t.name === 'shr-line') P.pick = +t.value;
    else if (t.id === 'shr-esize') P.esize = t.value as EmbedSize;
    else if (t.id === 'shr-theme') P.theme = t.value as 'dark' | 'light';
    else if (t.id === 'shr-auto') P.auto = (t as HTMLInputElement).checked;
    else if (t.id === 'shr-view' && P.ask) {
      const [module, focus, n] = t.value.split('|');
      if (n === 'keep') return;
      const S = api.S, base = P.ask.charts[0], want = +n;
      const charts = want === 0 ? [] : want === 2 ? S.charts.slice(0, 2) : [base || S.charts[0]];
      P.ask = { module, focus, charts };
      P.outs = charts.map((c) => fromEngineChart(c));
      P.pick = 0;
    }
    void refresh();
  });
  $<HTMLInputElement>('#shr-url')?.addEventListener('focus', (e) => (e.target as HTMLInputElement).select());
  document.addEventListener('natal:render', decorate);
  decorate();
}

/* ---------------- start ---------------- */

/**
 * A share link is read from the query string, where a link preview can see it. Once read, the chart codes are
 * moved to the fragment, which browsers never send: nothing that runs or loads after arrival (a later request,
 * a referrer, an analytics beacon should one ever be added) carries them. A reload reads the fragment.
 */
function incoming(): ShareState | null {
  const fromQuery = parseShare(location.search);
  if (fromQuery) {
    const keep = new URLSearchParams(location.search);
    for (const k of ['c', 'c2', 'm', 'f', 'p']) keep.delete(k);
    const rest = keep.toString();
    try { history.replaceState(null, '', location.pathname + (rest ? `?${rest}` : '') + '#' + shareQuery(fromQuery)); } catch { /* the address stays as it was */ }
    return fromQuery;
  }
  return location.hash.length > 1 ? parseShare(location.hash.slice(1)) : null;
}

if (api && api.LIVE) {
  wire();
  const st = incoming();
  if (st) arrive(st);
}
