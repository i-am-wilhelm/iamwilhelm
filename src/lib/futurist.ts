/**
 * Mounts a Futurist page from its approved source file, the way
 * src/lib/seen.ts mounts the Seen batch. The source
 * (_incoming/futurist-essays/<slug>.html) is a whole document: its own
 * palette, markup, stylesheet and one script. It ships as it is, checked
 * against its approved hash (src/config/futurist.ts); this function makes
 * only the changes a page needs to live on the site:
 *
 *   - the Google Fonts links become the site's self-hosted files, the same
 *     files Google serves, declared under the same family names, weights
 *     and unicode-range;
 *   - the head gains what Poem.astro gives Everyone, Searchable: the full
 *     title, the description, the canonical URL, theme colour, icons, feeds,
 *     the link to the plain-text twin, the share card (the page's own
 *     render, public/og/<slug>.jpg) and the Article schema;
 *   - LINKS holds the two cross-links between Face Forward and The
 *     Receipts, each one a named, exact replacement (Depth Chart and
 *     Quantum Banking have none);
 *   - FIXES holds the repairs made since the files were approved, each one
 *     a named, exact replacement (the source files stay as approved), and
 *     for Quantum Banking the sentences its plain-text twin reads for the
 *     two rigs and the mark that leaves its counter out of the share card;
 *   - the links back, as Everyone, Searchable carries them: the series label
 *     (to the series index), the byline (to the foyer) and the way back to
 *     the Gallery, set in a line of the page's own masthead (`back`);
 *   - the shared foot (ScrollFoot). The document comes back in two halves,
 *     split where the foot goes, and the page file renders the component
 *     between them; FOOT_CSS dresses it for each page.
 *
 * No wrapper element is added around the page.
 * Anything the function expects and does not find stops the build, so a
 * changed source file cannot ship half-mounted.
 *
 * The So-Called Count (Mythmaking No. 3) arrived the same way, as one whole
 * document, so it is mounted here too. Its source is filed with its series
 * (_incoming/mythmaking/, the `dir` on its entry in src/config/futurist.ts);
 * the series label, the feed and the foot follow its gallery entry, as
 * they do for every page. Cannot Be Uninstalled (Mythmaking No. 4) is
 * filed and mounted the same way.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FUTURIST_SOURCES, type FuturistSlug } from '../config/futurist';
import { ogImage } from '../config/og';
import { series as registry } from '../config/series';
import { FEEDS, SITE_NAME, SITE_URL } from '../config/site';
import { getPiece } from './pieces';

const LATIN =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const face = (family: string, weight: number, file: string) =>
  `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url('/fonts/${file}.woff2') format('woff2');unicode-range:${LATIN}}`;
/* Free Won't: variable files (a weight range), an italic, and the greek and
   greek-ext subsets its Greek words are set in, each under the
   unicode-range Google declares for that subset. */
const GREEK = 'U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF';
const GREEK_EXT = 'U+1F00-1FFF';
/* The So-Called Count: the latin-ext and math subsets, under the ranges Google declares for them. */
const LATIN_EXT =
  'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';
const MATH =
  'U+0302-0303, U+0305, U+0307-0308, U+0310, U+0312, U+0315, U+031A, U+0326-0327, U+032C, U+032F-0330, U+0332-0333, U+0338, U+033A, U+0346, U+034D, U+0391-03A1, U+03A3-03A9, U+03B1-03C9, U+03D1, U+03D5-03D6, U+03F0-03F1, U+03F4-03F5, U+2016-2017, U+2034-2038, U+203C, U+2040, U+2043, U+2047, U+2050, U+2057, U+205F, U+2070-2071, U+2074-208E, U+2090-209C, U+20D0-20DC, U+20E1, U+20E5-20EF, U+2100-2112, U+2114-2115, U+2117-2121, U+2123-214F, U+2190, U+2192, U+2194-21AE, U+21B0-21E5, U+21F1-21F2, U+21F4-2211, U+2213-2214, U+2216-22FF, U+2308-230B, U+2310, U+2319, U+231C-2321, U+2336-237A, U+237C, U+2395, U+239B-23B7, U+23D0, U+23DC-23E1, U+2474-2475, U+25AF, U+25B3, U+25B7, U+25BD, U+25C1, U+25CA, U+25CC, U+25FB, U+266D-266F, U+27C0-27FF, U+2900-2AFF, U+2B0E-2B11, U+2B30-2B4C, U+2BFE, U+3030, U+FF5B, U+FF5D, U+1D400-1D7FF, U+1EE00-1EEFF';
