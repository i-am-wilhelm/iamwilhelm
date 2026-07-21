/**
 * Audio engine — the public face.
 *
 * This module stays featherweight: no Tone.js import, static or
 * otherwise. wake() dynamic-imports the runtime chunk (which carries
 * Tone) inside the visitor's first gesture — the threshold's Enter
 * click, or the mute toggle on any later page. Everything is safe to
 * call at any time, in any order, on any page; if Tone fails to load
 * the site simply stays silent.
 *
 * State changes are announced on document as `audio:state`
 * ({ awake, muted }) so UI like the mute toggle can follow along.
 */

const MUTE_KEY = 'wilhelm.muted';

type Runtime = typeof import('./runtime');

let runtime: Runtime | null = null;
let waking: Promise<void> | null = null;
let failed = false;

function announce(): void {
  document.dispatchEvent(
    new CustomEvent('audio:state', { detail: { awake: isAwake(), muted: isMuted() } })
  );
}

/**
 * Called from a user gesture (the threshold's Enter, or unmuting).
 * Idempotent; concurrent calls share one load.
 */
export async function wake(): Promise<void> {
  if (runtime || failed) return;
  if (waking) return waking;
  waking = (async () => {
    try {
      const rt = await import('./runtime');
      await rt.start(isMuted());
      runtime = rt;
      announce();
    } catch {
      failed = true; // Tone unavailable — the site keeps its silence
    } finally {
      waking = null;
    }
  })();
  return waking;
}

export function isAwake(): boolean {
  return runtime !== null;
}

export function setMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    /* no persistence available */
  }
  runtime?.setMuted(muted);
  announce();
}

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}
