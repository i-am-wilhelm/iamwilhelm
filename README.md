# iamwilhelm.com

The personal site of Michael Wilhelm. Esoteric, initiation-structured, in the
lineage of flash-era easter-egg sites and modern glyph-art portfolios. The
site is a single descent-and-return: it opens on black, resolves out of
glyphs, and closes at dawn.

Astro (static-first) · TypeScript · vanilla CSS · Canvas 2D · deployed to
Cloudflare Workers.

## The systems

**The glyph dither filter** (`src/lib/filters/dither.ts`, `<DitherCanvas>`)
— every image on the site renders as a field of characters with RGB
chromatic fringing; images resolve *out of* glyphs. Character palettes are
per-section: ASCII by default, polytonic Greek (seeded with the dead letters
ϝ ϟ ϡ) in deconstruction contexts. Modes: `static` (gentle shimmer),
`resolve` (noise → image on scroll/hover), `dissolve` (reverse), `rain`
(Phase 3, the monsoon). Glyphs draw once per step to a mono layer, then
composite three times with per-channel tint and offset for the CRT fringe.
Lazy-initialized, paused offscreen, single still frame under
`prefers-reduced-motion`.

**The Great Fade** (`src/lib/fade.ts`) — the page background eases from
pure black (nigredo) to near-white (albedo) across the full homepage
scroll, on a curve weighted to stay dark long into the descent (t^2.6).
Ink crosses over smoothly past the midpoint. Scroll-driven, so it holds
under reduced motion.

**Fumigation accents** (`src/styles/tokens.css`) — one accent color per
section, its incense smoke, set against the monochrome fade. Each section
carries a small italic marginalia line naming its fumigation.

**Odd-meter motion** (`src/lib/timing.ts`) — all animation timing derives
from 7/8: reveals and cascades stagger in 2+2+3 pulse groups (140ms
eighth-note, 980ms bar). The CSS side lives in tokens as `--pulse`,
`--pulse-2`, `--pulse-3`, `--bar-7-8`.

**Content** (`src/lib/content.ts`) — every page fetches writings through
this one interface. A future swap to a headless Ghost backend touches this
file only. Posts declare a governing `symbol` and optional `accent` in
frontmatter; the template themes the page to them.

**Later phases** (scaffolded, not yet wired):
`src/lib/eggs.ts` (the egg registry and mark tokens), `src/lib/audio/engine.ts`
(Tone.js drones on the circle of fifths — the threshold's Enter click already
wakes it as the visitor's first offering), `/underworld` (hidden route, the
descent and the Orpheus rule), the monsoon states, the orchestra pit, the
dawn gate. Search `TODO(phase-` for every seam.

## Local development

```sh
npm install
npm run dev        # http://localhost:4321
npm run build      # static build + worker entry in dist/
npm run preview    # preview the production build
```

## Deploy (Cloudflare Workers)

One-time setup:

1. `npx wrangler login` (opens a browser to authorize).
2. Make sure the `iamwilhelm.com` zone exists on the Cloudflare account.
   If the routes block in `wrangler.toml` fails on first deploy, comment
   out both `[[routes]]` entries, deploy once, then re-enable them (or
   attach the custom domain in the dashboard under Workers → iamwilhelm →
   Settings → Domains & Routes).

Then, from the repo root:

```sh
npm run deploy     # astro build && wrangler deploy
```

The site is fully prerendered; the Worker serves `dist/` as static assets
and stands ready for on-demand routes later (live weather, Ghost).

## Asset checklist (what Michael supplies)

Every slot currently holds a procedural or SVG placeholder. The dither
filter samples luminance, so **high-contrast grayscale art reads best** —
bright form against true black. PNG or high-quality JPEG; no transparency
needed (the field behind glyphs is always black).

| # | Asset | Slot | Size / format | Notes |
|---|-------|------|---------------|-------|
| 1 | Black Swan hero art | `public/img/` → hero `<DitherCanvas src>` in `index.astro` | 1600×1000px (16:10), grayscale PNG/JPG | Barely-there; form suggested more than shown. Replaces `placeholder-swan.svg`. |
| 2 | Facecard portrait | hero section (`TODO(asset)` marker) | 800×1000px (4:5), grayscale | Will render through the filter; strong key light works best. |
| 3 | Atlas / Columbia / Pallas art | philosophy section | 1600×900px (16:9), grayscale | Phase 2 morphs Atlas → Columbia/Pallas; one still is enough for Phase 1. Replaces `placeholder-atlas.svg`. |
| 4 | Monsoon / drought still | memoir section | 1600×800px (2:1), grayscale | Cracked earth under a storm shelf. Replaces `placeholder-monsoon.svg`. |
| 5 | Symbol art ×12 | constellation sky + writings headers (Janus, Orpheus, Babalon, Prometheus, Hermes, Medea, Ouroboros, Sol Niger, Saturn, Pleiades, the Cross, Pan) | 800×800px each, white-on-black line art | Phase 2 turns these into star-clusters; until then a glyph mark stands in (`src/lib/symbols.ts`). |
| 6 | Pharmakon (abridged) text | `src/content/writings/pharmakon.md` | Markdown | Frontmatter is already set (symbol: medea). |
| 7 | Section copy | `TODO(copy)` markers in `index.astro` + contact address | text | Philosophy line, memoir excerpt, contact line. |

## Voice rules (for all copy)

Active voice. Concise. Speak to the reader as *you*. Zero fluff. Avoid
negative parallelism constructions.