const faceOf = (family: string, style: 'normal' | 'italic', weight: string, file: string, range = LATIN) =>
  `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};font-display:swap;src:url('/fonts/${file}.woff2') format('woff2');unicode-range:${range}}`;
/* Each family a Google Fonts link in the source files asks for, and the
   faces it stood for: one per weight asked for, as Google declares them (a
   variable file is named once per weight). Depth Chart asks for its three
   families in one link; Quantum Banking asks for the same three, the same
   way. */
const FACES: Record<string, string[]> = {
  'Big+Shoulders+Display:wght@600;700;800;900': [600, 700, 800, 900].map((w) =>
    face('Big Shoulders Display', w, 'big-shoulders-display-latin-wght-normal'),
  ),
  'Public+Sans:wght@400;500;600;700': [400, 500, 600, 700].map((w) => face('Public Sans', w, 'public-sans-latin-wght-normal')),
  'Black+Ops+One': [face('Black Ops One', 400, 'black-ops-one-latin-400-normal')],
  'IBM+Plex+Mono:wght@400;500;600': [400, 500, 600].map((w) => face('IBM Plex Mono', w, `ibm-plex-mono-latin-${w}-normal`)),
  'Doto:wght@700;900': [700, 900].map((w) => face('Doto', w, 'doto-latin-wght-normal')),
  'Barlow+Condensed:wght@600;800': [600, 800].map((w) => face('Barlow Condensed', w, `barlow-condensed-latin-${w}-normal`)),
  'DM+Mono:wght@400;500': [400, 500].map((w) => face('DM Mono', w, `dm-mono-latin-${w}-normal`)),
  'Public+Sans:wght@400;600;700': [400, 600, 700].map((w) => face('Public Sans', w, 'public-sans-latin-wght-normal')),
  /* Free Won't asks for its three families in one link. */
  'Alegreya:ital,wght@0,400..900;1,400..900': [
    faceOf('Alegreya', 'normal', '400 900', 'alegreya-latin-wght-normal'),
    faceOf('Alegreya', 'italic', '400 900', 'alegreya-latin-wght-italic'),
    faceOf('Alegreya', 'normal', '400 900', 'alegreya-greek-wght-normal', GREEK),
    faceOf('Alegreya', 'normal', '400 900', 'alegreya-greek-ext-wght-normal', GREEK_EXT),
  ],
  'Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400..600': [
    faceOf('Newsreader', 'normal', '400 600', 'newsreader-latin-opsz-normal'),
    faceOf('Newsreader', 'italic', '400 600', 'newsreader-latin-opsz-italic'),
  ],
  'Courier+Prime:wght@400;700': [400, 700].map((w) => face('Courier Prime', w, `courier-prime-latin-${w}-normal`)),
  /* The So-Called Count asks for its five families in one link: the
     Mythmaking faces Questions Wearing Teeth declares (Bodoni Moda, Literata,
     Martian Mono, GFS Didot; the same files, subsets and ranges), and Pinyon
     Script for the clerk's hand, new here. Its canvas sets ctx.font by these
     family names. The transliterations (xērion, phēmē, sēma) need the
     latin-ext subsets, the Greek headwords GFS Didot's greek files. */
  'Bodoni+Moda:ital,opsz,wght@0,6..96,400..700;1,6..96,400..700': (['normal', 'italic'] as const).flatMap((st) => [
    faceOf('Bodoni Moda', st, '400 900', `bodoni-moda-math-opsz-${st}`, MATH),
    faceOf('Bodoni Moda', st, '400 900', `bodoni-moda-latin-ext-opsz-${st}`, LATIN_EXT),
    faceOf('Bodoni Moda', st, '400 900', `bodoni-moda-latin-opsz-${st}`),
  ]),
  'Literata:ital,opsz,wght@0,7..72,400;0,7..72,500;1,7..72,400': (['normal', 'italic'] as const).flatMap((st) => [
    faceOf('Literata', st, '200 900', `literata-greek-ext-opsz-${st}`, GREEK_EXT),
    faceOf('Literata', st, '200 900', `literata-greek-opsz-${st}`, GREEK),
    faceOf('Literata', st, '200 900', `literata-latin-ext-opsz-${st}`, LATIN_EXT),
    faceOf('Literata', st, '200 900', `literata-latin-opsz-${st}`),
  ]),
  'Martian+Mono:wght@400;500': [
    faceOf('Martian Mono', 'normal', '100 800', 'martian-mono-latin-ext-wght-normal', LATIN_EXT),
    faceOf('Martian Mono', 'normal', '100 800', 'martian-mono-latin-wght-normal'),
  ],
  'GFS+Didot': [
    faceOf('GFS Didot', 'normal', '400', 'gfs-didot-greek-ext-400-normal', GREEK_EXT),
    faceOf('GFS Didot', 'normal', '400', 'gfs-didot-greek-400-normal', GREEK),
    faceOf('GFS Didot', 'normal', '400', 'gfs-didot-latin-400-normal'),
  ],
  'Pinyon+Script': [
    faceOf('Pinyon Script', 'normal', '400', 'pinyon-script-latin-ext-400-normal', LATIN_EXT),
    faceOf('Pinyon Script', 'normal', '400', 'pinyon-script-latin-400-normal'),
  ],
  /* Cannot Be Uninstalled asks for four families in one link: IBM Plex Mono
     for the Record (the files Depth Chart's link already declares), IM Fell
     English and its small caps for the Legend, and VT323 for the terminal. */
  'IM+Fell+English:ital@0;1': [
    faceOf('IM Fell English', 'normal', '400', 'im-fell-english-latin-400-normal'),
    faceOf('IM Fell English', 'italic', '400', 'im-fell-english-latin-400-italic'),
  ],
  'IM+Fell+English+SC': [faceOf('IM Fell English SC', 'normal', '400', 'im-fell-english-sc-latin-400-normal')],
  'VT323': [faceOf('VT323', 'normal', '400', 'vt323-latin-400-normal')],
};

