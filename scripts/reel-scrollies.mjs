/**
 * Shoots each scroll page's previews from the page itself, with its words
 * put away, so a preview shows what the piece draws and moves rather than
 * what it says:
 *
 *   public/reel/<slug>/1.jpg … 5.jpg  five stills, 800x420, in the order the
 *                                      page reaches them (the Archive's
 *                                      reading table on the homepage)
 *   public/reel/<slug>/poster.jpg     the strongest of them (a Gallery tile,
 *                                      and the loop's poster)
 *   public/reel/<slug>/loop.mp4       a five-second muted loop, 640x336
 *                                      H.264: the three strongest stretches
 *                                      of the page, scrolled through, cross-
 *                                      faded (a Gallery tile, on hover or in
 *                                      view)
 *
 * How it finds them. The built page is served from dist/ and opened at
 * 1280x672. It is walked top to bottom half a screen at a time; at each
 * step the page settles, its copy is put away, and the frame is scored:
 *
 *   - Copy: all text set below display size is made transparent, and a
 *     run of four words or more takes the card it sits on with it (the
 *     nearest box smaller than the screen that holds no canvas, svg, image
 *     or video of its own, nor any display type). Display type stays: six
 *     words or fewer set at 40px or more, since on these pages that is
 *     often the picture (a Greek word, a gauge's figure, a title set as an
 *     image). Text inside an svg is part of its drawing and stays too.
 *   - Chrome: the exits, the foot, and anything fixed or sticky and small
 *     that carries text or controls (HUDs, top bars, control bars) are
 *     hidden, as is anything marked data-og-hide.
 *   - Score: how much of the frame is drawn rather than ground, how much
 *     colour, how many edges, how much light-to-dark range, less a little
 *     for display type still showing (a frame that is only a title loses
 *     to one that draws), and more for type the frame's edge cuts in half. The five best stills are chosen apart
 *     from one another (a screen and a half apart, and different to the
 *     eye), then put back in page order.
 *
 * The loop records the three best stretches in real time (Chrome's
 * screencast), each a slow scroll through 0.6 of a screen around its
 * still, and joins them with half-second dissolves, faded in and out at
 * the ends so it loops cleanly.
 *
 * Run after a build, for every page or the ones named:
 *   npm run reel
 *   npm run reel -- the-so-called-count cannot-be-uninstalled
 * Needs a local Chromium (Playwright's, or set CHROMIUM_PATH) and ffmpeg on
 * the PATH (or FFMPEG_PATH) for the loop; without ffmpeg the stills and the
 * poster are written and the loop is skipped, with a warning.
 *
 * A page that waits for a hand gets one in ACTS: The Snowflake Machine is
 * drawn on before each shot, so its reel is not an empty canvas, and
 * Horoskopos opens its house chart.
 * A page the scoring reads wrong gets a word in PICKS: `at`, places (in
 * screens from the top) that must be among its stills and lead its loop;
 * `keepWords`, for a page whose words are its picture (a product's screens,
 * a homepage design), which then loses only its chrome.
 */
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const sharp = require('sharp');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
if (!existsSync(resolve(dist, 'index.html'))) throw new Error('dist/ is missing. Run `astro build` first.');

const VIEW = { width: 1280, height: 672 };
const STILL = { width: 800, height: 420 };
const LOOP = { width: 640, height: 336 };
const STILLS = 5;
const STRETCHES = 3;
/** How long a page settles at each step before the shot. */
const SETTLE = 650;
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const hasFfmpeg = spawnSync(FFMPEG, ['-version'], { stdio: 'ignore' }).status === 0;
if (!hasFfmpeg) console.warn(`reel: ffmpeg not found (${FFMPEG}); writing stills and posters only.`);

/** Pages that wait for a hand: what to do before each shot. */
const ACTS = {
  /* The machine opens on "Whose sky?": open the house chart, once. */
  horoskopos: async (page) => {
    const open = page.getByRole('button', { name: /open the house chart/i });
    if (await open.isVisible().catch(() => false)) {
      await open.click();
      await page.waitForTimeout(1500);
    }
  },
  'the-snowflake-machine': async (page) => {
    const c = page.viewportSize();
    const cx = c.width / 2;
    const cy = c.height / 2;
    for (let s = 0; s < 4; s++) {
      const a0 = (s / 4) * Math.PI * 0.9 + 0.2;
      await page.mouse.move(cx + Math.cos(a0) * 40, cy + Math.sin(a0) * 40);
      await page.mouse.down();
      for (let i = 1; i <= 24; i++) {
        const t = i / 24;
        const r = 40 + t * 220;
        const a = a0 + Math.sin(t * Math.PI * 2) * 0.35;
        await page.mouse.move(cx + Math.cos(a) * r, cy + Math.sin(a) * r, { steps: 2 });
      }
      await page.mouse.up();
    }
  },
};

