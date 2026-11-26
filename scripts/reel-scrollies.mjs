/**
 * Shoots each scroll page's previews from the page itself, aimed at what the
 * piece animates. The copy stays where the page puts it, but a preview is
 * framed on what moves, not on what it says:
 *
 *   public/reel/<slug>/1.jpg … 5.jpg  five stills, 800x420, in the order the
 *                                      page reaches them (the Archive's
 *                                      reading table on the homepage)
 *   public/reel/<slug>/poster.jpg     the strongest of them (a Gallery tile,
 *                                      and the loop's poster)
 *   public/reel/<slug>/loop.mp4       a five-second muted loop, 640x336
 *                                      H.264: the three strongest stretches
 *                                      of the page, cross-faded (a Gallery
 *                                      tile, on hover or in view)
 *
 * How it finds them. The built page is served from dist/ and opened at
 * 1280x672. It is walked top to bottom half a screen at a time. At each step
 * the page settles and is read three times: once, again half a second later
 * (what moves on its own), and again a fifth of a screen further down (what
 * the scroll drives). A part of the screen that changed between the first
 * two, or that changed under the scroll in a way plain scrolling does not
 * explain (it neither stayed put nor slid up with the page), is moving.
 *
 *   - Copy: text set below display size, and the card it sits on (the
 *     nearest box smaller than the screen that holds no canvas, svg, image
 *     or video of its own, nor any display type), is left showing but
 *     counts for nothing: it is masked out of the motion and the drawing,
 *     and a frame that is mostly copy loses a little. So a paragraph fading
 *     in is not "animation", and a frame is chosen for its pictures. Display
 *     type (six words or fewer at 40px or more: a Greek word, a gauge's
 *     figure, a title set as an image) counts as picture. Text inside an svg
 *     is part of its drawing.
 *   - Chrome: the exits, the foot, and anything fixed or sticky and small
 *     that is a control or a short label (HUDs, top bars, control bars) are
 *     hidden, as is anything marked data-og-hide.
 *   - Score: above all, how much of the frame moves, and how near the middle
 *     the moving part sits; then how much of the rest is drawn rather than
 *     ground, its colour, edges and light-to-dark range; less a little for a
 *     frame that is mostly copy or only a title, and more for display type
 *     the frame's edge cuts in half. The five best stills are chosen apart
 *     from one another (a screen and a half apart, and different to the
 *     eye), each moved, if it helps, so its moving part sits in the middle
 *     of the frame, then put back in page order.
 *
 * The loop records the three best stretches in real time (Chrome's
 * screencast) around their stills: a slow scroll through 0.6 of a screen
 * where the scroll drives the motion, a slight drift of 0.2 where the piece
 * moves on its own. They are joined with half-second dissolves, faded in and
 * out at the ends so the loop is seamless.
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
 * `only`, to use those places and nothing else (more moments of them fill
 * the five); `keepWords`, for a page whose words are its picture (a product's screens,
 * a homepage design, a receipt), whose copy then counts as drawing.
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
/** How long it is watched for what moves on its own. */
const TICK = 500;
/** The grid frames are read on: cells of 8x8 screen pixels. */
const GW = 160;
const GH = 84;
const CELL = VIEW.height / GH;
/** How far it is scrolled to see what the scroll drives (a whole number of cells, so plain scrolling lines up), and how long that settles. */
const NUDGE = CELL * 17;
const NUDGE_SETTLE = 450;
/** How far a cell's colour must change (sum of R, G, B) to count as moving. */
const MOVES = 30;
/** How much edge (luma steps to the next cells) a cell needs for its change to be a thing moving rather than ground changing tint. */
const EDGE = 6;
/** How much of a frame must move for it to count as a place where the piece animates. */
const LIVE = 0.008;
/** How far a still or a stretch may crop in on its moving part (never past the still's own size, so nothing is enlarged). */
const MAX_ZOOM = Math.min(1.33, VIEW.width / STILL.width);
/** The loop's length, in seconds, and its dissolves. */
const LOOP_S = 5.3;
const DISSOLVE = 0.5;
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
  /* The meteor over the title is the piece. */
  'depth-chart': { at: [0] },
  /* The title over its swirl of numbers. */
  'quantum-banking': { at: [0] },
  /* Janus over the title, and the face the elements settle into; the door moves only at the edge of pages of copy. */
  'before-and-behind': { at: [0, 2.47], only: true },
  /* The stage is too dark to read as moving: the title, and the seed. */
  'the-unseen-one': { at: [1.49, 1.99], only: true },
  /* The title, the three-storey psyche set as type, and the lyre and the sea; the rest is copy and the ledger. */
  'where-it-was': { at: [0, 4.5, 10.24], only: true },
  /* The title over the field of points. */
  'the-dual-thing': { at: [0] },
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

