# IAMWILHELM.COM — HERO: "The Natal Engine" + the Dioscuri Facecard

Handoff for a Claude Code session working in `C:\Users\mamaz\Claude Code\iamwilhelm.com`.
Read this whole file before touching code. Where this document and the current
code disagree, this document wins; where this document is silent, follow the
conventions already in the repo.

---

## 0. Repo reality (read first — the site exists and is live)

This is NOT a scaffold job. iamwilhelm.com is live on Cloudflare Workers
(static assets, worker `iamwilhelm`), repo `i-am-wilhelm/iamwilhelm`, and
**every push to `main` deploys to production** via `.github/workflows/deploy.yml`.

- Stack: Astro 5 (`output: 'static'`), vanilla TS client islands, GSAP +
  ScrollTrigger, OGL WebGL pipeline, Tone.js (lazy). No `@astrojs/cloudflare`
  adapter — `wrangler.jsonc` serves `./dist` as assets. Do not add one.
- Run `npm ci` first (gsap/ogl/tone). Dev server: the `iamwilhelm` entry in
  `../.claude/launch.json` (port 4323, host 127.0.0.1). Use `preview_start`
  with that name; never run the dev server through Bash.
- `npm run check` (astro check) must pass before every commit.
- **Branch workflow:** create `feat/natal-hero` from `main`. Commit as you go
  with the repo's style (`feat(hero): …`, `style: …`, `content: …`). Do NOT
  merge or push to `main` until Michael approves the dev route in the browser.
  For a hosted preview without deploying, `npx wrangler versions upload`
  returns a non-promoted preview URL; if it refuses, screenshots from the dev
  server are the review medium.
- Screenshot gotcha: copy blocks are `autoAlpha:0` until a real wheel scroll
  fires the GSAP reveal. Nudge the wheel before capturing, not `scrollTo`.

### What already exists that this build must reuse, not duplicate

| Concern | Existing file | What to do |
| --- | --- | --- |
| Event bus | `src/scripts/events.ts` | All cross-subsystem talk is `iw:*` window CustomEvents. Extend the `IWEvents` interface, never rename or bypass it. |
| Section registry / tokens | `src/design/tokens.ts` | `meter` (7/8, 2+2+3, 84 bpm), `glyphRamp` (Greek), `accents.hero`, `backgroundFade`. Add new tokens here. |
| Greek glyph atlas | `src/webgl/glyph-atlas.ts` → `buildGlyphAtlas(cell)` | Coverage-ranked Greek ramp on an offscreen canvas. **The signal layer's dither uses this atlas.** Do not write a second glyph atlas. |
| WebGL stage | `#gl-stage` in `src/layouts/Base.astro`, `src/webgl/pipeline.ts` | Fixed, `z-index: 0`, runs behind every section including the hero. Leave it running; the hero canvas layers above it. Section backdrop/constellation chrome is out of scope. |
| Scroll choreography | `src/scripts/scroll.ts` | GSAP ScrollTrigger already registered; emits `iw:scroll`, `iw:section-enter/leave/progress`. Reuse ScrollTrigger for the hero pin. |
| Hero markup | `src/components/sections/Hero.astro` + `src/components/Section.astro` | Current hero = `<figure class="facecard">` with `/assets/portrait.webp` + copy (term, h1, lede, Pharmakon epigraph, phosphoros star). The copy and both egg anchors survive this rebuild. |
| Portrait | `public/assets/portrait.webp` | **This is Michael's real portrait, already shipped.** It is the flesh layer. There is no placeholder to swap. |
| Natal placeholders | `src/scripts/eggs/natal.config.ts` | Carries `TODO(owner)` placeholder placements (uranus/neptune/venus) and `keyDate`. This build supplies the real data (§2) and makes that file derive from it. |
| Easter eggs | `src/scripts/eggs/eggs.config.ts` | `swan-preen` binds `[data-egg-anchor="hero-swan"]` (triple-tap → inverse dither); `phosphoros-dawn` binds `[data-egg-anchor="phosphoros-star"]`. Both anchors must remain in the hero DOM and remain clickable. |
| Audio "knock" | `src/scripts/audio/` (README, `engine.ts`, `tap.ts`) | The site already calls the 7/8 accent figure "the knock" (Tone transport, 84 bpm, accents on steps 0/2/4). The new clock is the visual sibling of this; see §3 for the tempo decision. |
| Boot | `src/scripts/boot.ts` | Add the hero mount as one more independent job; it must tolerate every other subsystem being absent, and vice versa. |
| Symbology guardrails | top of `tokens.ts`, `src/webgl/README.md` | Classical / alchemical / Greco-Egyptian only. No kabbalah, no new-age, no modern secret-society marks. Glyphs, rings and the Lilith lens all pass this audit. |

