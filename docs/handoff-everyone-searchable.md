# Handoff: Everyone, Searchable

> **Provenance.** The original handoff doc for this piece did not reach the
> session that built it; only the prototype did. This doc was rebuilt from
> `docs/prototypes/everyone-searchable-prototype.html`. Every value below is
> taken from the prototype or follows an existing convention in the repo, and
> the ones that are a choice rather than a quote are marked *(chosen)*. If the
> original doc differs, the original wins: change the entry files listed
> under "Where it lives" and rebuild.

The first essay in the **Futurist** series. A scrolly in nine chapters, set as
a dossier that opens as you scroll: step text on the left and the exhibit
pinned on the right; on phones the exhibit pins full-screen and the steps
slide over it. One visual world: archive paper, redaction black, stamp red,
and the water that floods the page at the end.

The prototype is the spec. Its copy, chapter order, pacing and look ship
as-is.

## Entry data

| Field | Value |
| --- | --- |
| Title | Everyone, Searchable |
| Slug / route | `everyone-searchable` → `/writings/everyone-searchable/` |
| Series | Futurist · No. 1 |
| Byline | By Michael Wilhelm |
| Date | 2026-11-06 *(chosen: the prototype says "November 2026"; set the real day when it ships)* |
| Meta description | Every human life is about to become searchable through a god-level AI. What it does to the searcher, the searched, and the one move that holds. |
| Dek | Every human life is about to become searchable through a god-level AI. It will break the searcher before it breaks the searched, and the one move that holds is to get known before you get searched. |
| Epigraph | "That which ye have spoken in the ear in closets shall be proclaimed upon the housetops." Luke 12:3 |
| Accent | `futurist`, `#c0281c` (the prototype's stamp red) |
| Share image | `/og/everyone-searchable.jpg`, the opening frame, rendered by `npm run og:scrollies` |

### Gallery frame

| Field | Value |
| --- | --- |
| Position | Hero frame of the homepage wall; first card on `/gallery/` (`order: 0`) |
| Label | Futurist · No. 1 |
| Medium | Visualized essay in nine chapters; interactive page *(chosen)* |
| Epigraph on the frame | The meta description |
| Sign | Aquarius *(chosen: the essay ends on the age of Aquarius, the water-bearer's vessel tipping)* |
| Plate | `#0b2730`, the coda's water taken down to a dark plate *(chosen)* |

### Chapters

| | Chapter | Exhibit |
| --- | --- | --- |
| I | The Index | a search for your name, then the assistant's answer |
| II | The Polyneural | the relationship map, one tie cut, a three-hop path to a scandal |
| III | Already Here | the timeline under the sheer curtain, 2015 to next |
| IV | The Searcher | the staircase down to the mire; your searches on file |
| V | The Genie | 100 dots, 19 in 2017 and 28 in 2023 (PIAAC) |
| VI | Reveal Day | the Wollenberger file, then the wall of files stamped Public |
| VII | Who Comes Through | the self-acceptance by accountability quadrants, and the Hunted |
| VIII | The Come-to-Jesus Move | the accuser, the stones dropped eldest first, then Seven moves |
| IX | Fear Not | the Aquarius vessel tips and the page floods |

Then the coda ("Get known before you get searched.") and the sources.

## Page notes

- **Page system.** Same as The Dual Thing: `src/layouts/Poem.astro`, the
  page's CSS scoped under its body class (`.es`), its script inline at the end
  of the body exactly as in the prototype.
- **No site effects.** The route carries none of the glyph dither, backdrop
  fade or smoke, and the audio layer stays dormant (see the `scrolly`
  treatment below).
- **Top bar.** The prototype's bar, plus one discreet link back to the
  Gallery at its right end.
- **Fonts.** Self-hosted from `public/fonts` under the same family names the
  prototype loads from Google Fonts: Big Shoulders Stencil Display (display),
  Newsreader (text, with optical sizes), Courier Prime (typed labels).