/* ---- in the page: the chrome away, the copy found ------------------------- */
const HIDE_CSS = `
.poem-exit,.descent-exit,.crumb-exit,.crumb-inline,.crumb-foot,.scroll-foot,#rail,.orchestra-pit,.pit-toggle,[data-og-hide]{display:none!important}
.__reel-hide{visibility:hidden!important}
html{scroll-behavior:auto!important;scrollbar-width:none!important}::-webkit-scrollbar{display:none!important}
*{cursor:none!important}`;

/**
 * Runs in the page: hides the chrome, and finds the copy. Returns, in screen
 * pixels, the boxes the copy covers (each line of it, and the card it sits
 * on), the boxes display type covers, and whether the screen's edge cuts any
 * display type.
 */
function readFrame() {
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
  const onScreen = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
  const box = (r) => [r.left, r.top, r.right, r.bottom];

  /* Small fixed or sticky chrome: a control, or a short label (HUDs, top
     bars, control bars). Not a small fixed or sticky picture (a chart
     wheel), and not a card of copy that stays while a picture changes. */
  for (const el of document.body.querySelectorAll('*')) {
    if (el.classList.contains('__reel-hide')) continue;
    const pos = getComputedStyle(el).position;
    if (pos !== 'fixed' && pos !== 'sticky') continue;
    const r = el.getBoundingClientRect();
    if (r.width * r.height > vw * vh * 0.3 || heavy(el)) continue;
    const t = (el.textContent || '').trim();
    /* A thin fixed bar is a progress rule or a rail. */
    const thin = r.height <= 10 || r.width <= 10;
    if (thin || el.matches('button,a,nav,header,footer') || el.querySelector('button,input,select,a') || (t.length > 1 && t.length < 80)) el.classList.add('__reel-hide');
  }

  const copy = [];
  const cardBoxes = [];
  const shown = [];
  let cut = false;
  const seen = new Set();
  const cards = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (skip(el)) continue;
    const t = n.nodeValue.trim();
    if (!t) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    const rects = [...range.getClientRects()].filter(onScreen);
    if (!rects.length) continue;
    /* Copy still waiting to be revealed counts as copy too: it is about to move. */
    const words = (t.match(/\S+/g) || []).length;
    if (display(el, words)) {
      for (const r of rects) {
        shown.push(box(r));
        if ((r.top < 0 && r.bottom > 4) || (r.top < vh - 4 && r.bottom > vh)) cut = true;
      }
      continue;
    }
    for (const r of rects) copy.push(box(r));
    if (seen.has(el) || (words < 4 && t.length < 28) || heavy(el)) continue;
    seen.add(el);
    /* Climb to the card the words sit on: the largest box short of a stage or a page column. */
    let card = el;
    while (card.parentElement && card.parentElement !== document.body) {
      const p = card.parentElement;
      const r = p.getBoundingClientRect();
      if (r.width > vw * 0.72 || r.height > vh * 0.92 || heavy(p) || holdsDisplay(p)) break;
      card = p;
    }
    if (cards.has(card)) continue;
    cards.add(card);
    const r = card.getBoundingClientRect();
    if (r.width <= vw * 0.72 && r.height <= vh * 0.92 && !holdsDisplay(card) && onScreen(r)) cardBoxes.push(box(r));
  }
  return { copy, cards: cardBoxes, shown, cut };
}

