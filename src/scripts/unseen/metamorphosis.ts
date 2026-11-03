/**
 * THE UNSEEN ONE: the metamorphosis (movement III). The lines of
 * .meta-lines appear one at a time. Without audio the cadence is the
 * prototype's timer table (META_CADENCE_MS); with the voice on, each cue
 * ends and holds before the next line. The newest line is kept above the
 * fold. Instant mode (the straight read, reduced motion) shows everything.
 */

import { META, META_CADENCE_MS, type MetaCue } from './cues';
import type { VoiceController } from './audio';

export interface MetamorphosisOptions {
  instant: boolean;
  reduced: boolean;
  voice: VoiceController | null;
}

function cadenceFor(line: HTMLElement): number {
  const c = META_CADENCE_MS;
  if (line.classList.contains('gap')) return c.gap;
  if (line.classList.contains('rise')) return c.rise;
  if (line.classList.contains('word')) return c.word;
  if (line.classList.contains('split')) return c.split;
  if (line.classList.contains('small')) return c.small;
  return c.base;
}

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

/** Keep the newest line above the fold, as the prototype did. */
function keepInView(el: HTMLElement, reduced: boolean) {
  const r = el.getBoundingClientRect();
  if (r.bottom > window.innerHeight - 120) {
    window.scrollBy({ top: r.bottom - window.innerHeight + 160, behavior: reduced ? 'auto' : 'smooth' });
  }
}

export async function runMetamorphosis(container: HTMLElement, opts: MetamorphosisOptions): Promise<void> {
  const lines = Array.from(container.querySelectorAll<HTMLElement>('p'));
  for (const p of lines) p.classList.add('m-line');

  if (opts.instant) {
    for (const p of lines) p.classList.add('on');
    return;
  }

  const show = (p: HTMLElement) => {
    p.classList.add('on');
    keepInView(p, opts.reduced);
  };

  const voice = opts.voice && opts.voice.on ? opts.voice : null;
  if (!voice) {
    for (const p of lines) {
      show(p);
      const d = cadenceFor(p);
      if (d > 0) await sleep(d);
    }
    await sleep(META_CADENCE_MS.tail);
    return;
  }

  // Audio cadence. Cues address the non-gap lines; a gap shows itself
  // alongside the line that follows it.
  const spoken = lines.filter((p) => !p.classList.contains('gap'));
  const showThrough = (p: HTMLElement) => {
    // Reveal any gaps sitting before this line, then the line.
    let prev = p.previousElementSibling as HTMLElement | null;
    const gaps: HTMLElement[] = [];
    while (prev && prev.classList.contains('gap') && !prev.classList.contains('on')) {
      gaps.unshift(prev);
      prev = prev.previousElementSibling as HTMLElement | null;
    }
    gaps.forEach((g) => g.classList.add('on'));
    show(p);
  };

  for (const cue of META) {
    if (!voice.on) {
      // The listener turned the voice off mid-run: finish on timers.
      await finishOnTimers(spoken, cue, show);
      await sleep(META_CADENCE_MS.tail);
      return;
    }
    const [a, b] = cue.lines;
    const group = spoken.slice(a, b + 1);
    if (!group.length) continue;
    showThrough(group[0]);
    const rest = group.slice(1);
    // Lines inside one cue arrive spread over the take.
    const spread = rest.length ? spreadLines(rest, cue, showThrough) : null;
    await voice.play(cue, group[0]);
    spread?.cancel();
    rest.forEach((p) => (p.classList.contains('on') ? null : showThrough(p)));
  }
  // The whole movement's lines are on; let "Rise." stand before Elysium.
  for (const p of lines) if (!p.classList.contains('on')) p.classList.add('on');
}

/** Reveal the remaining lines of a multi-line cue at the base cadence. */
function spreadLines(rest: HTMLElement[], _cue: MetaCue, show: (p: HTMLElement) => void) {
  let i = 0;
  const id = window.setInterval(() => {
    if (i >= rest.length) {
      window.clearInterval(id);
      return;
    }
    show(rest[i++]);
  }, META_CADENCE_MS.base);
  return { cancel: () => window.clearInterval(id) };
}

async function finishOnTimers(spoken: HTMLElement[], from: MetaCue, show: (p: HTMLElement) => void) {
  const start = from.lines[0];
  for (const p of spoken.slice(start)) {
    if (p.classList.contains('on')) continue;
    show(p);
    const d = cadenceFor(p);
    if (d > 0) await sleep(d);
  }
}
