/**
 * Drones — one generative voice per homepage section.
 *
 * Each voice is four oscillators (root, just fifth, octave, modal color
 * tone) through a breathing lowpass into a crossfade gain. A scroll
 * tracker watches which section band holds the viewport center and
 * crossfades voices over two 7/8 bars, so moving down the page is heard
 * as a chain of perfect-fifth modulations (see sections.ts).
 *
 * Voices are built lazily and their oscillators stop once faded out, so
 * only the sounding section (plus a fading neighbor) costs CPU. The
 * underworld pitches the whole bed downward via setBedDetune; the
 * monsoon reshapes the memoir voice via setSectionProfile.
 *
 * All modulation here is deliberately slow (LFOs in the 0.05–0.15 Hz
 * range) — gentle under prefers-reduced-motion by construction.
 */

import * as Tone from 'tone';
import { SECTIONS, type SectionTuning } from './sections';
import { type AudioCtx, BAR_S, CROSSFADE_S } from './shared';

/** Reshapeable character of a voice (the monsoon drives memoir's). */
export interface VoiceProfile {
  /** Multiplier on the base lowpass frequency (root * 8). */
  filterMul: number;
  /** Modal color tone level, dB. */
  colorDb: number;
  /** Octave partial level, dB. */
  octDb: number;
  /** Reverb send level (0..1). */
  wet: number;
}

const DEFAULT_PROFILE: VoiceProfile = { filterMul: 1, colorDb: -16, octDb: -13, wet: 0.25 };

/** Memoir opens in drought until monsoon:state says otherwise. */
const DROUGHT_PROFILE: VoiceProfile = { filterMul: 0.6, colorDb: -60, octDb: -30, wet: 0.1 };

class DroneVoice {
  private readonly oscs: Tone.Oscillator[];
  private readonly colorOsc: Tone.Oscillator;
  private readonly octOsc: Tone.Oscillator;
  private readonly filter: Tone.Filter;
  private readonly breath: Tone.LFO;
  private readonly waver: Tone.LFO;
  private readonly send: Tone.Gain;
  readonly out: Tone.Gain;
  readonly tuning: SectionTuning;
  private running = false;
  private baseFilterHz: number;

  constructor(ctx: AudioCtx, tuning: SectionTuning, profile: VoiceProfile) {
    this.tuning = tuning;
    const f = tuning.root;
    this.baseFilterHz = f * 8;

    const root = new Tone.Oscillator({ frequency: f, type: 'sine', volume: -2 });
    const fifth = new Tone.Oscillator({ frequency: f * 1.5, type: 'sine', volume: -8 });
    this.octOsc = new Tone.Oscillator({ frequency: f * 2, type: 'triangle', volume: profile.octDb });
    this.colorOsc = new Tone.Oscillator({
      frequency: f * tuning.color,
      type: 'sine',
      volume: profile.colorDb,
    });
    this.oscs = [root, fifth, this.octOsc, this.colorOsc];

    this.filter = new Tone.Filter({
      frequency: this.baseFilterHz * profile.filterMul,
      type: 'lowpass',
      rolloff: -12,
    });
    this.out = new Tone.Gain(0);
    this.send = new Tone.Gain(profile.wet);

    const mix = new Tone.Gain(0.3);
    for (const o of this.oscs) o.connect(mix);
    mix.connect(this.filter);
    this.filter.connect(this.out);
    this.out.connect(ctx.master);
    this.out.connect(this.send);
    this.send.connect(ctx.reverb);

    // the drone breathes: filter drifts over ~8 bars, pitch wavers ±4¢
    this.breath = new Tone.LFO({
      frequency: 1 / (BAR_S * 8),
      min: this.baseFilterHz * profile.filterMul * 0.7,
      max: this.baseFilterHz * profile.filterMul * 1.15,
    });
    this.breath.connect(this.filter.frequency);
    this.waver = new Tone.LFO({ frequency: 0.05, min: -4, max: 4 });
    this.waver.connect(root.detune);
    this.waver.connect(fifth.detune);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    for (const o of this.oscs) o.start();
    this.breath.start();
    this.waver.start();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    for (const o of this.oscs) o.stop();
    this.breath.stop();
    this.waver.stop();
  }

  isRunning(): boolean {
    return this.running;
  }

