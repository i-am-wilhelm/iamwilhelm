# Easter-Egg & Hunt Engine (spec §5)

Flash-site-spirited secrets (homestarrunner.com lineage): clicking hidden
anchors swaps the dither style, shifts the pose of the visual layer, or fires
a color splash — all by emitting events on the shared bus
(`src/scripts/events.ts`). A cross-page scavenger hunt ("little initiations")
advances as eggs are found.

Entry point: `initEggs()` from `registry.ts`, called by `src/scripts/boot.ts`
on every page. Idempotent; safe on pages with zero anchors.

## Files

| File | Role |
| --- | --- |
| `registry.ts` | Engine: lazy anchor binding, trigger wiring, effect dispatch, hunt advancement, natal CSS hooks. Exports `initEggs()`. |
| `types.ts` | `EggDef`, `Trigger`, `EffectAction`, `PageScope`, `DitherStyle`. |
| `eggs.config.ts` | The declarative egg registry (list of `EggDef`). |
| `natal.config.ts` | Natal placement hooks + birthday-derived sequence. All values are `TODO(owner)` placeholders. |
| `hunt.config.ts` | Initiation steps, completion sigil, and the `finalStep` config slot. |
| `hunt.ts` | State machine + localStorage persistence. |
| `ui.ts` | Injected-style DOM UI: toasts, sigil-mark rail, completion sigil. |

## Registry format

Each egg in `eggs.config.ts`:

```ts
{
  id: 'swan-preen',                          // stable; persisted + emitted
  scope: 'home' | 'writings' | 'any',        // page gate
  binding: '[data-egg-anchor="hero-swan"]',  // CSS selector for anchors
  trigger: { kind: 'click' }
         | { kind: 'n-clicks', count, withinMs }
         | { kind: 'hover-hold', holdMs }
         | { kind: 'sequence', order: string[] },
  effects: [                                  // event script, optional `at` delay
    { kind: 'dither', style: 'inverse', revertMs: 5600 },
    { kind: 'splash', id: 'hero', color: '#0d0d10', at: 120 },
  ],
  toast: '…',            // affirmative one-liner on first discovery
  enabled?: boolean,     // default true
  lateHunt?: boolean,    // binds only at phase 'awaiting-seal'
  condition?: () => boolean,  // fire-time gate (e.g. dawn window)
  payload?: string | null,    // opaque, owner-configured
}
```

Binding is **lazy and tolerant**: an initial scan plus a `MutationObserver`
wire anchors whenever they appear; a selector matching nothing is fine.
Section agents only need to place `data-egg-anchor="…"` attributes.
Sequence anchors should also carry `data-egg-step="0"`…`"6"` (fallback:
bind-order index). Effects replay on every successful interaction;
`iw:egg-found {eggId}` and hunt bookkeeping happen exactly once per egg.

## Registered eggs

| Egg id | Scope | Anchor selector | Trigger | Effect |
| --- | --- | --- | --- | --- |
| `swan-preen` | home | `[data-egg-anchor="hero-swan"]` | 3 clicks within 1.6s | dither `inverse` (revert 5.6s) + hero splash |
| `natal-ascent` | home | `[data-egg-anchor="cluster-node"]` | sequence — click nodes in the order derived from `natal.config.ts` `keyDate` | dither `chaos` (revert 7s) + cluster splash |
| `maat-feather` | home | `[data-egg-anchor="underworld-feather"]` | hover-hold 2500ms (one 7/8 bar at 84bpm) | dither `dense` (revert 5s) + underworld splash |
| `orphic-lyre` | home | `[data-egg-anchor="underworld-lyre"]` | 7 clicks within 4s | underworld splash + dither `inverse` (revert 3.5s) |
| `monsoon-rainmaker` | home | `[data-egg-anchor="monsoon-cloud"]` | 3 clicks within 1.2s | dither `dense` (revert 6s) + monsoon splash |
| `pharmakon-sigil` | writings | `[data-egg-anchor="writings-pharmakon"]` | click | writings splash + dither `inverse` (revert 4s) |
| `phosphoros-dawn` | any | `[data-egg-anchor="phosphoros-star"]` | click, gated to the local dawn band (`natal.config.ts` `dawnWindow`) | dawn-gold splash. Grace note — outside the hunt path |
| `psychopomp-door` | any | `[data-egg-anchor="psychopomp-door"]` | click | none yet — ships `enabled: false`, `payload: null`, `lateHunt: true`. TODO(owner): destination revealed via egg only |