/**
 * The only copy edits: [what, the exact source text, its replacement].
 * The link in The Receipts' header takes the line's own colour and no
 * underline, so the line looks as it did.
 */
const LINKS: Partial<Record<FuturistSlug, [string, string, string]>> = {
  'face-forward': [
    'the footer note',
    'The channels, sponsors and videos on this page are invented.</p>',
    'The channels, sponsors and videos on this page are invented. The receipts behind section 2 have their own page: <a href="/gallery/the-receipts/">The Receipts</a>.</p>',
  ],
  'the-receipts': [
    'the header line',
    '<p class="sub">FACE FORWARD · REGISTER 01</p>',
    '<p class="sub"><a href="/gallery/face-forward/" style="color:inherit;text-decoration:none">FACE FORWARD</a> · REGISTER 01</p>',
  ],
  /* The So-Called Count names the series and No. 2 in the line above its
     colophon; both become links. */
  'the-so-called-count': [
    'the series line',
    '<p class="series">Mythmaking · No. 3 · Previous: Questions Wearing Teeth</p>',
    '<p class="series"><a href="/writings/mythmaking/" style="color:inherit">Mythmaking</a> · No. 3 · Previous: <a href="/gallery/questions-wearing-teeth/" style="color:inherit"><i>Questions Wearing Teeth</i></a></p>',
  ],
  /* Cannot Be Uninstalled names the series and No. 3, the other Saint
     Germain piece, in the line above its credits; both become links. */
  'cannot-be-uninstalled': [
    'the series line',
    '<p class="series">Mythmaking · No. 4 · Previous: The So-Called Count</p>',
    '<p class="series"><a href="/writings/mythmaking/" style="color:inherit">Mythmaking</a> · No. 4 · Previous: <a href="/gallery/the-so-called-count/" style="color:inherit"><i>The So-Called Count</i></a></p>',
  ],
};

