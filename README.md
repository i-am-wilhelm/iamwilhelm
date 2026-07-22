# iamwilhelm.com

Personal site for Michael Wilhelm. Astro static build, deployed to Cloudflare
Workers (static assets) via Wrangler. Interactive layers hydrate as client
islands: a shared WebGL pipeline (OGL), GSAP ScrollTrigger choreography, a
Tone.js audio layer, and an easter-egg engine.

## Commands

```sh
npm install
npm run dev      # local dev server
npm run build    # static build to dist/
npm run preview  # wrangler dev serving dist/
npm run deploy   # build + wrangler deploy
```

Deploying requires a Cloudflare account: `npx wrangler login` once, then
`npm run deploy`. Point the `iamwilhelm.com` zone at the worker with a
custom domain in the Cloudflare dashboard.

## Architecture

- `src/design/tokens.ts` — the shared contract: section registry, accent
  colors, symbol assignments, meter constants, glyph ramp. Every subsystem
  reads from here; symbology guardrails are documented at the top of the file.
- `src/scripts/events.ts` — the event bus. Subsystems communicate only
  through these window CustomEvents; no cross-subsystem imports.
- `src/scripts/boot.ts` — per-page bootstrap; each subsystem initializes
  independently and tolerates the others being absent.
- Content is local markdown collections (`src/content/`); a Ghost backend can
  be wired in later by swapping the loader in `src/content.config.ts` — the
  schema is the stable interface.

## Shader pipeline

One OGL renderer, two stages: four scene passes composite into a render
target — **backdrop** (per-section accent aura, hosts splashes), 
**constellation** (star maps seeded per section id, hairline geometry),
**morph** (stretch-and-resolve: the glyph field smears along the motion path,
then collapses into the resolved silhouette — `trismegistus`, `cross-cube`,
`atlas-columbia`), **smoke** (domain-warped fbm fumigation, side from
`data-smoke-side`, sheared by scroll velocity) — and the **glyph dither post
pass** is the only thing that reaches the screen: brightness-bucketed Greek
glyphs from a runtime atlas, per-channel RGB fringing, and a
saturation-preserve path so painted focal zones resolve *more* saturated
than their surroundings. Style presets: `default`, `dense`, `inverse`,
`chaos` (the easter-egg engine swaps these live). Full pass-by-pass
documentation, uniforms, and the morph registry: `src/webgl/README.md`.

All cross-subsystem input arrives as `iw:*` CustomEvents; handlers write
targets and the frame loop damps toward them, so event bursts never pop.

## Easter-egg registry & hunt

Eight eggs ship in `src/scripts/eggs/eggs.config.ts` (declarative registry;
anchors are `data-egg-anchor` attributes in the section markup, bound lazily
and tolerant of absence): `swan-preen`, `natal-ascent` (the reworked
birthday-coded egg — Pleiades nodes clicked in a date-derived order),
`maat-feather`, `orphic-lyre`, `monsoon-rainmaker`, `pharmakon-sigil`,
`phosphoros-dawn` (dawn-gated grace note), and `psychopomp-door` (ships
disabled; separate-domain discipline — the destination appears nowhere on
this site). Effects replay on every interaction, flash-site style; discovery
fires `iw:egg-found` once.

The cross-page hunt (`hunt.ts`) runs `unbegun → in-progress → awaiting-seal
→ sealed` with five ordered initiation steps persisted under one versioned
localStorage key. The final mail-in step (password in an email subject line,
PO box) is wired later by supplying the `finalStep` object in
`hunt.config.ts` — a config addition, not a refactor. Natal-chart hooks
(`natal.config.ts`) expose placement-derived CSS variables; real birth data
is a `TODO(owner)` config edit. Full documentation:
`src/scripts/eggs/README.md`.

## Orchestra pit

See `src/scripts/audio/README.md` for the 7/8 tap pattern, score structure
(the knock), circle-of-fifths section drones, and adding owner tracks.

## Owner-supplied assets (pending)

Search the codebase for `TODO(owner)` — every pending image, copy block, and
config value is marked. Key ones: hero facecard (`/assets/facecard.png`),
Medea facecard (`/assets/medea.png`), underworld essay copy, Pharmakon poem
text, natal-chart config values, hunt final-step config.