---

## 1. Architecture (paths follow the repo: `src/scripts/`, not `src/lib/`)

- `src/scripts/natal/engine.ts` — framework-agnostic Canvas 2D renderer.
  `new NatalEngine(canvas, chart: ChartData, opts)`. Knows nothing about whose
  chart it draws. Exports the `ChartData` types (this engine later powers a
  public chart tool and a music-engine sibling). Zero runtime deps.
- `src/scripts/natal/chart.michael.ts` — the data in §2, typed as `ChartData`.
- `src/scripts/natal/aspects.ts` — aspect computation (§4), pure functions.
- `src/scripts/clock.ts` — site-wide 7/8 meter singleton ("the knock"). Bar of
  7 eighths, accents at eighth indices 0/2/4, index 0 is the knock. Exports
  `subscribe(cb)`, `now()` (bar phase 0..1, eighth index, knockGlow envelope),
  `setEighthMs()`. Emits `iw:knock {index, accent}` on every accented eighth so
  non-importing subsystems can listen. The hero, future sections and the
  hidden music layer all listen to this one clock.
- `src/scripts/natal/dioscuri.ts` — the portrait stack (flesh + signal, §7).
- `src/scripts/natal/mount.ts` — wires engine + portrait + scroll choreography
  + tinker overlay to the hero DOM; called from `boot.ts`.
- `src/components/sections/Hero.astro` — rewritten: sticky canvas wrapper
  OUTSIDE `.copy` (the GSAP copy reveal sets `autoAlpha:0` on every `.copy`
  child, so a canvas inside it would vanish), the existing copy block kept, the
  egg anchors kept (`hero-swan` moves onto the portrait hit-area element;
  `phosphoros-star` stays).
- `src/pages/lab/hero.astro` — dev route: the hero alone, with `?tinker=1`
  honored. Build and review here first, then wire into `index.astro`. Keep the
  route in the repo; it is a permanent workbench.
- `src/scripts/eggs/natal.config.ts` — refactor to import `CHART` and derive
  `natal.uranus/neptune/venus` and `keyDate` from it. Delete the `TODO(owner)`
  markers there. (`birthdaySequence()` will change because the real date
  replaces the placeholder — that is intended; update
  `src/scripts/eggs/README.md` if it documents the old order.)

Events to add to `IWEvents` (extend, never rename):

```ts
/** Clock → everyone. Fires on accented eighths; index 0 is the knock. */
'iw:knock': { index: 0 | 2 | 4; barPhase: number };
/** Hero → next section. Scroll phase of the natal hero (see §8). */
'iw:natal-phase': { progress: number; phase: 'face' | 'ascent' | 'dissolve' };
/** Venus's heart → audio sibling, later. */
'iw:venus-beat': { env: number };
```

Debug overlay behind `?tinker=1`: layer toggles (spine/splits, circuit, Venus
& window, squares, sextiles, lens, vertex, portrait, knock, glyph audit) and
dials (brilliance 0.5–1.7, density 0.2–1.6, flow speed 0.4–2, Venus 40–84 bpm,
eighth 230–420 ms, signal rest/surge, tide period). Plain DOM, `--font-ui`,
no library.

---

## 2. Chart data (Swiss Ephemeris, 1991-03-01 17:00 UT, Safford AZ 32.834N 109.707W, Placidus)

```ts
export const CHART = {
  mc: 302.0342, asc: 48.3416, vertex: 202.2901, house12cusp: 5.7480,
  cusps: [48.3416,75.9414,98.8494,122.0342,149.6519,185.748,
          228.3416,255.9414,278.8494,302.0342,329.6519,5.748],
  bodies: {
    sun:     {lon:340.6065, spd:1.00328,  retro:false},
    mercury: {lon:340.2568, spd:1.87525,  retro:false}, // cazimi — rides inside the Sun
    moon:    {lon:172.6298, spd:13.63952, retro:false}, // full
    venus:   {lon:9.0222,   spd:1.22742,  retro:false}, // chart ruler, 12th house
    mars:    {lon:74.0065,  spd:0.45081,  retro:false},
    jupiter: {lon:124.8545, spd:0.08777,  retro:true},
    saturn:  {lon:302.5105, spd:0.10194,  retro:false}, // partile on the MC — the crown
    uranus:  {lon:282.8672, spd:0.03831,  retro:false},
    neptune: {lon:286.1374, spd:0.02503,  retro:false},
    pluto:   {lon:230.3599, spd:0.00454,  retro:true},
    nn:      {lon:295.9728, spd:0.05299,  retro:true},
    vesta:   {lon:55.4756,  spd:0.29743,  retro:false}
  },
  lilith: 263.8747 // 23°52' Sag — a lens, never an orb
};
```

