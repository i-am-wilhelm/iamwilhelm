/**
 * STRETCH-AND-RESOLVE MORPH PASS — into the scene target, above the
 * constellation, below the smoke.
 *
 * A morph is two silhouettes and a motion path. Mid-progress, the source
 * silhouette is *smeared* along the path (multi-tap accumulation), so the
 * luminance field — and therefore the glyph field the dither hangs on it —
 * stretches like taffy; approaching progress 1 the smear collapses and
 * the target silhouette resolves. Driven by iw:morph {name, progress}.
 *
 * Silhouettes are procedural SDF placeholders, clearly marked TODO for
 * owner-supplied art. Registry (symbology: classical / alchemical /
 * Greco-Egyptian only):
 *
 *   0 'trismegistus'   caduceus (L) + Was-scepter (R) flanking a small
 *                      centerpoint → both stretch inward → Trismegistus
 *                      figure resolves at center.
 *   1 'cross-cube'     unfolded-cube cross → folds → black cube.
 *   2 'atlas-columbia' Atlas bearing the sphere → Columbia/Pallas Athena
 *                      upright with spear and aegis.
 */

import { Mesh, Program, Triangle } from 'ogl';
import type { OGLRenderingContext } from 'ogl';
import { FULLSCREEN_VERT, COLOR_GLSL, SDF_GLSL } from '../glsl';
import type { PipelineState } from '../state';

/** name → shader morph id. Exported for the pipeline's event wiring. */
export const MORPHS: Record<string, number> = {
  trismegistus: 0,
  'cross-cube': 1,
  'atlas-columbia': 2,
};

export const MORPH_NAMES = Object.keys(MORPHS);

const FRAG = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform float uAspect;
uniform float uMorph;    // 0 | 1 | 2 (see MORPHS)
uniform float uProgress; // 0..1 along stretch-and-resolve
uniform float uFade;     // overall pass opacity (damped in JS)
uniform vec3  uAccent;

${COLOR_GLSL}
${SDF_GLSL}

/* ------------------------------------------------------------------ */
/* Morph 0 — 'trismegistus'                                            */
/* ------------------------------------------------------------------ */

/* TODO(owner art): replace with the drawn caduceus silhouette.
   Placeholder: staff + two counter-phased serpent sines + wing bars. */
float caduceus(vec2 p) {
  float staff = sdSegment(p, vec2(0.0, -0.28), vec2(0.0, 0.30)) - 0.012;
  float serpA = abs(p.x - sin((p.y + 0.28) * 12.0) * 0.06 * smoothstep(0.34, -0.2, p.y)) - 0.014;
  serpA = max(serpA, sdBox(p - vec2(0.0, 0.0), vec2(0.09, 0.26)));
  float serpB = abs(p.x + sin((p.y + 0.28) * 12.0) * 0.06 * smoothstep(0.34, -0.2, p.y)) - 0.014;
  serpB = max(serpB, sdBox(p - vec2(0.0, 0.0), vec2(0.09, 0.26)));
  float wings = min(
    sdBox(p - vec2(-0.075, 0.24), vec2(0.05, 0.012)),
    sdBox(p - vec2(0.075, 0.24), vec2(0.05, 0.012)));
  float orb = sdCircle(p - vec2(0.0, 0.315), 0.028);
  return min(min(staff, orb), min(wings, min(serpA, serpB)));
}

/* TODO(owner art): replace with the drawn Was-scepter silhouette.
   Placeholder: straight shaft, angled Set-beast head, forked base. */
float wasScepter(vec2 p) {
  float shaft = sdSegment(p, vec2(0.0, -0.26), vec2(0.0, 0.26)) - 0.012;
  float head = sdSegment(p, vec2(0.0, 0.26), vec2(0.07, 0.30)) - 0.014;
  float snout = sdSegment(p, vec2(0.07, 0.30), vec2(0.10, 0.27)) - 0.010;
  float forkL = sdSegment(p, vec2(0.0, -0.26), vec2(-0.05, -0.32)) - 0.010;
  float forkR = sdSegment(p, vec2(0.0, -0.26), vec2(0.05, -0.32)) - 0.010;
  return min(min(shaft, head), min(snout, min(forkL, forkR)));
}

/* TODO(owner art): replace with the drawn Thoth-Hermes-Trismegistus
   figure. Placeholder: hooded standing figure, staff in hand. */