/** Where the scoring needs a word from an editor. */
const PICKS = {
  'backgold-scrolly': { keepWords: true },
  'lla-scrolly-homepage': { keepWords: true },
  /* A receipt is its printed lines. */
  'the-receipts': { keepWords: true },
  /* The meteor over the title is the piece; the panels below read empty without their words. */
  'depth-chart': { at: [0] },
  /* The title over its swirl of numbers; the panels below are mostly words. */
  'quantum-banking': { at: [0] },
  /* The field of glyphs that resolves into the vase and the faces. */
  'the-double-image': { at: [4.5] },
};

/* ---- which pages --------------------------------------------------------- */
const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
let slugs = readdirSync(resolve(root, 'src/pages/gallery'))
  .filter((f) => f.endsWith('.astro') && f !== 'index.astro')
  .map((f) => f.replace(/\.astro$/, ''));
if (only.length) {
  const unknown = only.filter((s) => !slugs.includes(s));
  if (unknown.length) throw new Error(`No scroll page for: ${unknown.join(', ')}`);
  slugs = slugs.filter((s) => only.includes(s));
}

/* ---- a tiny static server over dist/ ------------------------------------ */
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.wasm': 'application/wasm' };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = join(dist, p);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

/* ---- in the page: put the words away ------------------------------------ */
const HIDE_CSS = `
.poem-exit,.descent-exit,.crumb-exit,.crumb-inline,.crumb-foot,.scroll-foot,#rail,.orchestra-pit,.pit-toggle,[data-og-hide]{display:none!important}
.__reel-hide{visibility:hidden!important}
.__reel-mute{color:transparent!important;text-shadow:none!important;-webkit-text-stroke:0!important;caret-color:transparent!important}
.__reel-mute::placeholder{color:transparent!important}
html{scrollbar-width:none!important}::-webkit-scrollbar{display:none!important}
*{cursor:none!important}`;

/** Runs in the page: hides copy and chrome; returns the share of the screen still showing text, and whether any of it is cut by the screen's edge. */
function putWordsAway(keepWords = false) {
  const vw = innerWidth;
  const vh = innerHeight;
  const VISUAL = 'canvas,svg,img,video,picture,iframe';
  const heavy = (el) =>
    [...el.querySelectorAll(VISUAL)].some((v) => {
      const r = v.getBoundingClientRect();
      return r.width * r.height > 140 * 100;
    }) || (el.matches?.(VISUAL) ?? false);
  const skip = (el) => !el || el.closest('svg,canvas,script,style,noscript,template,title,.__reel-hide');
  const display = (el, words) => words <= 6 && parseFloat(getComputedStyle(el).fontSize) >= 40;
  const holdsDisplay = (el) =>
    [...el.querySelectorAll('*')].some((c) => {
      const t = (c.textContent || '').trim();
      return t && c.children.length === 0 && display(c, (t.match(/\S+/g) || []).length);
    });
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const done = new Set();
  for (let n = keepWords ? null : walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (skip(el) || done.has(el)) continue;
    const t = n.nodeValue.trim();
    if (!t) continue;
    const words = (t.match(/\S+/g) || []).length;
    if (display(el, words)) continue;
    done.add(el);
    el.classList.add('__reel-mute');
    if (words < 4 && t.length < 28) continue;
    if (heavy(el)) continue;
    /* Climb to the card the words sit on: the largest box short of a stage or a page column. */
    let card = el;
    while (card.parentElement && card.parentElement !== document.body) {
      const p = card.parentElement;
      const r = p.getBoundingClientRect();
      if (r.width > vw * 0.72 || r.height > vh * 0.92 || heavy(p) || holdsDisplay(p)) break;
      card = p;
    }
    const r = card.getBoundingClientRect();
    if (r.width <= vw * 0.72 && r.height <= vh * 0.92 && !holdsDisplay(card)) card.classList.add('__reel-hide');
  }
  /* Small fixed or sticky chrome that carries words or controls: HUDs, top
     bars, control bars. Not a small fixed or sticky picture (a chart wheel). */
  for (const el of document.body.querySelectorAll('*')) {
    if (el.classList.contains('__reel-hide')) continue;
    const pos = getComputedStyle(el).position;
    if (pos !== 'fixed' && pos !== 'sticky') continue;
    const r = el.getBoundingClientRect();
    if (r.width * r.height > vw * vh * 0.3 || heavy(el)) continue;
    if ((el.textContent || '').trim().length > 1 || el.querySelector('button,input,select,a')) el.classList.add('__reel-hide');
  }
  /* What text still shows, as a share of the screen, and whether the screen's edge cuts any. */
  let area = 0;
  let cut = false;
  const w2 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w2.nextNode(); n; n = w2.nextNode()) {
    const el = n.parentElement;
    if (!el || !n.nodeValue.trim() || el.closest('.__reel-hide,.__reel-mute,svg,canvas,script,style,noscript')) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.opacity === '0' || cs.display === 'none') continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) {
      const w = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
      const h = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      area += w * h;
      if (w > 0 && ((r.top < 0 && r.bottom > 4) || (r.top < vh - 4 && r.bottom > vh))) cut = true;
    }
  }
  return { area: area / (vw * vh), cut };
}

