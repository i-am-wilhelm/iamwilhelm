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

## The museum (public homepage)

The homepage is a walk through a small museum: a foyer, three numbered rooms
(the Treasury, the Gallery, Writings) divided by Greek meander keylines, and a
colophon, with the threshold ("What brought you here?") as a popup over it. Warm ivory walls, charcoal
ink, gilt as the one shared accent, paper grain from an SVG noise tile, and
text that settles into place on scroll (same 7/8 meter as the poem pages).
No WebGL, no dithering, no audio on these pages.

- `src/layouts/Museum.astro`: meta, Open Graph and Twitter cards, JSON-LD
  Person schema, nav, footer. Used by `/`, `/gallery`, `/writings`, `/writings/<slug>`,
  the series indexes, `/method`, `/support`, `/services` (Room IV, the
  commissions page for scrollies), `/scrollbrief` (Room V, the studio page),
  `/what-is-a-scrolly` (Room IV, the glossary), the plain-text twins, and 404.
- The Threshold (`rooms/Threshold.astro`, `#welcome`; `/welcome` redirects
  there, set in `astro.config.mjs`): the doorkeeper and the site's
  wayfinding, shown as a popup (a modal `<dialog>`; a bottom sheet on a
  phone) and kept out of the page's flow. It greets a new arrival by itself
  once per browser session, a moment after the Foyer settles (`GREET_MS` in
  the component; it stays quiet if the visitor arrived at a room's anchor
  or is already down the page), and it opens from every link to `#welcome`:
  the Foyer's "Begin the tour", the footer's "The front door", and an
  arrival at `/#welcome` from any other page. Close, Escape, a click on the
  veil, or a door closes it. Without script it falls back into the page as
  a plain section after the Foyer. It asks "What brought you here?" and
  offers six answers, three on each side of a Janus coin, each a door to
  the room that fits it. The elder's side is the work done for others
  (BackGold, Scrollbrief, Commissions); the youth's side is the work made
  for its own sake (the Gallery, Futurist, Writings), after the couplet at
  its foot (Ovid, Fasti 1.135-136: every door has two fronts, one toward
  the people, one toward the household god). Two more answers sit under
  the coin (only looking; looking for Michael). Pointing at a door wakes
  the face that looks toward it. The last door taken is kept in
  localStorage (`iw:threshold`, this browser only) and offered back in one
  line on the next visit. To add or move a door, edit the arrays at the top
  of the component; a door's `id` is what the page remembers. To stop the
  popup greeting on its own, remove the `GREET_MS` timer at the foot of the
  component's script; the links still open it.