/**
 * Repairs to single pages: [what, the exact source text, its replacement].
 *
 * Face Forward: the hero's two columns were the headline's full width plus
 * a fixed 34rem panel, which is wider than the hero's own 68rem box, so the
 * livestream panel ran past the right edge of any window under about 1220px
 * and sat off-centre above that. The panel column now takes the room that
 * is left, and the two columns start only where both fit (1088px, the
 * hero's full width); below that the hero stacks as it does on a phone.
 *
 * The Receipts: the register counted the first item as rung up on load,
 * before any scrolling, so it never showed "ITEM 00/14 · SCROLL TO RING
 * UP". Items now ring up only once the reader has scrolled.
 *
 * Quantum Banking: one line of CSS, described at its entry.
 */
const FIXES: Record<FuturistSlug, [string, string, string][]> = {
  'face-forward': [
    [
      "the hero's two-column rule",
      '  .hero { grid-template-columns: 1fr 34rem; align-items: end; padding-top: 64px; column-gap: 40px; }\n  .hero .hint { grid-column: 1 / -1; }\n',
      '  .hero { padding-top: 64px; }\n',
    ],
    [
      'the end of the wide-screen rules',
      '  .card { margin: 0; max-width: 30rem; }\n}\n',
      '  .card { margin: 0; max-width: 30rem; }\n}\n' +
        '/* site: the hero goes two-up only where both columns fit (src/lib/futurist.ts) */\n' +
        '@media (min-width: 1088px) {\n' +
        '  .hero { grid-template-columns: min-content minmax(0, 1fr); align-items: end; column-gap: 40px; }\n' +
        '  .hero .hint { grid-column: 1 / -1; }\n' +
        '}\n',
    ],
  ],
  'the-receipts': [
    [
      "the register's ring-up test",
      '      if (items[i].getBoundingClientRect().top < line) {',
      '      if ((window.pageYOffset || document.documentElement.scrollTop || 0) > 0 && items[i].getBoundingClientRect().top < line) {',
    ],
  ],
  'depth-chart': [],
  /* Free Won't ships as delivered: its file already carries the twin's
     sentences (data-twin), the share-card frame (data-og-frame) and the
     marks that keep its top bar out of both. */
  'free-wont': [],
  /* The So-Called Count ships as delivered: its file already carries the
     share-card frame (data-og-frame on the cover, with the title's written
     insertion shown whole under `og`) and the marks that keep its HUD out
     of the card and its HUD and control docks out of the twin. */
  'the-so-called-count': [],
  /* Cannot Be Uninstalled ships as delivered: its file already carries the
     share-card frame (data-og-frame on the cold open, with the title's
     strike shown finished under `og`), the twin's sentences (role="img"
     labels on its plates, terminals and canvases) and the marks that keep
     its top bar and case board out of both. Off Claude its reader tally
     has no store, so the page keeps that line hidden. */
  'cannot-be-uninstalled': [],
  /* Quantum Banking: the hero rosette is drawn once, at load, into a canvas
     sized to the hero as it stands then, and the canvas is shown at the
     hero's full size. On a phone the web fonts arrive after that and the
     hero grows 3 to 10% taller (the headline and lead re-wrap), so the
     drawing was stretched tall and the rings went oval until the next
     resize. The canvas now keeps its drawing's proportions and covers the
     hero, so the rings stay round. CSS only; where the drawing already
     matches the hero (768px up, or fonts already cached) nothing changes. */
  'quantum-banking': [
    [
      'the end of the stylesheet',
      '</style>\n</head>',
      '/* site: the rosette keeps its proportions when the fonts settle the hero (src/lib/futurist.ts) */\n' +
        '.hero canvas { object-fit: cover; }\n' +
        '</style>\n</head>',
    ],
    /* The share card only: at 1200x630 the twin counter (fixed to the
       bottom edge) cut through the last line of the lead, so the card
       leaves the counter out and shows the whole hero. The mark does
       nothing on the page itself (scripts/og-scrollies.mjs reads it). */
    ['the twin counter', '<div class="counter" aria-hidden="true">', '<div class="counter" aria-hidden="true" data-og-hide>'],
    /* The plain-text twin is the page without its script, so the two rigs
       read as their unfilled placeholders ("$0 credit resting on one $100
       token", "Saved per month $0") and the six streams, which are labels,
       were not read at all. Each part carries the twin's sentence for it
       (data-twin, which the page itself never shows): the page's own
       labels and the readings its own arithmetic gives at the settings it
       opens on. */
    [
      "the chain's bars",
      '      <div class="hops" id="hops"></div>\n',
      '      <div class="hops" id="hops" data-twin="Two sliders set the haircut at each hop, from 2% to 50%, and the times the token is re-pledged, from 1 to 8. A row of bars follows them: the $100 token, then one bar for each loan made against it. At a 15% haircut and four re-pledgings the loans are $85, $72, $61 and $52."></div>\n',
    ],
    [
      "the chain's totals",
      '      <div class="sum">\n',
      '      <div class="sum" data-twin="At that setting, $271 of credit rests on one $100 token, and the ceiling if the chain never stopped is $567.">\n',
    ],
    [
      'the data streams',
      '      <ul class="streams" id="streams">\n',
      '      <ul class="streams" id="streams" data-twin="Six data streams, each a checkbox with the monthly saving it buys. Purchase history (member pricing on groceries and fuel), $85. Location and driving (telematics insurance rate), $60. Verified-identity wallet (lower payment and transfer fees), $25. Home energy meter (utility credit for load sharing), $30. Wearable and pharmacy feed (health premium discount), $70. Contacts and referrals (sign-up and streak bonuses), $20. The first three start ticked.">\n',
    ],
    [
      "the veil's meters",
      '      <div class="twin-out">\n',
      '      <div class="twin-out" data-twin="Two meters and a sentence follow the ticks. With the first three streams ticked: saved per month, $170 of $290; twin completeness, 50%; “$2,040 a year saved. The veil on the rest costs $1,440 a year.” With none ticked: “Full veil. You pay list price on everything: $3,480 a year for privacy.” With all six: “Full collector. $3,480 a year saved, and the twin is complete.”">\n',
    ],
  ],
};

