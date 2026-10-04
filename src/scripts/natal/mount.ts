/**
 * Natal hero mount — wires engine + portrait + scroll choreography + tinker
 * overlay to the hero DOM. Called from boot.ts as one more independent job;
 * returns early on pages without a `.natal-stage`.
 *
 * Owns the single rAF. Idles entirely when the hero is off-screen
 * (IntersectionObserver) or the tab is hidden. Under reduced motion it
 * mounts the engine, renders one static frame, and never starts the loop.
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { emit, on } from '../events';
import * as clock from '../clock';
import { NatalEngine, type EngineOpts } from './engine';
import { Dioscuri } from './dioscuri';
import type { ChartData } from './types';

/** Match MAX_DPR in src/webgl/pipeline.ts. */
const MAX_DPR = 2;

let mounted = false;

export async function mountNatalHero(): Promise<void> {
  if (mounted || typeof window === 'undefined') return;
  const section = document.getElementById('hero');
  const stage = section?.querySelector<HTMLElement>('.natal-stage') ?? null;
  const canvas = stage?.querySelector<HTMLCanvasElement>('canvas.natal-canvas') ?? null;
  const face = stage?.querySelector<HTMLElement>('.natal-face') ?? null;
  if (!section || !stage || !canvas) return;
  mounted = true;

  const params = new URLSearchParams(location.search);
  const tinker = params.get('tinker') === '1';
  const chartKey = params.get('chart');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.innerWidth < 640;

  const chart: ChartData =
    chartKey === 'test'
      ? (await import('./chart.test')).TEST_CHART
      : (await import('./chart.michael')).CHART;

  const opts: Partial<EngineOpts> = {
    // Phones get a larger face relative to the wheel; R is already small.
    discRadius: isMobile ? 0.3 : 0.26,
    onVenusBeat: (env) => emit('iw:venus-beat', { env }),
  };
  const engine = new NatalEngine(canvas, chart, opts);

  // Portrait: the glyph atlas is the site's own coverage-ranked Greek ramp.
  let portrait: Dioscuri | null = null;
  if (chart.portrait) {
    const { buildGlyphAtlas } = await import('../../webgl/glyph-atlas');
    const atlas = buildGlyphAtlas(48);
    portrait = new Dioscuri(chart.portrait, { atlas, cellPx: isMobile ? 6 : 8 });
    engine.setPortrait(portrait);
  }

  /* ---------------- sizing ---------------- */
  const dpr = () => Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const resize = () => {
    const r = stage.getBoundingClientRect();
    engine.resize(r.width, r.height, dpr());
    placeFace();
  };

  /* ---------------- egg anchor tracks the disc ---------------- */
  let lastFace = '';
  const placeFace = () => {
    if (!face) return;
    const { x, y, r } = engine.disc;
    const key = `${x | 0},${y | 0},${r | 0}`;
    if (key === lastFace) return;
    lastFace = key;
    face.style.transform = `translate(${x - r}px, ${y - r}px)`;
    face.style.width = face.style.height = `${r * 2}px`;
  };

  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  resize();

  /* ---------------- scroll ---------------- */
  let lastPhase = '';
  const setProgress = (p: number) => {
    engine.setProgress(p);
    const phase = engine.getPhase();
    // Dissolve: the whole canvas fades so the WebGL constellation beneath
    // shows through at p = 1.
    const dis = Math.max(0, (p - 0.75) / 0.25);
    canvas.style.opacity = String(1 - dis * dis);
    placeFace();
    const key = `${phase}:${p.toFixed(3)}`;
    if (key !== lastPhase) {
      lastPhase = key;
      emit('iw:natal-phase', { progress: p, phase });
    }
  };

  /* ---------------- inverse dither (swan-preen) ---------------- */
  on('iw:dither-style', ({ style }) => portrait?.setInverse(style === 'inverse'));

  /* ---------------- reduced motion: one lit frame ---------------- */
  if (reduced) {
    const paint = () => {
      engine.renderStatic();
      placeFace();
    };
    if (portrait) portrait.load().then(() => { resize(); paint(); });
    paint();
    setProgress(0);
    if (tinker) (await import('./tinker')).mountTinker({ engine, portrait, stage, getLoop: () => ({ running: false, frames: engine.stats.frames }) });
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => setProgress(self.progress),
    onRefresh: (self) => setProgress(self.progress),
  });
  setProgress(0);

  /* ---------------- pointer ---------------- */
  const toLocal = (e: PointerEvent): [number, number] => {
    const r = stage.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  stage.addEventListener('pointermove', (e) => {
    const [x, y] = toLocal(e);
    engine.setPointer(x, y);
  });
  stage.addEventListener('pointerleave', () => engine.setPointer(null));
  stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') {
      const [x, y] = toLocal(e);
      engine.tap(x, y);
    }
  });

  /* ---------------- the loop ---------------- */
  let running = false;
  let raf = 0;
  let last = 0;
  let inView = true;

  const frame = (t: number) => {
    raf = 0;
    if (!running) return;
    const dt = last ? (t - last) / 1000 : 1 / 60;
    last = t;
    engine.tick(dt, clock.now(t));
    placeFace();
    raf = requestAnimationFrame(frame);
  };
  const start = () => {
    if (running) return;
    running = true;
    last = 0;
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
  const sync = () => {
    if (inView && !document.hidden) start();
    else stop();
  };

  const io = new IntersectionObserver(
    (entries) => {
      inView = entries.some((e) => e.isIntersecting);
      sync();
    },
    { threshold: 0 },
  );
  io.observe(section);
  document.addEventListener('visibilitychange', sync);

  if (portrait) {
    portrait.load().then(() => {
      lastFace = '';
      resize();
    });
  }
  sync();

  if (tinker) {
    const { mountTinker } = await import('./tinker');
    mountTinker({ engine, portrait, stage, getLoop: () => ({ running, frames: engine.stats.frames }) });
  }
}
