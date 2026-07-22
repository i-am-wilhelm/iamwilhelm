/**
 * PIT ENGINE — all Tone.js lives here, behind a dynamic import so the main
 * bundle stays light and no AudioContext exists until a user gesture.
 *
 * SCORE STRUCTURE (site spec §6.3–6.4):
 *   - Transport runs the site's signature meter: timeSignature [7, 8] at
 *     tokens.meter.bpm (84). One scheduleRepeat on the '8n' grid drives
 *     everything; `step` counts 0..6 through the bar.
 *   - LOW DRONE: fat saw + sine sub through a dark lowpass. Its pitch is the
 *     current section's `drone` field (C2→G2→D2→A2→E2, the circle of fifths
 *     descending the page — music of the spheres). Section changes glide via
 *     frequency ramps, matching the site's animation-adjacent pacing.
 *   - THE KNOCK: a deep membrane thump an octave below the drone, sounding
 *     on the 2+2+3 group boundaries — steps 0, 2, 4 (beats 1, 3, 5) — with
 *     the bar downbeat slightly stronger. Mixed low but felt: it is the
 *     deliberate clue that teaches the 7/8 tap pattern.
 *   - SPARSE MOTIFS: a quiet triangle voice occasionally (per-bar chance)
 *     places one or two notes from a pentatonic set above the drone root,
 *     echoed through a feedback delay tuned to the meter.
 *   - MASTER: everything sums into a low gain then a limiter, so the whole
 *     layer stays quiet and tasteful under the site.
 *
 * SEQUENCER TOY: a 4×7 boolean grid (rows: knock, tick, pluck, shimmer)
 * played by the same transport/step counter, so the toy and the score stay
 * phase-locked in 7/8.
 */

import * as Tone from 'tone';
import { meter, sections } from '../../design/tokens';
import { SEQ_ROW_NAMES, STEPS } from './grid';

type StepListener = (step: number) => void;

export class PitEngine {
  private transportRunning = false;
  private scoreOn = false;
  private seqOn = false;
  private step = 0;
  private pattern: boolean[][] = SEQ_ROW_NAMES.map(() =>
    new Array<boolean>(STEPS).fill(false),
  );
  private stepListeners = new Set<StepListener>();
  private droneNote: string = sections[0].drone; // 'C2'

  // Master chain
  private limiter = new Tone.Limiter(-6).toDestination();
  private master = new Tone.Gain(0.4).connect(this.limiter);

