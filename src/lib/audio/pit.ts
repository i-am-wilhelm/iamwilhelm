/**
 * Pit audio — the Orchestra Pit's sound, behind its own dynamic import.
 *
 * Two instruments live here: the six section drones re-voiced as
 * playable tracks (same roots, just fifths, octaves, and modal color
 * tones as sections.ts) and a 7-step sequencer on the site pulse
 * (eighth = 140 ms, steps grouped 2+2+3). Tone.js enters only inside a
 * visitor gesture — ensure() first wakes the main engine (the gesture
 * is shared), then imports Tone and builds the pit's own trimmed bus
 * (gain ≈ -18 dB into a limiter), so nothing here can spike the mix.
 * The site mute is honored at the shared destination: a muted pit plays
 * nothing while its UI keeps working. Sequencer cell state is plain
 * module data, togglable before Tone has ever loaded.
 */

import type * as ToneNS from 'tone';
import { isMuted, wake } from './engine';
import { SECTIONS } from './sections';

type ToneMod = typeof ToneNS;

interface PitBus {
  T: ToneMod;
  master: ToneNS.Gain;
}

/** One 7/8 bar in seconds — track fades breathe over one bar. */
const FADE_S = 0.98;

/** One eighth-note pulse in seconds — the sequencer step length. */
const STEP_S = 0.14;

let bus: PitBus | null = null;
let loading: Promise<PitBus | null> | null = null;

