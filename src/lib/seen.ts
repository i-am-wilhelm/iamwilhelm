/**
 * Mounts a Seen page from its approved source file. The source
 * (_incoming/art-scrollies/<slug>.html, or the file SEEN_SOURCES names for
 * a page delivered on its own, such as Due Space) is a whole document: its own
 * palette, markup, stylesheet and one script. It ships as it is; this
 * function makes only the changes a page needs to live on the site:
 *
 *   - the Google Fonts links become the site's self-hosted files, declared
 *     under the same family names and weights;
 *   - the head gains the canonical URL, icons, the share card (the page's
 *     own render, public/og/<slug>.jpg), the Article schema and the link to
 *     the plain-text twin; a source with no meta description of its own
 *     takes the gallery entry's;
 *   - the colophon's "Previous: <i>Title</i>" becomes a link, with a
 *     matching "Next" where a next piece is hung (src/config/seen.ts) and
 *     the link back to the Gallery that the hung essays end on;
 *   - the making-of line is printed from src/config/seen.ts, on every
 *     numbered page and on any other page whose source carries it;
 *   - each scene's control bar is lifted out of the stage into a layer above
 *     the text cards (liftControls), so a card scrolling past on a phone
 *     passes under the bar instead of covering it;
 *   - FIXES holds the few per-page repairs made since the files were
 *     approved, and the in-page links to other pieces moved onto the
 *     site's own routes, each one a named, exact replacement.
 *
 * Anything the function expects and does not find stops the build, so a
 * changed source file cannot ship half-mounted.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ogImage } from '../config/og';
import { SEEN_AI_LINE, SEEN_AI_LINE_SOURCE, SEEN_CHAIN, SEEN_SOURCES } from '../config/seen';
import { series as registry } from '../config/series';
import { SITE_NAME, SITE_URL } from '../config/site';
import { getPieces, type Piece } from './pieces';

const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const face = (family: string, style: string, weight: string, file: string) =>
  `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};font-display:swap;src:url('/fonts/${file}.woff2') format('woff2');unicode-range:${LATIN}}`;
/* The faces the source files ask Google Fonts for, from public/fonts. */
const FACES: Record<string, string[]> = {
  'Cormorant+Garamond': [
    face('Cormorant Garamond', 'normal', '400', 'cormorant-garamond-latin-400-normal'),
    face('Cormorant Garamond', 'normal', '500', 'cormorant-garamond-latin-500-normal'),
    face('Cormorant Garamond', 'normal', '600', 'cormorant-garamond-latin-600-normal'),
    face('Cormorant Garamond', 'italic', '400', 'cormorant-garamond-latin-400-italic'),
    face('Cormorant Garamond', 'italic', '500', 'cormorant-garamond-latin-500-italic'),
    face('Cormorant Garamond', 'italic', '600', 'cormorant-garamond-latin-600-italic'),
  ],
  Newsreader: [
    face('Newsreader', 'normal', '400', 'newsreader-latin-opsz-normal'),
    face('Newsreader', 'italic', '400', 'newsreader-latin-opsz-italic'),
  ],
  'IBM+Plex+Mono': [
    face('IBM Plex Mono', 'normal', '400', 'ibm-plex-mono-latin-400-normal'),
    face('IBM Plex Mono', 'normal', '500', 'ibm-plex-mono-latin-500-normal'),
  ],
  /* Per My Last Memo: the latin files exactly as fonts.gstatic.com serves
     them for the page's link (the Courier Prime 400 and 700 files were
     already here, byte for byte). The page's canvases set ctx.font by these
     family names, so the names stay exactly as Google declares them. */
  Caprasimo: [face('Caprasimo', 'normal', '400', 'caprasimo-latin-400-normal')],
  Caveat: [face('Caveat', 'normal', '700', 'caveat-latin-700-normal')],
  'Courier+Prime': [
    face('Courier Prime', 'normal', '400', 'courier-prime-latin-400-normal'),
    face('Courier Prime', 'normal', '700', 'courier-prime-latin-700-normal'),
    face('Courier Prime', 'italic', '400', 'courier-prime-latin-400-italic'),
  ],
  /* Fall Line and Off Soundings. A key with its axes (the family as the
     link spells it) is matched before the bare family name, so Fall Line's
     IBM Plex Mono gains the 600 it asks for and the batch pages, which ask
     for 400 and 500, build as before. IBM Plex Mono is the repo's three
     files; the rest are the latin files exactly as fonts.gstatic.com serves
     them for each page's link (IBM Plex Sans and Libre Franklin are
     variable files, named once per weight asked for, as Google declares
     them). The canvases set ctx.font by these family names. */
  'IBM+Plex+Mono:wght@400;500;600': ['400', '500', '600'].map((w) => face('IBM Plex Mono', 'normal', w, `ibm-plex-mono-latin-${w}-normal`)),
  'IBM+Plex+Sans': ['400', '500', '600'].map((w) => face('IBM Plex Sans', 'normal', w, 'ibm-plex-sans-latin-wght-normal')),
  'Instrument+Serif': [
    face('Instrument Serif', 'normal', '400', 'instrument-serif-latin-400-normal'),
    face('Instrument Serif', 'italic', '400', 'instrument-serif-latin-400-italic'),
  ],
  'Libre+Caslon+Display': [face('Libre Caslon Display', 'normal', '400', 'libre-caslon-display-latin-400-normal')],
  'Libre+Caslon+Text': [
    face('Libre Caslon Text', 'normal', '400', 'libre-caslon-text-latin-400-normal'),
    face('Libre Caslon Text', 'normal', '700', 'libre-caslon-text-latin-700-normal'),
    face('Libre Caslon Text', 'italic', '400', 'libre-caslon-text-latin-400-italic'),
  ],
  'Libre+Franklin': [
    ...['400', '500', '600', '700'].map((w) => face('Libre Franklin', 'normal', w, 'libre-franklin-latin-wght-normal')),
    face('Libre Franklin', 'italic', '400', 'libre-franklin-latin-wght-italic'),
  ],
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unesc = (s: string) =>
  s.replace(/&rsquo;/g, '\u2019').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
/** Straight and curly apostrophes read as one when titles are compared. */
const plain = (s: string) => unesc(s).replace(/[\u2018\u2019]/g, "'").trim();

function swap(html: string, find: string | RegExp, put: string | ((...m: string[]) => string), what: string, slug: string): string {
  const hit = typeof find === 'string' ? html.includes(find) : find.test(html);
  if (!hit) throw new Error(`seen: ${slug}: expected ${what} in the source file.`);
  return html.replace(find as never, put as never);
}

/**
 * The control bars (.palette) sit inside the sticky stage, and the text
 * cards scroll over the stage, so on a narrow screen a card on its way out
 * covered the bar. Each scene's bars move, unchanged, into a second sticky
 * layer at the head of the scene's steps, stacked above the cards. The
 * layer is the size and position of the stage, so every bar keeps its
 * place; the scripts find the bars by id and are untouched.
 */
const CTL_CSS =
  '/* site: the control bars ride above the text cards (src/lib/seen.ts) */\n' +
  '.ctl{position:sticky;top:0;height:100vh;height:100dvh;margin-bottom:-100vh;margin-bottom:-100dvh;z-index:1;pointer-events:none}\n' +
  '.ctl .palette{-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}\n' +
  /* On the stacked layout (cards below the picture, bars near the top) a
     card fades out over 44px as its top climbs past a line 262px down, so
     it is gone by 218px, just under the lowest bar measured (216px), and no
     text shows through a bar. The tallest card is 250px, so even on a
     320 x 568 screen every card is whole and fully opaque before it starts
     to fade. Where scroll-driven animation is not supported the card
     simply passes under the bar. */
  '@keyframes ctl-pass{to{opacity:0}}\n' +
  '@supports (animation-timeline:view()){@media not all and (min-width:900px) and (min-aspect-ratio:5/4){' +
  '.ctl~.step .card{animation:ctl-pass linear both;animation-timeline:view(block 262px 0px);animation-range:exit 0px exit 44px}}}\n';
function liftControls(html: string, slug: string): string {
  const out: string[] = [];
  let rest = html;
  let scenes = 0;
  for (;;) {
    const at = rest.indexOf('<div class="stage">');
    if (at < 0) break;
    const stepsAt = rest.indexOf('<div class="steps">', at);
    if (stepsAt < 0) throw new Error(`seen: ${slug}: a stage with no steps after it.`);
    let stage = rest.slice(at, stepsAt);
    const bars: string[] = [];
    stage = stage.replace(/[ \t]*<div class="palette"[^>]*>[\s\S]*?<\/div>\n/g, (bar) => {
      if ((bar.match(/<div\b/g) ?? []).length !== 1) throw new Error(`seen: ${slug}: a control bar with a nested div.`);
      bars.push(bar);
      return '';
    });
    out.push(rest.slice(0, at), stage, '<div class="steps">\n');
    if (bars.length) out.push('    <div class="ctl">\n', ...bars, '    </div>\n');
    rest = rest.slice(stepsAt + '<div class="steps">\n'.length);
    scenes++;
  }
  if (!scenes) return html;
  return swap(out.join('') + rest, '</style>\n</head>', `${CTL_CSS}</style>\n</head>`, 'the end of the stylesheet', slug);
}

/** Repairs to single pages: [what, the exact source text, its replacement]. */
const FIXES: Record<string, [string, string, string][]> = {
  'nobody-sees-the-same-sea': [
    /* The belly-lights slider had no aria-valuetext. It now reads the
       contrast the scene is about, in the page's language. */
    [
      'the belly slider',
      '<input type="range" id="belly" min="0" max="100" value="0" step="1">',
      '<input type="range" id="belly" min="0" max="100" value="0" step="1" aria-valuetext="contrast 1.00">',
    ],
    [
      'the belly slider reading',
      'const b = +bellyIn.value / 62.5, contrast = Math.abs(1 - b);',
      "const b = +bellyIn.value / 62.5, contrast = Math.abs(1 - b); { const vt = (lang === 'es' ? 'contraste ' : 'contrast ') + contrast.toFixed(2); if (bellyIn._vt !== vt) { bellyIn._vt = vt; bellyIn.setAttribute('aria-valuetext', vt); } }",
    ],
  ],
  'nine-hundred-lights': [
    /* The source credits its lighthouse drawings to How to Throw a Flame
       Twenty Miles with an absolute link to the live site. On the site it
       is the site's own route, so it works on a preview and in dev too. */
    [
      'the link to How to Throw a Flame Twenty Miles',
      '<a href="https://iamwilhelm.com/gallery/how-to-throw-a-flame-twenty-miles/" rel="noopener">',
      '<a href="/gallery/how-to-throw-a-flame-twenty-miles/">',
    ],
  ],
  'per-my-last-memo': [
    /* The prototype was only ever checked with fallback fonts. Set in its
       web fonts, the two-column layout between 900px and the page's full
       width (1180px) has a sheet narrower than the type it carries:
         - the H1 broke "Per My / Last / Memo" up to 951px; it is held to
           two lines by the width of "Last Memo";
         - Exhibit 4's five cards were 67 to 117px wide, so words such as
           "Approve", "bachelor" and "extinguisher" ran out of them; the
           cards sit two across with the fifth spanning, as on a phone;
         - the incident title, set by the window's width at 30px, ran under
           the red stamp; it is set by the sheet's width instead, and starts
           6px lower, below the stamp.
       And on a phone shorter than 844px, Exhibit 4's sheet (66% of the
       screen) was too short for the incident card, whose text rose over
       the option buttons and blocked taps on them (375 x 667: 115px short
       at Figure 0). That sheet takes the height it has on a 390 x 844
       phone, 556px, up to 84% of the screen; on a phone held sideways,
       where the page already unpins its sheets at 380px, it is 480px; and
       the card's text centres safely, so any overflow runs down, never
       over the options.
       Exhibit 2's readout kept two lines free, but its eight sentences
       run to three under 482px and from 900 to 995px (four under 346px),
       so the chart above it changed height from sort to sort and the red
       line moved 12 to 18px on the screen. The readout keeps its longest
       sentence's height free at those widths, and the line stays put.
       CSS only. From 1180px up nothing changes; on a phone 844px tall or
       more, only the readout's reserved line. */
    [
      'the end of the stylesheet',
      '</style>\n</head>',
      '/* site: display repairs found with the web fonts (src/lib/seen.ts) */\n' +
        '@media (min-width:900px) and (max-width:1059px){h1{font-size:min(10.6vw,calc((100vw - 400px) / 5.6))}}\n' +
        '@media (min-width:900px) and (max-width:1179px){' +
        '.hand{grid-template-columns:repeat(2,minmax(0,1fr))}' +
        '.opt{min-height:60px;justify-content:center;padding:7px 10px}' +
        '.opt:last-child{grid-column:1 / -1}' +
        '.opt-n{display:none}' +
        '.inc-t{font-size:clamp(19px,2.2vw,26px)}' +
        '.inc-k{margin-bottom:6px}}\n' +
        '@media (max-width:899px) and (min-height:521px){' +
        '[data-scene="4"] .sheet{height:max(66vh,min(556px,84vh));height:max(66svh,min(556px,84svh))}}\n' +
        '@media (max-width:899px) and (max-height:520px){[data-scene="4"] .sheet{height:480px}}\n' +
        '@media (max-width:899px){.inc{justify-content:safe center}}\n' +
        '@media (max-width:495px),(min-width:900px) and (max-width:1005px){#o2{min-height:4.2em}}\n' +
        '@media (max-width:350px){#o2{min-height:5.6em}}\n' +
        '</style>\n</head>',
    ],
  ],
  /* Fall Line and Off Soundings were approved as review drafts. Published,
     each drops the words "review draft" and their separator from its sheet
     tag (the markup and the string the script sets it back to) and from its
     colophon, and nothing else.
     Each also carries one sentence for the plain-text twin (data-twin,
     which the page itself never shows), since the twin is the page without
     its script: Fall Line's Term paragraph is hidden until its button is
     pressed, and Off Soundings' four quarter notes live in its script. The
     sentences are the pages' own words. */
  'fall-line': [
    [
      'the policy buttons',
      '<div class="seg" role="group" aria-label="Kind of policy">',
      '<div class="seg" role="group" aria-label="Kind of policy" data-twin="Two buttons, Term and Whole life, swap the tank in the drawing and the paragraph that follows. Whole life is shown. Term reads: “A rented tank. Large, cheap, and it expires. In one Consumer Reports comparison the term policy cost $660 a year. Critics of the method buy this one and invest the difference.” (source 10)">',
    ],
    ['the sheet tag', '<span id="tagL">Fall Line · review draft</span>', '<span id="tagL">Fall Line</span>'],
    ['the first sheet name', "const SHEETS=['Fall Line · review draft',", "const SHEETS=['Fall Line',"],
    [
      'the colophon',
      '<p class="colophon">Fall Line · Drawing RW-01 · Review draft · Nov 2026</p>',
      '<p class="colophon">Fall Line · Drawing RW-01 · Nov 2026</p>',
    ],
  ],
  'off-soundings': [
    [
      "the quarter's note",
      '<p class="qout" id="qout" aria-live="polite"></p>',
      '<p class="qout" id="qout" aria-live="polite" data-twin="Four buttons, one for each quarter of the compass. The chosen quarter lights on the chart and its note shows here; Private, Offshore is chosen first. Private, Onshore: A South Dakota dynasty trust. A Wyoming LLC. A private placement policy written in the States. Closed to the public, inside the reach of U.S. courts. Private, Offshore: A Cook Islands trust. A Cayman fund. Closed to the public and outside the reach of U.S. courts. Reported to the IRS in full. Public, Onshore: Your brokerage account, even when it holds euros and Tokyo-listed shares. Open, regulated, simple. Public, Offshore: A plain bank account in Zurich or Singapore. Another country\'s system, reported home every year once balances pass $10,000."></p>',
    ],
    ['the sheet tag', '<span id="tagL">Off Soundings · review draft</span>', '<span id="tagL">Off Soundings</span>'],
    [
      "the sheet tag's opening text",
      "tagL.textContent=stepIdx===0?'Off Soundings · review draft':'Off Soundings';",
      "tagL.textContent=stepIdx===0?'Off Soundings':'Off Soundings';",
    ],
    [
      'the colophon',
      '<p class="colophon">Off Soundings · Chart No. 3 · Review draft · Nov 2026 · Not for navigation</p>',
      '<p class="colophon">Off Soundings · Chart No. 3 · Nov 2026 · Not for navigation</p>',
    ],
  ],
};

export function seenSource(slug: string): string {
  return readFileSync(resolve(process.cwd(), SEEN_SOURCES[slug] ?? `_incoming/art-scrollies/${slug}.html`), 'utf8').replace(/\r\n/g, '\n');
}

/** The source's own <title> and meta description (when it carries one), as plain text. */
export function seenMeta(slug: string): { title: string; description?: string } {
  const html = seenSource(slug);
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
  const description = html.match(/<meta name="description" content="([^"]*)">/)?.[1];
  if (!title) throw new Error(`seen: ${slug}: the source file needs a <title>.`);
  /* Only a page named in SEEN_SOURCES may leave its description to the gallery entry. */
  if (!description && !SEEN_SOURCES[slug]) throw new Error(`seen: ${slug}: the source file needs a meta description.`);
  return { title: unesc(title), description: description ? unesc(description) : undefined };
}

