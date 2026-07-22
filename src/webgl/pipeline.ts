/**
 * SHADER CORE — WebGL pipeline for the fixed #gl-stage canvas.
 *
 * One OGL renderer, two stages:
 *
 *   scene target (RTT)                       screen
 *   ┌──────────────────────────────┐         ┌───────────────────┐
 *   │ 1. backdrop  (splash/aura)   │         │                   │
 *   │ 2. constellation (stars)     │ ──────▶ │  glyph dither     │
 *   │ 3. morph (stretch/resolve)   │  texture│  post pass        │
 *   │ 4. smoke (fumigation)        │         │                   │
 *   └──────────────────────────────┘         └───────────────────┘
 *
 * Everything below the dither is plain luminance/chroma painting; the
 * dither is what the visitor actually sees, so smoke, morphs, and
 * constellations all automatically "wear" the Greek glyph field.
 *
 * All cross-subsystem input arrives via window CustomEvents (see
 * ../scripts/events.ts) — no imports from other subsystems.
 */

import { Renderer, RenderTarget } from 'ogl';
import { on } from '../scripts/events';
import { createState, activation, type PipelineState } from './state';
import { clamp, damp, damp3, hexToRgb } from './utils';
import { BackdropPass } from './passes/backdrop';
import { ConstellationPass } from './passes/constellation';
import { MorphPass, MORPHS, MORPH_NAMES } from './passes/morphs';
import { SmokePass } from './passes/smoke';
import { DitherPass, DITHER_STYLES, DITHER_STYLE_NAMES } from './passes/dither';

export { DITHER_STYLES, DITHER_STYLE_NAMES, MORPH_NAMES };

export interface PipelineHandle {
  /** Stop the loop, unbind all listeners, release the GL context. */
  destroy(): void;
}

const MAX_DPR = 2;

/**
 * Boot the pipeline on the given canvas. Resolves to a handle, or null
 * when WebGL is unavailable (the page then simply runs without the
 * shader layer — never throws).
 */