  // Score voices
  private droneFilter = new Tone.Filter(180, 'lowpass').connect(
    new Tone.Gain(0.16).connect(this.master),
  );
  private droneOsc = new Tone.FatOscillator(
    Tone.Frequency(sections[0].drone).toFrequency(),
    'sawtooth',
    18,
  );
  private subOsc = new Tone.Oscillator(
    Tone.Frequency(sections[0].drone).toFrequency(),
    'sine',
  );
  private subGain = new Tone.Gain(0.12).connect(this.master);
  private knock = new Tone.MembraneSynth({
    pitchDecay: 0.06,
    octaves: 1.5,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.45, sustain: 0, release: 0.1 },
  });
  private knockGain = new Tone.Gain(0.55).connect(this.master);
  private motif = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.05, release: 1.4 },
  });
  private motifDelay = new Tone.FeedbackDelay('4n.', 0.35);
  private motifGain = new Tone.Gain(0.14).connect(this.master);

  // Sequencer voices (the toy sits a little forward of the score)
  private seqKnock = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 2,
    envelope: { attack: 0.001, decay: 0.3, sustain: 0 },
  });
  private seqKnockGain = new Tone.Gain(0.7).connect(this.master);
  private tick = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.03, sustain: 0 },
  });
  private tickFilter = new Tone.Filter(5000, 'highpass').connect(
    new Tone.Gain(0.25).connect(this.master),
  );
  private pluck = new Tone.PluckSynth({ dampening: 3200, resonance: 0.92 });
  private pluckGain = new Tone.Gain(0.5).connect(this.master);
  private shimmer = new Tone.FMSynth({
    harmonicity: 3,
    modulationIndex: 8,
    envelope: { attack: 0.005, decay: 0.4, sustain: 0, release: 0.8 },
    modulationEnvelope: { attack: 0.005, decay: 0.2, sustain: 0 },
  });
  private shimmerGain = new Tone.Gain(0.18).connect(this.master);

  constructor() {
    this.droneOsc.connect(this.droneFilter);
    this.subOsc.connect(this.subGain);
    this.knock.connect(this.knockGain);
    this.motif.chain(this.motifDelay, this.motifGain);
    this.seqKnock.connect(this.seqKnockGain);
    this.tick.connect(this.tickFilter);
    this.pluck.connect(this.pluckGain);
    this.shimmer.connect(this.shimmerGain);

    const transport = Tone.getTransport();
    transport.bpm.value = meter.bpm;
    transport.timeSignature = [meter.beatsPerBar, 8]; // 7/8
    transport.scheduleRepeat((time) => this.onEighth(time), '8n');
  }

  /** Must be called from (or shortly after) a user gesture. */
  async ensureRunning(): Promise<void> {
    await Tone.start();
    if (!this.transportRunning) {
      Tone.getTransport().start('+0.05');
      this.transportRunning = true;
    }
  }

  // ---- Site score -------------------------------------------------------

  async setScoreOn(onFlag: boolean): Promise<void> {
    this.scoreOn = onFlag;
    if (onFlag) {
      await this.ensureRunning();
      if (this.droneOsc.state !== 'started') this.droneOsc.start();
      if (this.subOsc.state !== 'started') this.subOsc.start();
      this.droneFilter.frequency.rampTo(180, 0.5);
    } else {
      // Let the drone breathe out rather than cutting.
      this.droneFilter.frequency.rampTo(40, 1.5);
      setTimeout(() => {
        if (!this.scoreOn) {
          this.droneOsc.stop();
          this.subOsc.stop();
        }
      }, 1800);
    }
  }

  /** Music of the spheres — glide the drone to a section's pitch (e.g. on
   * 'iw:section-enter'). Ramp is slow and animation-adjacent. */
  setDroneNote(note: string): void {
    this.droneNote = note;
    const freq = Tone.Frequency(note).toFrequency();
    this.droneOsc.frequency.rampTo(freq, 5);
    this.subOsc.frequency.rampTo(freq, 5);
  }

  // ---- Sequencer toy ----------------------------------------------------

  setSeqOn(onFlag: boolean): void {
    this.seqOn = onFlag;
  }

  setCell(row: number, stepIndex: number, value: boolean): void {
    if (this.pattern[row]) this.pattern[row][stepIndex] = value;
  }

  setPattern(pattern: boolean[][]): void {
    pattern.forEach((row, r) =>
      row.forEach((v, s) => {
        if (this.pattern[r]) this.pattern[r][s] = !!v;
      }),
    );
  }

  getPattern(): boolean[][] {
    return this.pattern.map((row) => [...row]);
  }

  /** UI step-highlight hook; fires on the animation-frame side via Draw. */
  onStep(listener: StepListener): () => void {
    this.stepListeners.add(listener);
    return () => this.stepListeners.delete(listener);
  }

  // ---- Internal ---------------------------------------------------------

  private onEighth(time: number): void {
    const step = this.step;
    this.step = (this.step + 1) % STEPS;

    if (this.scoreOn) this.playScoreStep(step, time);
    if (this.seqOn) this.playSeqStep(step, time);

    if (this.scoreOn || this.seqOn) {
      Tone.getDraw().schedule(() => {
        this.stepListeners.forEach((l) => l(step));
      }, time);
    }
  }

  private playScoreStep(step: number, time: number): void {
    // THE KNOCK: group boundaries of 2+2+3 — steps 0, 2, 4 (beats 1, 3, 5).
    // Downbeat strongest; low in the mix, felt more than heard.
    if (step === 0) this.triggerKnock(time, 0.9);
    else if (step === 2) this.triggerKnock(time, 0.55);
    else if (step === 4) this.triggerKnock(time, 0.65);

    // Sparse motifs: decide once per bar, land inside the long (3) group.
    if (step === 0 && Math.random() < 0.3) {
      const eighth = Tone.Time('8n').toSeconds();
      const root = Tone.Frequency(this.droneNote);
      const degrees = [12, 19, 24, 26, 31]; // octave, 5th, 2 8ves, 9th, 12th
      const count = Math.random() < 0.4 ? 2 : 1;
      const slots = [4, 5, 6].sort(() => Math.random() - 0.5).slice(0, count);
      slots.forEach((slot) => {
        const deg = degrees[Math.floor(Math.random() * degrees.length)];
        this.motif.triggerAttackRelease(
          root.transpose(deg).toFrequency(),
          '8n',
          time + slot * eighth,
          0.25,
        );
      });
    }
  }

  private triggerKnock(time: number, velocity: number): void {
    const oct = Tone.Frequency(this.droneNote).transpose(-12).toFrequency();
    this.knock.triggerAttackRelease(oct, '8n', time, velocity);
  }

  private playSeqStep(step: number, time: number): void {
    const root = Tone.Frequency(this.droneNote);
    if (this.pattern[0][step])
      this.seqKnock.triggerAttackRelease(
        root.transpose(-12).toFrequency(),
        '8n',
        time,
        0.9,
      );
    if (this.pattern[1][step]) this.tick.triggerAttackRelease('32n', time, 0.7);
    if (this.pattern[2][step])
      this.pluck.triggerAttack(root.transpose(24).toFrequency(), time);
    if (this.pattern[3][step])
      this.shimmer.triggerAttackRelease(
        root.transpose(36).toFrequency(),
        '16n',
        time,
        0.5,
      );
  }
}

let engine: PitEngine | null = null;

/** Singleton accessor — the engine (and its AudioContext use) is created at
 * most once per page. */
export function getEngine(): PitEngine {
  if (!engine) engine = new PitEngine();
  return engine;
}
