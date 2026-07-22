/**
 * Shared mutable pipeline state. Event handlers write targets; the frame
 * loop damps "current" values toward them so every visual responds with
 * its own inertia (smoke swings late, accents crossfade, rain soaks in).
 */

import { accents, type SectionId } from '../design/tokens';
import { fnv1a, hexToRgb, mulberry32 } from './utils';

export interface SectionInfo {
  id: string;
  index: number;
  symbols: string[];
  /** -1 = left, +1 = right (from data-smoke-side). */
  smokeSide: number;
  accent: [number, number, number];
  /** Deterministic per-section focal point for the backdrop's saturated zone. */
  focal: [number, number];
}

export interface PipelineState {
  sections: SectionInfo[];
  /** Index of the section that last fired iw:section-enter. */
  activeIndex: number;
  /** Local 0..1 progress within the active section. */
  sectionProgress: number;
  /**
   * Continuous "which section are we on" float — activeIndex plus centered
   * local progress. Drives constellation crossfade and parallax.
   */
  sectionFloat: number;

  // Scroll
  scrollProgress: number;
  scrollVelocity: number; // raw, from iw:scroll
  smoothVelocity: number; // damped, drives smoke swing

  // Smoke
  smokeSideCurrent: number; // damped -1..+1
  accentCurrent: [number, number, number]; // damped active accent

  // Backdrop focal point (damped toward active section's)
  focalCurrent: [number, number];

  // Morph
  morphIndex: number; // -1 = none
  morphProgress: number;

  // Splash flash
  splashColor: [number, number, number];
  splashStrength: number; // decays each frame

  // Weather (monsoon)
  raining: boolean;
  rainCurrent: number; // damped 0..1
  lightning: number; // decays each frame
  nextLightningAt: number; // seconds timestamp
}

const FALLBACK_ACCENT: [number, number, number] = [0.55, 0.52, 0.47];

/**
 * Read `.section[data-section]` elements from the DOM. The DOM — not the
 * token registry — is authoritative, so blog pages or reordered sections
 * still work; tokens only supply the accent hex for known ids.
 */
export function readSections(): SectionInfo[] {
  const els = Array.from(
    document.querySelectorAll<HTMLElement>('.section[data-section]'),
  );
  return els.map((el, index) => {
    const id = el.dataset.section || `section-${index}`;
    const accentHex = (accents as Record<string, string>)[id as SectionId];
    const rand = mulberry32(fnv1a(id));
    return {
      id,
      index,
      symbols: (el.dataset.symbols || '').split(',').filter(Boolean),
      smokeSide: el.dataset.smokeSide === 'right' ? 1 : -1,
      accent: accentHex ? hexToRgb(accentHex) : FALLBACK_ACCENT,
      // Focal zone sits off-center, opposite the copy column, seeded per id.
      focal: [0.55 + rand() * 0.3, 0.3 + rand() * 0.4],
    };
  });
}

export function createState(): PipelineState {
  const sections = readSections();
  const first = sections[0];
  return {
    sections,
    activeIndex: 0,
    sectionProgress: 0,
    sectionFloat: 0,
    scrollProgress: 0,
    scrollVelocity: 0,
    smoothVelocity: 0,
    smokeSideCurrent: first ? first.smokeSide : -1,
    accentCurrent: first ? [...first.accent] : [...FALLBACK_ACCENT],
    focalCurrent: first ? [...first.focal] : [0.6, 0.4],
    morphIndex: -1,
    morphProgress: 0,
    splashColor: [1, 1, 1],
    splashStrength: 0,
    raining: false,
    rainCurrent: 0,
    lightning: 0,
    nextLightningAt: 0,
  };
}

/** Triangle activation: 1 at section i, fading to 0 one section away. */
export function activation(state: PipelineState, index: number): number {
  return Math.max(0, 1 - Math.abs(state.sectionFloat - index));
}
