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
 *     Receipts, each one a named, exact replacement;
 *   - FIXES holds the repairs made since the files were approved, each one
 *     a named, exact replacement (the source files stay as approved).
 *
 * Nothing is added around the page: no wrapper element, no site navigation, no foot.
 * Anything the function expects and does not find stops the build, so a
 * changed source file cannot ship half-mounted.
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
/* Each Google Fonts link in the source files, and the faces it stood for:
   one per weight asked for, as Google declares them (a variable file is
   named once per weight). */
const FACES: Record<string, string[]> = {
  'Big+Shoulders+Display:wght@600;700;800;900': [600, 700, 800, 900].map((w) =>
    face('Big Shoulders Display', w, 'big-shoulders-display-latin-wght-normal'),
  ),
  'Public+Sans:wght@400;500;600;700': [400, 500, 600, 700].map((w) => face('Public Sans', w, 'public-sans-latin-wght-normal')),
  'Black+Ops+One': [face('Black Ops One', 400, 'black-ops-one-latin-400-normal')],
  'IBM+Plex+Mono:wght@400;500;600': [400, 500, 600].map((w) => face('IBM Plex Mono', w, `ibm-plex-mono-latin-${w}-normal`)),
  'Doto:wght@700;900': [700, 900].map((w) => face('Doto', w, 'doto-latin-wght-normal')),
};

/**
 * The only copy edits: [what, the exact source text, its replacement].
 * The link in The Receipts' header takes the line's own colour and no
 * underline, so the line looks as it did.
 */
const LINKS: Record<FuturistSlug, [string, string, string]> = {
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
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Replace exactly one occurrence, or stop the build. */
function swap(html: string, find: string, put: string, what: string, slug: string): string {
  const parts = html.split(find);
  if (parts.length !== 2) throw new Error(`futurist: ${slug}: expected ${what} once in the source file, found it ${parts.length - 1} times.`);
  return parts.join(put);
}

export function futuristSource(slug: FuturistSlug): string {
  const bytes = readFileSync(resolve(process.cwd(), '_incoming/futurist-essays', `${slug}.html`));
  const sha = createHash('sha256').update(bytes).digest('hex');
  if (sha !== FUTURIST_SOURCES[slug].sha256) {
    throw new Error(`futurist: ${slug}: the source file is not the approved one (sha256 ${sha.slice(0, 16)}…).`);
  }
  return bytes.toString('utf8');
}

export async function futuristDocument(slug: FuturistSlug): Promise<string> {
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
  html = html.replace(/<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=([^"&]+)&display=swap" rel="stylesheet">\n/g, (_m, family: string) => {
    if (!FACES[family]) throw new Error(`futurist: ${slug}: no self-hosted copy of ${family}.`);
    const first = faces.length === 0;
    faces.push(...FACES[family]);
    return first ? '<!--futurist-fonts-->' : '';
  });
  if (/fonts\.g(oogleapis|static)\.com/.test(html)) throw new Error(`futurist: ${slug}: a Google Fonts reference was left in the page.`);
  html = swap(html, '<!--futurist-fonts-->', `<style>\n${faces.join('\n')}\n</style>\n`, 'the Google Fonts stylesheet links', slug);

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

  const [what, find, put] = LINKS[slug];
  html = swap(html, find, put, what, slug);
  for (const [fixed, from, to] of FIXES[slug]) html = swap(html, from, to, fixed, slug);

  return html.replace(/^<!DOCTYPE html>\n/i, '');
}