/* ---- scoring a frame ------------------------------------------------------- */
async function score(buf) {
  const W = 160;
  const H = 84;
  const { data } = await sharp(buf).resize(W, H, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = W * H;
  /* The ground: the commonest colour, coarsely binned. */
  const bins = new Map();
  for (let i = 0; i < n; i++) {
    const k = ((data[i * 3] >> 4) << 8) | ((data[i * 3 + 1] >> 4) << 4) | (data[i * 3 + 2] >> 4);
    bins.set(k, (bins.get(k) || 0) + 1);
  }
  let top = 0;
  let key = 0;
  for (const [k, c] of bins) if (c > top) [top, key] = [c, k];
  const gr = ((key >> 8) & 15) * 16 + 8;
  const gg = ((key >> 4) & 15) * 16 + 8;
  const gb = (key & 15) * 16 + 8;
  let drawn = 0;
  let srg = 0;
  let syb = 0;
  let srg2 = 0;
  let syb2 = 0;
  let sl = 0;
  let sl2 = 0;
  const luma = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    if (Math.abs(r - gr) + Math.abs(g - gg) + Math.abs(b - gb) > 48) drawn++;
    const rg = r - g;
    const yb = 0.5 * (r + g) - b;
    srg += rg;
    syb += yb;
    srg2 += rg * rg;
    syb2 += yb * yb;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luma[i] = l;
    sl += l;
    sl2 += l * l;
  }
  const mrg = srg / n;
  const myb = syb / n;
  const colour = Math.sqrt(srg2 / n - mrg * mrg + (syb2 / n - myb * myb)) + 0.3 * Math.sqrt(mrg * mrg + myb * myb);
  const range = Math.sqrt(Math.max(0, sl2 / n - (sl / n) ** 2));
  let edges = 0;
  for (let y = 1; y < H; y++) for (let x = 1; x < W; x++) {
    const i = y * W + x;
    edges += Math.abs(luma[i] - luma[i - 1]) + Math.abs(luma[i] - luma[i - W]);
  }
  edges /= n;
  /* A small grey thumbnail, to tell frames apart. */
  const thumb = await sharp(buf).resize(32, 17, { fit: 'fill' }).greyscale().raw().toBuffer();
  return { drawn: drawn / n, colour, range, edges, thumb };
}
const differ = (a, b) => {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]);
  return d / a.length;
};
/* Ground that is only a gradient counts for little: being drawn needs edges too. */
const value = (s) =>
  Math.min(s.drawn, 0.7) * 1.6 * Math.min(1, s.edges / 8) + Math.min(s.colour, 90) / 90 + Math.min(s.edges, 26) / 26 + Math.min(s.range, 80) / 160 - Math.min(s.text, 0.25) * 1.5 - (s.cut ? 0.6 : 0);

