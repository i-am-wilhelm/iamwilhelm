/**
 * Horoskopos share links, server side. Crawlers do not run scripts, so what
 * a pasted link unfurls into has to be worked out here.
 *
 * Routes (all read the one share state, ?c=<chart>&m=<module>&f=<focus>&p=<privacy>):
 *   GET /gallery/horoskopos/?…        the engine page, with its Open Graph and Twitter tags
 *                                     rewritten for this share and an oEmbed discovery link
 *   GET /api/horoskopos/card.png?…    the share's 1200x630 card (also &size=feed|story)
 *   GET /api/horoskopos/card.svg?…    the same card as SVG
 *   GET /api/horoskopos/oembed?url=…  oEmbed (JSON): the iframe for any Horoskopos share URL
 *
 * The card is laid out by the same registry card data and the same layout
 * code as the browser's canvas card (src/scripts/horoskopos/share/cards.ts),
 * written as SVG (paint-svg.ts) and rasterised to PNG with resvg, compiled
 * to WebAssembly and bundled with the Worker: no outside service is called.
 * The chart on a card is drawn by the engine's own drawing code into an SVG
 * recorder. Text is set in the site's Literata and IBM Plex Mono, read from
 * the static assets.
 *
 * A link carries computed chart positions and nothing a chart was cast
 * from. Even so, the chart codes are kept out of what this Worker leaves
 * behind: nothing here logs a URL or a code, invocation logs are off in
 * the wrangler configs, and the card cache is keyed by a hash of the share
 * state, never by the state itself.
 */
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
// The engine, written as a module by scripts/horoskopos-engine-module.mjs at the start of every build.
import { natal as engine } from './gen/horoskopos-engine.js';
import { estimate, layoutCard, sizeById } from '../src/scripts/horoskopos/share/cards.ts';
import { toEngineChart, type Natal } from '../src/scripts/horoskopos/share/engine.ts';
import { paintSvg } from '../src/scripts/horoskopos/share/paint-svg.ts';
import { REGISTRY, derive, type CardData, type Content } from '../src/scripts/horoskopos/share/registry.ts';
import { EMBED_PATH, OEMBED_PATH, OG_PATH, SHARE_PATH, chartsOf, embedUrl, levelOf, parseShare, shareQuery, type ShareState } from '../src/scripts/horoskopos/share/state.ts';

const natal = engine as Natal;

/** Bump when the card's look or wording changes: it is part of every card URL and cache key, so previews refresh. */
const CARD_REV = '1';
const SHARE_ROUTE = /^\/gallery\/horoskopos\/?$/;
const EMBED_ROUTE = /^\/horoskopos\/embed\/?$/;
const FONTS = ['literata-latin-opsz-normal', 'literata-latin-ext-opsz-normal', 'literata-greek-opsz-normal', 'literata-greek-ext-opsz-normal', 'literata-latin-opsz-italic', 'ibm-plex-mono-latin-500-normal', 'ibm-plex-mono-latin-600-normal'];

interface Assets { fetch(input: Request | string): Promise<Response> }
interface Ctx { waitUntil(p: Promise<unknown>): void }

export const isHoroskoposShare = (url: URL) => SHARE_ROUTE.test(url.pathname) && url.searchParams.has('m');
export const isHoroskoposApi = (url: URL) => url.pathname.startsWith('/api/horoskopos/');

/** The share a URL carries, derived: its module's content and card. Null when it is not a readable share. */
function read(st: ShareState, size = 'wide'): { content: Content; card: CardData; svg: string } | null {
  const m = REGISTRY[st.m];
  if (!m) return null;
  let outs;
  try { outs = chartsOf(st); } catch { return null; }
  const charts = outs.map(toEngineChart), dims = sizeById(size);
  let svg = '', card: CardData | null = null;
  const d = derive(natal, st.m, st.f, charts, levelOf(st, outs), (content) => {
    card = m.card(content, 0);
    svg = paintSvg(layoutCard(card, dims, estimate, { latinGreekOnly: true }), dims, (ctx, w, h) => natal.paint(ctx, w, h, 2.4));
  });
  return d.ok && card ? { content: d.content, card, svg } : null;
}

