/**
 * Audio engine — Phase 3 scaffold.
 *
 * The plan (see README / build prompt §6):
 *  - Generative drones via Tone.js, one per section, tuned around the
 *    circle of fifths so scroll-crossfades are perfect-fifth modulations.
 *  - Greek modes per section character (Dorian for Philosophy, Phrygian
 *    for Babalon, Lydian-melancholic for Memoir — document each choice
 *    where the drone is defined).
 *  - Dither sonification: granular static resolving toward tone.
 *    Neptune = washes/reverb tails on dissolves; Uranus = crackle and
 *    hard cuts on glitches.
 *  - Soft lyre-pluck UI sounds. Mixed quiet. Visible mute toggle.
 *
 * Phase 1 ships this silent stub so the threshold's Enter click already
 * performs the visitor's first offering: waking the engine inside a user
 * gesture, which is what browser autoplay policy demands.
 */

const MUTE_KEY = 'wilhelm.muted';

let awake = false;

/** Called from the threshold's Enter click (a user gesture). */
export async function wake(): Promise<void> {
  if (awake) return;
  awake = true;
  // TODO(phase-3): dynamic-import Tone.js here, await Tone.start(),
  // and begin the hero drone. Keeping Tone out of the Phase 1 bundle
  // holds the JS budget.
}

export function isAwake(): boolean {
  return awake;
}

export function setMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    /* no persistence available */
  }
  // TODO(phase-3): Tone.Destination.mute = muted
}

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}
