# The Orchestra Pit (hidden audio layer)

Everything audio lives in this directory. `boot.ts` calls
`initOrchestraPit()` from `pit.ts`; all other cross-subsystem contact happens
through the window events in `src/scripts/events.ts`.

## The tap pattern (how the pit opens)

Tap the site's 7/8 figure — 2+2+3 at roughly the site tempo (84 bpm) — on any
`[data-tap-zone]` element, or anywhere on the page when no zones exist.

Two figures are accepted (`tap.ts`):

| Figure | Taps | Inter-onset ratios (eighth notes) | Feel |
| --- | --- | --- | --- |
| A. one bar of accents | 4 | 2 : 2 : 3 | "short · short · long" |
| B. two bars of accents | 7 | 2 : 2 : 3 : 2 : 2 : 3 | the same figure, twice through |

Matching is tempo-invariant: intervals are normalized to an estimated
eighth-note unit and compared as ratios, with a 25% tolerance per interval
and a wide tempo band (roughly half to 2.5x the nominal 357 ms eighth).
A contrast gate additionally requires each "long" (3) interval to be at
least 1.2x the mean "short" (2) interval, so evenly spaced clicking keeps
the pit closed.
At 84 bpm figure A spans about 2.5 seconds: tap — (2) — tap — (2) — tap —
(3) — tap.

On a match the pit emits `iw:pit-open`, opens the drawer, and — since the
completed figure is a deliberate performance — starts the site score. The
score's knock plays exactly this figure, so listeners learn the key by ear.

## Score structure (`engine.ts`)

- **Transport**: `Tone.getTransport()` at 84 bpm, `timeSignature = [7, 8]`.
  A single `scheduleRepeat` on the `'8n'` grid drives score and sequencer;
  `step` counts 0–6 through the bar. Animation code can read the same
  transport for meter-locked timing.
- **Drone (music of the spheres)**: fat saw + sine sub through a dark
  lowpass. Pitch follows `sections[].drone` from `src/design/tokens.ts`
  (C2 → G2 → D2 → A2 → E2, the circle of fifths as you descend); on
  `iw:section-enter` the frequency glides over ~5 s.
- **The knock**: a deep `MembraneSynth` an octave below the drone, on the
  2+2+3 group boundaries — steps 0, 2, 4 (beats 1, 3, 5), downbeat
  strongest. Mixed low but felt; it is the clue that teaches the tap.
- **Sparse motifs**: a quiet triangle voice places one or two pentatonic
  notes inside the long group on ~30% of bars, echoed through a dotted-
  quarter feedback delay.
- **Master**: all voices sum into a low gain, then a `Limiter(-6)` before
  the destination. The whole layer sits far under the site.

Audio is strictly gesture-gated: Tone.js loads via dynamic import and
`Tone.start()` runs only inside a user interaction (the tap figure, a
toggle click, or the first gesture of a page view when restoring a
remembered choice). Nothing sounds on page load.

## Sequencer toy

Four rows (knock, tick, pluck, shimmer) by seven steps, phase-locked to the
transport. The grid spaces its columns 2 | 2 | 3 and a count row reads
`1 2 · 1 2 · 1 2 3`. The knock row arrives pre-seeded on the group starts.
The pattern persists in `sessionStorage` (`iw-pit:pattern`), alongside the
drawer state (`iw-pit:open`) and the score choice (`iw-pit:score`).

## Adding owner tracks

Edit `tracks.config.ts` — the drawer renders the `tracks` array with zero UI
changes:

- **Owner recording**: `kind: 'owner-recording'`, put the file under
  `public/audio/` and set `src: '/audio/your-file.mp3'`. Renders a native
  `<audio controls preload="none">` player.
- **Licensed embed**: `kind: 'licensed-embed'`, set `embedUrl` to the
  provider iframe URL and fill `license` with the rights note. Renders a
  lazy iframe.

Both `TODO(owner)` markers sit in `tracks.config.ts` with worked examples.

## Files

- `pit.ts` — entry point (`initOrchestraPit`), wiring, persistence, lazy loads
- `tap.ts` — tempo-invariant 7/8 onset matcher
- `engine.ts` — all Tone.js: score, knock, spheres drone, sequencer voices
- `ui.ts` — the drawer (DOM + injected style, site CSS vars)
- `grid.ts` — Tone-free shared sequencer constants
- `tracks.config.ts` — typed track registry (owner recordings, licensed embeds)