async function ensure(): Promise<PitBus | null> {
  if (bus) return bus;
  if (loading) return loading;
  loading = (async (): Promise<PitBus | null> => {
    try {
      await wake(); // share the gesture with the main engine; harmless if it failed
      const T = await import('tone');
      await T.start();

      const limiter = new T.Limiter(-9);
      const master = new T.Gain(0.13); // ≈ -18 dB, matching the site trim
      master.connect(limiter);
      limiter.connect(T.getDestination());

      // the site mute rules the shared destination, runtime loaded or not
      T.getDestination().mute = isMuted();
      document.addEventListener('audio:state', (e) => {
        const detail = (e as CustomEvent<{ muted?: boolean }>).detail;
        if (typeof detail?.muted === 'boolean') T.getDestination().mute = detail.muted;
      });

      // if the main runtime already started the transport this is a no-op
      const transport = T.getTransport();
      if (transport.state !== 'started') {
        transport.bpm.value = 60000 / 280; // quarter = 280 ms → eighth = one PULSE
        transport.timeSignature = [7, 8];
        transport.start();
      }

      bus = { T, master };
      return bus;
    } catch {
      return null; // Tone unavailable — the pit stays a silent instrument
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/* ---------------------------------------------------------------- */
/* Track shelf — the section drones as playable voices               */
/* ---------------------------------------------------------------- */

interface TrackVoice {
  oscs: ToneNS.Oscillator[];
  out: ToneNS.Gain;
  playing: boolean;
}

const voices = new Map<string, TrackVoice>();
const playingIds = new Set<string>();

function voiceFor(b: PitBus, id: string): TrackVoice | null {
  const t = SECTIONS.find((s) => s.id === id);
  if (!t) return null;
  const existing = voices.get(id);
  if (existing) return existing;

  const { T } = b;
  const f = t.root;
  // root + just fifth + octave + modal color tone, as the drones voice it
  const oscs = [
    new T.Oscillator({ frequency: f, type: 'sine', volume: -2 }),
    new T.Oscillator({ frequency: f * 1.5, type: 'sine', volume: -8 }),
    new T.Oscillator({ frequency: f * 2, type: 'triangle', volume: -13 }),
    new T.Oscillator({ frequency: f * t.color, type: 'sine', volume: -16 }),
  ];
  const filter = new T.Filter({ frequency: f * 8, type: 'lowpass', rolloff: -12 });
  const mix = new T.Gain(0.3);
  const out = new T.Gain(0);
  for (const o of oscs) o.connect(mix);
  mix.connect(filter);
  filter.connect(out);
  out.connect(b.master);

  const v: TrackVoice = { oscs, out, playing: false };
  voices.set(id, v);
  return v;
}

/** Play or stop a section drone track. Resolves to "is it now playing". */
export async function toggleTrack(id: string): Promise<boolean> {
  const b = await ensure();
  if (!b) return false;
  const v = voiceFor(b, id);
  const t = SECTIONS.find((s) => s.id === id);
  if (!v || !t) return false;

  if (v.playing) {
    v.playing = false;
    playingIds.delete(id);
    v.out.gain.rampTo(0, FADE_S);
    // stop the faded oscillators a beat after the tail so they cost nothing
    window.setTimeout(
      () => {
        if (!v.playing) for (const o of v.oscs) o.stop();
      },
      FADE_S * 1000 + 400
    );
    return false;
  }

  v.playing = true;
  playingIds.add(id);
  for (const o of v.oscs) if (o.state !== 'started') o.start();
  v.out.gain.rampTo(t.level * 0.9, FADE_S);
  return true;
}

export function trackPlaying(id: string): boolean {
  return playingIds.has(id);
}

/* ---------------------------------------------------------------- */
/* 7-step sequencer — one bar of 7/8, three synthesized voices       */
/* ---------------------------------------------------------------- */

export const SEQ_VOICES = 3;
export const SEQ_STEPS = 7;

const grid: boolean[][] = Array.from({ length: SEQ_VOICES }, () =>
  Array<boolean>(SEQ_STEPS).fill(false)
);

export function setCell(voice: number, step: number, on: boolean): void {
  const row = grid[voice];
  if (row && step >= 0 && step < SEQ_STEPS) row[step] = on;
}

export function cellOn(voice: number, step: number): boolean {
  return grid[voice]?.[step] === true;
}

let stepCb: ((step: number) => void) | null = null;

/** UI hook: called each step while running, with -1 when stopped. */
export function onStep(cb: (step: number) => void): void {
  stepCb = cb;
}

interface Kit {
  low: ToneNS.MembraneSynth;
  tick: ToneNS.NoiseSynth;
  brush: ToneNS.NoiseSynth;
}

let kit: Kit | null = null;
let loop: ToneNS.Loop | null = null;
let running = false;

function kitFor(b: PitBus): Kit {
  if (kit) return kit;
  const { T } = b;

  // low membrane hit on the hero root's D
  const low = new T.MembraneSynth({
    pitchDecay: 0.03,
    octaves: 3,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.28, sustain: 0, release: 0.05 },
    volume: -4,
  });
  low.connect(b.master);

  // tick: a grain of white noise through a highpass
  const tick = new T.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.03, sustain: 0 },
    volume: -14,
  });
  const tickFilter = new T.Filter({ frequency: 3200, type: 'highpass' });
  tick.connect(tickFilter);
  tickFilter.connect(b.master);

  // brush: pink noise, longer breath, kept under a lowpass
  const brush = new T.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.01, decay: 0.22, sustain: 0 },
    volume: -12,
  });
  const brushFilter = new T.Filter({ frequency: 1600, type: 'lowpass' });
  brush.connect(brushFilter);
  brushFilter.connect(b.master);

  kit = { low, tick, brush };
  return kit;
}

/** Downbeats of the 2+2+3 grouping — lightly accented. */
const GROUP_STARTS = new Set([0, 2, 4]);

/** Start the bar. Resolves to false if Tone could not load. */
export async function startSequencer(): Promise<boolean> {
  const b = await ensure();
  if (!b) return false;
  if (running) return true;
  running = true;

  const k = kitFor(b);
  const { T } = b;
  let step = 0;
  loop = new T.Loop((time) => {
    const s = step;
    step = (step + 1) % SEQ_STEPS;
    const vel = GROUP_STARTS.has(s) ? 1 : 0.7;
    if (grid[0]?.[s]) k.low.triggerAttackRelease('D2', 0.1, time, vel);
    if (grid[1]?.[s]) k.tick.triggerAttackRelease(0.03, time, vel * 0.9);
    if (grid[2]?.[s]) k.brush.triggerAttackRelease(0.2, time, vel * 0.8);
    T.getDraw().schedule(() => stepCb?.(s), time);
  }, STEP_S);
  loop.start(0);
  return true;
}

export function stopSequencer(): void {
  running = false;
  if (loop) {
    loop.stop();
    loop.dispose();
    loop = null;
  }
  stepCb?.(-1); // clear the step light
}

export function sequencerRunning(): boolean {
  return running;
}