export async function initPipeline(
  canvas: HTMLCanvasElement,
): Promise<PipelineHandle | null> {
  let renderer: Renderer;
  try {
    renderer = new Renderer({
      canvas,
      dpr: Math.min(window.devicePixelRatio || 1, MAX_DPR),
      alpha: true, // page background shows through empty cells
      depth: false,
      antialias: false, // the dither *is* the antialiasing aesthetic
    });
  } catch {
    return null;
  }
  const gl = renderer.gl;
  if (!gl) return null; // OGL logs, doesn't throw, when contexts fail

  const state = createState();
  const monsoonIndex = state.sections.findIndex((s) => s.id === 'monsoon');
  // Deconstruction context (9th-house register): the dead letters surface
  // most often over the philosophy section.
  const deconIndex = state.sections.findIndex((s) => s.id === 'philosophy');

  // ---- Scene target + passes -----------------------------------------
  const size = () => ({
    w: window.innerWidth,
    h: window.innerHeight,
  });
  let { w, h } = size();
  renderer.setSize(w, h);

  let sceneTarget = new RenderTarget(gl, {
    width: gl.drawingBufferWidth,
    height: gl.drawingBufferHeight,
    depth: false,
  });

  const backdrop = new BackdropPass(gl);
  const constellation = new ConstellationPass(gl, state.sections);
  const morph = new MorphPass(gl);
  const smoke = new SmokePass(gl);
  const dither = new DitherPass(gl, sceneTarget.texture);

  // ---- Event wiring ---------------------------------------------------
  // Handlers only write *targets*; the frame loop damps visuals toward
  // them, so bursts of events can never pop the imagery.
  const offs: (() => void)[] = [];

  offs.push(
    on('iw:scroll', ({ progress, velocity }) => {
      state.scrollProgress = clamp(progress, 0, 1);
      state.scrollVelocity = velocity;
    }),

    on('iw:section-enter', ({ id }) => {
      const section = state.sections.find((s) => s.id === id);
      if (section) state.activeIndex = section.index;
    }),

    on('iw:section-progress', ({ id, progress }) => {
      const section = state.sections.find((s) => s.id === id);
      if (section && section.index === state.activeIndex) {
        state.sectionProgress = clamp(progress, 0, 1);
      }
    }),

    on('iw:morph', ({ name, progress }) => {
      const idx = MORPHS[name];
      if (idx === undefined) return;
      state.morphIndex = idx;
      state.morphProgress = clamp(progress, 0, 1);
    }),

    on('iw:dither-style', ({ style }) => {
      dither.setStyle(style);
    }),

    on('iw:splash', ({ id, color }) => {
      const section = state.sections.find((s) => s.id === id);
      // Flash color: explicit color wins, else the section's accent,
      // else warm white.
      state.splashColor = color
        ? hexToRgb(color)
        : section
          ? [...section.accent]
          : [1, 0.95, 0.85];
      state.splashStrength = 1;
    }),

    on('iw:weather', ({ raining }) => {
      state.raining = raining;
    }),
  );

  // ---- Resize ----------------------------------------------------------
  const onResize = () => {
    ({ w, h } = size());
    renderer.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    renderer.setSize(w, h);
    sceneTarget.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    dither.setSceneTexture(sceneTarget.texture);
  };
  window.addEventListener('resize', onResize);

  // ---- Frame loop ------------------------------------------------------
  let raf = 0;
  let running = false;
  let last = performance.now();
  let elapsed = 0; // pauses with the tab, so animations never jump

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = clamp((now - last) / 1000, 0.0001, 0.1);
    last = now;
    elapsed += dt;
    tick(dt, elapsed);
  };

  const start = () => {
    if (running) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
  };

  // Idle when the tab is hidden.
  const onVisibility = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVisibility);

  function tick(dt: number, time: number) {
    updateState(state, dt, time);

    const aspect = w / Math.max(1, h);
    const dpr = renderer.dpr;

    // Stage 1: composite the scene into the offscreen target.
    backdrop.update(state, time, aspect);
    renderer.render({ scene: backdrop.mesh, target: sceneTarget });

    constellation.update(state, time, dpr);
    renderer.render({
      scene: constellation.scene,
      target: sceneTarget,
      clear: false,
      sort: false,
      frustumCull: false,
    });

    if (morph.update(state, dt, aspect)) {
      renderer.render({ scene: morph.mesh, target: sceneTarget, clear: false });
    }

    smoke.update(state, time, aspect);
    renderer.render({ scene: smoke.mesh, target: sceneTarget, clear: false });

    // Stage 2: resolve the scene through the glyph dither to the screen.
    const monsoonAct = monsoonIndex >= 0 ? activation(state, monsoonIndex) : 0;
    const deconAct = deconIndex >= 0 ? activation(state, deconIndex) : 0;
    dither.update(
      state,
      time,
      dt,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
      dpr,
      monsoonAct,
      deconAct,
    );
    renderer.render({ scene: dither.mesh });
  }

  start();

  return {
    destroy() {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      offs.forEach((off) => off());
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}

/** Per-frame damping of event targets into displayed values. */
function updateState(state: PipelineState, dt: number, time: number) {
  const active = state.sections[state.activeIndex];

  // Continuous section position: index plus centered local progress.
  const targetFloat = state.activeIndex + (state.sectionProgress - 0.5);
  state.sectionFloat = damp(state.sectionFloat, targetFloat, 5, dt);

  // Scroll velocity smoothing — the smoke swing rides this.
  state.smoothVelocity = damp(state.smoothVelocity, state.scrollVelocity, 4, dt);
  state.scrollVelocity *= Math.exp(-2 * dt); // decay between scroll events

  if (active) {
    // Smoke side swings left↔right as sections alternate. Deliberately
    // lazy (low lambda): the vapor drags across the floor mid-swing.
    state.smokeSideCurrent = damp(state.smokeSideCurrent, active.smokeSide, 2.5, dt);
    damp3(state.accentCurrent, active.accent, 3.5, dt);
    state.focalCurrent[0] = damp(state.focalCurrent[0], active.focal[0], 3, dt);
    state.focalCurrent[1] = damp(state.focalCurrent[1], active.focal[1], 3, dt);
  }

  // Splash flash decays exponentially (~0.7 s tail).
  state.splashStrength *= Math.exp(-4.5 * dt);

  // Weather: rain soaks in / dries out slowly.
  state.rainCurrent = damp(state.rainCurrent, state.raining ? 1 : 0, 1.2, dt);

  // Lightning scheduler: while raining, strikes at irregular intervals.
  state.lightning *= Math.exp(-9 * dt); // sharp flash, fast decay
  if (state.raining && state.rainCurrent > 0.5) {
    if (state.nextLightningAt === 0) {
      state.nextLightningAt = time + 3 + Math.random() * 9;
    } else if (time >= state.nextLightningAt) {
      state.lightning = 0.7 + Math.random() * 0.3;
      state.nextLightningAt = time + 3 + Math.random() * 9;
    }
  } else {
    state.nextLightningAt = 0;
  }
}
