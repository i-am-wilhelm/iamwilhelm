/**
 * Builds the site search after the build. Once every page is in dist/
 * (and the twins integration has filled the plain-text twins, so this one
 * is listed after it in astro.config.mjs), this hook reads the list of
 * what to index (/search/records.json, from src/pages/search/records.json.ts),
 * reads each record's text from its built page, and writes a Pagefind
 * index to dist/pagefind/. The search page (src/pages/search/index.astro)
 * loads /pagefind/pagefind.js from there and asks it.
 *
 * Each record goes to Pagefind as a small HTML page of its own, so the
 * result links to the piece while the words come from wherever they read
 * best:
 *
 *   - a scroll page: its plain-text twin (the whole piece in reading
 *     order, every exhibit described), not the scroll page, whose words
 *     are split across canvases, layers and scripts;
 *   - a reading or a room: the page's main text, reduced the same way
 *     (src/lib/twin.ts drops the nav, the foot, scripts and controls);
 *   - one of the homepage's rooms: that section of the homepage;
 *   - a series: its name and statement only.
 *
 * The title weighs most (10), then the one line (5), then the text (1; a
 * room's 0.4). Tags, series and kind are Pagefind filters, not words: the
 * search page lists a tag's or a series' pieces first when the words name
 * it ("gold", "Seen"). The date is a sort key.
 *
 * In `astro dev` there is no index: the search page says so and points to
 * `npm run build` then `npm run preview`.
 */
import type { AstroIntegration } from 'astro';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, renderSync, ELEMENT_NODE } from 'ultrahtml';
/* A static import: astro.config.mjs loads this file once, and its module
   runner is closed by the time the build is done. */
import * as pagefind from 'pagefind';
import { twinFromHtml } from '../lib/twin';
import type { SearchRecord } from '../config/search';

type Node = { type: number; name?: string; attributes?: Record<string, string>; children?: Node[] };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function find(node: Node, test: (n: Node) => boolean): Node | undefined {
  if (node.type === ELEMENT_NODE && test(node)) return node;
  for (const c of node.children ?? []) {
    const hit = find(c, test);
    if (hit) return hit;
  }
  return undefined;
}

const inner = (n: Node) => (n.children ?? []).map((c) => renderSync(c as never)).join('');

/** The record's words, as reduced HTML (headings kept, ids dropped so no result deep-links into a twin). */
function textFor(r: SearchRecord, dist: string): string {
  if (r.read === 'none') return '';
  const file = join(dist, r.source.replace(/^\//, '').replace(/#.*$/, ''), 'index.html');
  if (!existsSync(file)) throw new Error(`search: ${r.url}: no built page at ${r.source}.`);
  const doc = parse(readFileSync(file, 'utf8')) as Node;
  let html: string;
  if (r.read === 'twin') {
    const body = find(doc, (n) => 'data-twin-body' in (n.attributes ?? {}));
    if (!body) throw new Error(`search: ${r.url}: the twin at ${r.source} has no filled [data-twin-body].`);
    html = inner(body);
  } else if (r.read === 'section') {
    const part = find(doc, (n) => n.attributes?.id === r.section);
    if (!part) throw new Error(`search: ${r.url}: no element #${r.section} on ${r.source}.`);
    html = twinFromHtml(renderSync(part as never)).html;
  } else {
    const main = find(doc, (n) => n.name === 'main');
    html = twinFromHtml(main ? renderSync(main as never) : readFileSync(file, 'utf8'), r.title).html;
  }
  if (!html.trim()) throw new Error(`search: ${r.url}: read nothing from ${r.source}.`);
  return html.replace(/\s(id|data-[a-z-]+)="[^"]*"/g, '');
}

function recordPage(r: SearchRecord, text: string): string {
  /* A room's text lists the pieces it hangs; it weighs least, so a piece always outranks the room. */
  const weight = r.kind === 'room' ? '0.4' : '1';
  const meta = (k: string, v: string) => (v ? `<span data-pagefind-meta="${k}">${esc(v)}</span>` : '');
  const filter = (k: string, v: string) => (v ? `<span data-pagefind-filter="${k}">${esc(v)}</span>` : '');
  return [
    `<!doctype html><html lang="en"><head><title>${esc(r.title)}</title></head><body><main data-pagefind-body>`,
    `<h1 data-pagefind-weight="10">${esc(r.title)}</h1>`,
    r.line ? `<p data-pagefind-weight="5">${esc(r.line)}</p>` : '',
    text ? `<div data-pagefind-weight="${weight}">${text}</div>` : '',
    `<div data-pagefind-ignore>`,
    meta('label', r.label),
    meta('line', r.line),
    meta('kind', r.kind),
    meta('date', r.date),
    meta('tags', r.tags.join(' ')),
    meta('image', r.image),
    ...r.tags.map((t) => filter('tag', t)),
    filter('series', r.series),
    filter('kind', r.kind),
    r.date ? `<span data-pagefind-sort="date">${r.date}</span>` : '',
    `</div>`,
    `</main></body></html>`,
  ].join('');
}

export default function search(): AstroIntegration {
  return {
    name: 'iamwilhelm:search',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const dist = fileURLToPath(dir);
        const list = join(dist, 'search', 'records.json');
        if (!existsSync(list)) throw new Error('search: dist/search/records.json is missing (src/pages/search/records.json.ts).');
        const { records } = JSON.parse(readFileSync(list, 'utf8')) as { records: SearchRecord[] };

        const { index, errors } = await pagefind.createIndex({ forceLanguage: 'en' });
        if (!index) throw new Error(`search: Pagefind would not start: ${errors.join('; ')}`);
        let words = 0;
        for (const r of records) {
          const res = await index.addHTMLFile({ url: r.url, content: recordPage(r, textFor(r, dist)) });
          if (res.errors.length) throw new Error(`search: ${r.url}: ${res.errors.join('; ')}`);
          words += res.file.uniqueWords;
        }
        const out = await index.writeFiles({ outputPath: join(dist, 'pagefind') });
        if (out.errors.length) throw new Error(`search: writing the index: ${out.errors.join('; ')}`);
        await pagefind.close();
        rmSync(list);
        logger.info(`${records.length} records indexed (${words} words) into /pagefind/.`);
      },
    },
  };
}
