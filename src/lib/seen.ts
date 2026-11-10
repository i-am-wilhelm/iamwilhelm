/**
 * Mounts a Seen page from its approved source file. The source
 * (_incoming/art-scrollies/<slug>.html) is a whole document: its own
 * palette, markup, stylesheet and one script. It ships as it is; this
 * function makes only the changes a page needs to live on the site:
 *
 *   - the Google Fonts links become the site's self-hosted files, declared
 *     under the same family names and weights;
 *   - the head gains the canonical URL, icons, the share card (the page's
 *     own render, public/og/<slug>.jpg), the Article schema and the link to
 *     the plain-text twin;
 *   - the colophon's "Previous: <i>Title</i>" becomes a link, with a
 *     matching "Next" where a next piece is hung (src/config/seen.ts) and
 *     the link back to the Gallery that the hung essays end on;
 *   - the making-of line is printed from src/config/seen.ts.
 *
 * Anything the function expects and does not find stops the build, so a
 * changed source file cannot ship half-mounted.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ogImage } from '../config/og';
import { SEEN_AI_LINE, SEEN_AI_LINE_SOURCE, SEEN_CHAIN } from '../config/seen';
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

export function seenSource(slug: string): string {
  return readFileSync(resolve(process.cwd(), '_incoming/art-scrollies', `${slug}.html`), 'utf8').replace(/\r\n/g, '\n');
}

/** The source's own <title> and meta description, as plain text. */
export function seenMeta(slug: string): { title: string; description: string } {
  const html = seenSource(slug);
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
  const description = html.match(/<meta name="description" content="([^"]*)">/)?.[1];
  if (!title || !description) throw new Error(`seen: ${slug}: the source file needs a <title> and a meta description.`);
  return { title: unesc(title), description: unesc(description) };
}

export async function seenDocument(slug: string): Promise<string> {
  let html = seenSource(slug);
  const { title, description } = seenMeta(slug);
  const pieces = (await getPieces()).filter((p) => p.kind === 'scroll');
  const piece = pieces.find((p) => p.id === slug);
  if (!piece) throw new Error(`seen: ${slug}: no gallery entry (src/content/gallery/${slug}.md).`);
  if (piece.title !== title) throw new Error(`seen: ${slug}: the gallery entry's title differs from the source file's <title>.`);

  /* Fonts: the site's copies, under the names the stylesheet already uses. */
  const fonts = html.match(/<link href="https:\/\/fonts\.googleapis\.com\/css2\?([^"]*)" rel="stylesheet">\n/);
  if (!fonts) throw new Error(`seen: ${slug}: expected the Google Fonts stylesheet link.`);
  const families = [...fonts[1].matchAll(/family=([^:&]+)/g)].map((m) => m[1]);
  const faces = families.flatMap((f) => {
    if (!FACES[f]) throw new Error(`seen: ${slug}: no self-hosted copy of ${f}.`);
    return FACES[f];
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
  html = swap(html, /(<meta name="description" content="[^"]*">\n)/, (m) => `${m}${head}\n`, 'the meta description', slug);

  /* Colophon: the series links and the making-of line. */
  const at = (SEEN_CHAIN as readonly string[]).indexOf(slug);
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

  return html.replace(/^<!DOCTYPE html>\n/i, '');
}
