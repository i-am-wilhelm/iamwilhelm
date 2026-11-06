/**
 * Renders a share image for every scroll page (the Gallery pieces and the
 * descent-treatment writings) from the page itself: the built route is
 * served from dist/, opened at 1200x630 with the canvas running, and the
 * opening frame is screenshotted to public/og/<slug>.png. Poem.astro and
 * writings/[slug].astro pick these up by slug and fall back to /og.png.
 *
 * Run after a build, and again whenever a new scrolly is hung:
 *   npm run og:scrollies
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

/* Which routes get a rendered card: every Gallery page, plus every writing
   staged with the descent treatment. Gallery pages shoot their hero at the
   full 1200x630. Descent pieces are a narrow column on a wide wall, so they
   shoot at 800x420 scaled up (the column fills the card), centred on the
   poem's title movement; `target` is the selector to centre on. */
const routes = [];
for (const f of readdirSync(resolve(root, 'src/pages/gallery'))) {
  if (f === 'index.astro' || !f.endsWith('.astro')) continue;
  const slug = f.replace(/\.astro$/, '');
  routes.push({ slug, route: `/gallery/${slug}/`, width: 1200, settle: 1600 });
}
for (const f of readdirSync(resolve(root, 'src/content/writings'))) {
  if (!f.endsWith('.md')) continue;
  const fm = readFileSync(resolve(root, 'src/content/writings', f), 'utf8').split('---')[1] || '';
  if (/^treatment:\s*descent/m.test(fm) && !/^draft:\s*true/m.test(fm)) {
    const slug = f.replace(/\.md$/, '');
    routes.push({ slug, route: `/writings/${slug}/`, width: 800, settle: 2200, target: '.poem-front, .poem-movement' });
  }
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
  if (target) await page.evaluate((t) => document.querySelector(t)?.scrollIntoView({ block: 'center' }), target);
  await page.waitForTimeout(settle);
  /* Hide the fixed exits and rails so the card is the work alone. */
  await page.addStyleTag({ content: '.poem-exit, .descent-exit, #rail, .orchestra-pit, .pit-toggle { display: none !important }' });
  await page.waitForTimeout(80);
  writeFileSync(resolve(out, `${slug}.png`), await page.screenshot({ type: 'png' }));
  console.log(`wrote public/og/${slug}.png  (${route}, ${width}x${height} @${(1200 / width).toFixed(2)}x)`);
  await page.close();
}
await browser.close();
server.close();