async function sha(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
}
/** The daily read changes with the date, so the date is part of what identifies its card. */
const dayKey = (st: ShareState) => (st.m === 'daily' ? new Date().toISOString().slice(0, 10) : '');
const secondsLeftToday = () => { const now = new Date(); return Math.max(60, Math.ceil((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime()) / 1000)); };

let ready: Promise<Uint8Array[]> | null = null;
/** The rasteriser and its fonts, set up once per isolate. */
function setup(assets: Assets, origin: string): Promise<Uint8Array[]> {
  if (!ready) {
    ready = (async () => {
      await initWasm(resvgWasm);
      return Promise.all(FONTS.map(async (f) => {
        const r = await assets.fetch(`${origin}/fonts/${f}.woff2`);
        if (!r.ok) throw new Error(`font ${f}: ${r.status}`);
        return new Uint8Array(await r.arrayBuffer());
      }));
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

async function cardResponse(request: Request, url: URL, assets: Assets, ctx: Ctx): Promise<Response> {
  const st = parseShare(url.searchParams), wantSvg = url.pathname.endsWith('.svg');
  if (!st) return new Response('not a share', { status: 400 });
  const size = sizeById(url.searchParams.get('size') || 'wide').id, day = dayKey(st);
  /* Cached by a hash of the share state. The key is a made-up URL holding only the hash. */
  const key = new Request(`${url.origin}/api/horoskopos/cache/${await sha(`${CARD_REV}|${size}|${day}|${shareQuery(st)}`)}.${wantSvg ? 'svg' : 'png'}`);
  const cache = (caches as unknown as { default: Cache }).default;
  const hit = await cache.match(key);
  if (hit) return hit;
  const got = read(st, size);
  if (!got) return new Response('this share could not be read', { status: 404 });
  const headers = {
    'Content-Type': wantSvg ? 'image/svg+xml; charset=utf-8' : 'image/png',
    'Cache-Control': day ? `public, max-age=${secondsLeftToday()}` : 'public, max-age=31536000, immutable',
    'X-Robots-Tag': 'noindex',
  };
  let body: BodyInit = got.svg;
  if (!wantSvg) {
    const fontBuffers = await setup(assets, url.origin);
    const r = new Resvg(got.svg, { font: { fontBuffers, loadSystemFonts: false, defaultFontFamily: 'Literata' } });
    const img = r.render();
    body = img.asPng();
    img.free(); r.free();
  }
  const res = new Response(body, { headers });
  if (request.method === 'GET') ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).replace(/[\s,;:.]+\S*$/, '') + '…' : s);

/** Title and description of a share, for unfurl tags and oEmbed. */
function describe(c: Content, card: CardData): { title: string; description: string } {
  const title = `${card.title}${c.owner && !card.title.includes(c.owner) ? `, ${c.owner}` : ''} · ${card.kicker} · Horoskopos`;
  const line = card.line ? card.line.text : c.paras[0] || '';
  return { title: clip(title, 110), description: clip(line || 'A view from Horoskopos, the chart engine.', 200) };
}

function cardUrl(origin: string, st: ShareState): string {
  const day = dayKey(st);
  return `${origin}${OG_PATH}?${shareQuery(st)}&v=${CARD_REV}${day ? `&d=${day}` : ''}`;
}

/** The engine page for a share link: the page as built, with this share's preview tags in its head. */
async function sharePage(request: Request, url: URL, assets: Assets): Promise<Response> {
  const page = await assets.fetch(request);
  const st = parseShare(url.searchParams);
  if (!st || !(page.headers.get('Content-Type') || '').includes('text/html')) return page;
  const got = read(st);
  if (!got) return page; // unreadable: the page itself says so to the visitor
  const { title, description } = describe(got.content, got.card);
  const self = `${url.origin}${SHARE_PATH}?${shareQuery(st)}`, image = cardUrl(url.origin, st);
  const set = (value: string) => ({ element(el: Element) { el.setAttribute('content', value); } });
  const out = new HTMLRewriter()
    .on('title', { element(el) { el.setInnerContent(title); } })
    .on('meta[name="description"]', set(description))
    .on('meta[property="og:title"]', set(title))
    .on('meta[property="og:description"]', set(description))
    .on('meta[property="og:url"]', set(self))
    .on('meta[property="og:image"]', set(image))
    .on('meta[name="twitter:title"]', set(title))
    .on('meta[name="twitter:description"]', set(description))
    .on('meta[name="twitter:image"]', set(image))
    .on('head', {
      element(el) {
        const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
        el.append(`<meta property="og:image:alt" content="${esc(title)}"><meta name="robots" content="noindex, follow"><link rel="alternate" type="application/json+oembed" href="${esc(`${url.origin}${OEMBED_PATH}?url=${encodeURIComponent(self)}&format=json`)}" title="${esc(title)}">`, { html: true });
      },
    })
    .transform(page);
  const res = new Response(out.body, out);
  /* A share URL holds a chart code: keep it out of search indexes and shared caches. The canonical stays the engine page. */
  res.headers.set('X-Robots-Tag', 'noindex');
  res.headers.set('Cache-Control', 'private, no-cache');
  res.headers.delete('ETag');
  return res;
}

function oembed(url: URL): Response {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=3600', 'X-Robots-Tag': 'noindex' } });
  if ((url.searchParams.get('format') || 'json') !== 'json') return json({ error: 'Only format=json is offered.' }, 501);
  let target: URL;
  try { target = new URL(url.searchParams.get('url') || ''); } catch { return json({ error: 'Give a Horoskopos share URL in ?url=.' }, 400); }
  const ours = target.hostname === url.hostname || /^(www\.)?iamwilhelm\.com$/.test(target.hostname);
  if (!ours || !(SHARE_ROUTE.test(target.pathname) || EMBED_ROUTE.test(target.pathname))) return json({ error: 'Not a Horoskopos share URL.' }, 404);
  /* An embed URL with no view named is the daily read. */
  const st = parseShare(target.searchParams) || (EMBED_ROUTE.test(target.pathname) ? ({ m: 'daily', f: '', p: 'full' } as ShareState) : null);
  const got = st && read(st);
  if (!st || !got) return json({ error: 'That share could not be read.' }, 404);
  const max = (k: string, d: number, lo: number) => { const v = parseInt(url.searchParams.get(k) || '', 10); return Number.isFinite(v) ? Math.max(lo, Math.min(d, v)) : d; };
  const width = max('maxwidth', 640, 240), height = max('maxheight', got.content.chart ? 760 : 560, 200);
  const { title } = describe(got.content, got.card);
  const theme = target.searchParams.get('theme') === 'light' ? 'light' : 'dark';
  const src = embedUrl(st, { theme }, url.origin).replace(/&/g, '&amp;');
  return json({
    version: '1.0', type: 'rich', title, author_name: 'Michael Wilhelm', author_url: `${url.origin}/`,
    provider_name: 'Horoskopos', provider_url: `${url.origin}${SHARE_PATH}`, cache_age: st.m === 'daily' ? 3600 : 86400,
    html: `<iframe src="${src}" width="${width}" height="${height}" style="border:0;max-width:100%" loading="lazy" title="${title.replace(/"/g, '&quot;')}"></iframe>`,
    width, height, thumbnail_url: cardUrl(url.origin, st), thumbnail_width: 1200, thumbnail_height: 630,
  });
}

/** Answer a Horoskopos share request. Called only for the routes isHoroskoposShare and isHoroskoposApi match. */
export async function horoskopos(request: Request, assets: Assets, ctx: Ctx): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  try {
    if (SHARE_ROUTE.test(url.pathname)) return await sharePage(request, url, assets);
    if (url.pathname === OG_PATH || url.pathname === OG_PATH.replace(/\.png$/, '.svg')) return await cardResponse(request, url, assets, ctx);
    if (url.pathname === OEMBED_PATH) return oembed(url);
  } catch {
    /* Say nothing of the request in the log: a share URL holds a chart code. */
    console.error('horoskopos: a share request failed');
    return SHARE_ROUTE.test(url.pathname) ? assets.fetch(request) : new Response('the share could not be drawn', { status: 500 });
  }
  return new Response('not found', { status: 404 });
}

export { EMBED_PATH };
