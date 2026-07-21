/**
 * Underworld sound — the descent, heard.
 *
 * `underworld:depth` (0 at the threshold → 1 at the deepest station):
 *   - the whole drone bed detunes downward, a full octave at the bottom
 *   - water gathers: two counter-panning filtered noise layers whose slow,
 *     out-of-phase drift gives the binaural feeling of a moving river
 *   - near depth 0.475 (the Furies station) a dissonant low cluster
 *     surfaces — minor second against tritone — and passes as you do
 *
 * `underworld:presence` — the Orpheus rule. While present, quiet
 * footstep thumps walk the 2+2+3 grid behind the listener (heavily
 * lowpassed, alternating pan). On present:false the walker STOPS —
 * a presence leaves the mix, it does not fade.
 *
 * Everything builds lazily on the first event, so pages that never
 * descend never pay for any of it.
 */

import * as Tone from 'tone';
import type { DroneField } from './drones';
import { type AudioCtx, BAR_S, PULSE_S, clamp01 } from './shared';

/** The Furies window: peak of the cluster along the depth axis. */
const FURIES_CENTER = 0.475;
const FURIES_WIDTH = 0.09;

interface Water {
  gains: Tone.Gain[];
}

function buildWater(ctx: AudioCtx): Water {
  const layer = (type: 'brown' | 'pink', lfoHz: number, phase: number): Tone.Gain => {
    const noise = new Tone.Noise(type).start();
    const low = new Tone.Filter({ frequency: 420, type: 'lowpass', rolloff: -24 });
    const panner = new Tone.Panner(0);
    const lfo = new Tone.LFO({ frequency: lfoHz, min: -0.8, max: 0.8 });
    lfo.phase = phase;
    lfo.connect(panner.pan);
    lfo.start();
    const gain = new Tone.Gain(0);
    noise.connect(low);
    low.connect(panner);
    panner.connect(gain);
    gain.connect(ctx.master);
    gain.connect(ctx.reverb);
    return gain;
  };
  // two layers drifting at slightly different rates, opposed phases —
  // the ears never quite agree on where the water is
  return { gains: [layer('brown', 0.055, 0), layer('pink', 0.073, 180)] };
}

function buildFuries(ctx: AudioCtx): Tone.Gain {
  const gain = new Tone.Gain(0);
  // A1 + B♭1 + E♭2: semitone grinding under a tritone, kept low and quiet
  for (const [f, dB] of [
    [55.0, -4],
    [58.27, -6],
    [77.78, -9],
  ] as const) {
    const o = new Tone.Oscillator({ frequency: f, type: 'sine', volume: dB });
    o.connect(gain);
    o.start();
  }
  gain.connect(ctx.master);
  const send = new Tone.Gain(0.4);
  gain.connect(send);
  send.connect(ctx.reverb);
  return gain;
}

function buildWalker(ctx: AudioCtx): Tone.Loop {
  const step = new Tone.MembraneSynth({
    pitchDecay: 0.03,
    octaves: 3,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.002, decay: 0.14, sustain: 0, release: 0.05 },
    volume: -20,
  });
  const muffle = new Tone.Filter({ frequency: 260, type: 'lowpass', rolloff: -24 });
  const panner = new Tone.Panner(0);
  const out = new Tone.Gain(0.6);
  step.connect(muffle);
  muffle.connect(panner);
  panner.connect(out);
  out.connect(ctx.master);
  // behind the listener = mostly tail: heavy send, muffled dry
  const send = new Tone.Gain(0.5);
  panner.connect(send);
  send.connect(ctx.reverb);

  let foot = 0;
  return new Tone.Loop((time) => {
    // steps land on the bar's 2+2+3 onsets: 0, 2 and 4 pulses in
    for (const pulses of [0, 2, 4]) {
      const at = time + pulses * PULSE_S;
      panner.pan.setValueAtTime(foot % 2 === 0 ? -0.45 : 0.45, at);
      step.triggerAttackRelease(49, 0.1, at, 0.7); // ~G1
      foot++;
    }
  }, BAR_S);
}

export function initUnderworld(ctx: AudioCtx, drones: DroneField): void {
  let water: Water | null = null;
  let furies: Tone.Gain | null = null;
  let walker: Tone.Loop | null = null;

  document.addEventListener('underworld:depth', (e) => {
    const raw = (e as CustomEvent<{ depth?: number }>).detail?.depth;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return;
    const depth = clamp01(raw);

    // the spec's rule: drones pitch downward with depth (octave at 1)
    drones.setBedDetune(-1200 * depth);

    water ??= buildWater(ctx);
    for (const g of water.gains) g.gain.rampTo(0.055 * Math.pow(depth, 1.2), 1);

    const window = Math.exp(-Math.pow((depth - FURIES_CENTER) / FURIES_WIDTH, 2));
    if (furies || window > 0.02) {
      furies ??= buildFuries(ctx);
      furies.gain.rampTo(0.045 * window, 0.5);
    }
  });

  document.addEventListener('underworld:presence', (e) => {
    const present = (e as CustomEvent<{ present?: boolean }>).detail?.present;
    if (present === true) {
      walker ??= buildWalker(ctx);
      if (walker.state !== 'started') walker.start(Tone.getTransport().nextSubdivision('8n'));
    } else if (present === false) {
      walker?.stop(); // Orpheus turns: the steps do not fade, they cease
    }
  });
}