float trisFigure(vec2 p) {
  float head = sdCircle(p - vec2(0.0, 0.24), 0.055);
  // Robe: box widened toward the ground (trapezoid via x-scale by height).
  vec2 rp = p - vec2(0.0, -0.04);
  rp.x /= 1.0 + (0.12 - rp.y) * 1.2;
  float robe = sdBox(rp, vec2(0.07, 0.22));
  float staff = sdSegment(p, vec2(0.11, -0.26), vec2(0.11, 0.28)) - 0.008;
  return min(min(head, robe), staff);
}

float morphTrismegistus(vec2 p, float s) {
  // Flanks converge on the centerpoint as s advances.
  float travel = smoothstep(0.0, 0.75, s);
  vec2 posL = mix(vec2(-0.55, 0.0), vec2(0.0), travel);
  vec2 posR = mix(vec2(0.55, 0.0), vec2(0.0), travel);

  float flanks = min(caduceus(p - posL), wasScepter(p - posR));
  float centerpoint = sdCircle(p, 0.012 + 0.01 * sin(s * 6.2831));
  float a = min(flanks, centerpoint);

  float b = trisFigure(p);
  float resolve = smoothstep(0.65, 0.95, s);
  return mix(fill(a, 0.02), fill(b, 0.02), resolve);
}

/* ------------------------------------------------------------------ */
/* Morph 1 — 'cross-cube'                                              */
/* ------------------------------------------------------------------ */

/* TODO(owner art): replace with the drawn unfolded-cube cross.
   Placeholder: six squares in the classic cruciform net. */
float crossNet(vec2 p, float foldY) {
  float sq = 0.085;
  // Vertical arm of four squares folds upward (squashes) as foldY→0.
  vec2 vp = p;
  vp.y /= max(foldY, 0.08);
  float vert = sdBox(vp - vec2(0.0, 0.043 / max(foldY, 0.08)), vec2(sq, sq * 2.0));
  float horz = sdBox(p - vec2(0.0, 0.06), vec2(sq * 3.0, sq));
  return min(vert, horz);
}

/* TODO(owner art): replace with the drawn black cube (sol niger register).
   Placeholder: hexagonal isometric-cube silhouette. The inner Y-edges
   will come with the owner art; a silhouette mask can't carve grooves. */
float cube(vec2 p) {
  return sdHexagon(p, 0.19);
}

float morphCrossCube(vec2 p, float s) {
  float foldPhase = smoothstep(0.15, 0.7, s);
  float a = crossNet(p, 1.0 - foldPhase * 0.9);
  float b = cube(p);
  float resolve = smoothstep(0.6, 0.92, s);
  return mix(fill(a, 0.015), fill(b, 0.015), resolve);
}

/* ------------------------------------------------------------------ */
/* Morph 2 — 'atlas-columbia'                                          */
/* ------------------------------------------------------------------ */

/* TODO(owner art): replace with the drawn Atlas silhouette.
   Placeholder: crouched figure under the celestial sphere. */
float atlas(vec2 p) {
  float sphere = sdCircle(p - vec2(0.0, 0.22), 0.14);
  float ring = abs(sdCircle(p - vec2(0.0, 0.22), 0.14)) - 0.006; // ecliptic band
  float head = sdCircle(p - vec2(0.0, 0.04), 0.045);
  float back = sdSegment(p, vec2(0.0, 0.0), vec2(-0.10, -0.18)) - 0.035;
  float legF = sdSegment(p, vec2(-0.10, -0.18), vec2(0.02, -0.30)) - 0.025;
  float armL = sdSegment(p, vec2(-0.02, 0.02), vec2(-0.10, 0.16)) - 0.02;
  float armR = sdSegment(p, vec2(0.02, 0.02), vec2(0.10, 0.16)) - 0.02;
  return min(min(sphere, ring), min(min(head, back), min(legF, min(armL, armR))));
}

/* TODO(owner art): replace with the drawn Columbia / Pallas Athena.
   Placeholder: upright robed figure, spear (R), round aegis shield (L). */