/** Jump, not glide: some pages set scroll-behavior: smooth on their root. */
const jump = (page, y) => page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y);

/* ---- reading a frame -------------------------------------------------------- */
const grid = (buf) => sharp(buf).resize(GW, GH, { fit: 'fill' }).removeAlpha().raw().toBuffer();

/** Boxes in screen pixels, laid on the grid: 1 where they cover a cell. */
function lay(boxes, pad = 0) {
  const m = new Uint8Array(GW * GH);
  const sx = GW / VIEW.width;
  const sy = GH / VIEW.height;
  for (const [l, t, r, b] of boxes) {
    const x0 = Math.max(0, Math.floor(l * sx) - pad);
    const x1 = Math.min(GW - 1, Math.ceil(r * sx) - 1 + pad);
    const y0 = Math.max(0, Math.floor(t * sy) - pad);
    const y1 = Math.min(GH - 1, Math.ceil(b * sy) - 1 + pad);
    for (let y = y0; y <= y1; y++) m.fill(1, y * GW + x0, y * GW + x1 + 1);
  }
  return m;
}
const share = (m) => m.reduce((a, v) => a + (v ? 1 : 0), 0) / m.length;

/** How much of the frame is drawn, its colour, edges and range, leaving out the copy. */
async function look(data, mask) {
  const n = GW * GH;
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
  let free = 0;
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
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luma[i] = l;
    if (mask[i]) continue;
    free++;
    if (Math.abs(r - gr) + Math.abs(g - gg) + Math.abs(b - gb) > 48) drawn++;
    const rg = r - g;
    const yb = 0.5 * (r + g) - b;
    srg += rg;
    syb += yb;
    srg2 += rg * rg;
    syb2 += yb * yb;
    sl += l;
    sl2 += l * l;
  }
  const f = Math.max(1, free);
  const mrg = srg / f;
  const myb = syb / f;
  /* Colour and range are of what is not copy, scaled by how much of the frame that is. */
  const colour = (Math.sqrt(Math.max(0, srg2 / f - mrg * mrg + (syb2 / f - myb * myb))) + 0.3 * Math.sqrt(mrg * mrg + myb * myb)) * (free / n);
  const range = Math.sqrt(Math.max(0, sl2 / f - (sl / f) ** 2)) * (free / n);
  let edges = 0;
  for (let y = 1; y < GH; y++) for (let x = 1; x < GW; x++) {
    const i = y * GW + x;
    if (mask[i]) continue;
    edges += Math.abs(luma[i] - luma[i - 1]) + Math.abs(luma[i] - luma[i - GW]);
  }
  edges /= n;
  return { drawn: drawn / n, colour, range, edges };
}

/**
 * What moves. `a` and `b` are the same place half a second apart; `c` is
 * `shift` grid rows further down the page. A cell moves if it changed from
 * `a` to `b`, or if under the scroll it neither stayed put nor slid up with
 * the page. Copy is left out.
 */