/* ---- the loop ------------------------------------------------------------- */
function run(args) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
  if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr}`);
}

async function recordStretch(page, cdp, centre, dir, k, keep) {
  const span = VIEW.height * 0.6;
  const from = Math.max(0, centre - span / 2);
  await page.evaluate((y) => window.scrollTo(0, y), from);
  await page.waitForTimeout(SETTLE);
  await page.evaluate(putWordsAway, keep);
  const frames = [];
  const onFrame = async ({ data, metadata, sessionId }) => {
    frames.push({ data, t: metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  };
  cdp.on('Page.screencastFrame', onFrame);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: VIEW.width, maxHeight: VIEW.height });
  /* A slow, eased scroll through the stretch, the words kept away as new ones arrive. */
  await page.evaluate(
    ({ from, span, ms }) =>
      new Promise((done) => {
        const t0 = performance.now();
        const hide = setInterval(() => window.__reelHide?.(window.__reelKeep), 180);
        const step = (now) => {
          const t = Math.min(1, (now - t0) / ms);
          const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
          window.scrollTo(0, from + span * e);
          if (t < 1) requestAnimationFrame(step);
          else {
            clearInterval(hide);
            done();
          }
        };
        requestAnimationFrame(step);
      }),
    { from, span, ms: 2000 },
  );
  await page.waitForTimeout(150);
  await cdp.send('Page.stopScreencast');
  cdp.off('Page.screencastFrame', onFrame);
  if (frames.length < 3) return null;
  /* Frames arrive when the screen changes: hold each until the next. */
  const list = [];
  frames.forEach((f, i) => {
    const file = join(dir, `s${k}-${String(i).padStart(4, '0')}.jpg`);
    writeFileSync(file, Buffer.from(f.data, 'base64'));
    const next = frames[i + 1]?.t ?? f.t + 0.1;
    list.push(`file '${file}'`, `duration ${Math.max(0.016, next - f.t).toFixed(4)}`);
  });
  list.push(`file '${join(dir, `s${k}-${String(frames.length - 1).padStart(4, '0')}.jpg`)}'`);
  writeFileSync(join(dir, `s${k}.txt`), list.join('\n'));
  const out = join(dir, `s${k}.mp4`);
  run(['-f', 'concat', '-safe', '0', '-i', join(dir, `s${k}.txt`), '-vf', `fps=30,scale=${LOOP.width}:${LOOP.height}:flags=lanczos,format=yuv420p`, '-t', '2.1', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', out]);
  return out;
}

function joinStretches(parts, out) {
  const D = 0.5;
  const len = 2.1;
  const inputs = parts.flatMap((p) => ['-i', p]);
  let chain = '';
  let last = '[0:v]';
  let offset = len - D;
  for (let i = 1; i < parts.length; i++) {
    const tag = `[x${i}]`;
    chain += `${last}[${i}:v]xfade=transition=fade:duration=${D}:offset=${offset.toFixed(3)}${tag};`;
    last = tag;
    offset += len - D;
  }
  const total = len * parts.length - D * (parts.length - 1);
  chain += `${last}fade=t=in:st=0:d=0.35,fade=t=out:st=${(total - 0.35).toFixed(3)}:d=0.35,format=yuv420p[v]`;
  run([...inputs, '-filter_complex', chain, '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30', '-profile:v', 'main', '-movflags', '+faststart', out]);
}

/* ---- each page -------------------------------------------------------------- */
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const report = [];
async function shoot(slug) {
  const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: 1 });
  await page.goto(`${base}/gallery/${slug}/`, { waitUntil: 'networkidle' }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: HIDE_CSS });
  const pick = PICKS[slug] ?? {};
  const keep = Boolean(pick.keepWords);
  await page.evaluate(`window.__reelHide = ${putWordsAway.toString()}; window.__reelKeep = ${keep};`);
  await page.waitForTimeout(1200);
  const act = ACTS[slug];
  if (act) await act(page);
  const height = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
  const room = Math.max(0, height - VIEW.height);
  const steps = Math.min(90, Math.max(1, Math.ceil(room / (VIEW.height * 0.5))));
  const shots = [];
  for (let i = 0; i <= steps; i++) {
    const y = steps ? Math.round((room * i) / steps) : 0;
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(SETTLE);
    if (act) await act(page);
    const { area: text, cut } = await page.evaluate(putWordsAway, keep);
    await page.waitForTimeout(60);
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
    const s = await score(buf);
    shots.push({ y, buf, ...s, text, cut, v: 0 });
  }
  for (const s of shots) s.v = value(s);
  /* An editor's places lead: shot if the walk missed them, and put first. */
  for (const at of pick.at ?? []) {
    const y = Math.round(Math.min(room, Math.max(0, at * VIEW.height)));
    let s = shots.find((o) => o.y === y);
    if (!s) {
      await page.evaluate((y) => window.scrollTo(0, y), y);
      await page.waitForTimeout(SETTLE);
      const { area: text, cut } = await page.evaluate(putWordsAway, keep);
      const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
      s = { y, buf, ...(await score(buf)), text, cut };
      s.v = value(s);
      shots.push(s);
    }
    s.v += 10;
    s.fixed = true;
  }
  /* The best, apart from one another. */
  const chosen = [];
  for (const s of [...shots].sort((a, b) => b.v - a.v)) {
    if (chosen.length >= STILLS) break;
    if (chosen.some((c) => Math.abs(c.y - s.y) < VIEW.height * 1.4 || differ(c.thumb, s.thumb) < 9)) continue;
    chosen.push(s);
  }
  /* A short page may not hold five that far apart: fill from the rest, still different to the eye. */
  for (const s of [...shots].sort((a, b) => b.v - a.v)) {
    if (chosen.length >= STILLS) break;
    if (!chosen.includes(s) && chosen.every((c) => differ(c.thumb, s.thumb) >= 4)) chosen.push(s);
  }
  for (const s of [...shots].sort((a, b) => b.v - a.v)) {
    if (chosen.length >= STILLS) break;
    if (!chosen.includes(s)) chosen.push(s);
  }
  /* Each chosen still, nudged a quarter screen either way if that frames it better. */
  for (const c of chosen) {
    if (c.fixed) continue;
    for (const dy of [-0.25, 0.25]) {
      const y = Math.round(Math.min(room, Math.max(0, c.y + dy * VIEW.height)));
      if (y === c.y) continue;
      await page.evaluate((y) => window.scrollTo(0, y), y);
      await page.waitForTimeout(SETTLE);
      if (act) await act(page);
      const { area: text, cut } = await page.evaluate(putWordsAway, keep);
      await page.waitForTimeout(60);
      const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
      const s = { y, buf, ...(await score(buf)), text, cut };
      s.v = value(s);
      const apart = chosen.every((o) => o === c || Math.abs(o.y - y) >= VIEW.height);
      if (s.v > c.v && apart) Object.assign(c, s);
    }
  }
  chosen.sort((a, b) => b.v - a.v);
  const best = chosen[0];
  const dir = resolve(root, 'public/reel', slug);
  mkdirSync(dir, { recursive: true });
  const ordered = [...chosen].sort((a, b) => a.y - b.y);
  for (let i = 0; i < STILLS; i++) {
    const s = ordered[i] ?? ordered[ordered.length - 1];
    await sharp(s.buf).resize(STILL.width, STILL.height, { kernel: 'lanczos3' }).jpeg({ quality: 82, mozjpeg: true }).toFile(join(dir, `${i + 1}.jpg`));
  }
  await sharp(best.buf).resize(STILL.width, STILL.height, { kernel: 'lanczos3' }).jpeg({ quality: 84, mozjpeg: true }).toFile(join(dir, 'poster.jpg'));
  let loop = 'skipped';
  if (hasFfmpeg) {
    const tmp = mkdtempSync(join(tmpdir(), `reel-${slug}-`));
    try {
      const cdp = await page.context().newCDPSession(page);
      const stretches = chosen.slice(0, STRETCHES).sort((a, b) => a.y - b.y);
      const parts = [];
      for (const [k, s] of stretches.entries()) {
        if (act) {
          await page.evaluate((y) => window.scrollTo(0, y), s.y);
          await act(page);
        }
        const p = await recordStretch(page, cdp, s.y + VIEW.height / 2, tmp, k, keep);
        if (p) parts.push(p);
      }
      if (parts.length) {
        joinStretches(parts, join(dir, 'loop.mp4'));
        loop = `${Math.round(statSync(join(dir, 'loop.mp4')).size / 1024)} KB`;
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }
  report.push({ slug, steps, best: best.v.toFixed(2), text: best.text.toFixed(3), loop });
  console.log(`reel ${slug}: ${steps + 1} frames read; stills at y=${ordered.map((s) => s.y).join(',')}; loop ${loop}`);
  await page.close();
}

const queue = [...slugs];
const workers = Array.from({ length: Math.min(Number(process.env.REEL_JOBS || 3), queue.length) }, async () => {
  for (let slug = queue.shift(); slug; slug = queue.shift()) {
    try {
      await shoot(slug);
    } catch (e) {
      console.error(`reel ${slug}: ${e.message}`);
      report.push({ slug, error: e.message });
    }
  }
});
await Promise.all(workers);
await browser.close();
server.close();
if (report.some((r) => r.error)) process.exitCode = 1;
