/**
 * CONSTELLATION PASS — per-section star maps into the scene target.
 *
 * Each `.section[data-section]` gets a sparse field of point nodes joined
 * by hairline sketch geometry, seeded deterministically from the section
 * id (same id → same sky, every visit). Node count scales gently with the
 * section's data-symbols count so denser mythologies read denser.
 *
 * Stars twinkle and drift on slow per-star phases; the whole map slides
 * vertically against scroll (parallax) and crossfades with the triangle
 * activation of its section.
 */

import { Geometry, Mesh, Program, Transform } from 'ogl';
import type { OGLRenderingContext } from 'ogl';
import { activation, type PipelineState, type SectionInfo } from '../state';
import { fnv1a, mulberry32 } from '../utils';

const POINT_VERT = /* glsl */ `
attribute vec2 position;   // base position, clip space
attribute vec3 aRand;      // per-star: phase, speed, size
uniform float uTime;
uniform float uParallax;   // vertical slide from scroll
uniform float uDpr;
varying float vTwinkle;

void main() {
  // Slow orbital drift, unique per star.
  vec2 drift = vec2(
    sin(uTime * (0.05 + aRand.y * 0.08) + aRand.x * 6.2831),
    cos(uTime * (0.04 + aRand.y * 0.06) + aRand.x * 12.566)
  ) * 0.012;

  vec2 pos = position + drift;
  pos.y += uParallax;

  vTwinkle = 0.6 + 0.4 * sin(uTime * (0.7 + aRand.y * 1.8) + aRand.x * 40.0);
  gl_PointSize = (1.5 + aRand.z * 3.5) * uDpr;
  gl_Position = vec4(pos, 0.0, 1.0);
}
`;

const POINT_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uAlpha;
varying float vTwinkle;

void main() {
  // Round sprite with soft falloff.
  float d = length(gl_PointCoord - 0.5);
  float star = 1.0 - smoothstep(0.05, 0.5, d);
  gl_FragColor = vec4(uColor, star * vTwinkle * uAlpha);
}
`;

const LINE_VERT = /* glsl */ `
attribute vec2 position;
attribute float aFade;     // per-endpoint fade so lines taper
uniform float uParallax;
varying float vFade;

void main() {
  vec2 pos = position;
  pos.y += uParallax;
  vFade = aFade;
  gl_Position = vec4(pos, 0.0, 1.0);
}
`;

const LINE_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uAlpha;
varying float vFade;

void main() {
  gl_FragColor = vec4(uColor, vFade * uAlpha * 0.45); // hairline sketch weight
}
`;

interface SectionSky {
  section: SectionInfo;
  points: Mesh;
  lines: Mesh;
  pointUniforms: Record<string, { value: unknown }>;
  lineUniforms: Record<string, { value: unknown }>;
}

export class ConstellationPass {
  scene: Transform;
  private skies: SectionSky[] = [];

  constructor(gl: OGLRenderingContext, sections: SectionInfo[]) {
    this.scene = new Transform();
    for (const section of sections) {
      const sky = this.buildSky(gl, section);
      sky.points.setParent(this.scene);
      sky.lines.setParent(this.scene);
      this.skies.push(sky);
    }
  }

  private buildSky(gl: OGLRenderingContext, section: SectionInfo): SectionSky {
    // Deterministic seed: id + symbols, so edits to a section's symbol
    // list re-cast its sky but reloads never do.
    const rand = mulberry32(fnv1a(section.id + '|' + section.symbols.join(',')));
    const nodeCount = 14 + section.symbols.length * 5;

    const positions = new Float32Array(nodeCount * 2);
    const rands = new Float32Array(nodeCount * 3);
    const nodes: [number, number][] = [];
    for (let i = 0; i < nodeCount; i++) {
      // Keep a margin so drift never clips at the viewport edge.
      const x = -0.92 + rand() * 1.84;
      const y = -0.88 + rand() * 1.76;
      nodes.push([x, y]);
      positions[i * 2] = x;
      positions[i * 2 + 1] = y;
      rands[i * 3] = rand();
      rands[i * 3 + 1] = rand();
      rands[i * 3 + 2] = rand();
    }

    // Hairline geometry: connect each node to its nearest neighbor, plus a
    // few random chords — sparse enough to read as a sketched star chart,
    // not a mesh.
    const linePts: number[] = [];
    const lineFade: number[] = [];
    const link = (a: number, b: number) => {
      linePts.push(nodes[a][0], nodes[a][1], nodes[b][0], nodes[b][1]);
      lineFade.push(0.9, 0.35); // taper toward the far endpoint
    };
    for (let i = 0; i < nodeCount; i++) {
      let best = -1;
      let bestD = Infinity;
      for (let j = 0; j < nodeCount; j++) {
        if (j === i) continue;
        const dx = nodes[i][0] - nodes[j][0];
        const dy = nodes[i][1] - nodes[j][1];
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = j; }
      }
      if (best > i) link(i, best); // dedupe mutual pairs
    }
    const chords = Math.floor(nodeCount / 5);
    for (let c = 0; c < chords; c++) {
      link(Math.floor(rand() * nodeCount), Math.floor(rand() * nodeCount));
    }

    const pointUniforms = {
      uTime: { value: 0 },
      uParallax: { value: 0 },
      uDpr: { value: 1 },
      uColor: { value: section.accent },
      uAlpha: { value: 0 },
    };
    const lineUniforms = {
      uParallax: { value: 0 },
      uColor: { value: section.accent },
      uAlpha: { value: 0 },
    };

    const mkProgram = (vertex: string, fragment: string, uniforms: object) => {
      const p = new Program(gl, {
        vertex,
        fragment,
        uniforms: uniforms as Record<string, { value: unknown }>,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      p.setBlendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      return p;
    };

    const points = new Mesh(gl, {
      geometry: new Geometry(gl, {
        position: { size: 2, data: positions },
        aRand: { size: 3, data: rands },
      }),
      program: mkProgram(POINT_VERT, POINT_FRAG, pointUniforms),
      mode: gl.POINTS,
    });

    const lines = new Mesh(gl, {
      geometry: new Geometry(gl, {
        position: { size: 2, data: new Float32Array(linePts) },
        aFade: { size: 1, data: new Float32Array(lineFade) },
      }),
      program: mkProgram(LINE_VERT, LINE_FRAG, lineUniforms),
      mode: gl.LINES,
    });

    return { section, points, lines, pointUniforms, lineUniforms };
  }

  update(state: PipelineState, time: number, dpr: number) {
    for (const sky of this.skies) {
      const a = activation(state, sky.section.index);
      // Parallax: the sky slides opposite the scroll direction through its
      // section, ±12% of the viewport.
      const parallax = (state.sectionFloat - sky.section.index) * -0.24;

      const visible = a > 0.01;
      sky.points.visible = visible;
      sky.lines.visible = visible;
      if (!visible) continue;

      sky.pointUniforms.uTime.value = time;
      sky.pointUniforms.uParallax.value = parallax;
      sky.pointUniforms.uDpr.value = dpr;
      sky.pointUniforms.uAlpha.value = a;
      sky.lineUniforms.uParallax.value = parallax;
      sky.lineUniforms.uAlpha.value = a;
    }
  }
}
