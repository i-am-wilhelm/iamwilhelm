/**
 * EggRegistry — Phase 2 scaffold.
 *
 * Every hidden interaction on the site registers an egg here. Finding one
 * sets a persistent token; `marks()` exposes the found set so later
 * systems can gate on it (the dawn gate opens only when all marks are
 * held; the initiate state re-renders the site for a completed chain).
 *
 * Phase 1 ships the registry shape only — no eggs are wired yet.
 */

export type EggId =
  | 'mercury-cazimi' // Mercury glyph hidden at the exact center of Sol Niger
  | 'saturn-mc' // Saturn pinned to the top of its viewport
  | 'grand-trine' // three constellations at an exact 120° triangle
  | 'colophon' // α´ Μαρτίου ͵αϡϟα — the date in dead letters
  | 'eighth-house' // 23.52 buried in the writings template
  | 'outer-glyphs' // ♅ ♆ surfacing in the dither palettes
  | 'golden-bough' // the underworld door
  | 'style-swap' // Homestar-mode hotspots
  | 'secret-knock' // the tapped 7/8 rhythm → orchestra pit
  | 'dawn-gate' // the door that renders only before sunrise
  | 'seikilos'; // the gate's opening tone

const STORE_KEY = 'wilhelm.marks';

function readMarks(): Set<EggId> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

/** Record a found egg. Idempotent, persistent. */
export function mark(id: EggId): void {
  const found = readMarks();
  if (found.has(id)) return;
  found.add(id);
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify([...found]));
  } catch {
    /* storage unavailable — the seeker keeps only what they remember */
  }
  document.dispatchEvent(new CustomEvent('egg:found', { detail: { id } }));
}

/** The visitor's held marks. */
export function marks(): ReadonlySet<EggId> {
  return readMarks();
}

export function holdsAll(ids: EggId[]): boolean {
  const found = readMarks();
  return ids.every((id) => found.has(id));
}

// TODO(phase-2): wire eggs 1–6 and 8 to their interactions.
// TODO(phase-4): dawn gate + initiate state consume holdsAll().