export async function seenDocument(slug: string): Promise<string> {
  let html = seenSource(slug);
  const { title, description: own } = seenMeta(slug);
  const pieces = (await getPieces()).filter((p) => p.kind === 'scroll');
  const piece = pieces.find((p) => p.id === slug);
  if (!piece) throw new Error(`seen: ${slug}: no gallery entry (src/content/gallery/${slug}.md).`);
  if (piece.title !== title) throw new Error(`seen: ${slug}: the gallery entry's title differs from the source file's <title>.`);
  const description = own ?? piece.description;
  if (!description) throw new Error(`seen: ${slug}: no meta description in the source file or the gallery entry.`);

  /* Fonts: the site's copies, under the names the stylesheet already uses. */
  const fonts = html.match(/<link href="https:\/\/fonts\.googleapis\.com\/css2\?([^"]*)" rel="stylesheet">\n/);
  if (!fonts) throw new Error(`seen: ${slug}: expected the Google Fonts stylesheet link.`);
  const families = [...fonts[1].matchAll(/family=([^&]+)/g)].map((m) => m[1]);
  const faces = families.flatMap((spec) => {
    const f = FACES[spec] ?? FACES[spec.split(':')[0]];
    if (!f) throw new Error(`seen: ${slug}: no self-hosted copy of ${spec.split(':')[0]}.`);
    return f;
  });
  html = swap(html, '<link rel="preconnect" href="https://fonts.googleapis.com">\n', '', 'the fonts.googleapis.com preconnect', slug);
  html = swap(html, '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n', '', 'the fonts.gstatic.com preconnect', slug);
  html = html.replace(fonts[0], `<style>\n${faces.join('\n')}\n</style>\n`);

  /* Head: where the page lives, how it shares, what it is. */
  const canonical = new URL(piece.path, SITE_URL).href;
  const image = ogImage(piece.ogPath);
  const s = piece.series ? registry[piece.series] : undefined;
  const fullTitle = `${title} · ${s ? s.title : 'The Gallery'} · ${SITE_NAME}`;
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
    datePublished: piece.date.toISOString(),
    dateModified: modified.toISOString(),
    author: { '@type': 'Person', '@id': `${SITE_URL}/#person`, name: 'Michael Wilhelm', url: `${SITE_URL}/` },
    isPartOf: s
      ? { '@type': 'CreativeWorkSeries', name: s.title, url: `${SITE_URL}${s.href}` }
      : { '@type': 'CollectionPage', name: 'The Gallery', url: `${SITE_URL}/gallery/` },
  };
  const head = [
    `<link rel="canonical" href="${canonical}">`,
    `<meta name="author" content="Michael Wilhelm">`,
    `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`,
    `<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">`,
    `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`,
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
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(fullTitle)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
    `<meta name="twitter:image" content="${esc(image)}">`,
    `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`,
  ].join('\n');
  html = own
    ? swap(html, /(<meta name="description" content="[^"]*">\n)/, (m) => `${m}${head}\n`, 'the meta description', slug)
    : swap(html, /(<title>[^<]*<\/title>\n)/, (m) => `${m}<meta name="description" content="${esc(description)}">\n${head}\n`, 'the <title>', slug);

  /* Colophon: the series links and the making-of line. A numbered page
     must carry the line; any other page that carries it prints it from the
     same place, so the pending wording changes everywhere at once. */
  const at = (SEEN_CHAIN as readonly string[]).indexOf(slug);
  if (at < 0 && html.includes(SEEN_AI_LINE_SOURCE)) html = swap(html, SEEN_AI_LINE_SOURCE, () => SEEN_AI_LINE, 'the making-of line', slug);
  if (at >= 0) {
    html = swap(html, SEEN_AI_LINE_SOURCE, SEEN_AI_LINE, 'the making-of line', slug);
    const link = (p: Piece) => `<a href="${p.path}"><i>${esc(p.title)}</i></a>`;
    const hung = (id: string | undefined) => pieces.find((p) => p.id === id);
    const prev = hung(SEEN_CHAIN[at - 1]);
    const next = hung(SEEN_CHAIN[at + 1]);
    html = swap(
      html,
      /Previous: <i>([^<]*)<\/i>/,
      (m, named) => {
        if (prev && plain(named) !== plain(prev.title)) {
          throw new Error(`seen: ${slug}: the colophon names "${named}" as the previous piece; the series order says "${prev.title}".`);
        }
        /* The way back to the wall closes the line, as on the essays already hung. */
        return [prev ? `Previous: ${link(prev)}` : m, next ? `Next: ${link(next)}` : '', '<a href="/gallery/">The Gallery</a>']
          .filter(Boolean)
          .join(' &middot; ');
      },
      'the colophon\'s "Previous:" line',
      slug,
    );
    /* A page with a language switch keeps its Spanish colophon in the script,
       as a single-quoted string: the same links, apostrophes escaped. */
    if (/Anterior: <i>/.test(html)) {
      const js = (p: Piece) => link(p).replace(/'/g, '&#39;');
      html = html.replace(/Anterior: <i>[^<]*<\/i>/, (m) =>
        [prev ? `Anterior: ${js(prev)}` : m, next ? `Siguiente: ${js(next)}` : '', '<a href="/gallery/">The Gallery</a>']
          .filter(Boolean)
          .join(' &middot; '),
      );
    }
  } else if (/Previous: <i>/.test(html)) {
    throw new Error(`seen: ${slug}: the page names a previous piece but is not in SEEN_CHAIN.`);
  }

  for (const [what, find, put] of FIXES[slug] ?? []) html = swap(html, find, () => put, what, slug);
  html = liftControls(html, slug);

  return html.replace(/^<!DOCTYPE html>\n/i, '');
}