function moving(a, b, c, shift, mask) {
  const n = GW * GH;
  const d = (p, q, i, j) => Math.abs(p[i * 3] - q[j * 3]) + Math.abs(p[i * 3 + 1] - q[j * 3 + 1]) + Math.abs(p[i * 3 + 2] - q[j * 3 + 2]);
  /* A flat stretch that only changes tint (a section's ground warming as it scrolls past) is not motion: a moving thing has edges. */
  const luma = (p) => {
    const l = new Float32Array(n);
    for (let i = 0; i < n; i++) l[i] = 0.2126 * p[i * 3] + 0.7152 * p[i * 3 + 1] + 0.0722 * p[i * 3 + 2];
    return l;
  };
  const [la, lb, lc] = [luma(a), luma(b), luma(c)];
  const edged = (l, x, y) => {
    const i = y * GW + x;
    let e = 0;
    if (x > 0) e = Math.max(e, Math.abs(l[i] - l[i - 1]));
    if (x < GW - 1) e = Math.max(e, Math.abs(l[i] - l[i + 1]));
    if (y > 0) e = Math.max(e, Math.abs(l[i] - l[i - GW]));
    if (y < GH - 1) e = Math.max(e, Math.abs(l[i] - l[i + GW]));
    return e >= EDGE;
  };
  let all = 0;
  let own = 0;
  let sy = 0;
  const rows = new Uint32Array(GH);
  const cols = new Uint32Array(GW);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const i = y * GW + x;
    if (mask[i]) continue;
    const y2 = y - shift;
    const t = d(a, b, i, i) > MOVES && (edged(la, x, y) || edged(lb, x, y));
    const s = y2 >= 0 && y2 < GH && Math.min(d(b, c, i, i), d(b, c, i, y2 * GW + x)) > MOVES && (edged(lb, x, y) || edged(lc, x, y) || edged(lc, x, y2));
    if (!t && !s) continue;
    all++;
    if (t) own++;
    sy += y;
    rows[y]++;
    cols[x]++;
  }
  /* The box most of the motion sits in: a stray cell at the edge does not stretch it. */
  const span = (h, len) => {
    const lo = all * 0.04;
    const hi = all * 0.96;
    let acc = 0;
    let a0 = 0;
    let a1 = len - 1;
    for (let k = 0; k < len; k++) {
      if (acc <= lo) a0 = k;
      acc += h[k];
      if (acc >= hi) {
        a1 = k;
        break;
      }
    }
    return [a0 / len, (a1 + 1) / len];
  };
  const [x0, x1] = all ? span(cols, GW) : [0, 1];
  const [y0, y1] = all ? span(rows, GH) : [0, 1];
  return {
    motion: all / n,
    /* How much of what moves does so on its own, not because of the scroll. */
    own: all ? own / all : 0,
    /* Where the moving part's middle is, as a share of the frame, and the box around it. */
    my: all ? (sy / all + 0.5) / GH : 0.5,
    box: [x0, y0, x1, y1],
  };
}

/**
 * The part of the screen a still or a stretch shows: the moving part with a
 * margin, at the still's shape, cropped in at most MAX_ZOOM (so nothing is
 * enlarged and the copy around it keeps its place) and never wider than the
 * screen. A frame that does not move shows whole.
 */
function cropFor(s) {
  const whole = { left: 0, top: 0, width: VIEW.width, height: VIEW.height };
  if (!s || s.motion < LIVE) return whole;
  const aspect = VIEW.width / VIEW.height;
  const [x0, y0, x1, y1] = s.box;
  const cx = ((x0 + x1) / 2) * VIEW.width;
  const cy = ((y0 + y1) / 2) * VIEW.height;
  let w = Math.max((x1 - x0) * VIEW.width * 1.6, (y1 - y0) * VIEW.height * 1.6 * aspect);
  w = Math.min(VIEW.width, Math.max(VIEW.width / MAX_ZOOM, w));
  const h = w / aspect;
  const even = (v) => Math.round(v / 2) * 2;
  const width = even(w);
  const height = even(h);
  const left = even(Math.min(VIEW.width - width, Math.max(0, cx - width / 2)));
  const top = even(Math.min(VIEW.height - height, Math.max(0, cy - height / 2)));
  return { left, top, width, height };
}

