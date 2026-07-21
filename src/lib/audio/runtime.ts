/**
 * Audio runtime — everything behind the wake.
 *
 * This module (and its imports, including Tone.js itself) lives in a
 * lazy chunk that engine.ts dynamic-imports inside wake(), so the
 * initial bundle carries zero Tone bytes. start() runs once, inside the
 * visitor's first gesture.
 *
 * The mix is deliberately quiet: master trimmed around -18 dB with a
 * limiter behind it so no event — thunder, Furies, crackle — can spike.
 * The transport runs the site's 7/8 grid (eighth = 140 ms) for every
 * rhythmic element.
 */

import * as Tone from 'tone';
import { DroneField } from './drones';
import { initMonsoon } from './monsoon';
import { initPlucks } from './plucks';
import { initSonify } from './sonify';
import { initUnderworld } from './underworld';
import type { AudioCtx } from './shared';

let started = false;

export async function start(muted: boolean): Promise<void> {
  if (started) return;
  started = true;

  await Tone.start();

  const destination = Tone.getDestination();
  destination.mute = muted;

  // master: quiet trim → limiter → out. Nothing bypasses this chain.
  const limiter = new Tone.Limiter(-9);
  const master = new Tone.Gain(0.13); // ≈ -18 dB
  master.connect(limiter);
  limiter.connect(destination);

  const reverb = new Tone.Reverb({ decay: 7, preDelay: 0.03, wet: 1 });
  reverb.connect(master);

  const transport = Tone.getTransport();
  transport.bpm.value = 60000 / 280; // quarter = 280 ms → eighth = one PULSE
  transport.timeSignature = [7, 8];
  transport.start();

  const ctx: AudioCtx = { master, reverb };

  const drones = new DroneField(ctx);
  drones.init();
  initPlucks(ctx, drones);
  initSonify(ctx, drones);
  initUnderworld(ctx, drones);
  initMonsoon(ctx, drones);
}

export function setMuted(muted: boolean): void {
  if (!started) return;
  Tone.getDestination().mute = muted;
}
