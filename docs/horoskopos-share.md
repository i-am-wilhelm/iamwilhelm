# Horoskopos: the share system

Every major module of Horoskopos can be shared three ways from one foundation: an image card, a deep link, and an embed. This is the map.

## The rule

Birth date, time and place are never stored, logged or put in a URL. A share is built from computed chart output only: where each body stands, the angles, the cusps, the house system. `fromEngineChart` (`src/scripts/horoskopos/share/engine.ts`) is the one place a cast chart is read for sharing, and it copies nothing else.

Placements can still reveal an approximate birth date. That is what the privacy selector is for.

## One URL shape

```
?c=<chart>&m=<moduleId>&f=<focus>&p=<privacy>      (+ c2 for a second chart)
```

Read by the engine page (`/gallery/horoskopos/`), the embed route (`/horoskopos/embed/`), the Worker and the oEmbed endpoint. `state.ts` parses and writes it.

| Level | What the link holds |
| --- | --- |
| `full` | Everything, with the chart's label |
| `sign` | Signs only: no degrees, no houses, no lots |
| `anon` | Signs only, and no label |

The level is applied before encoding, so what it hides is not in the link. The two cuts (sign level, has a name) are separate flags in the format.

## Where things live

| File | What it does |
| --- | --- |
| `src/scripts/horoskopos/share/codec.ts` | `encodeChart` / `decodeChart`: versioned binary, base64url |
| `…/state.ts` | Share state, URLs, the trail-of-steps focus |
| `…/engine.ts` | Types for the engine's API; cast chart to computed output and back |
| `…/registry.ts` | The module registry: derive, and the `full`, `embed`, `card` renderers |
| `…/cards.ts` | Card layouts (voice, duo, table, chart) as drawing operations |
| `…/paint-canvas.ts`, `…/paint-svg.ts` | The two painters: browser canvas, and SVG for the Worker |
| `…/page.ts` | Engine page: arrival, share buttons, the panel |
| `…/embed.ts`, `src/pages/horoskopos/embed.astro` | The embed route |
| `worker/horoskopos.ts` | Unfurl tags, the card PNG, oEmbed |
| `public/machines/natal/embed.js` | Optional script that fits a frame's height to its reading |
| `scripts/horoskopos-engine-module.mjs` | Wraps the engine as a module for the Worker and the tests |
| `tests/horoskopos-share/` | Codec round trips, privacy, registry, state (`npm test`) |

## Registered modules

`wheel`, `placements`, `god`, `aspect`, `patterns`, `house`, `keyholder`, `inner` (Anima / Animus), `lots`, `fate`, `key` (chart key and tones), `daily`, `synastry`, `davison`, `glossary`, `step` (a trail of breadcrumbs).

To add one: write an entry in `registry.ts` and add it to `MODULES`. Cards, links, embeds and previews follow.

`deep: true` on an entry is the paid-tier gate: it shares as a teaser. `house` and `keyholder` carry it now. `DEEP_GATE` switches it off globally.

## The engine

`public/machines/natal/engine.js` is patched in place (search it for "share system"):

- A headless mode: with no `#sky` on the page it skips the page wiring.
- A spec can be a chart already cast (`{ chart }`); such a chart is never recast.
- A sign-level chart shows no degrees or lines anywhere.
- The API on `self.__natal`, including `withShared`, which stages charts for one call and puts the table back.

If the engine is regenerated from its source artifact, these patches must be carried over.

## Things that are deliberate

- Content is always derived from charts that came out of the codec, at default tuning, so a preview is exactly what a recipient gets.
- A Davison share carries the Davison chart itself. It cannot be worked out from two shared charts without birth data.
- On arrival the chart codes move from the query to the fragment, which browsers never send.
- Invocation logs are off in both wrangler configs, because they record request URLs.
- The Worker's card is SVG rasterised with resvg (WebAssembly, bundled). It sets Literata at its default instance; the canvas card uses the browser's optical sizing, so letterforms differ slightly.
