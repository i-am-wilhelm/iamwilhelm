/**
 * Shared GLSL chunks, concatenated into pass shaders. GLSL ES 1.0 so the
 * pipeline runs identically on a WebGL1 fallback context.
 */

/** Standard fullscreen-triangle vertex shader (OGL `Triangle` geometry). */
export const FULLSCREEN_VERT = /* glsl */ `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

/** Cheap hash + value noise + fbm. Used by smoke, backdrop, dither. */
export const NOISE_GLSL = /* glsl */ `
float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

/* 5-octave fractal Brownian motion. */
float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8); // decorrelate octaves
  for (int i = 0; i < 5; i++) {
    v += amp * vnoise(p);
    p = rot * p * 2.03;
    amp *= 0.5;
  }
  return v;
}
`;

/** Luminance / saturation helpers shared by the color-aware passes. */
export const COLOR_GLSL = /* glsl */ `
float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

/* HSV-style saturation without a full colorspace round trip. */
float satOf(vec3 c) {
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  return (mx - mn) / max(mx, 1e-4);
}

/* Scale chroma about the gray axis. k > 1 saturates, k < 1 flattens. */
vec3 chromaScale(vec3 c, float k) {
  float l = luma(c);
  return clamp(vec3(l) + (c - vec3(l)) * k, 0.0, 1.0);
}
`;

/** 2D SDF primitives for the morph silhouettes. */
export const SDF_GLSL = /* glsl */ `
float sdCircle(vec2 p, float r) {
  return length(p) - r;
}

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

/* Regular hexagon — the silhouette of an isometric cube. */
float sdHexagon(vec2 p, float r) {
  const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

/* Soft fill from a distance value (feather in scene units). */
float fill(float d, float feather) {
  return smoothstep(feather, -feather, d);
}
`;
