# Handoff — The Unseen One Pleads His Case

Status: content written, interactive prototype done as a standalone page, voice layer shelved pending actor recordings.

## Files

- `src/content/writings/the-unseen-one.md` — the piece, in the Pharmakon section format. Headnote + five movements. Movement II holds six `.seed-gate` markers and five `.litany-part` blocks; movement III is `.meta-lines`; movement IV has two island mounts (`[data-island="hall"]`, `[data-island="mirror"]`).
- `docs/prototypes/unseen-one-prototype.html` — working standalone prototype. Open it in a browser and go through it once before porting; the pacing is the spec.
- `docs/unseen-one-recording-script.md` — cue-numbered actor script. Each cue id becomes one audio file under `public/audio/unseen/`. The page's voice layer should be driven by those files; the prototype's `speechSynthesis` scaffold is a placeholder and is not to ship.

## What the page does (from the prototype)

1. **Light falls with depth.** Body background lerps from `#17141a` at the top to `#000` by the sixth seed, holds at black through Elysium, and lifts to `#0c0a0d` for the return. On the site this should hook into the existing `backgroundFade` contract in `src/design/tokens.ts` rather than fighting it: this piece needs the fade to run dark-first and stay dark, so it will need a per-page override or a `data-fade="descent"` mode that the backdrop pass honors.
2. **Narcissus at the door.** A small Canvas 2D band of nine six-tepal flowers below the title, fading to near-nothing as the viewer scrolls the first viewport. Seeded random (mulberry32), so it's the same hillside every time.
3. **Seed gates.** Six pomegranate arils, the only red on the page (`#c0243a`, highlight `#ee5a6c`, husk `#6e0f1c`). Gates 1–5 are a click: the seed shrinks to a husk, the next litany part fades in, the page scrolls to it, the next gate appears. Gate 6 is press-and-hold, 2.6 s, with a ring that grows as it fills; release early resets it with the label "Hold it. All the way." Completing it fires the metamorphosis.
4. **Metamorphosis.** Lines appear one at a time on a timed cadence (1100 ms base; 500 for gaps, 1500 for the split/small lines, 1800 for each "Queen.", none after "Rise."), scrolling to keep the newest line above the fold. When audio is present, cadence is driven by the audio cue ending plus its hold value instead of the timer.
5. **Elysium.** A Canvas 2D hall: perspective floor lines to a vanishing point at 42% height, a river band at 86% with a hairline of light and a pressed six-petal flower set on the near bank, ~900 asphodel heads denser and smaller toward the far end with the center aisle kept clearer, two converging walls of darkness, and at the vanishing point a throne in silhouette facing the viewer with a radial light behind it that comes from nothing. In the seat, a black slit with one lit edge. The nearer heads breathe (periodic faint restamp; the frame is rebuilt every ~420 frames so alpha never accumulates). Below it, "Look." and the seat-mirror: a black glass panel with a pointer-following sheen; after ~2 s the word "Queen" appears mirror-reversed then rights itself over ~2.4 s.
6. **Return.** The couplets come back in the opening cadence; the colophon carries the Greek.
7. **Read it straight through** link at the top un-gates everything, marks the seeds taken, and renders the metamorphosis instantly. Also what `prefers-reduced-motion` gets.

## Site integration notes

- Sections are already marked up with the site's `section poem-movement` pattern, `data-section="unseen-0…5"`, `data-symbols`, and `data-smoke-side` alternating, accent `underworld`. Register `unseen-*` section ids wherever the constellation pass seeds star maps by section id.
- The glyph dither post pass will sit on top of the hall canvas; check that the throne's hairline and the mirror edge survive it. If they don't, give the hall and mirror a `data-dither="off"` escape hatch or a lower dither density.
- The drone for these sections: continue the circle of fifths downward from wherever the writings pages land; this piece wants the lowest drone on the site, and silence (actual rest) during the hold on the sixth seed.
- The seat-mirror is a DOM panel, not canvas, so the sheen can be CSS. Keep it a `div`; a real reflective surface is the wrong move here.
- Mobile: the sixth seed hold must work on touch (`pointerdown`/`pointerup`/`pointercancel`, `touch-action: manipulation`, `contextmenu` suppressed). Already done in the prototype.
- Audio: when actor files land, each litany `<p>` maps to a cue id by document order within its part; the metamorphosis lines map to U-06-01…28 in order. Name cues the names (U-05-02, U-05-04) are audio only and have no printed line.

## Open

- Actor recordings (Mike sourcing).
- Whether the hall gets a WebGL pass later (asphodel as instanced points in the existing OGL pipeline). Canvas 2D is fine to ship.
- An easter egg: the pressed flower on the river bank could be a `data-egg-anchor`. Not scoped.
