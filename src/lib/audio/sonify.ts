/**
 * Dither sonification — the fields are faintly audible.
 *
 * Pointer and scroll activity feeds an energy envelope; fresh movement
 * sounds as granular static (pink noise chopped at the pulse rate), and
 * sustained movement resolves toward a pure tone two octaves above the
 * active section's root — the same gesture as an image resolving out of
 * glyphs. Everything here sits far below the drones.
 *
 * Outer-planet character, keyed off the dither engine's `dither:rare`:
 *   ♆ Neptune — a wash: soft sine swell into the long reverb tail.
 *   ♅ Uranus — crackle: a high noise burst with a hard, unfaded cut.
 */

import * as Tone from 'tone';
import type { DroneField } from './drones';
import { type AudioCtx, BAR_S, PULSE_S, clamp01 } from './shared';

export function initSonify(ctx: AudioCtx, drones: DroneField): void {
  // static bed: pink noise → bandpass → pulse-rate chop
  const noise = new Tone.Noise('pink').start();
  const band = new Tone.Filter({ frequency: 1800, type: 'bandpass', Q: 0.8 });
  const grain = new Tone.Tremolo(1 / PULSE_S, 0.8).start();
  const noiseGain = new Tone.Gain(0);
  noise.connect(band);
  band.connect(grain);
  grain.connect(noiseGain);
  noiseGain.connect(ctx.master);

  // the resolved tone: two octaves over the active root
  const tone = new Tone.Oscillator({
    frequency: drones.activeTuning().root * 4,
    type: 'sine',
  }).start();
  const toneGain = new Tone.Gain(0);
  tone.connect(toneGain);
  toneGain.connect(ctx.master);
  const toneSend = new Tone.Gain(0.5);
  toneGain.connect(toneSend);
  toneSend.connect(ctx.reverb);

  drones.onChange((t) => tone.frequency.rampTo(t.root * 4, BAR_S));

  // energy spikes with movement and decays; resolve rises only while the
  // movement is sustained — static first, tone once the image has settled
  let energy = 0;
  let resolve = 0;
  window.addEventListener(
    'wheel',
    (e) => {
      energy = clamp01(energy + Math.min(0.25, Math.abs(e.deltaY) / 1600));
    },
    { passive: true }
  );
  window.addEventListener(
    'scroll',
    () => {
      energy = clamp01(energy + 0.06);
    },
    { passive: true }
  );
  window.addEventListener(
    'pointermove',
    (e) => {
      energy = clamp01(energy + Math.min(0.1, Math.hypot(e.movementX, e.movementY) / 900));
    },
    { passive: true }
  );

  const STEP_MS = 120;
  window.setInterval(() => {
    energy *= Math.exp(-STEP_MS / 1400);
    resolve =
      energy > 0.04
        ? Math.min(1, resolve + STEP_MS / (BAR_S * 2000)) // ~2 bars to resolve
        : Math.max(0, resolve - STEP_MS / 1200);
    // FAINT by design: static ceiling ≈ -26 dBFS pre-master
    noiseGain.gain.rampTo(0.05 * energy * (1 - 0.85 * resolve), 0.15);
    toneGain.gain.rampTo(0.035 * energy * resolve, 0.2);
  }, STEP_MS);

  // ♆ wash / ♅ crackle
  const pad = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 1.2, decay: 0.5, sustain: 0.6, release: 5 },
    volume: -26,
  });
  const padSend = new Tone.Gain(1);
  pad.connect(padSend);
  padSend.connect(ctx.reverb);

  const crackle = new Tone.Noise('white').start();
  const high = new Tone.Filter({ frequency: 2600, type: 'highpass' });
  const crackleGain = new Tone.Gain(0);
  crackle.connect(high);
  high.connect(crackleGain);
  crackleGain.connect(ctx.master);

  document.addEventListener('dither:rare', (e) => {
    const glyph = (e as CustomEvent<{ glyph?: string }>).detail?.glyph;
    if (glyph === '♆') {
      // Neptune: dissolve-wash, all tail
      pad.triggerAttackRelease(drones.activeTuning().root * 2, BAR_S * 2);
    } else if (glyph === '♅') {
      // Uranus: two crackles, hard cuts — no fades on purpose
      const now = Tone.now();
      crackleGain.gain.setValueAtTime(0.05, now);
      crackleGain.gain.setValueAtTime(0, now + 0.05);
      crackleGain.gain.setValueAtTime(0.04, now + PULSE_S);
      crackleGain.gain.setValueAtTime(0, now + PULSE_S + 0.03);
    }
  });
}