## Natal placement hooks

`natal.config.ts` holds placeholder placements (every number marked
`TODO(owner)`); swapping in the real birth data is a config edit only.
Nothing in the UI explains any of this — it reads as arbitrary rotation and
drift to anyone without the chart.

- **Uranus–Neptune, 9th house**: `natalCssHooks()` derives the pair's
  midpoint longitude and orb; `initEggs()` writes them to the root as
  `--iw-natal-un-rot` (constellation rotation), `--iw-natal-un-orb` (drift
  amplitude), and `--iw-natal-house-phase` (9th house / 12 → animation phase
  offset). Visual/section agents may consume these anywhere; elements
  carrying deconstruction-themed content can be tagged
  `data-natal-aspect="uranus-neptune"` and styled with those variables.
- **Venus at dawn / 12th house**: `--iw-natal-venus-phase` (degree-in-sign
  normalized 0–1) plus the `dawnWindow` local-hour band that gates the
  `phosphoros-dawn` egg.
- **Birthday as coded egg**: `birthdaySequence()` folds `keyDate`
  (month, day, year-mod-100, then successive sums) modulo the node count into
  four distinct node indices — the click order for `natal-ascent`. Original
  mechanism for this site; the date itself is rendered nowhere.

## Hunt state machine (`hunt.ts`)

One namespaced, versioned localStorage key: **`iw:hunt`**, storing
`{ version: 1, found: string[], completedSteps: string[], phase, sealed }`.
A version mismatch migrates by carrying `found` forward and recomputing.

Phases:

```
unbegun → in-progress → awaiting-seal → sealed
```

- **unbegun**: nothing found.
- **in-progress**: eggs accumulating. Steps complete strictly in
  `hunt.config.ts` order; a step completes only when every prior step is
  complete and all its `requires` eggs are found (eggs found early are held
  until their step's turn). Completed steps render small classical glyph
  marks on their `markPages` — homepage discoveries surface marks on
  `/writings/` and vice versa.
- **awaiting-seal**: every configured step complete. Terminal until the
  mail-in step is wired. The completion sigil (⊙ + affirmative copy) appears.
- **sealed**: reachable only after `finalStep` is configured and the future
  mail-in wiring calls `recordSeal()`.

Steps (all marks appear on `/` and `/writings`):

| # | Step id | Requires | Glyph |
| --- | --- | --- | --- |
| 1 | `first-light` | swan-preen | ☉ |
| 2 | `katabasis` | maat-feather, orphic-lyre | ♄ |
| 3 | `storm-blessing` | monsoon-rainmaker | 🜄 |
| 4 | `pharmakon` | pharmakon-sigil | ☿ |
| 5 | `heliacal-rising` | natal-ascent | ⚹ |

Glyph register is classical astronomy/alchemy only (Sol, Saturn, alchemical
water, Mercury, sextile, circled Sol) per the tokens.ts guardrails.

## Wiring the final mail-in step

The hunt wraps immediately before the mail-in step (password in an email
subject line + PO box). It is modeled as a config slot in `hunt.config.ts`:

```ts
export interface FinalStepConfig {
  passwordHint: string;
  mailtoSubject: string;
  poBox: string;
}
export const finalStep: FinalStepConfig | null = null; // TODO(owner)
```

Supplying that object is the **only change needed** — the state machine
already treats `finalStep !== null` as the gate, and `recordSeal()` in
`hunt.ts` is the hook the mail-in wiring calls once the seal is verified,
moving the phase from `awaiting-seal` to `sealed`. Until then finishers see
the completion sigil with copy that affirms more will be revealed and gives
no detail of the unbuilt step.

## Separate-domain discipline

The controversial series lives on another domain. This engine ships **no**
link, CTA, or mention of it anywhere. The single sanctioned pathway is the
`psychopomp-door` egg: disabled, empty payload, late-hunt-only binding.
TODO(owner): set its `payload` (and `enabled: true`) when the destination
should become discoverable — via the egg only.

## Events emitted

- `iw:egg-found { eggId }` — once per discovery.
- `iw:dither-style { style }` — effect scripts (plus their timed reverts).
- `iw:splash { id, color }` — effect scripts; `id` is the section id by
  convention.

## Copy rules

Affirmative statements only, everywhere (toasts, step copy, sigil) — each
line states what is, with no negative parallelism.
