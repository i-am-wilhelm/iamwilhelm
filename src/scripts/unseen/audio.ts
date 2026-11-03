/**
 * THE UNSEEN ONE: voice controller. Audio hooks only; no files ship yet.
 *
 * On mount it probes one cue file under public/audio/unseen/. When the
 * file is absent nothing is shown and the page runs on timers. When it is
 * present a "Hear it" toggle appears; once on, litany parts and the
 * metamorphosis take their cadence from cue end + hold instead of timers,
 * and the line being spoken is marked .speaking.
 *
 * Audio is gesture-gated: nothing plays until the toggle is pressed, and a
 * cue whose file is missing or fails resolves after its hold so the
 * sequence never stalls on one bad file. The prototype's speechSynthesis
 * scaffold is not here and is not coming.
 */

import { AUDIO_BASE, AUDIO_PROBE, type Cue } from './cues';

export interface VoiceController {
  /** True while the listener has the voice on. */
  readonly on: boolean;
  /** Toggle; returns the new state. */
  toggle(): boolean;
  /**
   * Play one cue, marking `el` while it speaks, and resolve after the take
   * ends plus its hold. Resolves at once when the voice is off. Calling
   * play() again while a cue is speaking cuts the earlier one.
   */
  play(cue: Cue, el?: Element | null): Promise<void>;
  /** Loop a cue until stopLoop(); each pass waits the cue's hold. */
  loop(cue: Cue): void;
  stopLoop(): void;
  /** Cut whatever is speaking and clear the mark. */
  hush(): void;
  /** Report a state change (the mount uses it to update the toggle). */
  onChange(cb: (on: boolean) => void): void;
}

/** Resolve to a controller when cue files exist, else null. */
export async function probeVoice(): Promise<VoiceController | null> {
  if (typeof Audio === 'undefined') return null;
  try {
    const res = await fetch(`${AUDIO_BASE}${AUDIO_PROBE}.mp3`, { method: 'HEAD', cache: 'no-store' });
    const type = res.headers.get('content-type') || '';
    // A static host answers a missing file with its HTML 404 page; only a
    // real audio response counts.
    if (!res.ok || !type.startsWith('audio/')) return null;
  } catch {
    return null;
  }
  return createVoice();
}

function createVoice(): VoiceController {
  let on = false;
  let current: HTMLAudioElement | null = null;
  let currentEl: Element | null = null;
  let generation = 0;
  let looping: Cue | null = null;
  const listeners = new Set<(on: boolean) => void>();
  const cache = new Map<string, HTMLAudioElement>();

  const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

  function audioFor(id: string): HTMLAudioElement {
    let a = cache.get(id);
    if (!a) {
      a = new Audio(`${AUDIO_BASE}${id}.mp3`);
      a.preload = 'auto';
      cache.set(id, a);
    }
    return a;
  }

  function clearMark() {
    currentEl?.classList.remove('speaking');
    currentEl = null;
  }

  function hush() {
    generation++;
    if (current) {
      current.pause();
      try {
        current.currentTime = 0;
      } catch {
        /* not yet loaded */
      }
      current = null;
    }
    clearMark();
  }

  /** Play the take itself; resolves at end, error, or a safety timeout. */
  function speak(cue: Cue, el?: Element | null): Promise<void> {
    return new Promise<void>((resolve) => {
      const a = audioFor(cue.id);
      current = a;
      clearMark();
      if (el) {
        currentEl = el;
        el.classList.add('speaking');
      }
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        a.removeEventListener('ended', finish);
        a.removeEventListener('error', finish);
        a.removeEventListener('pause', onPause);
        if (current === a) current = null;
        clearMark();
        resolve();
      };
      // A hush() pauses the element; treat that as the end of the take.
      const onPause = () => {
        if (!a.ended) finish();
      };
      a.addEventListener('ended', finish, { once: true });
      a.addEventListener('error', finish, { once: true });
      a.addEventListener('pause', onPause);
      a.currentTime = 0;
      a.play().catch(finish);
    });
  }

  async function play(cue: Cue, el?: Element | null): Promise<void> {
    if (!on) return;
    hush();
    const gen = generation;
    await speak(cue, el);
    if (gen !== generation) return; // cut; the hold belongs to the new cue
    await sleep(cue.hold);
  }

  async function runLoop(cue: Cue) {
    const mine = cue;
    while (on && looping === mine) {
      hush();
      const gen = generation;
      await speak(mine);
      if (gen !== generation || looping !== mine) break;
      await sleep(mine.hold);
    }
  }

  return {
    get on() {
      return on;
    },
    toggle() {
      on = !on;
      if (!on) {
        looping = null;
        hush();
      }
      listeners.forEach((cb) => cb(on));
      return on;
    },
    play,
    loop(cue) {
      if (!on) return;
      looping = cue;
      void runLoop(cue);
    },
    stopLoop() {
      looping = null;
    },
    hush,
    onChange(cb) {
      listeners.add(cb);
    },
  };
}
