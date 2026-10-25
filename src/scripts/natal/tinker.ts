/**
 * Tinker overlay (?tinker=1) — plain DOM, --font-ui, no library. Layer
 * toggles, tuning dials, loop/frame readouts and the eye-mask tuner. Edits
 * the live engine opts in place; nothing persists.
 */
import * as clock from '../clock';
import { LAYER_NAMES, type LayerName, type NatalEngine } from './engine';
import type { Dioscuri } from './dioscuri';

export interface TinkerDeps {
  engine: NatalEngine;
  portrait: Dioscuri | null;
  stage: HTMLElement;
  getLoop: () => { running: boolean; frames: number };
}

const STYLE = `
.iw-tinker{position:fixed;top:12px;right:12px;z-index:50;width:238px;max-height:calc(100vh - 24px);overflow:auto;
  background:rgba(8,8,10,.86);border:1px solid rgba(255,255,255,.12);border-radius:6px;padding:10px 12px;
  font:11px/1.5 var(--font-ui, ui-monospace, monospace);color:#cfcbc2;backdrop-filter:blur(6px)}
.iw-tinker h4{font-weight:400;letter-spacing:.14em;text-transform:uppercase;font-size:9.5px;color:#9a958c;margin:10px 0 4px}
.iw-tinker h4:first-child{margin-top:0}
.iw-tinker label{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:2px 0}
.iw-tinker label span{flex:1}
.iw-tinker input[type=range]{width:110px;accent-color:#c9a05e}
.iw-tinker input[type=checkbox]{accent-color:#c9a05e}
.iw-tinker .v{width:46px;text-align:right;color:#e8e4dc;font-variant-numeric:tabular-nums}
.iw-tinker .ro{display:flex;justify-content:space-between;color:#9a958c}
.iw-tinker .ro b{font-weight:400;color:#e8e4dc;font-variant-numeric:tabular-nums}
.iw-tinker .grid{display:grid;grid-template-columns:1fr 1fr;gap:0 8px}
`;

interface Dial {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  get: () => number;
  set: (v: number) => void;
  fmt?: (v: number) => string;
}