- The coin (`Janus.astro`, geometry in `janus.ts`): a Roman as in hairline
  gilt, Janus on the obverse and a ship's prow on the reverse, with 365
  marks on the rim. It is a button: it turns over, and the reverse's
  caption (capita aut navia, "heads or ships") opens the door to `/earl/`.
  `JanusMark.astro` is the same god at glyph size. The site footer ("The
  front door") and the foot of every scroll page ("Came in by a side
  door?") link back to `/#welcome` under it, since most readers arrive on
  a piece and never see the homepage.
- Room I, the Treasury (`rooms/RoomBackGold.astro`): the one dark room. The
  BackGold tablet stands in a glass vitrine on a plinth and the eight things
  the platform holds sit in gilt niches. The vitrine is decoration; with a
  fine pointer it turns a few degrees toward the cursor.
- Room II on the homepage is the Archive (`Archive.astro`,
  `src/scripts/archive.ts`): every scroll page on view is a box shelved by
  series, and the chosen box opens on the reading table (a bottom sheet on a
  phone) with a reel of stills. A new gallery entry is shelved
  automatically; it needs five stills at `public/reel/<id>/1.jpg` to
  `5.jpg` (800×420 JPEG) and the build fails with the missing path if they
  are not there. The Futurist installments are the Archive's first bay, so
  `rooms/FeatureFuturist.astro` is unmounted (kept, like the rooms below).
- `/scrollbrief` (`src/pages/scrollbrief.astro`, with `Lens.astro` and
  `ScrollbriefMark.astro`): Room V, the page for Scrollbrief, the
  litigation-support studio. It links out to scrollbrief.com, the BackGold
  intake form (`SCROLLBRIEF_INTAKE_URL` in `src/config/site.ts`) and the
  scheduler.
- `src/components/museum/`: Placard, Room, Meander, ZodiacRing, Glyph (SVG
  zodiac paths in `zodiac.ts`), PoemGallery (the wall; `grouped` hangs it by
  series, as `/gallery` does) and PoemCard (one frame), WritingsList,
  Colophon, and the rooms in `rooms/`.
- Unmounted rooms, kept in the repo and referenced from nowhere on the
  public site: `rooms/RoomManifesto.astro` (the libertariantoolsuite
  manifesto exhibit) and `rooms/RoomAlm.astro` (Advancing Liberty Media /
  Websites by Wilhelm) with its case (`src/components/museum/case/`,
  `src/scripts/case/`), its client data (`src/data/portfolio.ts`, mirrors
  ALM `work.ts`), and the screenshots in `public/work/`. Re-import a room in
  `src/pages/index.astro` and restore its `NAV` entry to hang it again.
- `src/content/gallery/`: one markdown file per framed work. Drop a file in
  to hang a new piece on `/gallery` and in Room II; `href` points at its page,
  `series` and `seriesNo` place it in a series, `verb` is the card's verb
  line, `date` orders it in the feeds.
- Series: declared once in `src/config/series.ts` (in-the-original,
  through-the-lens, futurist, mythmaking, seen, poems, readings); every live piece
  names one on its collection entry. `src/lib/pieces.ts` is the one view of
  both collections (scroll pages and readings) that the cards, rows, series
  indexes (`/writings/<series>/`), the scroll-page foot and the feeds read.
  Feeds: `/rss.xml`, `/atom.xml`, and `/writings/<series>/rss.xml`; readings
  carry their full text, scroll pages a summary and link.
- Every scroll page lives under `/gallery/` (one route): the pieces that
  first shipped under `/writings/` redirect from `public/_redirects`. The
  reading room (`/writings/`) is the readings shelf.
- `src/components/scroll/`: the pieces every scroll page mounts. `ScrollFoot`
  (share: copy link, X, Facebook, Bluesky and the device's share sheet;
  next in the series; the newsletter field; the patronage door to
  `/support`; the "Plain text" link to the twin), `SeriesMark` (the series
  label in the header), `Byline` (the author's name linking to `/`, in
  every title block and signature), `MethodLink` (the line every source
  ledger ends on, "How this was made", to `/method`), `SplitText`
  (text shown twice for effect with one readable copy in the DOM; the
  copies paint from `data-text`), and `BureauStamp` (below).
- The Bureau of Coincidence: a poem whose gallery entry carries
  `subject: feminine` and a `case` gets the Bureau's stamp at its foot,
  above its colophon ("Certified coincidental · Case No. …", linking to the
  hearing, `/gallery/ladies-ladies/`). The case number is the ecliptic
  longitude of the natal placement that governs the poem, degrees.minutes
  from 0° Aries, read from `src/scripts/natal/chart.michael.ts`: The Keeper
  and the Flame is Venus, 9°01' Aries, `009.01`; PHARMAKON is Neptune,
  16°08' Capricorn, `286.08`; The Unseen One is Black Moon Lilith, 23°52'
  Sagittarius, `263.52`; the hearing itself is Saturn on the MC, 2°30'
  Aquarius, `302.30`. The schema (`src/content.config.ts`) refuses one
  field without the other. A Poem.astro page mounts
  `<BureauStamp id="…" />` above its `poem-foot`; the descent layout
  mounts it after the text. It renders nothing for an entry without the
  fields, so the mount is safe anywhere.
- The plain-text twin: every scroll page has one at `/gallery/<slug>/twin/`,
  the whole piece as semantic HTML in reading order with each exhibit
  described in a sentence (`src/pages/gallery/[slug]/twin.astro` renders
  the page with Astro's Container API; `src/lib/twin.ts` reduces it). An
  exhibit's sentence is the `data-twin` attribute on its container (or its
  aria-label, for a `role="img"` figure); `data-twin-skip` marks chrome
  the twin never reads. The twin's canonical is the scroll page, it stays
  out of the sitemap, and the page links it in the foot and in
  `<link rel="alternate" type="text/html">`. `/llms.txt` lists the twins.
- Schema: every page carries the one Person node (`Museum.astro`,
  `@id #person`); every piece and reading an Article with author,
  datePublished, dateModified (`updated` in frontmatter, else the date) and
  its share image; `/services` a Service, Offer and FAQPage; the glossary at
  `/what-is-a-scrolly` a DefinedTerm, Article and FAQPage. The FAQ schemas
  are built from the same arrays as the visible questions.
- `src/pages/gallery/<slug>.astro` + `src/layouts/Poem.astro`: the visualized
  pieces themselves (The Keeper and the Flame, PHARMAKON, The Only Sighted
  One), ported from the owner's Claude artifacts. Each is a night scene of its
  own: a fixed canvas behind lines that brighten as they arrive. The canvas
  paints once at load and animates from the reader's first scroll or touch.
- Tags (`src/config/tags.ts`): every piece carries a handful, from one
  registry of about ninety, grouped (Gods & myths, Words & old sources, Art &
  seeing, People, Money, Running threads, Forms and the rest). A piece names
  them in `tags` on the entry that numbers it: the `gallery` entry for a
  scroll page, the `writings` entry for a reading (the build refuses tags
  on a `scrolly` or `descent` writings entry, and any id not in the
  registry). From that one field follow the tag's page at `/tags/<id>/`
  (every piece under it, newest first, and the tags filed most often
  beside it), the subject index at `/tags/` (`TagIndex.astro`), the
  "Filed under" and "Filed near" lines at the foot of every piece
  (`ScrollFoot`, and the foot `src/lib/seen.ts` adds to the Seen pages),
  and the tag filter in search. To add a tag, add one entry and name it on
  the pieces; to rename one, change its `label` and keep its id.
- Breadcrumbs (`src/lib/crumbs.ts`): one trail per page, from the foyer
  down: Foyer / Gallery / Seen / Fall Line; Foyer / Writings / Readings /
  Underworld; Foyer / Tags / Gold. A series hangs in the room named by its
  `room` in `src/config/series.ts`, which also lights its nav item. Museum
  pages pass `crumbs` to `Museum.astro`, which draws the line under the nav
  (`Breadcrumbs.astro`) and adds a BreadcrumbList to the JSON-LD. On a
  scroll page the corner exit that read "The Gallery" is now the trail
  (`CrumbExit.astro`): the whole trail while the page opens, then "← Seen"
  once the reader is under way. The Seen pages mounted by `src/lib/seen.ts`
  get a small chip that shows only near the top (their own control bars
  use the top of the screen as they scroll); `SEEN_CRUMB_EXIT` in
  `src/config/seen.ts` moves it to the right, dresses it light, or leaves
  it off for a page with its own masthead. Every piece also ends on the
  trail. The first crumb's name is `CRUMB_HOME` ("Foyer").
- Search (`/search/`): Pagefind, built after the build. `src/pages/search/records.json.ts`
  lists what to index (every piece, every series, and the rooms in
  `src/config/search.ts`); `src/integrations/search.ts` reads each one's
  words from its built page (a scroll page from its plain-text twin), writes
  the index to `dist/pagefind/` and deletes the list. The page
  (`src/scripts/search.ts`) searches by word, filters by tag and series,
  offers matching tags, lists a named tag's or series' pieces first, and
  keeps the query in the address (`?q=`, `?tag=`, `?series=`). Before a
  search, and with scripts off, it shows the subject index. The nav's glass
  goes there, and so do "/" and Ctrl/⌘ K from any museum page. The index
  only exists in a build: in `astro dev` the page says to run `npm run
  build` then `npm run preview`. The 404 page offers the field, filled from
  the address that missed.
- Previews (`npm run reel`, `scripts/reel-scrollies.mjs`): every scroll
  page's previews are shot from the page itself and lead with what it
  animates. The copy stays where the page puts it, but it is never what a
  preview is framed on. The script walks the built page half a screen at a
  time, hides the chrome, and reads each frame three times (once, half a
  second later, and a fifth of a screen further down) to find what moves on
  its own or under the scroll, leaving copy out of the count. Frames are
  scored first for how much moves and how near the middle, then for what
  they draw; only places that move are used, each cropped in (up to 1.33×,
  never enlarged) so the moving part fills more of it. A piece with fewer than five
  moving places gets more moments of the ones it has rather than a still of
  copy. Out come five stills (`public/reel/<id>/1.jpg`…`5.jpg`, 800×420, in
  page order: the Archive's reading table), the strongest as `poster.jpg`,
  and a five-second muted loop of up to three moving places (`loop.mp4`,
  640×336). A piece that never moves falls back to the frames that draw
  most, skipping pages of copy and empty ground. Run
  `npm run reel -- <slug>` when a piece is hung, after `og:scrollies`. Needs
  Playwright's Chromium (or `CHROMIUM_PATH`) and ffmpeg (or `FFMPEG_PATH`);
  without ffmpeg it writes the stills and poster and skips the loop. A page
  that waits for a hand gets one in `ACTS` (The Snowflake Machine is drawn
  on before each shot).
- The Gallery page (`/gallery/`, `GalleryGrid.astro`): small tiles, four or
  five across (two on a phone), hung by series with a row of links to each
  wall. A tile shows the piece's poster and plays its loop while the pointer
  rests on it or it has focus; on a touch screen, while it is the tile most
  in view (`src/scripts/gallery-grid.ts`). Loops load only when asked and
  never under reduced motion or Save-Data. Room II's Archive and
  `/services` keep their own walls.
- `src/config/site.ts`: URLs, nav, and the owner placeholders (booking
  scheduler link, BackGold newsletter embed).
- `npm run og` re-renders `public/og.png` and the PNG icons;
  `npm run og:scrollies` renders each scroll page's own opening frame
  into `public/og/<slug>.jpg` (every page under `/gallery/`), which those
  routes use as their share image, versioned with a
  content-hash `?v=` so platforms refetch a changed card. Run it whenever a
  new scrolly is hung or restyled and commit the JPEGs;
  `npm run links` checks every outbound link in the build.

Google Search Console verification: `/google8b497834161e9abd.html` is
served by the Worker (`worker/index.ts`, plus its entry in
`run_worker_first` in both wrangler configs), not from `public/`. Keep it
permanently: Google re-checks the file and verification lapses if it goes.

Branch previews: pushes to `museum-homepage`, `scrolly/**`, `facelift/**`, `services/**`, `geo/**` and `feat/**` deploy to the
`iamwilhelm-preview` worker on workers.dev (`.github/workflows/preview.yml`,
`wrangler.preview.jsonc`). Production deploys only from `main`.

### The archived homepage

The original esoteric homepage is tagged `archive/esoteric-v1` and still
builds at `/atelier` (noindex, out of the sitemap, linked from nowhere). Its
components, the natal engine, the dither pipeline, the easter-egg hunt, and
the music layer all remain in the codebase; everything below describes them.
`/writings/<slug>` now renders in the museum layout; the old post
components (`src/components/writings/`) stay for reference.

## Architecture

- `src/design/tokens.ts`: the shared contract: section registry, accent
  colors, symbol assignments, meter constants, glyph ramp. Every subsystem
  reads from here; symbology guardrails are documented at the top of the file.
- `src/scripts/events.ts`: the event bus. Subsystems communicate only
  through these window CustomEvents; no cross-subsystem imports.
- `src/scripts/boot.ts`: per-page bootstrap; each subsystem initializes
  independently and tolerates the others being absent.
- Content is local markdown collections (`src/content/`); a Ghost backend can
  be wired in later by swapping the loader in `src/content.config.ts`, the
  schema is the stable interface.

## Shader pipeline

One OGL renderer, two stages: four scene passes composite into a render
target: **backdrop** (per-section accent aura, hosts splashes),
**constellation** (star maps seeded per section id, hairline geometry),
**morph** (stretch-and-resolve: the glyph field smears along the motion path,
then collapses into the resolved silhouette: `trismegistus`, `cross-cube`,
`atlas-columbia`), **smoke** (domain-warped fbm fumigation, side from
`data-smoke-side`, sheared by scroll velocity), and the **glyph dither post
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
birthday-coded egg, Pleiades nodes clicked in a date-derived order),
`maat-feather`, `orphic-lyre`, `monsoon-rainmaker`, `pharmakon-sigil`,
`phosphoros-dawn` (dawn-gated grace note), and `psychopomp-door` (ships
disabled; separate-domain discipline, the destination appears nowhere on
this site). Effects replay on every interaction, flash-site style; discovery
fires `iw:egg-found` once.

The cross-page hunt (`hunt.ts`) runs `unbegun → in-progress → awaiting-seal
→ sealed` with five ordered initiation steps persisted under one versioned
localStorage key. The final mail-in step (password in an email subject line,
PO box) is wired later by supplying the `finalStep` object in
`hunt.config.ts`, a config addition, not a refactor. Natal-chart hooks
(`natal.config.ts`) expose placement-derived CSS variables, derived from the
real chart in `src/scripts/natal/chart.michael.ts`. Full documentation:
`src/scripts/eggs/README.md`.

## The natal hero

The homepage hero is a Canvas 2D natal chart (`src/scripts/natal/`): a
chart-agnostic engine (`engine.ts`, `aspects.ts`, `types.ts`), Michael's
chart as its first data file (`chart.michael.ts`), the two-layer Dioscuri
portrait (`dioscuri.ts`, the photo plus a glyph-dither twin drawn from the
site's Greek atlas), and the mount (`mount.ts`) that owns the single rAF,
the scroll choreography (face → ascent → dissolve, emitting
`iw:natal-phase`) and the `?tinker=1` overlay. The site-wide 7/8 clock it
breathes to is `src/scripts/clock.ts` ("the knock", `iw:knock`): one eighth
at the site's 84 bpm (`meter.eighthMs`), phase-locked to the Tone transport
whenever the orchestra pit is playing (`iw:transport-eighth`), so the
visual knock and the audible knock are one knock. Workbench route: `/lab/hero`
(`?chart=test` renders a throwaway chart; `?tinker=1` opens the dials).

## Orchestra pit

See `src/scripts/audio/README.md` for the 7/8 tap pattern, score structure
(the knock), circle-of-fifths section drones, and adding owner tracks.

## Owner-supplied inputs (pending)

Search the codebase for `TODO(owner)`: every pending copy block, config
value, and art swap is marked. Shipped: hero portrait
(`/assets/portrait.webp`), swan facecard (`/assets/facecard.webp`), generated
Medea facecard (`/assets/medea.webp`), and the full Pharmakon poem. Still open:

- Copy: Philosophy statement; Underworld essays (Orpheus, the Guide, the
  Kindly Ones, the Feather close); Monsoon memoir.
- Config: hunt
  final-step seal (`src/scripts/eggs/hunt.config.ts`), psychopomp-door
  payload (`src/scripts/eggs/eggs.config.ts`), owner tracks
  (`src/scripts/audio/tracks.config.ts`).
- Art: the seven procedural silhouettes in `src/webgl/passes/morphs.ts`;
  commissioned Medea card at the same path when ready.
