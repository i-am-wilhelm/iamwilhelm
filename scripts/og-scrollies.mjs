/**
 * Renders a share image for every scroll page (everything under /gallery/)
 * from the page itself: the built route is
 * served from dist/, opened at 1200x630 with the canvas running, and the
 * opening frame is screenshotted to public/og/<slug>.jpg (JPEG keeps every
 * card well under the ~300 KB some messaging apps allow for previews). Poem.astro and
 * writings/[slug].astro pick these up by slug, add a content-hash ?v= so
 * a re-render busts share caches, and fall back to /og.png.
 *
 * Run after a build, and again whenever a new scrolly is hung:
 *   npm run og:scrollies
 * Name slugs to render only those, leaving every other card's bytes (and its
 * cache-busting hash) as they are:
 *   npm run og:scrollies -- everyone-searchable
 * The foot (ScrollFoot) and every exit are hidden in the shot by data-og-hide.
 *
 * Needs a local Chromium (Playwright's, or set CHROMIUM_PATH).
 */
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
if (!existsSync(resolve(dist, 'index.html'))) throw new Error('dist/ is missing. Run `astro build` first.');
const out = resolve(root, 'public/og');
mkdirSync(out, { recursive: true });

/* Which routes get a rendered card: every Gallery page (every scroll page
   lives under /gallery/ since the face-lift). Most shoot their hero at the
   full 1200x630. A descent piece (a writings entry with `treatment: descent`
   under the same slug, The Unseen One) is a narrow column on a wide wall, so
   it shoots at 800x420 scaled up (the column fills the card), centred on the
   poem's title movement; `target` is the selector to centre on. Any page can
   instead mark one element data-og-frame to be centred (see below). */
const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
let routes = [];
const descent = (slug) => {
  const md = resolve(root, 'src/content/writings', `${slug}.md`);
  if (!existsSync(md)) return false;
  const fm = readFileSync(md, 'utf8').split('---')[1] || '';
  return /^treatment:\s*descent/m.test(fm);
};
for (const f of readdirSync(resolve(root, 'src/pages/gallery'))) {
  if (f === 'index.astro' || !f.endsWith('.astro')) continue;
  const slug = f.replace(/\.astro$/, '');
  routes.push(
    descent(slug)
      ? { slug, route: `/gallery/${slug}/`, width: 800, settle: 2200, target: '.poem-front, .poem-movement' }
      : { slug, route: `/gallery/${slug}/`, width: 1200, settle: 1600 },
  );
}
if (only.length) {
  const unknown = only.filter((s) => !routes.some((r) => r.slug === s));
  if (unknown.length) throw new Error(`No scroll page for: ${unknown.join(', ')}`);
  routes = routes.filter((r) => only.includes(r.slug));
}

/* A tiny static server over dist/, so fonts and scripts load as they do live. */
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.wasm': 'application/wasm' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = join(dist, p);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
for (const { slug, route, width, settle, target } of routes) {
  const height = Math.round((width * 630) / 1200);
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1200 / width });
  await page.goto(base + route, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  /* A page can name its own card: the element marked data-og-frame is
     centred instead of the opening frame (Where It Was shoots its lyre and
     dike panel), and <html> gets the class `og`, which the page's CSS can
     use to show that frame in its resolved state. */
  const frame = target ?? ((await page.$('[data-og-frame]')) ? '[data-og-frame]' : null);
  if (frame) {
    await page.evaluate((t) => {
      document.documentElement.classList.add('og');
      document.querySelector(t)?.scrollIntoView({ block: 'center' });
    }, frame);
  }
  await page.waitForTimeout(settle);
  /* Hide the fixed exits and rails so the card is the work alone; a page
     marks any other site chrome (a top bar's way back) with data-og-hide. */
  await page.addStyleTag({ content: '.poem-exit, .descent-exit, #rail, .orchestra-pit, .pit-toggle, [data-og-hide] { display: none !important }' });
  await page.waitForTimeout(80);
  writeFileSync(resolve(out, `${slug}.jpg`), await page.screenshot({ type: 'jpeg', quality: 88 }));
  console.log(`wrote public/og/${slug}.jpg  (${route}, ${width}x${height} @${(1200 / width).toFixed(2)}x)`);
  await page.close();
}
await browser.close();
server.close();