/**
 * Where the shared foot goes, and how it sits on each page. The foot
 * inherits the page's colour and face; these rules give it what each page
 * needs beyond that.
 *
 * Face Forward: inside <main>, after the page's own footer, so it rides
 * above the sky canvas like every card. The sky is bright morning by then,
 * so the foot takes the cards' dark panel.
 *
 * The Receipts: after <main>, on the counter below the tape, in the paper
 * colour. It gives up ScrollFoot's z-index so the register bar (fixed,
 * later in the page) always rides above it, and it ends with the same
 * clearance the page leaves for the bar under the tape.
 *
 * Depth Chart: after <main>, on the log sheet under the sources, in the
 * sheet's 44rem column, with its small type in the page's mono. It gives up
 * ScrollFoot's z-index so the rig readout (fixed, later in the page) always
 * rides above it; the body's own bottom padding already keeps the readout
 * clear of the foot's last line.
 *
 * Quantum Banking: the page has no <main>, so the foot follows the last
 * sheet, the sources, on the paper ledger, set like Depth Chart's (same
 * 44rem column, same mono). It gives up ScrollFoot's z-index so the twin
 * counter (fixed, later in the page) always rides above it; the body's own
 * bottom padding keeps the counter clear of the foot's last line.
 *
 * Free Won't: inside the page's closing band, after the sources, so it
 * sits on the band's opaque ground above the fixed sky and takes the
 * page's colours as they turn from night to daylight. It runs the width of
 * the sources column, and its small labels are set bold like every other
 * label on the page.
 *
 * The So-Called Count: inside the Cairns, after the colophon, on the end
 * matter's dark ground above the fixed canvas, in the Cairns' 760px column,
 * with its small type in the page's mono.
 *
 * Cannot Be Uninstalled: inside <main>, after the page's own footer (the
 * crisis line and the credits), in the main column, with its small type in
 * the Record's mono. In Believer mode the column already leaves room for
 * the case board on wide screens, so the foot never runs under it.
 */