Derived values `natal.config.ts` should now compute instead of hard-coding:
Uranus 12°52′ Capricorn and Neptune 16°08′ Capricorn, both 9th house (cusp 9 =
278.85, cusp 10 = 302.03); Venus 9°01′ Aries, 12th house; `keyDate` =
1991-03-01. The existing placeholder signs/houses already match — only the
degrees and date were fake.

---

## 3. The clock — tempo decision

The spec's prototype was tuned at a **300 ms eighth** (quarter = 100 bpm). The
site's existing meter token is **84 bpm** (eighth ≈ 357 ms), used by the copy
reveal staggers in `scroll.ts` and the Tone transport in the orchestra pit.

Decision for this build: the natal clock defaults to the tuned **300 ms**. Add
`eighthMs: 300` to `meter` in `tokens.ts` with a comment naming the mismatch,
and leave `bpm: 84` and its consumers untouched. Unifying the two tempos (or
slaving `clock.ts` to the Tone transport once `iw:pit-open` fires) is a
documented follow-up, not part of this scope. The tinker dial (230–420 ms)
lets Michael hear both; 357 is the value to try if he wants one site tempo.

---

## 4. Orientation, geometry, aspect engine

- MC fixed at zenith, zodiac counterclockwise: canvas angle
  `theta = (-90 - (lon - mc)) * PI/180`.
- Planet ring `R = min(vw,vh) * 0.40` (0.42 under 640px). Bodies within 5° of a
  neighbor stagger radially to 0.965R / 1.035R. Portrait disc radius `0.165R`.
- Wheel chrome, unlabeled and exact: rings at 1.05R and 0.9R, sign ticks every
  30° (alpha 0.16), 5° minors (0.05), ASC/MC axis ticks (0.12). All chrome
  brightens ×(1 + 0.7·knockGlow).

Aspects (computed at runtime from `ChartData`, in `aspects.ts`):

- Mercury is excluded from the web — his aspects ride the Sun's (cazimi).
- Orbs: conj 8, sextile 5, square 7, trine 7, opposition 8. Sun–Moon pair +5;
  any other pair containing a luminary +2. Weight `w = 1 − off/orb`.
- Sun–Moon opposition is the spine; render weight `max(w, 0.75)` — the 12° orb
  is birth timing, never faintness.
- moon/vesta/nn trines render as the circuit, excluded from generic beams.
- Beam alpha base `(0.10 + 0.26w) · brilliance`; spine ×1.5 and ×(1+0.8·knock).

---

## 5. Visual grammar

Palette: sun #ffcf6e, mercury #e6edf4, moon #eef2fb, venus #ff8fb0,
mars #ff5a4d, jupiter #8fa8ff, saturn #c9a05e, uranus #6fe3ff, neptune #9a8cff,
pluto #c04a63, nn #d8c9a0, vesta #ffb27a. Venus fringe triplet:
#ff8fb0 / #86e6b8 / #ffe9c9. Put these in `tokens.ts` as `natalPalette`.
All glow via cached 64px radial-gradient sprites, composited `lighter`. Beams
stroke with linear gradients endpoint-color to endpoint-color.

- Opposition: straight, standing wave (2 antinodes, amp 2.2px; spine 3.2px),
  bidirectional flow, surges on the knock.
- Trine: quadratic bow with control point pulled 17% toward center; dual stroke
  (1.2px + 4px at 0.3× alpha); continuous laminar particles.
- Square: dash [7,9] with stepped offset `floor(t·6)·4`; staccato bursts +
  endpoint sparkles on accent 4.
- Sextile: 0.9px faint line; bright packets on accent 2.
- Conjunction (uranus–neptune, saturn–nn): 10px round-cap gradient corona +
  midpoint glow, a beam never forms.
- Particle speed from the source body's true motion:
  `pxPerSec = lerp(55, 330, lognorm(spd, 0.0045, 13.64))`. Flow cap 340×density,
  seekers cap 36 at 300 px/s.

