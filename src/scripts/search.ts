/**
 * The search page's script (src/pages/search/index.astro). It asks the
 * Pagefind index that src/integrations/search.ts writes to /pagefind/
 * after the build, draws the results, and keeps the address in step
 * (?q=, ?tag=, ?series=) so a search can be shared and the back button
 * walks it. Pagefind loads on the first search, or at once when the page
 * opens on one.
 *
 *   - Words search every piece, reading, series and room; an empty field
 *     with a tag or a series chosen lists that tag or series, newest first.
 *   - Tags whose names match the words are offered above the results, as
 *     links to their pages. When the words name a tag ("gold", "the
 *     dollar") or a series ("Seen"), every piece filed there leads the
 *     results, whether or not its text uses the word.
 *   - Pagefind answers a word it cannot find with near misses (a typed
 *     "xyzzy" finds "RWA.xyz"); a result is kept only if a word it marks
 *     and a word typed hold one another, or share their first four letters.
 *   - Before a search, the page shows the subject index; during one, the
 *     results replace it.
 *
 * In `astro dev` there is no index; the page says how to see search work.
 */

interface PagefindResultData {
  url: string;
  excerpt: string;
  meta: Record<string, string>;
  filters: Record<string, string[]>;
}
interface PagefindSearch {
  results: { id: string; data: () => Promise<PagefindResultData> }[];
}
interface Pagefind {
  options: (o: Record<string, unknown>) => Promise<void>;
  init: () => Promise<void>;
  preload: (q: string, o?: Record<string, unknown>) => Promise<void>;
  search: (q: string | null, o?: Record<string, unknown>) => Promise<PagefindSearch | null>;
}
interface SearchData {
  tags: Record<string, { label: string; n: number }>;
  series: Record<string, { name: string; href: string; accent: string }>;
}

const PAGE = 20;
/** Words too small to suggest a tag by ("the" would offer every tag that starts with it). */
const STOP = new Set(['the', 'and', 'of', 'an', 'in', 'on', 'to', 'for', 'with', 'by', 'at', 'is', 'it', 'or', 'as']);
const KIND: Record<string, string> = { scroll: 'Scroll page', reading: 'Reading', series: 'Series', room: 'Room' };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Pagefind's excerpt marks the matches; keep the marks and escape everything else. */
const excerpt = (s: string) =>
  esc(s.replace(/<mark>/g, '\u0001').replace(/<\/mark>/g, '\u0002').replace(/<[^>]*>/g, ''))
    .replace(/\u0001/g, '<mark>')
    .replace(/\u0002/g, '</mark>');
/** Lower case, accents off, for matching tag names. */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Does a word Pagefind marked answer a word typed? */
function answers(marked: string, typed: string[]): boolean {
  const m = fold(marked).replace(/[^\p{L}\p{N}]+/gu, '');
  return typed.some((t) => m.includes(t) || (m.length >= 3 && t.includes(m)) || (t.length >= 4 && m.slice(0, 4) === t.slice(0, 4)));
}

let pagefind: Promise<Pagefind | null> | undefined;
function loadPagefind(): Promise<Pagefind | null> {
  /* A path Vite leaves alone: the bundle only exists in the built site. */
  const url = '/pagefind/pagefind.js';
  return (pagefind ??= import(/* @vite-ignore */ url)
    .then(async (pf: Pagefind) => {
      await pf.options({ excerptLength: 26 });
      await pf.init();
      return pf;
    })
    .catch(() => null));
}

