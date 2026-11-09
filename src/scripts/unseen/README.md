# The Unseen One Pleads His Case (`src/scripts/unseen/`)

The descent island for `/gallery/the-unseen-one/` (moved from `/writings/the-unseen-one/`, which redirects). Mounted by `boot.ts`
wherever `.seed-gate` markup exists; the page itself is the writings route
rendered with `treatment: descent` (see `src/components/writings/Descent.astro`).

- `mount.ts`: orchestration. Hides what waits, builds the gates, runs the
  metamorphosis, opens Elysium and the return, binds "Read it straight through".
- `gates.ts`: the six pomegranate seeds. Click for 1 to 5; press-and-hold
  2.6 s for the sixth (pointer events, pointer capture, touch-safe, context
  menu suppressed, keyboard: hold Space or Enter).
- `metamorphosis.ts`: timed line reveal (prototype cadence) or cue-driven.
- `canvases.ts`: narcissus band and the hall of asphodel, Canvas 2D.
- `mirror.ts`: the seat-mirror panel: pointer sheen, reversed-then-righted word.
- `audio.ts` + `cues.ts`: the voice controller and the cue sheet.

## Audio (hooks only; no files ship yet)

Cue files go under `public/audio/unseen/` named by cue id from
`docs/unseen-one-recording-script.md`, as `U-00-01.mp3` and so on. On mount
the island sends a HEAD request for `U-00-01.mp3`; when the response is an
audio type, a "Hear it" toggle appears at the top of the litany. With the
voice on, each litany part and the metamorphosis take their cadence from cue
end plus the cue's hold, the speaking line is marked `.speaking`, the "Take
the Nth seed" cues play as seeds are taken, `U-05-08` loops through the hold
of the sixth seed, `U-05-09` plays on release, `U-07-01` as the mirror
appears, and the return couplets follow. Nothing plays before the toggle is
pressed. With no files present nothing is shown and timers run.

Unprinted cues (her small answers in parts 02 and 03, the two names in part
05) play in sequence without highlighting a line; `cues.ts` carries that map.

## Events

- emits `iw:pit-rest {resting}` for the length of the hold (the orchestra
  pit's master goes to actual silence, then back on release);
- emits `iw:layout` whenever a gated section is shown, so scroll choreography
  re-measures its triggers.