/* The source text the foot follows: [what, the exact text]. */
const FOOT_AFTER: Record<FuturistSlug, [string, string]> = {
  'face-forward': ["the page's own footer", '</footer>\n'],
  'the-receipts': ['the end of <main>', '</main>\n'],
  'depth-chart': ['the end of <main>', '</main>\n'],
  'quantum-banking': ['the end of the sources sheet', '    </ol>\n  </div>\n</section>\n'],
  'free-wont': ['the end of the sources', 'reading of each source.</p>\n  </section>\n'],
  'the-so-called-count': ['the colophon', 'checked against the sources listed.</p>\n'],
  'cannot-be-uninstalled': ["the page's own footer", '</footer>\n'],
};
const FOOT_CSS: Record<FuturistSlug, string> = {
  'face-forward':
    '.scroll-foot.site-foot{--log:var(--body);width:calc(100% - 32px);max-width:66rem;margin:0 auto 56px;padding-left:20px;padding-right:20px;' +
    'background:rgba(9,13,26,0.92);border:1px solid rgba(236,230,216,0.14);border-radius:4px;color:var(--bone)}',
  'the-receipts':
    '.scroll-foot.site-foot{--log:var(--body);z-index:auto;max-width:30rem;margin-top:0;padding-bottom:104px;color:var(--paper)}',
  'depth-chart': '.scroll-foot.site-foot{--log:var(--mono);z-index:auto;max-width:44rem;margin-top:0;border-top-color:var(--rule)}',
  'quantum-banking': '.scroll-foot.site-foot{--log:var(--mono);z-index:auto;max-width:44rem;margin-top:0;border-top-color:var(--rule)}',
  'free-wont':
    '.scroll-foot.site-foot{--log:var(--typed);max-width:1240px;margin-top:0;padding-left:0;padding-right:0;border-top-color:var(--rule)}' +
    '.scroll-foot.site-foot .scroll-foot__k,.scroll-foot.site-foot .scroll-foot__status,.scroll-foot.site-foot .scroll-foot__btn,' +
    '.scroll-foot.site-foot .scroll-foot__next-label,.scroll-foot.site-foot .scroll-foot__commission,.scroll-foot.site-foot .scroll-foot__door{font-weight:700;opacity:.92}',
  'the-so-called-count':
    '.scroll-foot.site-foot{--log:var(--mono);max-width:760px;margin-top:6vh;padding-left:0;padding-right:0;color:var(--bone);border-top-color:rgba(217,181,90,.3)}',
  'cannot-be-uninstalled':
    '.scroll-foot.site-foot{--log:var(--font-record);max-width:none;margin-top:0;padding-left:0;padding-right:0;color:var(--text);border-top-color:var(--line)}',
};
const FOOT_MARK = '<!--futurist:foot-->';

/**
 * The links back, in the page's own masthead: [what, the exact source
 * text, its replacement]. The Gallery link is hidden in the share image
 * (data-og-hide), like Everyone, Searchable's, and left out of the twin.
 */