export function initSearch() {
  const root = document.querySelector<HTMLElement>('[data-search]');
  if (!root) return;
  const form = root.querySelector<HTMLFormElement>('[data-search-form]')!;
  const input = root.querySelector<HTMLInputElement>('[data-search-input]')!;
  const tagSel = root.querySelector<HTMLSelectElement>('[data-search-tag]')!;
  const seriesSel = root.querySelector<HTMLSelectElement>('[data-search-series]')!;
  const clear = root.querySelector<HTMLButtonElement>('[data-search-clear]')!;
  const out = root.querySelector<HTMLElement>('[data-search-out]')!;
  const status = root.querySelector<HTMLElement>('[data-search-status]')!;
  const suggest = root.querySelector<HTMLElement>('[data-search-suggest]')!;
  const suggestList = root.querySelector<HTMLElement>('[data-search-suggest-list]')!;
  const hits = root.querySelector<HTMLOListElement>('[data-search-hits]')!;
  const more = root.querySelector<HTMLButtonElement>('[data-search-more]')!;
  const browse = root.querySelector<HTMLElement>('[data-search-browse]')!;
  const data = JSON.parse(document.getElementById('search-data')?.textContent ?? '{"tags":{},"series":{}}') as SearchData;
  root.querySelector('[data-search-nojs]')?.setAttribute('hidden', '');

  let run = 0;
  let pending: PagefindResultData[] = [];

  const state = () => ({ q: input.value.trim(), tag: tagSel.value, series: seriesSel.value });

  function fromUrl() {
    const p = new URLSearchParams(location.search);
    input.value = p.get('q') ?? '';
    tagSel.value = data.tags[p.get('tag') ?? ''] ? p.get('tag')! : '';
    seriesSel.value = data.series[p.get('series') ?? ''] ? p.get('series')! : '';
  }

  function toUrl(push: boolean) {
    const { q, tag, series } = state();
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (tag) p.set('tag', tag);
    if (series) p.set('series', series);
    const qs = p.toString();
    const next = `${location.pathname}${qs ? `?${qs}` : ''}`;
    if (next === `${location.pathname}${location.search}`) return;
    history[push ? 'pushState' : 'replaceState'](null, '', next);
  }

  /** Tags whose names start a word with any word typed (two letters or more), most-used first. */
  function drawSuggestions(q: string, tag: string) {
    const words = fold(q)
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 2 && !STOP.has(w));
    const found = words.length
      ? Object.entries(data.tags)
          .filter(([id]) => id !== tag)
          .filter(([, t]) => {
            const label = fold(t.label)
              .split(/[^\p{L}\p{N}]+/u)
              .filter((l) => !STOP.has(l));
            return words.some((w) => label.some((l) => l.startsWith(w)));
          })
          .sort((a, b) => b[1].n - a[1].n)
          .slice(0, 8)
      : [];
    suggestList.innerHTML = found
      .map(
        ([id, t]) =>
          `<li><a class="tag-chip" href="/tags/${id}/" aria-label="${esc(t.label)}, ${t.n === 1 ? '1 piece' : `${t.n} pieces`}">${esc(t.label)}<span class="tag-chip__n" aria-hidden="true">${t.n}</span></a></li>`,
      )
      .join('');
    suggest.hidden = !found.length;
  }

  function hitHtml(d: PagefindResultData, tag: string): string {
    const m = d.meta;
    const s = data.series[d.filters.series?.[0] ?? ''];
    /* A piece: its series label, then what it is; a room or a series: its own label. */
    const kind = KIND[m.kind] ?? '';
    const label = m.label && m.label !== kind ? m.label : '';
    const second = m.kind === 'scroll' || m.kind === 'reading' ? kind : '';
    const tagLinks = (m.tags ?? '')
      .split(' ')
      .filter((t) => data.tags[t])
      .map((t) => `<a href="/tags/${t}/"${t === tag ? ' aria-current="true"' : ''}>${esc(data.tags[t].label)}</a>`);
    /* The excerpt can open on the title, or the end of it, which the result already prints. */
    const words = (m.title ?? '').split(/\s+/).filter(Boolean);
    let ex = d.excerpt?.trim() ?? '';
    const lead = ex.replace(/<\/?mark>/g, '');
    const tail = words.map((_, k) => `${words.slice(k).join(' ')}.`).find((t) => lead.startsWith(t));
    if (tail) {
      let i = 0;
      let seen = 0;
      while (i < ex.length && seen < tail.length) {
        if (ex.startsWith('<mark>', i)) i += 6;
        else if (ex.startsWith('</mark>', i)) i += 7;
        else {
          i++;
          seen++;
        }
      }
      if (ex.startsWith('</mark>', i)) i += 7;
      ex = ex.slice(i).trim();
    }
    const text = ex ? excerpt(ex) : esc(m.line ?? '');
    return [
      `<li class="hit"${s ? ` style="--series-accent:${s.accent}"` : ''}>`,
      `<p class="hit__label">${label ? `<span>${esc(label)}</span>` : ''}${second ? `<span class="hit__kind">${second}</span>` : ''}${!label && !second ? `<span>${kind}</span>` : ''}</p>`,
      `<h2 class="hit__title"><a href="${esc(d.url)}">${esc(m.title ?? d.url)}</a></h2>`,
      text ? `<p class="hit__excerpt">${text}</p>` : '',
      tagLinks.length ? `<p class="hit__tags">${tagLinks.join('')}</p>` : '',
      `</li>`,
    ].join('');
  }

  function drawMore(tag: string) {
    const rows = pending.splice(0, PAGE);
    hits.insertAdjacentHTML('beforeend', rows.map((d) => hitHtml(d, tag)).join(''));
    more.hidden = !pending.length;
  }

  async function go() {
    const mine = ++run;
    const { q, tag, series } = state();
    const searching = Boolean(q || tag || series);
    clear.hidden = !searching;
    browse.hidden = searching;
    out.hidden = !searching;
    drawSuggestions(q, tag);
    if (!searching) {
      hits.innerHTML = '';
      status.textContent = '';
      more.hidden = true;
      return;
    }
    status.textContent = 'Searching…';
    const pf = await loadPagefind();
    if (mine !== run) return;
    if (!pf) {
      hits.innerHTML = '';
      more.hidden = true;
      status.textContent = import.meta.env.DEV
        ? 'Search is built with the site. Run npm run build, then npm run preview, to try it.'
        : 'Search could not load just now. Every piece is filed by tag below.';
      browse.hidden = false;
      return;
    }
    const filters: Record<string, string> = {};
    if (tag) filters.tag = tag;
    if (series) filters.series = series;
    const res = await pf.search(q || null, q ? { filters } : { filters, sort: { date: 'desc' } });
    if (mine !== run || !res) return;
    /* The whole collection is a few dozen records: read them all, so the count is the count shown. */
    let rows = await Promise.all(res.results.map((r) => r.data()));
    if (mine !== run) return;
    if (q) {
      const typed = fold(q)
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean);
      rows = rows.filter((d) => {
        const marked = [...(d.excerpt ?? '').matchAll(/<mark>([\s\S]*?)<\/mark>/g)].map((m) => m[1]);
        return !marked.length || marked.some((w) => answers(w, typed));
      });
      /* Words that name a tag or a series: every piece filed there first (newest first),
         then the rest in Pagefind's order. */
      const bare = (x: string) => fold(x).replace(/^the /, '').trim();
      const namedTag = Object.keys(data.tags).find((id) => bare(data.tags[id].label) === bare(q));
      const namedSeries = Object.keys(data.series).find((id) => bare(data.series[id].name) === bare(q));
      const shelf = namedTag ? { tag: namedTag } : namedSeries ? { series: namedSeries } : undefined;
      if (shelf) {
        const filed = await pf.search(null, { filters: { ...filters, ...shelf }, sort: { date: 'desc' } });
        if (mine !== run) return;
        const lead = filed ? await Promise.all(filed.results.map((r) => r.data())) : [];
        if (mine !== run) return;
        const byUrl = new Map(rows.map((d) => [d.url, d]));
        const first = lead.map((d) => byUrl.get(d.url) ?? d);
        const firstUrls = new Set(first.map((d) => d.url));
        /* The series' own record, when the words name it, stays on top. */
        const own = rows.filter((d) => d.meta.kind === 'series' && namedSeries && d.url === data.series[namedSeries].href);
        rows = [...own, ...first.filter((d) => !own.includes(d)), ...rows.filter((d) => !firstUrls.has(d.url) && !own.includes(d))];
      }
    }
    pending = rows;
    hits.innerHTML = '';
    const n = pending.length;
    const where = [tag && `filed under <em>${esc(data.tags[tag]?.label ?? tag)}</em>`, series && `in <em>${esc(data.series[series]?.name ?? series)}</em>`]
      .filter(Boolean)
      .join(', ');
    const count = n === 0 ? 'Nothing' : n === 1 ? 'One result' : `${n} results`;
    status.innerHTML = q
      ? `${count} for <em>“${esc(q)}”</em>${where ? `, ${where}` : ''}.`
      : `${n === 0 ? 'Nothing' : n === 1 ? 'One piece' : `${n} pieces`} ${where}, newest first.`;
    if (n === 0 && q) status.innerHTML += ' Try fewer words, another spelling, or a tag below.';
    if (n === 0) browse.hidden = false;
    drawMore(tag);
  }

  let timer = 0;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    void loadPagefind();
    timer = window.setTimeout(() => {
      toUrl(false);
      void go();
    }, 180);
  });
  input.addEventListener('focus', () => void loadPagefind(), { once: true });
  for (const sel of [tagSel, seriesSel]) {
    sel.addEventListener('change', () => {
      toUrl(true);
      void go();
    });
  }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(timer);
    toUrl(true);
    void go();
    input.blur();
  });
  form.addEventListener('reset', () => {
    window.setTimeout(() => {
      toUrl(true);
      void go();
      input.focus();
    });
  });
  more.addEventListener('click', () => drawMore(tagSel.value));
  window.addEventListener('popstate', () => {
    fromUrl();
    void go();
  });

  fromUrl();
  void go();
  /* Arriving with nothing asked: the cursor waits in the field (not on a phone, where it would raise the keyboard). */
  if (!input.value && matchMedia('(pointer: fine)').matches) input.focus({ preventScroll: true });
}