float columbia(vec2 p) {
  float head = sdCircle(p - vec2(0.0, 0.25), 0.05);
  // Crested helm hint.
  float crest = sdSegment(p, vec2(-0.01, 0.30), vec2(0.04, 0.34)) - 0.012;
  vec2 rp = p - vec2(0.0, -0.05);
  rp.x /= 1.0 + (0.1 - rp.y) * 1.0;
  float robe = sdBox(rp, vec2(0.065, 0.24));
  float spear = sdSegment(p, vec2(0.12, -0.30), vec2(0.12, 0.36)) - 0.007;
  float tip = sdSegment(p, vec2(0.12, 0.36), vec2(0.12, 0.40)) - 0.014;
  float shield = sdCircle(p - vec2(-0.13, 0.02), 0.07);
  return min(min(head, crest), min(robe, min(spear, min(tip, shield))));
}

float morphAtlasColumbia(vec2 p, float s) {
  // Atlas straightens as he becomes the standing goddess: shear his
  // sample space upright with progress before crossfading.
  float rise = smoothstep(0.1, 0.7, s);
  vec2 ap = p;
  ap.y *= 1.0 + rise * 0.25;      // un-crouch
  ap.x += ap.y * rise * 0.1;      // shoulders come over hips
  float a = atlas(ap);
  float b = columbia(p);
  float resolve = smoothstep(0.6, 0.95, s);
  return mix(fill(a, 0.02), fill(b, 0.02), resolve);
}

/* ------------------------------------------------------------------ */

/* Silhouette mask for the selected morph at raw progress s. */
float morphMask(vec2 p, float s) {
  if (uMorph < 0.5) return morphTrismegistus(p, s);
  if (uMorph < 1.5) return morphCrossCube(p, s);
  return morphAtlasColumbia(p, s);
}

/* Per-morph dominant motion direction, for the stretch smear. */
vec2 morphDir() {
  if (uMorph < 0.5) return vec2(1.0, 0.0);  // flanks travel horizontally
  return vec2(0.0, 1.0);                     // folds/rises travel vertically
}

void main() {
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);

  // Stretch-and-resolve: smear amplitude peaks mid-path and collapses at
  // both ends, so the form leaves crisp, travels as taffy, lands crisp.
  float smear = sin(3.14159265 * uProgress);
  float len = smear * 0.28;
  vec2 dir = morphDir();

  // Multi-tap accumulation along the motion path. max() keeps the smear
  // reading as *stretched glyph field*, not a translucent ghost trail.
  float m = 0.0;
  for (int i = 0; i < 7; i++) {
    float t = float(i) / 6.0;
    float w = 1.0 - 0.75 * t; // taps fade toward the trail's tail
    m = max(m, morphMask(p + dir * (t - 0.5) * len, uProgress) * w);
  }

  // Luminance high enough to land in the dither's heavy-glyph buckets;
  // chroma lifted so the resolved form reads saturated at its core.
  vec3 col = chromaScale(uAccent, 1.6) * (0.75 + 0.45 * m);
  float alpha = m * uFade;

  gl_FragColor = vec4(col * alpha, alpha);
}
`;

export class MorphPass {
  mesh: Mesh;
  private uniforms: Record<string, { value: unknown }>;
  private fade = 0;

  constructor(gl: OGLRenderingContext) {
    this.uniforms = {
      uAspect: { value: 1 },
      uMorph: { value: 0 },
      uProgress: { value: 0 },
      uFade: { value: 0 },
      uAccent: { value: [0.7, 0.7, 0.7] },
    };
    const program = new Program(gl, {
      vertex: FULLSCREEN_VERT,
      fragment: FRAG,
      uniforms: this.uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    // Premultiplied-style over blend: the shader outputs col * alpha.
    program.setBlendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
  }

  /** True when there is anything worth drawing this frame. */
  update(state: PipelineState, dt: number, aspect: number): boolean {
    // Fade in whenever a morph is being driven; fade out when it parks at
    // 0 (never started) — a morph parked at 1 stays resolved on screen.
    const driving = state.morphIndex >= 0 && state.morphProgress > 0.001;
    const target = driving ? 1 : 0;
    this.fade += (target - this.fade) * (1 - Math.exp(-6 * dt));
    if (this.fade < 0.01) return false;

    const u = this.uniforms;
    u.uAspect.value = aspect;
    u.uMorph.value = Math.max(0, state.morphIndex);
    u.uProgress.value = state.morphProgress;
    u.uFade.value = this.fade;
    u.uAccent.value = state.accentCurrent;
    return true;
  }
}
