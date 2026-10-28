/**
 * Renders the share image (public/og.png, 1200x630) and the PNG icons
 * (public/favicon-32.png, public/apple-touch-icon.png) in the museum style
 * with Playwright. The zodiac ring is lifted from the built homepage, so run
 * after a build:  npm run og
 *
 * Needs a local Chromium (Playwright's, or set CHROMIUM_PATH).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Inlined as data URIs: a page set from a string cannot load file:// fonts.
const font = (f) => `data:font/woff2;base64,${readFileSync(resolve(root, 'public/fonts', f)).toString('base64')}`;

const html = readFileSync(resolve(root, 'dist/index.html'), 'utf8');
const ring = html.match(/<svg class="ring__svg[\s\S]*?<\/svg>/)?.[0];
if (!ring) throw new Error('Zodiac ring not found in dist/index.html. Run `astro build` first.');

const grain =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.42 0 0 0 0 0.36 0 0 0 0 0.27 0 0 0 0.22 0'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)'/%3E%3C/svg%3E\")";

const meander =
  '<svg width="100%" height="18"><defs><pattern id="k" width="24" height="18" patternUnits="userSpaceOnUse"><path d="M0 16.5H22.5V1.5H4.5V12.5H16.5V5.5H10.5V9.5M22.5 16.5H24" fill="none" stroke="#b08a43" stroke-width="1.2"/></pattern></defs><rect width="100%" height="18" fill="url(#k)"/></svg>';

const fonts = `
  @font-face { font-family: 'Cormorant Garamond'; font-weight: 300; src: url('${font('cormorant-garamond-latin-300-normal.woff2')}'); }
  @font-face { font-family: 'Cormorant Garamond'; font-weight: 500; src: url('${font('cormorant-garamond-latin-500-normal.woff2')}'); }
  @font-face { font-family: 'EB Garamond'; font-weight: 400 800; src: url('${font('eb-garamond-latin-wght-normal.woff2')}'); }
  @font-face { font-family: 'EB Garamond'; font-style: italic; font-weight: 400 800; src: url('${font('eb-garamond-latin-wght-italic.woff2')}'); }
  @font-face { font-family: 'JetBrains Mono'; src: url('${font('jetbrains-mono-var.woff2')}'); }
`;

const og = `<!doctype html><html><head><meta charset="utf-8"><style>
  ${fonts}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; overflow: hidden; background: #f4eee2; color: #1d1b18; font-family: 'EB Garamond', serif; position: relative; }
  body::before { content: ''; position: absolute; inset: 0; background: radial-gradient(70% 90% at 30% 20%, rgba(255,252,244,.85), transparent 70%); }
  body::after { content: ''; position: absolute; inset: 0; background-image: ${grain}; background-size: 220px; opacity: .55; }
  .ring { position: absolute; width: 860px; height: 860px; right: -330px; top: -115px; color: #b08a43; opacity: .62; }
  .ring svg { width: 100%; height: 100%; transform: rotate(-12deg); }
  .frame { position: absolute; inset: 28px; border: 1px solid rgba(176,138,67,.7); }
  .frame::after { content: ''; position: absolute; inset: 6px; border: 1px solid rgba(176,138,67,.35); }
  .copy { position: absolute; left: 92px; top: 84px; width: 760px; z-index: 2; }
  .kicker { font-variant-caps: all-small-caps; letter-spacing: .16em; color: #7a5a1f; font-size: 26px; }
  h1 { font-family: 'Cormorant Garamond', serif; font-weight: 300; font-size: 80px; line-height: 1.02; max-width: 640px; letter-spacing: -.01em; margin-top: 14px; }
  .rule { width: 72px; height: 1px; background: #b08a43; margin: 28px 0 18px; }
  .name { font-family: 'Cormorant Garamond', serif; font-weight: 500; font-size: 34px; letter-spacing: .18em; font-variant-caps: all-small-caps; }
  .roles { font-style: italic; font-size: 22px; white-space: nowrap; color: #46403a; margin-top: 4px; }
  .roles b { font-style: normal; font-weight: 400; color: #b08a43; margin: 0 10px; }
  .band { position: absolute; left: 92px; right: 92px; bottom: 56px; z-index: 2; display: flex; align-items: center; gap: 18px; }
  .band svg { flex: 1; }
  .cat { font-family: 'JetBrains Mono', monospace; font-size: 15px; color: #625b50; letter-spacing: .04em; white-space: nowrap; }
</style></head><body>
  <div class="ring">${ring}</div>
  <div class="frame"></div>
  <div class="copy">
    <p class="kicker">iamwilhelm.com</p>
    <h1>Devoted to something, but no one knows what.</h1>
    <div class="rule"></div>
    <p class="name">Michael Wilhelm</p>
    <p class="roles">CEO &amp; Cofounder, BackGold<b>·</b>Founder, Advancing Liberty Media<b>·</b>Writer</p>
  </div>
  <div class="band">${meander}<span class="cat">The Foyer · I – V</span>${meander}</div>
</body></html>`;

const icon = (size) => `<!doctype html><html><head><meta charset="utf-8"><style>
  ${fonts}
  * { margin: 0; } body { width: ${size}px; height: ${size}px; overflow: hidden; background: transparent; }
</style></head><body>${readFileSync(resolve(root, 'public/favicon.svg'), 'utf8').replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`;

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(og, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
writeFileSync(resolve(root, 'public/og.png'), await page.screenshot({ type: 'png' }));

for (const [size, file] of [
  [32, 'favicon-32.png'],
  [180, 'apple-touch-icon.png'],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(icon(size), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  writeFileSync(resolve(root, 'public', file), await page.screenshot({ type: 'png', omitBackground: true }));
}
await browser.close();
console.log('Wrote public/og.png, public/favicon-32.png, public/apple-touch-icon.png');
