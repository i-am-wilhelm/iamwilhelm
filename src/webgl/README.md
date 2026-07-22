# Shader core (`src/webgl/`)

The WebGL pipeline behind the fixed `#gl-stage` canvas. One OGL renderer,
one offscreen scene target, one post pass:

```
scene target (render-to-texture)              screen
┌────────────────────────────────┐            ┌──────────────────────┐
│ 1. backdrop   — section splash │            │                      │
│ 2. constellation — star maps   │ ─texture─▶ │  glyph dither post   │
│ 3. morph      — stretch/resolve│            │  (the signature look)│
│ 4. smoke      — fumigation     │            │                      │
└────────────────────────────────┘            └──────────────────────┘
```

Everything in stage 1 paints plain luminance/chroma; the dither is the
only thing that reaches the screen, so smoke, morphs, and constellations
all automatically resolve through the Greek glyph field.

## Entry point

```ts
import { initPipeline } from './webgl/pipeline';
const handle = await initPipeline(canvas); // null if WebGL unavailable
handle?.destroy(); // stop loop, unbind events, lose context
```

`pipeline.ts` also re-exports `DITHER_STYLES`, `DITHER_STYLE_NAMES`, and
`MORPH_NAMES` for other subsystems that want to enumerate them.

Engineering posture: DPR capped at 2, `requestAnimationFrame` loop idles
on `visibilitychange`, window resize resizes both the drawing buffer and
the scene target, and a missing WebGL context returns `null` without
throwing (the page simply runs unshaded).

## Event contract (all input via `src/scripts/events.ts`)

| Event | Effect here |
| --- | --- |
| `iw:scroll` | Page progress + velocity. Velocity (damped) swings the smoke column and decays between events. |
| `iw:section-enter` | Sets the active section: accent color, smoke side, backdrop focal point, constellation crossfade target. |
| `iw:section-progress` | Local 0..1 progress — drives splash reveal, constellation parallax, section crossfade midpoints. |
| `iw:morph` | `{name, progress}` — drives the stretch-and-resolve morph pass. |
| `iw:dither-style` | Swaps the glyph treatment preset (crossfaded, ~⅓ s). |
| `iw:splash` | Flash/recolor pulse on the backdrop (explicit color, else the section accent). |
| `iw:weather` | `{raining}` — monsoon-section rain/drought treatment in the dither. |

Handlers only write *targets*; the frame loop damps displayed values
toward them, so event bursts can never pop the imagery.

## Files

- `pipeline.ts` — orchestrator: renderer, RTT, event wiring, frame loop.
- `state.ts` — shared mutable state + DOM section reading (`.section[data-section]`, `data-symbols`, `data-smoke-side`).
- `glyph-atlas.ts` — runtime atlas: draws the token `glyphRamp` (ancient Greek) to an offscreen canvas, measures real ink coverage per glyph, orders lightest→heaviest.
- `glsl.ts` — shared GLSL chunks (fbm noise, color helpers, 2D SDFs).
- `utils.ts` — hashing, seeded PRNG, damping math.
- `passes/backdrop.ts`, `passes/constellation.ts`, `passes/morphs.ts`, `passes/smoke.ts`, `passes/dither.ts` — the passes, below.

## Pass notes

### Glyph dither (post)

The screen is cut into glyph cells (base 14 CSS px × style `cellScale`).
Each cell samples scene luminance and picks a glyph by brightness bucket
from the coverage-ordered atlas; per-channel intra-cell offsets (radial
from screen center) produce the RGB chromatic fringing.

**Saturation preservation:** base visuals are painted with saturated
focal zones (see backdrop). The dither scales glyph chroma *up* where
source saturation is high (`chromaScale` gain 1→2.6 over sat 0.12→0.55),
so hot zones resolve more saturated than their surroundings instead of
flattening to a duotone.

Key uniforms: `uScene`, `uAtlas`, `uAtlasGrid`, `uGlyphCount`,
`uCellScale`, `uInvert`, `uChaos`, `uDensity`, `uFringe`, `uGamma`,
`uRain`, `uDrought`, `uLightning`.

**Style presets** (`iw:dither-style`, unknown names → `default`):

| name | treatment |
| --- | --- |
| `default` | 14 px cells, upright mapping, subtle fringe |
| `dense` | ~half-size cells, heavier glyph bias, tighter fringe |
| `inverse` | luminance mapping flipped — heavy ink lives in the shadows |
| `chaos` | scrambled glyph identity (re-rolled ~8×/s), sample jitter, wide fringe |

**Weather** (gated by monsoon-section activation): raining → per-column
falling glyph streaks force bright buckets so characters cascade, the
palette resolves toward a PNW register (evergreen shadow → wet-sky
slate), and a scheduler fires lightning glitches (white flash + cell-row
tearing) every 3–12 s. Dry → a parched state: thinned field, dusty
sun-bleached palette.

### Backdrop (scene)

Per-section splash: accent-tinted fbm aura with a deterministic focal
point per section id and a chroma-boosted core — the painted saturated
zone the dither preserves. Hosts the `iw:splash` expanding-ring flash.

### Constellation (scene)

Per `.section[data-section]`: sparse star nodes (count scales with
`data-symbols`) joined by hairline nearest-neighbor + chord sketch lines,
seeded deterministically from the section id (same sky every visit).
Stars twinkle and drift on per-star phases; the map slides vertically
against scroll (parallax) and crossfades with triangle activation around
its section.

### Smoke / fumigation (scene, additive)

Domain-warped fbm vapor rising from the active section's
`data-smoke-side`; the side value is continuous and lazily damped, so the
plume drags across the floor as sections alternate left/right. Scroll
velocity shears the column (tip lags base). Tinted with the active
accent, chroma-lifted to survive luminance bucketing.

### Morph (scene) — stretch-and-resolve

Driven by `iw:morph {name, progress}`. Mid-path the source silhouette is
smeared along its motion direction (7-tap max-accumulation — the glyph
field visibly stretches like taffy); near progress 1 the smear collapses
and the target silhouette resolves. A morph parked at 1 stays resolved.

**Morph registry** (silhouettes are procedural SDF placeholders, each
marked `TODO(owner art)` in `passes/morphs.ts`):

| name | from → to |
| --- | --- |
| `trismegistus` | caduceus (left) + Was-scepter (right) flanking a centerpoint, converging inward → Thoth-Hermes-Trismegistus figure at center |
| `cross-cube` | unfolded-cube cross folding → black cube (isometric silhouette) |
| `atlas-columbia` | Atlas crouched under the celestial sphere → Columbia / Pallas Athena upright with spear and aegis |

## Symbology guardrails

Classical / alchemical / Greco-Egyptian register only. **No kabbalah, no
new-age, no modern secret-society symbols.** Audit every added glyph,
silhouette, or texture against `src/design/tokens.ts` before merging.