export function mountTinker({ engine, portrait, getLoop }: TinkerDeps) {
  if (document.querySelector('.iw-tinker')) return;
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.className = 'iw-tinker';
  root.setAttribute('aria-label', 'Natal hero tinker');
  document.body.appendChild(root);

  const h = (t: string) => {
    const e = document.createElement('h4');
    e.textContent = t;
    root.appendChild(e);
  };

  /* ---- layers ---- */
  h('layers');
  const grid = document.createElement('div');
  grid.className = 'grid';
  root.appendChild(grid);
  for (const name of LAYER_NAMES as LayerName[]) {
    const l = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = engine.opts.layers[name];
    cb.addEventListener('change', () => {
      engine.opts.layers[name] = cb.checked;
      // Lens participation changes beam geometry; a resize relayouts.
      if (name === 'lens') engine.setProgress(engine.getProgress() + 1e-6);
    });
    const s = document.createElement('span');
    s.textContent = name;
    l.append(s, cb);
    grid.appendChild(l);
  }

  /* ---- dials ---- */
  h('dials');
  const o = engine.opts;
  const dials: Dial[] = [
    { key: 'brilliance', label: 'brilliance', min: 0.5, max: 1.7, step: 0.01, get: () => o.brilliance, set: (v) => (o.brilliance = v) },
    { key: 'density', label: 'density', min: 0.2, max: 1.6, step: 0.01, get: () => o.density, set: (v) => (o.density = v) },
    { key: 'flow', label: 'flow speed', min: 0.4, max: 2, step: 0.01, get: () => o.flowSpeed, set: (v) => (o.flowSpeed = v) },
    { key: 'venus', label: 'Venus bpm', min: 40, max: 84, step: 1, get: () => o.venusBpm, set: (v) => (o.venusBpm = v) },
    { key: 'eighth', label: 'eighth ms (pit re-locks)', min: 230, max: 420, step: 1, get: () => clock.getEighthMs(), set: (v) => clock.setEighthMs(v) },
    { key: 'sigRest', label: 'signal rest', min: 0, max: 0.6, step: 0.01, get: () => o.signalRest, set: (v) => (o.signalRest = v) },
    { key: 'sigSurge', label: 'signal surge', min: 0.2, max: 1, step: 0.01, get: () => o.signalSurge, set: (v) => (o.signalSurge = v) },
    { key: 'tide', label: 'tide period s', min: 10, max: 240, step: 1, get: () => o.tidePeriod, set: (v) => (o.tidePeriod = v) },
    { key: 'disc', label: 'face radius R', min: 0.12, max: 0.4, step: 0.005, get: () => o.discRadius, set: (v) => { o.discRadius = v; engine.setProgress(engine.getProgress() + 1e-6); } },
    { key: 'reach', label: 'lens reach R', min: 0.1, max: 0.4, step: 0.005, get: () => o.lensReach, set: (v) => { o.lensReach = v; engine.setProgress(engine.getProgress() + 1e-6); } },
    { key: 'lilith', label: 'Lilith radius R', min: 0.2, max: 1.05, step: 0.005, get: () => o.lilithRadius, set: (v) => { o.lilithRadius = v; engine.setProgress(engine.getProgress() + 1e-6); } },
  ];
  const addDial = (d: Dial, into: HTMLElement) => {
    const l = document.createElement('label');
    const s = document.createElement('span');
    s.textContent = d.label;
    const r = document.createElement('input');
    r.type = 'range';
    r.min = String(d.min);
    r.max = String(d.max);
    r.step = String(d.step);
    r.value = String(d.get());
    const v = document.createElement('span');
    v.className = 'v';
    const show = () => (v.textContent = d.fmt ? d.fmt(d.get()) : String(+d.get().toFixed(3)));
    r.addEventListener('input', () => {
      d.set(parseFloat(r.value));
      show();
    });
    show();
    l.append(s, r, v);
    into.appendChild(l);
  };
  dials.forEach((d) => addDial(d, root));

  /* ---- eyes ---- */
  if (portrait) {
    h('eye masks (flesh floors at .9)');
    const cfg = portrait.getConfig();
    const eyes = cfg.eyes.map((e) => ({ ...e }));
    const push = () => portrait.setEyes(eyes.map((e) => ({ ...e })));
    eyes.forEach((e, i) => {
      addDial({ key: `e${i}x`, label: `eye ${i + 1} x`, min: 0.2, max: 0.8, step: 0.005, get: () => e.x, set: (v) => { e.x = v; push(); } }, root);
      addDial({ key: `e${i}y`, label: `eye ${i + 1} y`, min: 0.2, max: 0.8, step: 0.005, get: () => e.y, set: (v) => { e.y = v; push(); } }, root);
    });
    addDial({ key: 'rx', label: 'eye rx', min: 0.02, max: 0.16, step: 0.002, get: () => eyes[0].rx, set: (v) => { eyes.forEach((e) => (e.rx = v)); push(); } }, root);
    addDial({ key: 'ry', label: 'eye ry', min: 0.02, max: 0.12, step: 0.002, get: () => eyes[0].ry, set: (v) => { eyes.forEach((e) => (e.ry = v)); push(); } }, root);
  }

  /* ---- readouts ---- */
  h('readouts');
  const ro = document.createElement('div');
  root.appendChild(ro);
  const rows: Record<string, HTMLElement> = {};
  for (const k of ['loop', 'frames', 'fps', 'tick ms', 'particles', 'seekers', 'bends', 'phase', 'progress', 'eighth', 'knock']) {
    const r = document.createElement('div');
    r.className = 'ro';
    const b = document.createElement('b');
    r.append(document.createTextNode(k), b);
    ro.appendChild(r);
    rows[k] = b;
  }

  let lastFrames = 0;
  let lastT = performance.now();
  let fps = 0;
  const update = () => {
    const now = performance.now();
    const loop = getLoop();
    const dtS = (now - lastT) / 1000;
    if (dtS >= 0.5) {
      fps = (loop.frames - lastFrames) / dtS;
      lastFrames = loop.frames;
      lastT = now;
    }
    const c = clock.now(now);
    rows.loop.textContent = loop.running ? 'running' : 'idle';
    rows.frames.textContent = String(loop.frames);
    rows.fps.textContent = fps.toFixed(0);
    rows['tick ms'].textContent = engine.stats.tickMs.toFixed(2);
    rows.particles.textContent = String(engine.stats.particles);
    rows.seekers.textContent = String(engine.stats.seekers);
    rows.bends.textContent = String(engine.stats.bends);
    rows.phase.textContent = engine.getPhase();
    rows.progress.textContent = engine.getProgress().toFixed(3);
    rows.eighth.textContent = `${c.eighth} / ${c.barPhase.toFixed(2)}`;
    rows.knock.textContent = c.knockGlow.toFixed(2);
  };
  window.setInterval(update, 250);
  update();
}
