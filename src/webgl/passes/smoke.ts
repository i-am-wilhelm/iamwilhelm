/**
 * SMOKE / FUMIGATION PASS — additive vapor into the scene target.
 *
 * Domain-warped fbm vapor rises from one side of the viewport. The side
 * comes from the active section's data-smoke-side (sections alternate, so
 * the vapor swings left↔right as the visitor descends the page); the
 * swing itself is weighted by scroll velocity — hard scrolling bends the
 * column like a draught through a censer. Tinted with the active
 * section's accent.
 */

import { Mesh, Program, Triangle } from 'ogl';
import type { OGLRenderingContext } from 'ogl';
import { FULLSCREEN_VERT, NOISE_GLSL, COLOR_GLSL } from '../glsl';
import type { PipelineState } from '../state';

const FRAG = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform float uAspect;
uniform float uSide;      // damped -1 (left) .. +1 (right)
uniform float uSwing;     // damped scroll velocity → lateral shear
uniform vec3  uTint;      // active section accent
uniform float uIntensity; // overall vapor amount

${NOISE_GLSL}
${COLOR_GLSL}

void main() {
  vec2 uv = vUv;

  // Distance from the emitting edge, 0 at the edge. uSide is continuous,
  // so mid-swing the emitter reads as drifting across the floor.
  float edgeX = 0.5 + uSide * 0.5;
  float fromEdge = abs(uv.x - edgeX);

  // Scroll-velocity swing: shear the sample column sideways, more with
  // height — the plume tip lags the base like real vapor in moving air.
  vec2 p = uv;
  p.x -= uSwing * p.y * p.y * 0.6;

  // Rising: advect the noise domain downward so features climb. Two
  // fbm reads, the first warping the second (curling wisps).
  vec2 q = p * vec2(uAspect * 2.2, 2.6);
  q.y -= uTime * 0.22;
  float warp = fbm(q + vec2(0.0, uTime * 0.05));
  float vapor = fbm(q * 1.7 + warp * 2.4 + vec2(uSide * 3.7, 0.0));

  // Shape the plume: strongest at the emitting edge and low in the frame,
  // thinning as it climbs and drifts inward.
  float edgeMask = exp(-fromEdge * 3.2);
  float riseMask = smoothstep(1.05, 0.0, uv.y) * (0.35 + 0.65 * (1.0 - uv.y));
  float density = vapor * vapor * edgeMask * riseMask;

  // Fumigation tint: accent hue, slightly brightened and chroma-lifted so
  // it survives the dither's luminance bucketing.
  vec3 col = chromaScale(uTint, 1.4) * (0.6 + 0.6 * vapor);

  gl_FragColor = vec4(col * density * uIntensity, density * uIntensity);
}
`;

export class SmokePass {
  mesh: Mesh;
  private uniforms: Record<string, { value: unknown }>;

  constructor(gl: OGLRenderingContext) {
    this.uniforms = {
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uSide: { value: -1 },
      uSwing: { value: 0 },
      uTint: { value: [0.5, 0.5, 0.5] },
      uIntensity: { value: 0.9 },
    };
    const program = new Program(gl, {
      vertex: FULLSCREEN_VERT,
      fragment: FRAG,
      uniforms: this.uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    // Additive: vapor brightens whatever the backdrop painted beneath it.
    program.setBlendFunc(gl.SRC_ALPHA, gl.ONE);
    this.mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
  }

  update(state: PipelineState, time: number, aspect: number) {
    const u = this.uniforms;
    u.uTime.value = time;
    u.uAspect.value = aspect;
    u.uSide.value = state.smokeSideCurrent;
    // Clamp the shear so a scroll-jack can't fold the plume in half.
    u.uSwing.value = Math.max(-1, Math.min(1, state.smoothVelocity * 1.4));
    u.uTint.value = state.accentCurrent;
  }
}
