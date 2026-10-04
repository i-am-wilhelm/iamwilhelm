/**
 * Cross-subsystem event contract. All workstreams (shader pipeline, scroll
 * choreography, sections, easter eggs, orchestra pit) communicate ONLY
 * through these window-level CustomEvents — no direct imports across
 * subsystem boundaries. Keep this file authoritative; extend, never rename.
 */

export interface IWEvents {
  /** Scroll choreography → everyone. progress 0..1 over the full page. */
  'iw:scroll': { progress: number; velocity: number };
  /** A section's viewport entry/exit. */
  'iw:section-enter': { id: string };
  'iw:section-leave': { id: string };
  /** Per-section local progress 0..1 while pinned/in view. */
  'iw:section-progress': { id: string; progress: number };
  /**
   * Morph drive (scroll → pipeline). name: 'trismegistus' | 'cross-cube'
   * | 'atlas-columbia'. progress 0..1 along the stretch-and-resolve path.
   */
  'iw:morph': { name: string; progress: number };
  /** Easter eggs → pipeline: swap the dither's glyph/style treatment. */
  'iw:dither-style': { style: string };
  /** Easter eggs → pipeline: recolor/trigger a section splash. */
  'iw:splash': { id: string; color?: string };
  /** Monsoon section → pipeline: live Phoenix weather. */
  'iw:weather': { raining: boolean };
  /** Egg engine bookkeeping. */
  'iw:egg-found': { eggId: string };
  /** Orchestra pit opened via the 7/8 tap. */
  'iw:pit-open': Record<string, never>;
  /** The dawn gate began opening (egg engine → audio: the Seikilos tone). */
  'iw:dawn-open': Record<string, never>;
  /** Clock → everyone. Fires on accented eighths; index 0 is the knock. */
  'iw:knock': { index: 0 | 2 | 4; barPhase: number };
  /** Hero → next section. Scroll phase of the natal hero. */
  'iw:natal-phase': { progress: number; phase: 'face' | 'ascent' | 'dissolve' };
  /** Venus's heart → audio sibling, later. env = heartbeat envelope 0..1. */
  'iw:venus-beat': { env: number };
  /**
   * Orchestra pit → clock. Fires on every transport eighth once the pit is
   * running; `inMs` is how far ahead of now the step will sound (Tone's
   * lookahead). clock.ts phase-locks the visual knock to it.
   */
  'iw:transport-eighth': { step: number; inMs: number };
}

export function emit<K extends keyof IWEvents>(type: K, detail: IWEvents[K]) {
  window.dispatchEvent(new CustomEvent(type, { detail }));
}

export function on<K extends keyof IWEvents>(
  type: K,
  handler: (detail: IWEvents[K]) => void,
): () => void {
  const wrapped = (e: Event) => handler((e as CustomEvent<IWEvents[K]>).detail);
  window.addEventListener(type, wrapped);
  return () => window.removeEventListener(type, wrapped);
}
