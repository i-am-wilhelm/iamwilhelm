/**
 * GLYPH DITHER POST PASS — the site's signature filter.
 *
 * The composited scene target (backdrop + constellation + morph + smoke)
 * is resolved through a field of ancient Greek characters: the screen is
 * cut into cells, each cell samples the scene's luminance and picks a
 * glyph from the runtime atlas by brightness bucket (lightest ink for
 * dark, heaviest for bright). Per-channel atlas offsets give every glyph
 * RGB chromatic fringing.
 *
 * SATURATION PRESERVATION (critical): base visuals are painted with
 * saturated focal zones. Instead of flattening chroma to a duotone, the
 * glyph color's chroma is *scaled up* where the source is saturated —
 * hot zones resolve MORE saturated than their surroundings.
 *
 * Also owns the weather treatment for the monsoon section: falling glyph
 * rain with lightning glitch flashes over a PNW palette when raining; a
 * dusty drought dither when dry.
 */

import { Mesh, Program, Texture, Triangle } from 'ogl';
import type { OGLRenderingContext } from 'ogl';
import { NOISE_GLSL, COLOR_GLSL, FULLSCREEN_VERT } from '../glsl';
import { buildGlyphAtlas } from '../glyph-atlas';
import { damp } from '../utils';
import type { PipelineState } from '../state';

/**
 * Glyph treatment presets, swappable at runtime via iw:dither-style (the
 * easter-egg engine mutates these). Unknown names fall back to 'default'.
 * Parameters crossfade over ~1/3 s so swaps feel like a lens change, not
 * a cut.
 */
export interface DitherStyle {
  /** Multiplier on the base cell size — smaller = finer glyph grid. */
  cellScale: number;
  /** 1 = invert the luminance→glyph mapping (heavy ink in shadows). */
  invert: number;
  /** 0..1 — glyph identity scramble + sample jitter. */
  chaos: number;
  /** Multiplier pushing the mapping into heavier-coverage glyphs. */
  density: number;
  /** Chromatic fringe amplitude (fraction of a cell). */
  fringe: number;
  /** Gamma applied to scene luminance before bucketing. */
  gamma: number;
}

export const DITHER_STYLES: Record<string, DitherStyle> = {
  default: { cellScale: 1.0, invert: 0, chaos: 0.0, density: 1.0, fringe: 1.0, gamma: 1.0 },
  dense: { cellScale: 0.55, invert: 0, chaos: 0.05, density: 1.35, fringe: 0.7, gamma: 0.85 },
  inverse: { cellScale: 1.0, invert: 1, chaos: 0.0, density: 1.0, fringe: 1.3, gamma: 1.0 },
  chaos: { cellScale: 0.8, invert: 0, chaos: 1.0, density: 1.1, fringe: 2.6, gamma: 0.9 },
};

export const DITHER_STYLE_NAMES = Object.keys(DITHER_STYLES);

/** Base glyph cell size in CSS pixels (scaled by DPR in the shader). */
const CELL_BASE_PX = 14;

const FRAG = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform sampler2D uScene;    // composited scene target
uniform sampler2D uAtlas;    // runtime glyph atlas (ink in alpha)
uniform vec2  uResolution;   // drawing buffer px
uniform float uDpr;
uniform float uTime;

uniform vec2  uAtlasGrid;    // atlas cols, rows
uniform float uGlyphCount;

/* Style preset params (crossfaded in JS). */
uniform float uCellScale;
uniform float uInvert;
uniform float uChaos;
uniform float uDensity;
uniform float uFringe;
uniform float uGamma;

/* Weather (gated by monsoon-section activation in JS). */
uniform float uRain;         // 0..1 falling-glyph rain
uniform float uDrought;      // 0..1 dry dusty state
uniform float uLightning;    // flash strength, decays in JS

${NOISE_GLSL}
${COLOR_GLSL}

/* Sample the glyph cell's ink. Intra-cell uv outside [0,1] returns 0 so
   fringe offsets bleed to empty rather than into neighboring glyphs.
   Atlas texture is uploaded unflipped: row 0 (canvas top) at uv y = 0,
   so intra-cell y is mirrored (screen-up = glyph-top = low canvas y). */
