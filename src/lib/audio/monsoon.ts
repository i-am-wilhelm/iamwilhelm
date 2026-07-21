/**
 * Monsoon sound — the memoir section's weather.
 *
 * `monsoon:state` reshapes the memoir drone (F♯ lydian):
 *   drought — parched: filter nearly closed, no shimmer, almost no tail
 *   break   — the sky opens: filter thrown wide, the lydian ♯4 rings,
 *             tail gathering
 *   release — saturated: full voicing, long wet tail, PNW rain
 *
 * `monsoon:lightning` is a single sub-bass thunder hit: instant attack,
 * seconds of decay, everything above ~90 Hz shaved off so it is felt
 * more than heard. Throttled to one strike per bar.
 */

import * as Tone from 'tone';
import type { DroneField, VoiceProfile } from './drones';
import { type AudioCtx, BAR_S } from './shared';

const STATES: Record<string, VoiceProfile> = {
  drought: { filterMul: 0.6, colorDb: -60, octDb: -30, wet: 0.1 },
  break: { filterMul: 1.7, colorDb: -12, octDb: -14, wet: 0.4 },
  release: { filterMul: 1.1, colorDb: -13, octDb: -10, wet: 0.65 },
};

export function initMonsoon(ctx: AudioCtx, drones: DroneField): void {
  document.addEventListener('monsoon:state', (e) => {
    const state = (e as CustomEvent<{ state?: string }>).detail?.state;
    const profile = state ? STATES[state] : undefined;
    if (profile) drones.setSectionProfile('memoir', profile);
  });

  let thunder: Tone.MembraneSynth | null = null;
  let lastStrike = 0;

  document.addEventListener('monsoon:lightning', () => {
    const now = Tone.now();
    if (now - lastStrike < BAR_S) return;
    lastStrike = now;
    if (!thunder) {
      thunder = new Tone.MembraneSynth({
        pitchDecay: 0.9,
        octaves: 1.5,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.004, decay: 2.8, sustain: 0, release: 1.6 },
        volume: -8,
      });
      const sub = new Tone.Filter({ frequency: 90, type: 'lowpass', rolloff: -24 });
      const out = new Tone.Gain(0.7);
      thunder.connect(sub);
      sub.connect(out);
      out.connect(ctx.master);
      const send = new Tone.Gain(0.3);
      sub.connect(send);
      send.connect(ctx.reverb);
    }
    thunder.triggerAttackRelease(43, 2.5); // ~F1, sinking as pitchDecay falls
  });
}
