/**
 * BACKDROP PASS — first into the scene target.
 *
 * Paints each section's "splash": an accent-tinted aura with a *saturated
 * focal zone*. This is the luminance/chroma field the dither pass reads,
 * so the focal zone is deliberately painted at boosted chroma — the
 * dither preserves (and further boosts) saturation there, which is how
 * hero visuals resolve more saturated at their heart than at their edges.
 *
 * Also hosts the iw:splash flash: a brief expanding recolor pulse.
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
uniform vec3  uAccent;      // damped active-section accent
uniform vec2  uFocal;       // damped focal point (uv space)
uniform float uReveal;      // active section local progress 0..1
uniform float uScroll;      // full-page progress 0..1
uniform vec3  uSplashColor; // iw:splash flash color
uniform float uSplash;      // flash strength, decays in JS

${NOISE_GLSL}
${COLOR_GLSL}

void main() {
  vec2 uv = vUv;
  vec2 p = (uv - uFocal) * vec2(uAspect, 1.0);
  float d = length(p);

  // Slow-breathing fbm grain gives the dither field something organic to
  // bite into; without it flat gradients dither into dead stripes.
  float grain = fbm(uv * vec2(uAspect, 1.0) * 3.0 + uTime * 0.03);

  // Aura envelope: wide soft glow, revealed as the section scrolls in.
  float aura = (1.0 - smoothstep(0.05, 0.85, d)) * (0.25 + 0.75 * uReveal);

  // Saturated focal core — the painted "hot" zone.
  float core = 1.0 - smoothstep(0.0, 0.38, d + (grain - 0.5) * 0.18);

  // Base wash at accent hue; core pushes chroma well above the accent's
  // resting saturation so the dither's saturation-preserve path engages.
  vec3 wash = uAccent * (0.35 + 0.5 * grain);
  vec3 hot  = chromaScale(uAccent, 2.2) * (0.9 + 0.4 * grain);
  vec3 col  = mix(wash, hot, core);

  // iw:splash — expanding recolor ring + brief overall flash.
  float ringDist = abs(d - (1.0 - uSplash) * 0.9) - 0.08;
  float ring = 1.0 - smoothstep(-0.06, 0.06, ringDist);
  col += uSplashColor * uSplash * (0.55 * ring + 0.25);

  // Page fade: dim slightly toward the bright page bottom so the global
  // black→white body fade stays legible through the glyph field.
  float alpha = aura * mix(1.0, 0.55, uScroll);
  alpha += uSplash * 0.3;

  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}
`;

export class BackdropPass {
  mesh: Mesh;
  private uniforms: Record<string, { value: unknown }>;

  constructor(gl: OGLRenderingContext) {
    this.uniforms = {
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uAccent: { value: [0, 0, 0] },
      uFocal: { value: [0.6, 0.4] },
      uReveal: { value: 0 },
      uScroll: { value: 0 },
      uSplashColor: { value: [1, 1, 1] },
      uSplash: { value: 0 },
    };
    const program = new Program(gl, {
      vertex: FULLSCREEN_VERT,
      fragment: FRAG,
      uniforms: this.uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    program.setBlendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
  }

  update(state: PipelineState, time: number, aspect: number) {
    const u = this.uniforms;
    u.uTime.value = time;
    u.uAspect.value = aspect;
    u.uAccent.value = state.accentCurrent;
    u.uFocal.value = state.focalCurrent;
    u.uReveal.value = Math.min(1, state.sectionProgress * 1.6);
    u.uScroll.value = state.scrollProgress;
    u.uSplashColor.value = state.splashColor;
    u.uSplash.value = state.splashStrength;
  }
}