Background: the body is `#050505` at the top of the page (`backgroundFade.from`).
The spec wants true `#000` behind the hero. Give `#hero` its own
`background: #000` with a short feathered gradient at its bottom edge into the
body colour; do not change `backgroundFade`.

---

## 6. Set pieces (tuned — keep these numbers)

- **Cazimi**: silver Mercury core orbiting inside the Sun's corona, orbit 9.5px,
  ~0.9 rad/s, trailing arc.
- **Saturn's Crown**: heaviest halo (52), slowest breath, tilted ring
  (rotate −0.42, scaleY 0.36, r 15.5) at the zenith.
- **Orb breath**: period `lerp(9s, 1.4s, lognorm(spd))` — the Moon races, Saturn
  barely stirs. Retrograde bodies run their highlight arc backward.
- **Spine splits**: spine particles within `0.88 × discR` of center flare and
  spawn ≤2 seekers toward random aspect-connected planets (arrival = brief tint).
- **Circuit**: moon→vesta→nn→moon, one direction, spawn ~2.4/s·density.
- **The Window** (12th house, lon 5.748 → 48.3416, radial 0.32R–1.08R): veil
  rgba(205,218,245,.03), slow sheen sweep, striae arcs at 0.5/0.68/0.86R, edge
  lines rgba(210,222,245,.14) that glow on crossings.
- **Venus's heart**: her own clock, default 52 bpm, lub at phase .02 (σ .085),
  dub 0.62× at .30 — a polyrhythm against the 7/8; her orb scale 1+0.26·env.
  Each heartbeat emits one packet per Venus aspect from her end, and emits
  `iw:venus-beat`. Crossing point is sampled against the pane edges on the
  beam's actual (curved) path. Before the glass: soft, alpha .4. At the glass:
  edge glow + expanding ripple ring. After: chromatic triplet, perpendicular
  offsets ±2.6px. Arrival: target orb blushes rose (decay ×.94) and the whole
  scene lifts — fillRect rgba(255,205,220, .045·lift), decay ×.9.
- **Lilith lens**: pull toward her point `(1−d/0.17R)² · 0.035R` applied to beam
  polylines and particle draw positions; violet rings (0.05R breathing + 0.085R
  partial arc) whose alpha rises only when light actually bends (+.05/event,
  −.012/frame).
- **Vertex ignition**: dim flickering ember at lon 202.29; pointer within 58px
  ramps heat → bloom + six quadratic filament wisps; slow decay on leave.
  Touch: a tap within the radius ignites for one bar.

---

## 7. The Dioscuri facecard (center stage)

Two portrait layers in a circular crop of radius discR, perfectly registered.
Source image: `public/assets/portrait.webp` (square, face at roughly 50%/45%
per the current CSS mask). Load once, decode once, share the bitmap.

- **Flesh**: the photo. Base alpha 1.0.
- **Signal**: runtime glyph-dither of the same photo. Offscreen pass: cell 8px
  (6px mobile), ~12-step luminance ramp drawn from `buildGlyphAtlas()` (the
  existing coverage-ranked Greek ramp — dark→bright `·` through `Ψ Φ`), with
  ±1px R/B chromatic fringing. Composite `lighter`. Rest alpha 0.15. Re-dither
  only when the disc radius changes, not per frame; per-frame work is
  compositing and the excitation buffer.
- **The breath**: on each knock, signal surges to 0.6 and flesh dips to 0.55,
  both decaying back across the bar. RGB tick: channels separate ±2px on the
  knock and snap back within ~180ms.
- **The tide**: a 90s sine slowly seesaws the rest values (flesh 1.0↔0.35,
  signal 0.15↔0.75) — over minutes the ghost twin takes the face, then gives it
  back.
- **Light through the head**: draw order is beams → portrait stack. The photo
  occludes; the glyph layer transmits. At each knock the spine and splits shine
  through the face between the characters for one flash per bar.
- **Receiving surface**: portrait-space excitation buffer (decay ×.94). Spine
  splits stamp a streak along the beam's direction; Venus arrivals stamp a rose
  radial. The buffer locally brightens glyphs and tints them toward the event
  color — the face lights only where the sky touches it.
- **Eyes hold out longest**: config array of normalized ellipse masks (defaults
  (0.38,0.42) and (0.62,0.42), rx .07 ry .045, tunable in tinker) where flesh
  alpha floors at 0.9 regardless of breath or tide. Verify the defaults against
  the real portrait and adjust in `chart.michael.ts`'s `portrait` block, not in
  the engine.
