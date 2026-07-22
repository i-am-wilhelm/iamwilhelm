/**
 * SEIKILOS — the dawn gate's opening tone, ported from the prototype.
 *
 * The oldest complete piece of music that survives: the Seikilos epitaph,
 * first century, carved on a tombstone near Ephesus. Public domain by
 * twenty centuries. "While you live, shine; grieve not at all. Life
 * exists a short while, and time demands its toll."
 *
 * The transcription is a free monophonic rendering after the standard
 * editions (Pöhlmann–West) — the famous phrase, a few bars, the Phrygian
 * octave arched around A, closing home. Durations are in eighth-note
 * pulses; the tempo is unhurried and deliberately slower than the site's
 * 7/8 pulse — dawn does not keep the house meter.
 *
 * Safe everywhere: dynamic `import('tone')`, silent no-op when Tone
 * fails. The gate opens on its own schedule (the hour, a timer), so the
 * AudioContext may still be locked when the tone is asked for; in that
 * case the piece arms itself on the next pointer/key gesture and plays
 * then — audio is not motion, and dawn can wait one touch.
 */

/** [note, pulses] — pulses are eighth-notes at SEIKILOS_PULSE_S. */
const MELODY: ReadonlyArray<readonly [string, number]> = [
  // Ὅσον ζῇς φαίνου — while you live, shine
  ['A4', 3], ['C#5', 1], ['B4', 2], ['A4', 2], ['B4', 1], ['A4', 3],
  // μηδὲν ὅλως σὺ λυποῦ — grieve not at all
  ['C#5', 2], ['D5', 1], ['E5', 2], ['D5', 1], ['C#5', 2], ['B4', 1], ['C#5', 3],
  // πρὸς ὀλίγον ἐστὶ τὸ ζῆν — life exists a short while
  ['E5', 2], ['D5', 1], ['C#5', 2], ['B4', 1], ['A4', 2], ['B4', 1], ['C#5', 3],
  // τὸ τέλος ὁ χρόνος ἀπαιτεῖ — time demands its toll
  ['C#5', 2], ['B4', 1], ['A4', 2], ['G#4', 1], ['F#4', 2], ['G#4', 1], ['A4', 4],
];

/** One eighth-note, in seconds. Unhurried — slower than the site pulse. */
const SEIKILOS_PULSE_S = 0.24;

/** Small breath before the first note so the gate's motion leads. */
const LEAD_IN_S = 0.15;

let playing = false;
let armed = false;

/**
 * Play the epitaph once — a soft sine voice with a plucked envelope,
 * quiet under everything else. Resolves immediately (scheduling is
 * fire-and-forget). When the AudioContext is locked, arms a one-shot
 * gesture listener and plays on the visitor's next touch instead.
 */
export async function playSeikilos(): Promise<void> {
  if (playing) return;

  let Tone: typeof import('tone');
  try {
    Tone = await import('tone');
  } catch {
    return; // no Tone — the gate opens in silence
  }

  try {
    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }
  } catch {
    /* fall through to the armed retry below */
  }

  if (Tone.getContext().state !== 'running') {
    if (armed) return;
    armed = true;
    const retry = () => {
      document.removeEventListener('pointerdown', retry);
      document.removeEventListener('keydown', retry);
      armed = false;
      void playSeikilos();
    };
    document.addEventListener('pointerdown', retry, { once: true });
    document.addEventListener('keydown', retry, { once: true });
    return;
  }

  try {
    playing = true;
    const voice = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.006, decay: 0.4, sustain: 0.2, release: 1.5 },
      volume: -18,
    }).toDestination();

    let t = Tone.now() + LEAD_IN_S;
    for (const [note, pulses] of MELODY) {
      const dur = pulses * SEIKILOS_PULSE_S;
      voice.triggerAttackRelease(note, dur * 0.9, t);
      t += dur;
    }

    // Release the voice once the last note has rung out.
    const totalMs = (t - Tone.now()) * 1000 + 2500;
    window.setTimeout(() => {
      voice.dispose();
      playing = false;
    }, totalMs);
  } catch {
    playing = false; // context refused or synth failed — stay silent
  }
}
