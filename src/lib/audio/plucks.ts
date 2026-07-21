/**
 * Plucks — the lyre.
 *
 * Karplus-Strong strings for UI acknowledgment: internal link clicks get
 * a single soft pluck; a found egg gets a three-note figure on the 2+2+3
 * grid (root, fifth, octave — the little ascending offering). Any system
 * can request one via `audio:pluck` with an optional `kind`.
 *
 * Pitches follow the active section's tonal center so the lyre is always
 * in the room's key. Throttled to one pluck per pulse.
 */

import * as Tone from 'tone';
import type { DroneField } from './drones';
import { type AudioCtx, PULSE_S } from './shared';

export function initPlucks(ctx: AudioCtx, drones: DroneField): void {
  const lyre = new Tone.PluckSynth({
    attackNoise: 0.6,
    dampening: 3400,
    resonance: 0.92,
    release: 0.8,
    volume: -16,
  });
  const out = new Tone.Gain(0.8);
  const send = new Tone.Gain(0.35);
  lyre.connect(out);
  out.connect(ctx.master);
  out.connect(send);
  send.connect(ctx.reverb);

  let lastAt = 0;
  const strike = (ratio: number, delayS = 0) => {
    const now = Tone.now();
    if (delayS === 0) {
      if (now - lastAt < PULSE_S) return;
      lastAt = now;
    }
    lyre.triggerAttack(drones.activeTuning().root * ratio, now + delayS);
  };

  const pluck = (kind: string) => {
    if (kind === 'egg') {
      // 2+2+3: onsets at 0, 2 and 4 pulses — root, fifth, octave rising
      strike(2, 0);
      strike(3, PULSE_S * 2);
      strike(4, PULSE_S * 4);
      return;
    }
    strike(kind === 'link' ? 3 : 2);
  };

  document.addEventListener('click', (e) => {
    const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
    if (!a) return;
    const href = a.getAttribute('href') ?? '';
    const internal =
      href.startsWith('/') || href.startsWith('#') || href.startsWith(location.origin);
    if (internal && a.getAttribute('target') !== '_blank') pluck('link');
  });

  document.addEventListener('egg:found', () => pluck('egg'));

  document.addEventListener('audio:pluck', (e) => {
    const detail = (e as CustomEvent<{ kind?: string }>).detail;
    pluck(detail?.kind ?? 'ui');
  });
}
