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
| Slug / route | `everyone-searchable` → `/gallery/everyone-searchable/` (moved from `/writings/everyone-searchable/`, which redirects) |
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
| Medium | Visualized essay; interactive page (as The Dual Thing and The Pretty Toy) |
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

## Adding the next futurist essay

The series plumbing is one entry: a `writings` entry that names the series.
The essay's own page is still its own file, as every scrolly is, and hanging
it on the Gallery wall is a separate, optional choice.

1. **The page.** Build it at `src/pages/writings/<slug>.astro` on
   `Poem.astro`, starting from `src/pages/writings/everyone-searchable.astro`:
   keep its frontmatter (it reads title, description, date and series from
   the entry with `getEntry('writings', '<slug>')`, and passes `scheme`,
   `exit={false}`, `partOf` and `preload` to the layout). Port the prototype
   the same way: markup and script verbatim (the script `is:inline` at the end
   of the slot), the CSS scoped under a body class of its own, and the three
   resets for `Poem.astro`'s `main`, `section` and `.stage` rules if the
   prototype uses those names. Self-host its fonts in `public/fonts` under the
   names it loads them by, and note them in `public/fonts/README.md`. Mark any
   site chrome you add (a way back) with `data-og-hide`.
2. **The one entry.** Add `src/content/writings/<slug>.md`:

   ```yaml
   ---
   title: "…"
   date: 2026-12-01
   accent: futurist
   draft: false
   description: "…"          # the page's meta description
   treatment: scrolly
   series: futurist
   seriesNo: 2
   ---
   ```

   That entry alone:
   - lists it in the reading room (`/writings/` and the homepage's Room III),
     newest first, under the label "Futurist · No. 2" in the futurist accent,
     linking to the series;
   - lists it at `/writings/futurist/` as No. 2;
   - gives the page its title, description, date and series in the meta and
     schema;
   - keeps `/writings/[slug]` off the route (`treatment: scrolly`): no glyph
     dither, no backdrop fade, no smoke, the audio layer dormant;
   - puts it on `npm run og:scrollies`' list.

   The schema refuses `series` without `seriesNo`, and the reverse.
3. **The share image.** `npm run og:scrollies -- <slug>` renders only that
   card (`public/og/<slug>.jpg`, its opening frame at 1200×630) and leaves the
   other cards' bytes and cache-busting hashes alone. Commit the JPEG.
4. **Optional: hang it in the Gallery.** Add `src/content/gallery/<slug>.md`
   (title, plateTitle, year, epigraph, href `/writings/<slug>/`, medium,
   order, sign, plate). The card picks up "Futurist · No. 2" from the writings
   entry by id, so the label is not repeated here. The lowest `order` takes the
   homepage hero frame: give the new piece an order below the current hero's
   (`order` takes negatives, so `-1` works) or renumber the wall.

### A new series

Add a key to `series` in `src/config/series.ts` (name, title, href, accent,
statement), an accent token in `src/design/tokens.ts` (and its mirror in
`src/styles/global.css`), and its index page,
`src/pages/writings/<id>/index.astro`, which is two lines:
`import SeriesIndex …` and `<SeriesIndex id="<id>" />`. A series id must not
be a writing's slug, since both live under `/writings/`.

### What to fill in

- The series statement in `src/config/series.ts` is a `PLACEHOLDER(owner)`
  line ("Essays on what comes next, each staged as its own scrolling page.").
- The date on `src/content/writings/everyone-searchable.md` is the day the
  page was built; set the publication day when it ships.
