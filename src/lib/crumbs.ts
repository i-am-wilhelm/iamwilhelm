/**
 * Breadcrumbs: where a page sits in the museum, from the foyer down. One
 * trail per page, built here from what the page already knows (its piece,
 * series or tag), so every page and every kind of page says the same
 * thing about where it is.
 *
 *   Foyer / Gallery / Seen / Fall Line           a scroll page in a series
 *   Foyer / Gallery / Elsewhere / Due Space      a scroll page in no series
 *   Foyer / Writings / Readings / Underworld     a reading
 *   Foyer / Gallery / Seen                       a series index (its room: src/config/series.ts)
 *   Foyer / Tags / Gold                          a tag's page
 *   Foyer / Commissions / What is a scrolly?     a page under a room
 *
 * The trail is drawn three ways:
 *
 *   - on the museum pages, a line under the nav (Breadcrumbs.astro, mounted
 *     by Museum.astro from its `crumbs` prop);
 *   - on a scroll page, in the small corner exit that used to read "The
 *     Gallery" (crumbExitHtml: Poem.astro, the descent, and the Seen pages
 *     mounted by src/lib/seen.ts), and again at the foot;
 *   - in the page's JSON-LD, as a BreadcrumbList (breadcrumbSchema).
 *
 * The last crumb is the page itself: it carries no href and is not a link.
 */
import { series as registry, type SeriesId } from '../config/series';
import { tags as tagRegistry, tagHref, type TagId } from '../config/tags';
import { SITE_URL } from '../config/site';
import type { Piece } from './pieces';

export interface Crumb {
  name: string;
  /** Site-root path. Absent on the last crumb, the page itself. */
  href?: string;
}

/**
 * The first crumb on every trail. "Foyer" is the homepage's own name for
 * itself; set `name` to 'Home' for the plainer word everywhere at once.
 */
export const CRUMB_HOME: Crumb = { name: 'Foyer', href: '/' };

/** The rooms and standalone pages a trail can pass through. */
export const CRUMB_ROOMS = {
  gallery: { name: 'Gallery', href: '/gallery/' },
  writings: { name: 'Writings', href: '/writings/' },
  tags: { name: 'Tags', href: '/tags/' },
  search: { name: 'Search', href: '/search/' },
  commissions: { name: 'Commissions', href: '/services/' },
} as const satisfies Record<string, Crumb>;

/** The Gallery's wall for pieces in no series (PoemGallery: #wall-elsewhere). */
export const CRUMB_ELSEWHERE: Crumb = { name: 'Elsewhere', href: '/gallery/#wall-elsewhere' };

/** A page under the foyer: trail('Commissions') or trail(CRUMB_ROOMS.commissions, 'What is a scrolly?'). */
export function trail(...steps: (Crumb | string)[]): Crumb[] {
  return [CRUMB_HOME, ...steps.map((s) => (typeof s === 'string' ? { name: s } : s))];
}

/** The series' own crumb, linking to its index. */
export function seriesCrumb(id: SeriesId): Crumb {
  return { name: registry[id].name, href: registry[id].href };
}

/** Foyer / <room> / <series>: the series index. */
export function seriesTrail(id: SeriesId): Crumb[] {
  return trail(CRUMB_ROOMS[registry[id].room], registry[id].name);
}

/** Foyer / Gallery / <series or Elsewhere> / <title>, or Foyer / Writings / <series> / <title>. */
export function pieceTrail(p: Pick<Piece, 'kind' | 'series' | 'title'>): Crumb[] {
  const room = p.kind === 'scroll' ? CRUMB_ROOMS.gallery : CRUMB_ROOMS.writings;
  const shelf = p.series ? seriesCrumb(p.series) : p.kind === 'scroll' ? CRUMB_ELSEWHERE : undefined;
  return trail(room, ...(shelf ? [shelf] : []), p.title);
}

/** The plain-text twin sits under its scroll page. */
export function twinTrail(p: Pick<Piece, 'kind' | 'series' | 'title' | 'path'>): Crumb[] {
  const t = pieceTrail(p);
  t[t.length - 1] = { name: p.title, href: p.path };
  return [...t, { name: 'Plain text' }];
}

