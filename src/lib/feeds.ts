/**
 * RSS 2.0 and Atom builders for the site feed (/rss.xml, /atom.xml) and the
 * per-series feeds (/writings/<series>/rss.xml). Hand-rolled: two small
 * templates, no dependency. A reading carries its full text (the markdown
 * rendered by the content layer); a scroll page carries its summary and a
 * link, since the page is the piece. Every item names its author
 * (dc:creator in RSS, <author> in Atom).
 *
 * Both name /feed.css in an xml-stylesheet instruction, so a person who
 * opens a feed in a browser sees a readable page in place of the markup
 * (public/feed.css; CSS, since Chrome stops running XSLT in November 2026).
 * Feed readers ignore it. For that page to read cleanly, an RSS item's
 * <description> is always the plain summary, and any HTML (a reading's
 * full text, a scroll page's summary and link) travels in content:encoded,
 * which readers prefer when both are present.
 */
import { SITE_NAME, SITE_URL } from '../config/site';
import type { Piece } from './pieces';

export interface FeedSpec {
  title: string;
  description: string;
  /** The HTML page the feed describes. */
  home: string;
  /** This feed's own absolute URL. */
  self: string;
  items: Piece[];
}

/** The stylesheet a browser applies when a person opens a feed. */
const STYLE = '<?xml-stylesheet type="text/css" href="/feed.css"?>';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Absolute URLs inside rendered HTML, so a reader away from the site resolves them. */
const absolutize = (html: string) =>
  html.replace(/(href|src)="\/(?!\/)/g, `$1="${SITE_URL}/`);

function summary(p: Piece): string {
  const bits = [p.label, p.verb].filter(Boolean).join(' · ');
  return [p.description, bits].filter(Boolean).join(' ');
}

/** Full text for a reading, summary and link for a scroll page. */
export function body(p: Piece): { html: string; full: boolean } {
  const rendered = p.kind === 'reading' ? p.writing?.rendered?.html : undefined;
  if (rendered) return { html: absolutize(rendered), full: true };
  const open = p.kind === 'scroll' ? `<p><a href="${esc(p.url)}">Open the page</a></p>` : '';
  return { html: `<p>${esc(summary(p))}</p>${open}`, full: false };
}

export function rss(spec: FeedSpec): string {
  const items = spec.items
    .map((p) => {
      const b = body(p);
      const cats = p.series ? `<category>${esc(p.label!)}</category>` : '';
      const content = `<content:encoded><![CDATA[${b.html.replace(/]]>/g, ']]]]><![CDATA[>')}]]></content:encoded>`;
      return `    <item>
      <title>${esc(p.title)}</title>
      <link>${esc(p.url)}</link>
      <guid isPermaLink="true">${esc(p.url)}</guid>
      <pubDate>${p.date.toUTCString()}</pubDate>
      <dc:creator>${esc(SITE_NAME)}</dc:creator>
      <description>${esc(summary(p))}</description>
      ${content}${cats}
    </item>`;
    })
    .join('\n');
  const latest = spec.items[0]?.date ?? new Date(0);
  return `<?xml version="1.0" encoding="UTF-8"?>
${STYLE}
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${esc(spec.title)}</title>
    <link>${esc(spec.home)}</link>
    <description>${esc(spec.description)}</description>
    <language>en-us</language>
    <lastBuildDate>${latest.toUTCString()}</lastBuildDate>
    <atom:link href="${esc(spec.self)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
}

export function atom(spec: FeedSpec): string {
  const entries = spec.items
    .map((p) => {
      const b = body(p);
      const cats = p.series ? `<category term="${esc(p.series)}" label="${esc(p.label!)}" />` : '';
      const content = b.full
        ? `<content type="html">${esc(b.html)}</content>`
        : `<content type="html">${esc(b.html)}</content>`;
      return `  <entry>
    <title>${esc(p.title)}</title>
    <link rel="alternate" type="text/html" href="${esc(p.url)}" />
    <id>${esc(p.url)}</id>
    <published>${p.date.toISOString()}</published>
    <updated>${p.date.toISOString()}</updated>
    <author><name>${esc(SITE_NAME)}</name><uri>${esc(SITE_URL)}/</uri></author>
    <summary>${esc(summary(p))}</summary>
    ${content}
    ${cats}
  </entry>`;
    })
    .join('\n');
  const latest = spec.items[0]?.date ?? new Date(0);
  return `<?xml version="1.0" encoding="UTF-8"?>
${STYLE}
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${esc(spec.title)}</title>
  <subtitle>${esc(spec.description)}</subtitle>
  <link rel="alternate" type="text/html" href="${esc(spec.home)}" />
  <link rel="self" type="application/atom+xml" href="${esc(spec.self)}" />
  <id>${esc(spec.home)}</id>
  <updated>${latest.toISOString()}</updated>
  <author><name>${esc(SITE_NAME)}</name><uri>${esc(SITE_URL)}/</uri></author>
${entries}
</feed>
`;
}