const back = (slug: FuturistSlug, label: string, href: string): [string, string, string] => {
  const a = 'style="color:inherit;white-space:nowrap"';
  if (slug === 'cannot-be-uninstalled') {
    return [
      'the eyebrow',
      '  <p class="eyebrow">Mythmaking · No. 4 · By Michael Wilhelm</p>\n',
      `  <p class="eyebrow"><a href="${href}" ${a}>${esc(label)}</a> · <span style="white-space:nowrap">By <a href="/" rel="author" ${a}>Michael Wilhelm</a></span>` +
        `<span data-og-hide data-twin-skip> · <a href="/gallery/" ${a}>The Gallery</a></span></p>\n`,
    ];
  }
  if (slug === 'the-so-called-count') {
    return [
      'the eyebrow',
      '    <div class="eyebrow">Mythmaking · No. 3 · By Michael Wilhelm</div>\n',
      `    <div class="eyebrow"><a href="${href}" ${a}>${esc(label)}</a> · <span style="white-space:nowrap">By <a href="/" rel="author" ${a}>Michael Wilhelm</a></span>` +
        `<span data-og-hide data-twin-skip> · <a href="/gallery/" ${a}>The Gallery</a></span></div>\n`,
    ];
  }
  if (slug === 'free-wont') {
    return [
      'the kicker',
      '  <p class="kicker"><span>By Michael Wilhelm</span><span>November 2026</span></p>\n',
      `  <p class="kicker"><span><a href="${href}" ${a}>${esc(label)}</a></span><span>By <a href="/" rel="author" ${a}>Michael Wilhelm</a></span><span>November 2026</span>` +
        `<span data-og-hide data-twin-skip><a href="/gallery/" ${a}>The Gallery</a></span></p>\n`,
    ];
  }
  if (slug === 'depth-chart') {
    return [
      'the hero tag',
      '    <p class="tag">Borehole log &middot; The new money &middot; Logged 14 Nov 2026</p>\n',
      '    <p class="tag">Borehole log &middot; The new money &middot; Logged 14 Nov 2026</p>\n' +
        `    <p class="tag"><a href="${href}" ${a}>${esc(label)}</a> &middot; <span style="white-space:nowrap">By <a href="/" rel="author" ${a}>Michael Wilhelm</a></span>` +
        `<span data-og-hide data-twin-skip> &middot; <a href="/gallery/" ${a}>The Gallery</a></span></p>\n`,
    ];
  }
  if (slug === 'quantum-banking') {
    return [
      'the hero tag',
      '    <p class="tag">Money file · status checked 14 November 2026</p>\n',
      '    <p class="tag">Money file · status checked 14 November 2026</p>\n' +
        `    <p class="tag"><a href="${href}" ${a}>${esc(label)}</a> · <span style="white-space:nowrap">By <a href="/" rel="author" ${a}>Michael Wilhelm</a></span>` +
        `<span data-og-hide data-twin-skip> · <a href="/gallery/" ${a}>The Gallery</a></span></p>\n`,
    ];
  }
  if (slug === 'face-forward') {
    return [
      'the byline',
      '<p class="by">By Michael Wilhelm</p>',
      `<p class="by">By <a href="/" rel="author" ${a}>Michael Wilhelm</a> · <a href="${href}" ${a}>${esc(label)}</a>` +
        `<span data-og-hide data-twin-skip> · <a href="/gallery/" ${a}>The Gallery</a></span></p>`,
    ];
  }
  return [
    'the printed line',
    '<p class="sub">PRINTED 11/10/2026 · 14 ITEMS</p>\n',
    '<p class="sub">PRINTED 11/10/2026 · 14 ITEMS</p>\n' +
      `      <p class="sub"><a href="${href}" ${a}>${esc(label.toUpperCase())}</a> · <span style="white-space:nowrap">BY <a href="/" rel="author" ${a}>MICHAEL WILHELM</a></span>` +
      `<span data-og-hide data-twin-skip> · <a href="/gallery/" ${a}>THE GALLERY</a></span></p>\n`,
  ];
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Replace exactly one occurrence, or stop the build. */
function swap(html: string, find: string, put: string, what: string, slug: string): string {
  const parts = html.split(find);
  if (parts.length !== 2) throw new Error(`futurist: ${slug}: expected ${what} once in the source file, found it ${parts.length - 1} times.`);
  return parts.join(put);
}

export function futuristSource(slug: FuturistSlug): string {
  const { dir = 'futurist-essays' } = FUTURIST_SOURCES[slug] as { dir?: string };
  const bytes = readFileSync(resolve(process.cwd(), '_incoming', dir, `${slug}.html`));
  const sha = createHash('sha256').update(bytes).digest('hex');
  if (sha !== FUTURIST_SOURCES[slug].sha256) {
    throw new Error(`futurist: ${slug}: the source file is not the approved one (sha256 ${sha.slice(0, 16)}…).`);
  }
  return bytes.toString('utf8');
}

/** The page in two halves: everything before the shared foot, and everything after it. */
export async function futuristDocument(slug: FuturistSlug): Promise<[string, string]> {
  let html = futuristSource(slug);
  const { night, preload } = FUTURIST_SOURCES[slug];
  const piece = await getPiece(slug);
  const { title, description } = piece;
  if (!piece.series) throw new Error(`futurist: ${slug}: the gallery entry needs a series.`);
  const s = registry[piece.series];

  /* Fonts: the site's copies, under the names the stylesheet already uses. */
  html = swap(html, '<link rel="preconnect" href="https://fonts.googleapis.com">\n', '', 'the fonts.googleapis.com preconnect', slug);
  html = swap(html, '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n', '', 'the fonts.gstatic.com preconnect', slug);
  const faces: string[] = [];
  html = html.replace(/<link href="https:\/\/fonts\.googleapis\.com\/css2\?((?:family=[^"&]+&)+)display=swap" rel="stylesheet">\n/g, (_m, query: string) => {
    const first = faces.length === 0;
    for (const part of query.split('&').filter(Boolean)) {
      const family = part.replace(/^family=/, '');
      if (!FACES[family]) throw new Error(`futurist: ${slug}: no self-hosted copy of ${family}.`);
      faces.push(...FACES[family]);
    }
    return first ? '<!--futurist-fonts-->' : '';
  });
  if (/fonts\.g(oogleapis|static)\.com/.test(html)) throw new Error(`futurist: ${slug}: a Google Fonts reference was left in the page.`);
  html = swap(
    html,
    '<!--futurist-fonts-->',
    `<style>\n${faces.join('\n')}\n/* site: the shared foot on this page (src/lib/futurist.ts) */\n${FOOT_CSS[slug]}\n</style>\n`,
    'the Google Fonts stylesheet links',
    slug,
  );

  /* Head: where the page lives, how it shares, what it is (as Poem.astro). */
  const canonical = new URL(piece.path, SITE_URL).href;
  const image = ogImage(piece.ogPath);
  const fullTitle = `${title} · ${s.title} · ${SITE_NAME}`;
  const modified = piece.gallery?.data.updated ?? piece.date;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${canonical}#article`,
    mainEntityOfPage: canonical,
    headline: title,
    name: title,
    description,
    genre: 'Essay',
    url: canonical,
    image,
    dateCreated: String(piece.date.getUTCFullYear()),
    datePublished: piece.date.toISOString(),
    dateModified: modified.toISOString(),
    author: { '@type': 'Person', '@id': `${SITE_URL}/#person`, name: 'Michael Wilhelm', url: `${SITE_URL}/` },
    isPartOf: { '@type': 'CreativeWorkSeries', name: s.title, url: `${SITE_URL}${s.href}` },
  };
  const head = [
    `<link rel="canonical" href="${canonical}">`,
    `<meta name="theme-color" content="${night}">`,
    `<meta name="author" content="Michael Wilhelm">`,
    `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`,
    `<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">`,
    `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`,
    ...preload.map((href) => `<link rel="preload" href="${href}" as="font" type="font/woff2" crossorigin>`),
    ...FEEDS.map((f) => `<link rel="alternate" type="${f.type}" title="${esc(f.title)}" href="${f.href}">`),
    `<link rel="alternate" type="text/html" title="${esc(title)} · plain text" href="${canonical}twin/">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:site_name" content="${esc(SITE_NAME)}">`,
    `<meta property="og:title" content="${esc(fullTitle)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${canonical}">`,
    `<meta property="og:image" content="${esc(image)}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="article:published_time" content="${piece.date.toISOString()}">`,
    `<meta property="article:modified_time" content="${modified.toISOString()}">`,
    `<meta property="article:author" content="${SITE_URL}/">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(fullTitle)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
    `<meta name="twitter:image" content="${esc(image)}">`,
    `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`,
  ].join('\n');

  /* The title and description: the page's own, in the site's title shape.
     Face Forward carries its description; The Receipts takes the entry's. */
  const titleTag = `<title>${esc(title)}</title>\n`;
  const own = html.match(/<meta name="description" content="([^"]*)">\n/);
  if (own) {
    if (own[1] !== esc(description)) throw new Error(`futurist: ${slug}: the gallery entry's description differs from the source file's.`);
    html = swap(html, own[0], '', 'the meta description', slug);
  }
  html = swap(
    html,
    titleTag,
    `<title>${esc(fullTitle)}</title>\n<meta name="description" content="${esc(description)}">\n${head}\n`,
    'the <title>',
    slug,
  );

  const link = LINKS[slug];
  if (link) html = swap(html, link[1], link[2], link[0], slug);
  for (const [fixed, from, to] of FIXES[slug]) html = swap(html, from, to, fixed, slug);
  if (!piece.label) throw new Error(`futurist: ${slug}: the gallery entry needs a series number.`);
  const [backWhat, backFrom, backTo] = back(slug, piece.label, s.href);
  html = swap(html, backFrom, backTo, backWhat, slug);

  const [footWhat, footAfter] = FOOT_AFTER[slug];
  html = swap(html, footAfter, `${footAfter}${FOOT_MARK}`, footWhat, slug);
  const halves = html.replace(/^<!DOCTYPE html>\n/i, '').split(FOOT_MARK);
  return [halves[0], halves[1]];
}
