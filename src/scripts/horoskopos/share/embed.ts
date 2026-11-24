/**
 * The embed route's script (/horoskopos/embed/). It reads the same share
 * state as the engine page, loads the engine headless (no page around it),
 * and shows one module through the registry's embed renderer.
 *
 * The engine is fetched here, not by the page, so the planet library only
 * comes down for the one view that casts a sky (the daily read). A view
 * with a chart in its link needs no ephemeris at all: the positions are in
 * the link.
 *
 * In a frame with no fixed size it tells the host page its height
 * (public/machines/natal/embed.js listens), since readings vary in length.
 */
import type { ChartOutput } from './codec.ts';
import { toEngineChart, type Natal } from './engine.ts';
import { REGISTRY, derive } from './registry.ts';
import { SHARE_PATH, chartsOf, levelOf, parseShare, shareQuery, type ShareState } from './state.ts';
import { esc } from './text.ts';

const root = document.getElementById('hk-root') as HTMLElement;
const q = new URLSearchParams(location.search);
/* With no view named, the embed is the daily read, which needs no chart. */
const st: ShareState = parseShare(q) || { m: 'daily', f: '', p: 'full' };
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

const script = (src: string) => new Promise<void>((res, rej) => {
  const s = document.createElement('script');
  s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error(src));
  document.head.appendChild(s);
});

function fail(text: string) {
  root.innerHTML = `<article class="hk"><header class="hk-h"><div><p class="hk-k" style="color:#f2c56b">Horoskopos</p><h1>Nothing to show</h1></div></header><div class="hk-b"><p>${esc(text)}</p></div></article>`;
  tell();
}

/** Tell the host page how tall the content is, for frames that size themselves to it. */
function tell() {
  /* A frame with a fixed size keeps it; only the responsive embed reports its height. */
  if (parent === window || document.documentElement.dataset.size !== 'auto') return;
  /* The content's own height, not the frame's: a short reading can then draw a tall frame in as well as push a short one out. */
  const inner = root.firstElementChild as HTMLElement | null, foot = document.querySelector<HTMLElement>('.emb-foot'), pad = getComputedStyle(root);
  const height = (inner ? inner.offsetHeight : 0) + parseFloat(pad.paddingTop) + parseFloat(pad.paddingBottom) + (foot ? foot.offsetHeight : 0);
  if (height > 0) parent.postMessage({ type: 'horoskopos:size', height: Math.ceil(height) }, '*');
}

let stopDrawing = () => {};
function chart(api: Natal, cv: HTMLCanvasElement) {
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  let raf = 0, alive = true, seen = true;
  const t0 = performance.now();
  const frame = (now: number) => {
    const box = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1), w = Math.round(box.width), h = Math.round(box.height);
    if (w && h) {
      if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      api.paint(ctx, w, h, still ? 2.4 : (now - t0) / 1000, { ...api.FONT, dpr });
    }
    if (alive && !still && seen && !document.hidden) raf = requestAnimationFrame(frame);
  };
  const kick = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); };
  const ro = new ResizeObserver(kick);
  ro.observe(cv);
  const io = new IntersectionObserver((es) => { seen = es.some((e) => e.isIntersecting); if (seen) kick(); });
  io.observe(cv);
  document.addEventListener('visibilitychange', kick);
  if (document.fonts && document.fonts.ready) void document.fonts.ready.then(kick);
  kick();
  stopDrawing = () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', kick); };
}

function show(api: Natal) {
  const m = REGISTRY[st.m];
  let outs: ChartOutput[];
  try { outs = chartsOf(st); } catch { return fail('This embed link could not be read. It may have been cut short.'); }
  const charts = outs.map(toEngineChart), level = levelOf(st, outs);
  const d = derive(api, st.m, st.f, charts, level);
  const content = d.content;
  if (!content) return fail(d.why);
  stopDrawing();
  root.innerHTML = m.embed(content);
  /* The way back to this exact view in the engine: on the title, and on a teaser's pointer. */
  const deep = `${SHARE_PATH}?${shareQuery({ ...st, f: content.focus })}&ref=embed`;
  const more = root.querySelector('.hk-more');
  if (more) more.innerHTML = `<a href="${esc(deep)}" target="_blank" rel="noopener">${more.innerHTML}</a>`;
  const open = document.getElementById('hk-open') as HTMLAnchorElement | null;
  if (open && (charts.length || st.m !== 'daily')) open.href = deep;
  document.title = `${content.title} · Horoskopos`;
  const cv = root.querySelector<HTMLCanvasElement>('canvas[data-chart]');
  if (cv) {
    /* The chart view stays on the engine's table here (the page shows nothing else), lit on the module's focus. */
    const staged = m.charts === 2 ? charts.slice(0, 2) : charts.slice(0, 1), stage = m.stage(content.focus, staged.length);
    api.loadShared(staged, { view: stage.view || 'wheel', trail: stage.trail || [] });
    api.S.still = still;
    if (m.light) m.light(api, content.focus);
    chart(api, cv);
  }
  tell();
}

async function start() {
  try {
    /* Only a view that casts today's sky needs the planet library; it must be in place before the engine reads it. */
    if (st.m === 'daily') await script('/machines/natal/astronomy.min.js');
    await script('/machines/natal/engine.js');
  } catch { return fail('The engine did not load. Try again in a moment.'); }
  const api = (window as unknown as { __natal?: Natal }).__natal;
  if (!api) return fail('The engine did not load. Try again in a moment.');
  show(api);
  new ResizeObserver(tell).observe(document.documentElement);
  if (document.fonts && document.fonts.ready) void document.fonts.ready.then(tell);
  if (st.m === 'daily') {
    /* The daily read turns over with the date, on its own, for as long as the page stays open. */
    let day = new Date().toDateString();
    setInterval(() => { const now = new Date().toDateString(); if (now !== day) { day = now; show(api); } }, 5 * 60 * 1000);
  }
}
void start();