/** Reads the frame `y` from the top: shot, copy, what moves. */
async function measure(page, y, act, room, keep) {
  await jump(page, y);
  await page.waitForTimeout(SETTLE);
  if (act) await act(page);
  const at = await page.evaluate(() => scrollY);
  const words = await page.evaluate(readFrame);
  await page.waitForTimeout(60);
  const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
  await page.waitForTimeout(TICK);
  const later = await page.screenshot({ type: 'jpeg', quality: 92 });
  const wordsLater = await page.evaluate(readFrame);
  const y2 = at + NUDGE <= room ? at + NUDGE : Math.max(0, at - NUDGE);
  await jump(page, y2);
  await page.waitForTimeout(NUDGE_SETTLE);
  await page.evaluate(() => void window.__reelRead?.());
  const moved = await page.evaluate(() => scrollY);
  const further = await page.screenshot({ type: 'jpeg', quality: 92 });
  const wordsFurther = await page.evaluate(readFrame);
  const [a, b, c] = await Promise.all([grid(buf), grid(later), grid(further)]);
  const shift = Math.round(((moved - at) * GH) / VIEW.height);
  /* The lines of copy wherever they were in any of the three readings (the third moved back into this frame's place too), so copy that fades or slides in is not taken for motion. Only the lines: a card can hold a picture drawn in plain boxes (a gauge, a tally), and its ground is flat, which the motion test already passes over. */
  const back = wordsFurther.copy.map(([l, t, r, b]) => [l, t + shift * CELL, r, b + shift * CELL]);
  const none = new Uint8Array(GW * GH);
  const lineMask = keep ? none : lay([...words.copy, ...wordsLater.copy, ...wordsFurther.copy, ...back], 1);
  /* How much of the frame is copy, cards and all. */
  const copyMask = keep ? none : lay([...words.copy, ...words.cards], 1);
  const thumb = await sharp(buf).resize(32, 17, { fit: 'fill' }).greyscale().raw().toBuffer();
  return {
    y: at,
    buf,
    thumb,
    ...(await look(a, lineMask)),
    ...moving(a, b, c, shift, lineMask),
    copy: share(copyMask),
    title: share(lay(words.shown)),
    cut: words.cut,
  };
}

const differ = (a, b) => {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]);
  return d / a.length;
};

/**
 * What moves leads; what is drawn follows. A frame with any real motion
 * beats one without, more motion beats less, and motion in the middle beats
 * motion at the edge. Ground that is only a gradient counts for little:
 * being drawn needs edges too.
 */
function value(s) {
  const moves = Math.sqrt(Math.min(Math.max(0, s.motion - 0.003), 0.25) / 0.25);
  const centred = moves * (1 - Math.min(1, Math.abs(s.my - 0.5) * 2));
  const drawn = (Math.min(s.drawn, 0.7) * 1.6 * Math.min(1, s.edges / 8) + Math.min(s.colour, 90) / 90 + Math.min(s.edges, 26) / 26 + Math.min(s.range, 80) / 160) / 3.6;
  return 2.5 * moves + 0.6 * centred + 1.2 * drawn - Math.max(0, s.copy - 0.2) * 1.5 - Math.min(s.title, 0.25) - (s.cut ? 0.5 : 0);
}