- **Egg anchor**: the portrait hit-area `<div data-egg-anchor="hero-swan">`
  tracks the disc (center and radius updated on scroll) so `swan-preen` still
  fires on a triple-tap of the face. When `iw:dither-style {style:'inverse'}`
  fires, invert the signal layer's luminance mapping for the same duration the
  WebGL dither inverts — the twin shows its white under-feather too.

---

## 8. Scroll choreography (flesh → signal → stars)

Hero section ~200vh; the canvas wrapper is pinned with one GSAP ScrollTrigger
(`pin: true`, scrub) and progress `p` comes from that trigger. Emit
`iw:natal-phase` on every change.

- `p < 0.25` — `phase: 'face'`: full composition, face centered. The copy block
  (term, h1, lede, epigraph) sits in a bottom band below the wheel, revealed by
  the existing 7/8 stagger; it must not cover the disc.
- `0.25–0.75` — `phase: 'ascent'`: the portrait shrinks to a medallion
  (~0.10R) and travels an eased curved path to its own rising degree — the ASC
  point, 18°20′ Taurus on the ring. The mask takes its station on the horizon.
  Signal share ramps to 1.0 by `p = 0.7` (fully the glyph twin on arrival; keep
  a faint knock-breath). The center opens and the prism splits play naked —
  flares fully visible. The copy block stays put; the wheel drifts up behind it.
- `0.75–1.0` — `phase: 'dissolve'`: the chart dissolves outward — planets
  scatter into a constellation point-field and fade, handing off to the next
  section (Cluster / Pleiades). The receiving section is a later build; this
  build only emits the event and fades the canvas to transparent so the WebGL
  constellation beneath shows through.
- `prefers-reduced-motion`: no pin, no scrub. Render one static lit frame of
  the `face` state (no particles, no breath) and let the page scroll normally.
  (`boot.ts` already skips the WebGL pipeline under reduced motion; follow that
  pattern — mount the engine, call `renderStatic()`, never start the rAF loop.)

---

## 9. Performance & accessibility

Single rAF owned by `mount.ts` (the engine exposes `tick(dt)`, it does not run
its own loop); DPR capped at 2 (match `MAX_DPR` in `pipeline.ts`); sprite and
dither bitmaps cached; particle caps as above; idle the loop entirely when the
hero is off-screen (IntersectionObserver on the section) and on
`document.hidden`. Canvas has `aria-hidden="true"`; the portrait keeps an
accessible name via a visually hidden `<img alt="Michael Wilhelm — portrait">`
or `role="img"` + `aria-label` on the wrapper. Target 60fps on mid-tier mobile;
measure with the Performance panel on the dev route and report the frame
budget in the PR notes. No layout shift when the canvas mounts (reserve the
200vh in CSS, not in JS).

---

## 10. Acceptance (verify each in the browser pane, screenshot the proof)

- Engine renders from any `ChartData`; Michael's chart is just the first data
  file. A second throwaway chart in `/lab/hero?chart=test` renders without
  code changes.
- Saturn crowns the zenith wearing his ring; Mercury orbits inside the Sun;
  retrograde highlights run backward; the circuit circulates; Lilith bends
  passing light; the Vertex ignites under the pointer.
- Venus thumps 52 bpm against the 300ms 7/8, ripples the glass, fringes into
  rose/emerald/pale-gold, blushes her targets, lifts the room.
- The face breathes flesh→signal on the knock, the tide trades dominance over
  minutes, beams flash through the glyph face, eyes stay photographic.
- On scroll the portrait takes the Ascendant as a signal medallion and the
  center splits play naked; `iw:natal-phase` fires through all three phases
  and the canvas is transparent at `p = 1`.
- `swan-preen` (triple-tap the face) and `phosphoros-dawn` (click the ⁘ star
  with `localStorage['wilhelm.dawn.force']='1'` or inside the 5–8 AM band)
  still fire. The copy block and its Pharmakon epigraph link are intact.
- `natal.config.ts` has no `TODO(owner)` left; README's pending list drops the
  natal line; `src/scripts/eggs/README.md` reflects the new sequence source.
- `?tinker=1` overlay works on `/lab/hero` and `/`; reduced-motion renders the
  static frame; offscreen idling and `document.hidden` stop the loop (confirm
  via a counter in tinker); mobile viewport (375px) holds frame rate.
- `npm run check` and `npm run build` pass. Other sections are visually
  unchanged (compare screenshots of Cluster and Philosophy before/after).
- Everything is on `feat/natal-hero`, pushed, with a PR description that lists
  the tempo decision (§3) and the eye-mask values chosen. Nothing on `main`.