/** Foyer / Tags / <label>. */
export function tagTrail(id: TagId): Crumb[] {
  return trail(CRUMB_ROOMS.tags, tagRegistry[id].label);
}

const abs = (href: string) => new URL(href, SITE_URL).href;

/** The trail as a schema.org BreadcrumbList node, for a page's JSON-LD @graph. */
export function breadcrumbSchema(crumbs: Crumb[], pageUrl: string): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl.replace(/#.*$/, '')}#breadcrumb`,
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: c.href ? abs(c.href) : pageUrl,
    })),
  };
}

/** A whole JSON-LD script for a page that writes its own head (the Seen and Futurist mounts). */
export function breadcrumbScript(crumbs: Crumb[], pageUrl: string): string {
  const node = { '@context': 'https://schema.org', ...breadcrumbSchema(crumbs, pageUrl) };
  return `<script type="application/ld+json">${JSON.stringify(node).replace(/</g, '\\u003c')}</script>`;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ---- The corner exit on a scroll page ---------------------------------- */

export interface CrumbExitOptions {
  /**
   * `compact`: the whole trail while the page opens, then only the step up
   * ("← Seen") once the reader is under way; the whole trail comes back on
   * hover and focus. For the pages that always had a corner exit.
   * `top`: the whole trail while the page opens, gone once the reader is
   * under way, back near the top and on focus. For pages whose own controls
   * use the top of the screen as they scroll (the Seen batch).
   */
  mode: 'compact' | 'top';
  /** Classes that dress the exit: `poem-exit`, `descent-exit`, or `crumb-exit--museum` (a neutral corner chip). */
  className?: string;
  /** For the neutral chip: which top corner. */
  side?: 'left' | 'right';
  /** For the neutral chip: dark glass (the default), or ivory for a light page. */
  tone?: 'dark' | 'light';
}

/** The trail as the scroll pages' corner exit. One <nav>; the page itself is named for screen readers only. */
export function crumbExitHtml(crumbs: Crumb[], { mode, className = 'crumb-exit--museum', side = 'left', tone = 'dark' }: CrumbExitOptions): string {
  const items = crumbs.map((c, i) =>
    c.href && i < crumbs.length - 1
      ? `<li><a href="${esc(c.href)}">${esc(c.name)}</a></li>`
      : `<li class="crumb-exit__here" aria-current="page">${esc(c.name)}</li>`,
  );
  const chip = className.includes('crumb-exit--museum');
  const sideClass = chip && side === 'right' ? ' crumb-exit--right' : '';
  const toneClass = chip && tone === 'light' ? ' crumb-exit--light' : '';
  return (
    `<nav class="crumb-exit ${esc(className)}${sideClass}${toneClass}" aria-label="Breadcrumb" data-crumb-exit="${mode}" data-og-hide data-twin-skip>` +
    `<ol class="crumb-exit__list">${items.join('')}</ol></nav>`
  );
}

/**
 * The exit's own rules: the list, the separators, the two modes, and the
 * neutral chip. A skin class (`poem-exit`, `descent-exit`) keeps its own
 * position, face and colours from the page.
 */
export const CRUMB_EXIT_CSS = `
.crumb-exit .crumb-exit__list{list-style:none;margin:0;padding:0;display:flex;align-items:center;gap:.6em;white-space:nowrap}
.crumb-exit .crumb-exit__list li{display:flex;align-items:center;gap:.6em;margin:0;padding:0;list-style:none}
.crumb-exit .crumb-exit__list li+li::before{content:"/";opacity:.5}
@supports (content:"x"/""){.crumb-exit .crumb-exit__list li+li::before{content:"/"/""}}
.crumb-exit a{color:inherit;text-decoration:none;background:none;border:0;padding:0}
.crumb-exit a:hover,.crumb-exit a:focus-visible{text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:.3em}
.crumb-exit .crumb-exit__here{position:absolute!important;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.crumb-exit[data-crumb-exit=compact].is-away:not(:hover):not(:focus-within) li:not(.crumb-exit__here):not(:nth-last-child(2)){display:none}
.crumb-exit[data-crumb-exit=compact].is-away:not(:hover):not(:focus-within) li:nth-last-child(2)::before{content:none}
.crumb-exit[data-crumb-exit=compact].is-away:not(:hover):not(:focus-within) li:nth-last-child(2) a::before{content:"\\2190\\00a0\\00a0"}
@supports (content:"x"/""){.crumb-exit[data-crumb-exit=compact].is-away:not(:hover):not(:focus-within) li:nth-last-child(2) a::before{content:"\\2190\\00a0\\00a0"/""}}
.crumb-exit[data-crumb-exit=top]{transition:opacity .45s ease,visibility 0s linear 0s}
.crumb-exit[data-crumb-exit=top].is-away:not(:focus-within){opacity:0;visibility:hidden;transition:opacity .45s ease,visibility 0s linear .45s}
.crumb-exit--museum{position:fixed;z-index:40;top:max(14px,env(safe-area-inset-top,0px));left:max(16px,env(safe-area-inset-left,0px));box-sizing:border-box;max-width:calc(100vw - 32px);margin:0;padding:.55rem .8rem;font:500 .68rem/1.2 ui-monospace,'SFMono-Regular','IBM Plex Mono',Menlo,Consolas,monospace;letter-spacing:.16em;text-transform:uppercase;color:#f4eee2;background:rgba(17,15,13,.7);border:1px solid rgba(244,238,226,.26);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.crumb-exit--museum.crumb-exit--right{left:auto;right:max(16px,env(safe-area-inset-right,0px))}
.crumb-exit--museum.crumb-exit--light{color:#1d1b18;background:rgba(244,238,226,.82);border-color:rgba(29,27,24,.22)}
.crumb-exit--museum.crumb-exit--light:hover,.crumb-exit--museum.crumb-exit--light:focus-within{border-color:rgba(29,27,24,.5)}
.crumb-exit--museum.crumb-exit--light a:focus-visible{outline-color:#7a5a1f}
.crumb-exit--museum:hover,.crumb-exit--museum:focus-within{border-color:rgba(244,238,226,.6)}
.crumb-exit--museum a:focus-visible{outline:2px solid #c9a45c;outline-offset:3px}
@media (max-width:420px){.crumb-exit .crumb-exit__list,.crumb-exit .crumb-exit__list li{gap:.45em}.crumb-exit--museum{letter-spacing:.1em;padding:.5rem .65rem}}
@media (prefers-reduced-motion:reduce){.crumb-exit{transition:none!important}}
@media print{.crumb-exit{display:none!important}}
`;

/** Marks the exit `is-away` once the reader is under way (a third of a screen down). */
export const CRUMB_EXIT_JS = `(function(){var n=document.querySelector('[data-crumb-exit]');if(!n)return;var f=0;function t(){f=0;var y=window.scrollY||document.documentElement.scrollTop||0;n.classList.toggle('is-away',y>Math.min(260,window.innerHeight*.3))}addEventListener('scroll',function(){if(!f)f=requestAnimationFrame(t)},{passive:true});t()})();`;

/* ---- The foot of a Seen page ------------------------------------------ */

/**
 * The end of a mounted Seen page, after its own colophon: the trail, the
 * piece's tags, the pieces filed near it, and the way to search. The Poem
 * and Futurist pages carry the same lines in ScrollFoot.
 */
export function crumbFootHtml(p: Pick<Piece, 'kind' | 'series' | 'title' | 'tags'>, near: Pick<Piece, 'title' | 'path'>[]): string {
  const crumbs = pieceTrail(p);
  const trailItems = crumbs.map((c, i) =>
    c.href && i < crumbs.length - 1 ? `<li><a href="${esc(c.href)}">${esc(c.name)}</a></li>` : `<li aria-current="page">${esc(c.name)}</li>`,
  );
  const tagLinks = p.tags.map((t) => `<a href="${tagHref(t)}">${esc(tagRegistry[t].label)}</a>`);
  const nearLinks = near.map((q) => `<a href="${esc(q.path)}"><i>${esc(q.title)}</i></a>`);
  return [
    `<aside class="crumb-foot" aria-label="Where this piece is filed" data-og-hide data-twin-skip>`,
    `<nav class="crumb-foot__trail" aria-label="Breadcrumb"><ol>${trailItems.join('')}</ol></nav>`,
    tagLinks.length ? `<p class="crumb-foot__line"><span class="crumb-foot__k">Filed under</span> ${tagLinks.join('<span class="crumb-foot__dot" aria-hidden="true"> &middot; </span>')}</p>` : '',
    nearLinks.length ? `<p class="crumb-foot__line"><span class="crumb-foot__k">Filed near</span> ${nearLinks.join('<span class="crumb-foot__dot" aria-hidden="true"> &middot; </span>')}</p>` : '',
    `<p class="crumb-foot__line"><a href="/search/">Search the collection</a><span class="crumb-foot__dot" aria-hidden="true"> &middot; </span><a href="/tags/">Every tag</a><span class="crumb-foot__dot" aria-hidden="true"> &middot; </span><a href="/#welcome">The front door</a></p>`,
    `</aside>`,
  ].join('');
}

/** The foot's rules: it takes the page's own colour and text face, like ScrollFoot. */
export const CRUMB_FOOT_CSS = `
.crumb-foot{position:relative;z-index:2;box-sizing:border-box;max-width:44rem;margin:0 auto;padding:2.25rem max(1.25rem,env(safe-area-inset-left,0px)) calc(2.75rem + env(safe-area-inset-bottom,0px));font-size:.95rem;line-height:1.6;color:inherit;text-align:left}
.crumb-foot *{box-sizing:border-box}
.crumb-foot::before{content:"";display:block;height:1px;margin-bottom:1.5rem;background:currentColor;opacity:.2}
.crumb-foot ol{list-style:none;margin:0 0 .9rem;padding:0;display:flex;flex-wrap:wrap;gap:.2em .6em;font:500 .7rem/1.5 ui-monospace,'SFMono-Regular','IBM Plex Mono',Menlo,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase}
.crumb-foot ol li{margin:0;padding:0;list-style:none}
.crumb-foot ol li+li::before{content:"/";margin-right:.6em;opacity:.5}
@supports (content:"x"/""){.crumb-foot ol li+li::before{content:"/"/""}}
.crumb-foot ol li[aria-current]{opacity:.7}
.crumb-foot__line{margin:.35rem 0;padding:0}
.crumb-foot__k{display:inline-block;margin-right:.7em;font:500 .68rem/1 ui-monospace,'SFMono-Regular','IBM Plex Mono',Menlo,Consolas,monospace;letter-spacing:.16em;text-transform:uppercase;opacity:.7}
.crumb-foot a{color:inherit;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:.22em;text-decoration-color:color-mix(in srgb,currentColor 40%,transparent)}
.crumb-foot a:hover,.crumb-foot a:focus-visible{text-decoration-color:currentColor}
.crumb-foot__dot{opacity:.5}
@media print{.crumb-foot{display:none!important}}
`;

/* ---- Inline, in a page's own bottom line ------------------------------- */

/** The trail set into a line of the page's own (the Snowflake Machine's foot). */
export function crumbInlineHtml(crumbs: Crumb[]): string {
  const items = crumbs.map((c, i) =>
    c.href && i < crumbs.length - 1
      ? `<li><a href="${esc(c.href)}">${esc(c.name)}</a></li>`
      : `<li class="crumb-exit__here" aria-current="page">${esc(c.name)}</li>`,
  );
  return `<nav class="crumb-inline" aria-label="Breadcrumb" data-og-hide data-twin-skip><ol>${items.join('')}</ol></nav> `;
}

export const CRUMB_INLINE_CSS = `
.crumb-inline{display:inline-block;margin:0 .9em 0 0;vertical-align:baseline}
.crumb-inline ol{list-style:none;display:inline-flex;flex-wrap:wrap;gap:.1em .5em;margin:0;padding:0}
.crumb-inline li{display:inline;margin:0;padding:0;list-style:none}
.crumb-inline li+li::before{content:"/";margin-right:.5em;opacity:.55}
@supports (content:"x"/""){.crumb-inline li+li::before{content:"/"/""}}
.crumb-inline a{color:inherit;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:.2em}
.crumb-inline .crumb-exit__here{position:absolute!important;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.exhibit .crumb-inline{display:none}
`;