/* ---- the loop ------------------------------------------------------------- */
function run(args) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
  if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr}`);
}

/**
 * A stretch of the page around a still, cut to the still's frame: a slow
 * scroll where the scroll drives the motion, a slight drift where the piece
 * moves on its own.
 */
async function recordStretch(page, cdp, still, crop, len, dir, k) {
  const span = VIEW.height * (still.own > 0.6 ? 0.08 : 0.4);
  const from = Math.max(0, still.y - span / 2);
  await jump(page, from);
  await page.waitForTimeout(SETTLE);
  await page.evaluate(readFrame);
  const frames = [];
  const onFrame = async ({ data, metadata, sessionId }) => {
    frames.push({ data, t: metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  };
  cdp.on('Page.screencastFrame', onFrame);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: VIEW.width, maxHeight: VIEW.height });
  /* A slow, eased scroll through the stretch, new chrome put away as it arrives. */
  await page.evaluate(
    ({ from, span, ms }) =>
      new Promise((done) => {
        const t0 = performance.now();
        const hide = setInterval(() => window.__reelRead?.(), 180);
        const step = (now) => {
          const t = Math.min(1, (now - t0) / ms);
          const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
          window.scrollTo({ top: from + span * e, behavior: 'instant' });
          if (t < 1) requestAnimationFrame(step);
          else {
            clearInterval(hide);
            done();
          }
        };
        requestAnimationFrame(step);
      }),
    { from, span, ms: Math.round(len * 1000) },
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
  const cut = `scale=${VIEW.width}:${VIEW.height},crop=${crop.width}:${crop.height}:${crop.left}:${crop.top}`;
  run(['-f', 'concat', '-safe', '0', '-i', join(dir, `s${k}.txt`), '-vf', `fps=30,${cut},scale=${LOOP.width}:${LOOP.height}:flags=lanczos,format=yuv420p`, '-t', len.toFixed(2), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', out]);
  return out;
}

function joinStretches(parts, len, out) {
  const D = DISSOLVE;
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
  await page.evaluate(`window.__reelRead = ${readFrame.toString()};`);
  await page.waitForTimeout(1200);
  const act = ACTS[slug];
  if (act) await act(page);
  const height = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
  const room = Math.max(0, height - VIEW.height);
  const steps = Math.min(90, Math.max(1, Math.ceil(room / (VIEW.height * 0.5))));
  const read = async (y) => {
    const s = await measure(page, Math.round(Math.min(room, Math.max(0, y))), act, room, keep);
    s.v = value(s);
    return s;
  };
  const shots = [];
  for (let i = 0; i <= steps; i++) shots.push(await read(steps ? (room * i) / steps : 0));
  if (process.env.REEL_DEBUG) console.log(`reel ${slug} walk: ${shots.map((s) => `${s.y}:${(s.motion * 100).toFixed(1)}`).join(' ')}`);
  /* An editor's places lead: shot if the walk missed them, and put first. */
  for (const at of pick.at ?? []) {
    const y = Math.round(Math.min(room, Math.max(0, at * VIEW.height)));
    let s = shots.find((o) => Math.abs(o.y - y) < 8);
    if (!s) shots.push((s = await read(y)));
    s.v += 10;
    s.fixed = true;
  }
  /* Only the places where the piece moves, if it moves anywhere. If it does
     not, the places that draw most, not a page of copy nor an empty stretch
     of ground: fewer of them, repeated, rather than those. */
  const live = shots.filter((s) => s.motion >= LIVE || s.fixed);
  let ranked = [...(live.length ? live : shots)].sort((a, b) => b.v - a.v);
  if (pick.only) ranked = ranked.filter((s) => s.fixed);
  {
    /* A moving place where the motion is a sliver beside a page of copy, or far weaker than the piece's best, is left out too: its best places, again, do better. */
    const quiet = ranked.filter((s) => keep || s.fixed || s.copy <= (live.length ? 0.4 : 0.35));
    if (quiet.length) ranked = quiet;
    const top = ranked.find((s) => !s.fixed)?.v ?? 0;
    if (top > 0) ranked = ranked.filter((s) => s.fixed || s.v >= top * (live.length ? 0.4 : 0.5));
  }
  /* The best places, apart from one another; a short page may not hold five that far apart, so then any that look different. */
  const places = [];
  for (const s of ranked) {
    if (places.length >= STILLS) break;
    if (places.some((c) => Math.abs(c.y - s.y) < VIEW.height * 1.4 || differ(c.thumb, s.thumb) < 9)) continue;
    places.push(s);
  }
  for (const s of ranked) {
    if (places.length >= STILLS) break;
    if (!places.includes(s) && places.every((c) => differ(c.thumb, s.thumb) >= 4)) places.push(s);
  }
  /* Each place, moved so its moving part sits in the middle, or a quarter screen either way, if that frames it better. */
  for (const c of places) {
    if (c.fixed) continue;
    const tries = [-0.25, 0.25].map((d) => c.y + d * VIEW.height);
    if (c.motion > 0.003 && Math.abs(c.my - 0.5) > 0.08) tries.unshift(c.y + (c.my - 0.5) * VIEW.height);
    for (const y of tries) {
      const t = Math.round(Math.min(room, Math.max(0, y)));
      if (Math.abs(t - c.y) < 8) continue;
      if (!places.every((o) => o === c || Math.abs(o.y - t) >= VIEW.height)) continue;
      const s = await read(t);
      if (s.v > c.v && (s.motion >= LIVE || c.motion < LIVE)) Object.assign(c, s);
    }
  }
  places.sort((a, b) => b.v - a.v);
  /* Fewer moving places than stills: more moments of the ones there are, a little later or a little further on, rather than a still of copy. */
  const stills = places.map((p, i) => ({ ...p, of: i, seq: 0 }));
  const moving = places.filter((p) => p.motion >= LIVE || p.fixed);
  for (let tries = 0, k = 0; stills.length < STILLS && moving.length && tries < STILLS * 2; tries++) {
    const p = moving[tries % moving.length];
    const of = places.indexOf(p);
    const seq = stills.filter((s) => s.of === of).length;
    const dy = p.own > 0.6 ? 0 : [0.12, -0.12, 0.24, -0.24][k++ % 4] * VIEW.height;
    const s = await read(p.y + dy);
    if (s.motion < LIVE / 2 && !p.fixed) continue;
    if (stills.some((o) => o.of === of && differ(o.thumb, s.thumb) < 1.5)) continue;
    stills.push({ ...s, of, seq });
  }
  for (const s of stills) s.crop = cropFor(s.motion >= LIVE ? s : places[s.of]);
  const ordered = [...stills].sort((a, b) => places[a.of].y - places[b.of].y || a.seq - b.seq || a.y - b.y);
  const best = places[0];
  const dir = resolve(root, 'public/reel', slug);
  mkdirSync(dir, { recursive: true });
  const still = (s, file, quality) =>
    sharp(s.buf).extract(s.crop).resize(STILL.width, STILL.height, { kernel: 'lanczos3' }).jpeg({ quality, mozjpeg: true }).toFile(join(dir, file));
  for (let i = 0; i < STILLS; i++) await still(ordered[i % ordered.length], `${i + 1}.jpg`, 82);
  await still(stills[0], 'poster.jpg', 84);
  let loop = 'skipped';
  if (hasFfmpeg) {
    const tmp = mkdtempSync(join(tmpdir(), `reel-${slug}-`));
    try {
      const cdp = await page.context().newCDPSession(page);
      const stretches = (moving.length ? moving : places).slice(0, STRETCHES).sort((a, b) => a.y - b.y);
      /* One moving place gets the whole loop; three share it. */
      const len = (LOOP_S + DISSOLVE * (stretches.length - 1)) / stretches.length;
      const parts = [];
      for (const [k, s] of stretches.entries()) {
        if (act) {
          await jump(page, s.y);
          await act(page);
        }
        const p = await recordStretch(page, cdp, s, cropFor(s), len, tmp, k);
        if (p) parts.push(p);
      }
      if (parts.length) {
        joinStretches(parts, len, join(dir, 'loop.mp4'));
        loop = `${Math.round(statSync(join(dir, 'loop.mp4')).size / 1024)} KB, ${parts.length} stretch${parts.length > 1 ? 'es' : ''}`;
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }
  const fmt = (s) => `${s.y}${s.seq ? `'${s.seq}` : ''}(${(s.motion * 100).toFixed(1)}%${s.own > 0.6 ? ' own' : ''}${s.crop.width < VIEW.width ? ` x${(VIEW.width / s.crop.width).toFixed(2)}` : ''})`;
  report.push({ slug, steps, best: best.v.toFixed(2), motion: best.motion.toFixed(3), places: moving.length, loop });
  console.log(`reel ${slug}: ${steps + 1} frames read, ${moving.length} moving place${moving.length === 1 ? '' : 's'}; stills ${ordered.map(fmt).join(', ')}; loop ${loop}`);
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