  fadeTo(level: number, seconds: number): void {
    this.out.gain.rampTo(level, seconds);
  }

  /** Underworld depth: whole-bed detune in cents (LFO waver rides on top). */
  setDetune(cents: number, seconds: number): void {
    for (const o of this.oscs) o.detune.rampTo(cents, seconds);
  }

  setProfile(p: VoiceProfile, seconds: number): void {
    this.colorOsc.volume.rampTo(p.colorDb, seconds);
    this.octOsc.volume.rampTo(p.octDb, seconds);
    this.send.gain.rampTo(p.wet, seconds);
    // retarget the breath so the filter keeps drifting around the new center
    this.breath.min = this.baseFilterHz * p.filterMul * 0.7;
    this.breath.max = this.baseFilterHz * p.filterMul * 1.15;
    this.filter.frequency.rampTo(this.baseFilterHz * p.filterMul, seconds);
  }
}

export class DroneField {
  private readonly ctx: AudioCtx;
  private readonly voices = new Map<string, DroneVoice>();
  private readonly profiles = new Map<string, VoiceProfile>();
  private readonly changeCbs: Array<(t: SectionTuning) => void> = [];
  private activeId: string | null = null;
  private bedDetune = 0;

  constructor(ctx: AudioCtx) {
    this.ctx = ctx;
    this.profiles.set('memoir', { ...DROUGHT_PROFILE });
  }

  /**
   * Find whichever tuned sections exist on this page and start tracking.
   * Pages without them (underworld, writings) get the hero voice as a
   * quiet ambient bed — the underworld's depth events need a bed to sink.
   */
  init(): void {
    const bands: Array<{ el: HTMLElement; t: SectionTuning }> = [];
    for (const t of SECTIONS) {
      const el = document.getElementById(t.id);
      if (el) bands.push({ el, t });
    }
    if (bands.length === 0) {
      const hero = SECTIONS[0]!;
      this.activate(hero, hero.level * 0.6, CROSSFADE_S * 2);
      return;
    }
    this.track(bands);
  }

  onChange(cb: (t: SectionTuning) => void): void {
    this.changeCbs.push(cb);
  }

  activeTuning(): SectionTuning {
    return SECTIONS.find((s) => s.id === this.activeId) ?? SECTIONS[0]!;
  }

  /** Underworld hook: 0 cents at the threshold, deeper is lower. */
  setBedDetune(cents: number): void {
    this.bedDetune = cents;
    for (const v of this.voices.values()) {
      if (v.isRunning()) v.setDetune(cents, 0.6);
    }
  }

  /** Monsoon hook: reshape a section's voice, built or not yet. */
  setSectionProfile(id: string, p: VoiceProfile): void {
    this.profiles.set(id, p);
    this.voices.get(id)?.setProfile(p, CROSSFADE_S);
  }

  private voiceFor(t: SectionTuning): DroneVoice {
    let v = this.voices.get(t.id);
    if (!v) {
      v = new DroneVoice(this.ctx, t, this.profiles.get(t.id) ?? DEFAULT_PROFILE);
      this.voices.set(t.id, v);
    }
    return v;
  }

  private activate(t: SectionTuning, level: number, fade: number): void {
    if (this.activeId === t.id) return;
    const prev = this.activeId ? this.voices.get(this.activeId) : undefined;
    this.activeId = t.id;

    const v = this.voiceFor(t);
    v.start();
    v.setDetune(this.bedDetune, 0.1);
    v.fadeTo(level, fade);

    if (prev) {
      prev.fadeTo(0, fade);
      // stop the faded voice a beat after the tail so it costs nothing
      window.setTimeout(
        () => {
          if (this.activeId !== prev.tuning.id) prev.stop();
        },
        fade * 1000 + 400
      );
    }
    for (const cb of this.changeCbs) cb(t);
  }

  private track(bands: Array<{ el: HTMLElement; t: SectionTuning }>): void {
    let raf = 0;
    const pick = () => {
      raf = 0;
      const mid = window.innerHeight / 2;
      for (const { el, t } of bands) {
        const r = el.getBoundingClientRect();
        if (r.top <= mid && r.bottom > mid) {
          this.activate(t, t.level, CROSSFADE_S);
          return;
        }
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(pick);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    pick();
  }
}
