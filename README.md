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

See `src/webgl/README.md` for the full pass-by-pass documentation
(glyph-dither post pass, fumigation smoke, constellation base layer,
stretch-and-resolve morph system, style presets, uniforms).

<!-- TODO(integration): summarize pipeline stages here once shader core lands -->

## Easter-egg registry & hunt

See `src/scripts/eggs/README.md` for the registry format, every registered
egg and its trigger, the hunt state machine, and how to wire the final
mail-in step (config addition only — `hunt.config.ts`).

<!-- TODO(integration): summarize egg registry here once egg engine lands -->

## Orchestra pit

See `src/scripts/audio/README.md` for the 7/8 tap pattern, score structure
(the knock), circle-of-fifths section drones, and adding owner tracks.

## Owner-supplied assets (pending)

Search the codebase for `TODO(owner)` — every pending image, copy block, and
config value is marked. Key ones: hero facecard (`/assets/facecard.png`),
Medea facecard (`/assets/medea.png`), underworld essay copy, Pharmakon poem
text, natal-chart config values, hunt final-step config.