float glyphInk(vec2 gcell, vec2 cuv) {
  if (cuv.x < 0.0 || cuv.x > 1.0 || cuv.y < 0.0 || cuv.y > 1.0) return 0.0;
  vec2 auv = (gcell + vec2(cuv.x, 1.0 - cuv.y)) / uAtlasGrid;
  return texture2D(uAtlas, auv).a;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float cellPx = ${CELL_BASE_PX.toFixed(1)} * uCellScale * uDpr;

  // Lightning glitch: whole cell-rows tear sideways for a frame or two.
  if (uLightning > 0.02) {
    float row = floor(frag.y / cellPx);
    float tear = hash21(vec2(row, floor(uTime * 24.0)));
    frag.x += (tear - 0.5) * uLightning * cellPx * 6.0 * step(0.6, tear);
  }

  vec2 cell = floor(frag / cellPx);
  vec2 cellUv = fract(frag / cellPx);
  vec2 sceneUv = (cell + 0.5) * cellPx / uResolution;

  // Chaos style: jitter where the cell samples the scene.
  sceneUv += (vec2(hash21(cell + 7.31), hash21(cell + 3.17)) - 0.5)
           * uChaos * 2.0 * (cellPx / uResolution);

  vec4 src = texture2D(uScene, clamp(sceneUv, 0.0, 1.0));
  vec3 srcRgb = src.rgb;
  float srcA = src.a;
  float lum = luma(srcRgb);

  // ---- Weather: falling glyph rain (monsoon, raining) ----------------
  // Per-column drops: a bright head with a decaying tail streams down the
  // glyph grid; heads force bright buckets so characters visibly cascade.
  if (uRain > 0.002) {
    float colSeed = hash21(vec2(cell.x, 91.7));
    float speed = mix(0.35, 1.1, colSeed);
    float phase = fract(colSeed * 13.7 + uTime * speed - cell.y * 0.045);
    float drop = pow(phase, 7.0);
    lum = max(lum, drop * uRain);
    srcA = max(srcA, drop * uRain * 0.85);
  }

  // ---- Weather: drought (monsoon, dry) — thin, parched field ---------
  lum *= 1.0 - 0.45 * uDrought;

  // ---- Brightness → glyph bucket -------------------------------------
  lum = pow(clamp(lum, 0.0, 1.0), uGamma);
  float mapped = mix(lum, 1.0 - lum, uInvert);
  float idxF = clamp(mapped * uDensity, 0.0, 1.0) * (uGlyphCount - 1.0);

  // Chaos style: scramble glyph identity, re-rolled ~8×/s so it seethes.
  idxF += (hash21(cell + floor(uTime * 8.0) * 0.371) - 0.5)
        * uChaos * uGlyphCount * 0.5;
  float idx = clamp(floor(idxF + 0.5), 0.0, uGlyphCount - 1.0);
  vec2 gcell = vec2(mod(idx, uAtlasGrid.x), floor(idx / uAtlasGrid.x));

  // ---- Chromatic fringing --------------------------------------------
  // Per-channel intra-cell offsets, radial from screen center like a
  // cheap lens: red pulls outward, blue inward, green stays true.
  vec2 radial = normalize(vUv - 0.5 + vec2(1e-4));
  vec2 fr = radial * uFringe * 0.07;
  vec3 ink = vec3(
    glyphInk(gcell, cellUv + fr),
    glyphInk(gcell, cellUv),
    glyphInk(gcell, cellUv - fr)
  );

  // ---- Saturation preservation (the critical bit) --------------------
  // Chroma gain *rises* with source saturation: painted focal zones
  // resolve more saturated than their surroundings; near-gray regions
  // stay in quiet ink instead of picking up noise chroma.
  float s = satOf(srcRgb);
  float satGain = 1.0 + smoothstep(0.12, 0.55, s) * 1.6;
  vec3 glyphCol = chromaScale(srcRgb, satGain);
  // Brightness shaping: keep bright cells luminous, lift near-black cells
  // to a faint ink so the field never fully dies.
  glyphCol = glyphCol * (0.55 + 0.8 * lum) + vec3(0.05) * (1.0 - s);

  // ---- Weather palettes ----------------------------------------------
  // Raining: resolve toward a PNW register — evergreen shadow to wet-sky
  // slate — instead of the desert accent underneath.
  vec3 pnw = mix(vec3(0.04, 0.09, 0.10), vec3(0.55, 0.70, 0.66), lum);
  glyphCol = mix(glyphCol, pnw, uRain * 0.65);
  // Drought: dusty, sun-bleached warm gray.
  vec3 dust = vec3(lum) * vec3(0.72, 0.62, 0.45);
  glyphCol = mix(glyphCol, dust, uDrought * 0.5);

  // Lightning: additive white flash over everything.
  glyphCol += vec3(uLightning * 0.9);

  float coverage = max(ink.r, max(ink.g, ink.b));
  float alpha = coverage * clamp(srcA * 1.4, 0.0, 1.0);
  alpha = max(alpha, uLightning * 0.25); // flash reaches empty cells too

  gl_FragColor = vec4(glyphCol * ink / max(coverage, 1e-3), alpha);
}
`;

export class DitherPass {
  mesh: Mesh;
  private uniforms: Record<string, { value: unknown }>;
  /** Currently displayed params, damped toward the target preset. */
  private current: DitherStyle = { ...DITHER_STYLES.default };
  private target: DitherStyle = DITHER_STYLES.default;

  constructor(gl: OGLRenderingContext, sceneTexture: Texture) {
    const atlas = buildGlyphAtlas();
    const atlasTexture = new Texture(gl, {
      image: atlas.canvas,
      generateMipmaps: false,
      flipY: false, // shader mirrors intra-cell y itself
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
    });

    this.uniforms = {
      uScene: { value: sceneTexture },
      uAtlas: { value: atlasTexture },
      uResolution: { value: [1, 1] },
      uDpr: { value: 1 },
      uTime: { value: 0 },
      uAtlasGrid: { value: [atlas.cols, atlas.rows] },
      uGlyphCount: { value: atlas.count },
      uCellScale: { value: this.current.cellScale },
      uInvert: { value: 0 },
      uChaos: { value: 0 },
      uDensity: { value: 1 },
      uFringe: { value: 1 },
      uGamma: { value: 1 },
      uRain: { value: 0 },
      uDrought: { value: 0 },
      uLightning: { value: 0 },
    };

    const program = new Program(gl, {
      vertex: FULLSCREEN_VERT,
      fragment: FRAG,
      uniforms: this.uniforms,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
  }

  /** Swap glyph treatment. Unknown names fall back to 'default'. */
  setStyle(name: string) {
    this.target = DITHER_STYLES[name] ?? DITHER_STYLES.default;
  }

  /** Re-point the scene input (after render-target resize). */
  setSceneTexture(texture: Texture) {
    this.uniforms.uScene.value = texture;
  }

  update(
    state: PipelineState,
    time: number,
    dt: number,
    width: number,
    height: number,
    dpr: number,
    monsoonActivation: number,
  ) {
    // Crossfade preset params.
    const c = this.current;
    const t = this.target;
    c.cellScale = damp(c.cellScale, t.cellScale, 8, dt);
    c.invert = damp(c.invert, t.invert, 8, dt);
    c.chaos = damp(c.chaos, t.chaos, 8, dt);
    c.density = damp(c.density, t.density, 8, dt);
    c.fringe = damp(c.fringe, t.fringe, 8, dt);
    c.gamma = damp(c.gamma, t.gamma, 8, dt);

    const u = this.uniforms;
    u.uTime.value = time;
    u.uResolution.value = [width, height];
    u.uDpr.value = dpr;
    u.uCellScale.value = c.cellScale;
    u.uInvert.value = c.invert;
    u.uChaos.value = c.chaos;
    u.uDensity.value = c.density;
    u.uFringe.value = c.fringe;
    u.uGamma.value = c.gamma;

    // Weather only manifests over the monsoon section.
    u.uRain.value = state.rainCurrent * monsoonActivation;
    u.uDrought.value = (1 - state.rainCurrent) * monsoonActivation;
    u.uLightning.value = state.lightning * monsoonActivation;
  }
}
