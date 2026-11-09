/**
 * The plain-text twin of a scroll page: the whole piece as semantic HTML
 * (headings, paragraphs, lists, quotes, the ledger as a table) in reading
 * order, with every exhibit described in one sentence. The twin is derived
 * from the page itself at build time, so it can never drift from the page:
 * src/pages/gallery/[slug]/twin.astro renders the scroll page with Astro's
 * Container API and hands the HTML here.
 *
 * What the twin keeps and drops:
 *
 *   - Scripts, styles, canvases, SVG, navigation rails, forms, buttons,
 *     anything aria-hidden or hidden, the exit links and the shared foot
 *     (ScrollFoot) are dropped. SplitText's painted copies are aria-hidden,
 *     so each line appears once.
 *   - An exhibit is any element carrying `data-twin="…"` (the sentence the
 *     page's author wrote for it), or, failing that, a `role="img"` or
 *     `data-island` element with an aria-label (the label stands in). It
 *     becomes one paragraph and its children are not read.
 *   - Headings keep their level; p, li, blockquote, figcaption, dt/dd and
 *     table cells keep their inline emphasis, links, and `lang` marks. The
 *     claim tags (text / reading / disputed) read as bracketed labels.
 *   - Text sitting directly inside a block (a div with words in it) is read
 *     as a paragraph, so no line of the piece is lost to markup.
 */
import { parse, ELEMENT_NODE, TEXT_NODE, DOCUMENT_NODE } from 'ultrahtml';

type Node = {
  type: number;
  name?: string;
  value?: string;
  attributes?: Record<string, string>;
  children?: Node[];
  parent?: Node;
};

const DROP = new Set([
  'script', 'style', 'noscript', 'template', 'svg', 'canvas', 'head', 'nav', 'form', 'button', 'input',
  'select', 'textarea', 'details', 'summary', 'audio', 'video', 'iframe', 'object', 'dialog', 'label',
]);
const DROP_CLASS = ['split-text__ghost', 'scroll-foot', 'poem-exit', 'descent-exit', 'skip-link', 'site-nav', 'site-footer'];
const BLOCK = new Set([
  'div', 'section', 'article', 'header', 'footer', 'aside', 'main', 'figure', 'figcaption', 'p', 'h1', 'h2', 'h3',
  'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'dl', 'dt',
  'dd', 'hr', 'pre', 'address', 'fieldset', 'body', 'html',
]);
/** Inline tags whose markup the twin keeps. Everything else inline becomes plain text. */
const KEEP_INLINE = new Set(['em', 'i', 'strong', 'b', 'a', 'cite', 'mark', 'code', 'sup', 'sub', 'q', 'abbr', 'time']);

const classes = (n: Node) => (n.attributes?.class ?? '').split(/\s+/).filter(Boolean);
const has = (n: Node, c: string) => classes(n).includes(c);
const esc = (s: string) => s.replace(/&(?![a-z#0-9]+;)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s: string) => esc(s).replace(/"/g, '&quot;');

function dropped(n: Node): boolean {
  if (!n.name) return false;
  const a = n.attributes ?? {};
  /* `data-twin-skip` marks page chrome the twin never reads (a top bar, a guide strip, a chart key). */
  if ('data-twin-skip' in a) return true;
  if (DROP.has(n.name)) return true;
  if (a['aria-hidden'] === 'true' || 'hidden' in a || a.role === 'presentation') return true;
  if ('data-og-hide' in a && n.name === 'a') return true;
  return DROP_CLASS.some((c) => has(n, c));
}

/** The one sentence for an exhibit, or undefined when the element is not one. */
function exhibitSentence(n: Node): string | undefined {
  const a = n.attributes ?? {};
  if (typeof a['data-twin'] === 'string' && a['data-twin'].trim()) return a['data-twin'].trim();
  if ((a.role === 'img' || 'data-island' in a) && a['aria-label']?.trim()) return a['aria-label'].trim();
  return undefined;
}

/** Inline content of a node as HTML with only the kept inline tags. */
function inline(n: Node, out: string[]): void {
  for (const c of n.children ?? []) {
    if (c.type === TEXT_NODE) {
      out.push(c.value ?? '');
      continue;
    }
    if (c.type !== ELEMENT_NODE || !c.name) continue;
    const ex = exhibitSentence(c);
    if (ex) {
      out.push(` ${esc(ex)} `);
      continue;
    }
    if (dropped(c)) continue;
    if (c.name === 'br') {
      out.push(' ');
      continue;
    }
    if (has(c, 'tag')) {
      /* A claim tag: text / reading / disputed, bracketed in the twin. */
      out.push(`<span class="twin-tag">[${text(c)}]</span>`);
      continue;
    }
    const lang = c.attributes?.lang;
    if (KEEP_INLINE.has(c.name)) {
      const tag = c.name === 'i' ? 'em' : c.name === 'b' ? 'strong' : c.name;
      const attrs: string[] = [];
      if (tag === 'a' && c.attributes?.href) attrs.push(` href="${escAttr(c.attributes.href)}"`);
      if (lang) attrs.push(` lang="${escAttr(lang)}"`);
      /* A breath on either side too: adjacent cells set in <b> or <i> must not run together. */
      out.push(` <${tag}${attrs.join('')}>`);
      inline(c, out);
      out.push(`</${tag}> `);
      continue;
    }
    if (lang) {
      out.push(` <span lang="${escAttr(lang)}">`);
      inline(c, out);
      out.push('</span> ');
      continue;
    }
    /* Any other inline element (a span cell in a kicker, a label beside a
       value) is read as text with a breath on either side, so adjacent
       cells do not run together; tidy() closes the gap before punctuation. */
    out.push(' ');
    inline(c, out);
    out.push(' ');
  }
}

/** Plain text of a node (no markup), whitespace collapsed. */
export function text(n: Node): string {
  const out: string[] = [];
  const walk = (x: Node) => {
    if (x.type === TEXT_NODE) out.push(x.value ?? '');
    else if (x.type === ELEMENT_NODE) {
      const ex = exhibitSentence(x);
      if (ex) out.push(` ${ex} `);
      else if (!dropped(x)) (x.children ?? []).forEach(walk);
    }
  };
  walk(n);
  return tidy(out.join(''));
}

const tidy = (s: string) =>
  s
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .trim();

const hasText = (html: string) => tidy(html.replace(/<[^>]+>/g, '')).length > 0;

interface Ctx {
  out: string[];
  /** Headings already written, to keep the twin's outline honest. */
  headings: number;
}

function para(ctx: Ctx, tag: string, html: string, cls?: string) {
  const h = tidy(html);
  if (!hasText(h)) return;
  ctx.out.push(`<${tag}${cls ? ` class="${cls}"` : ''}>${h}</${tag}>`);
}

function flushRun(ctx: Ctx, run: Node[]) {
  if (!run.length) return;
  const holder: Node = { type: ELEMENT_NODE, name: 'span', children: run, attributes: {} };
  const buf: string[] = [];
  inline(holder, buf);
  para(ctx, 'p', buf.join(''));
  run.length = 0;
}

function block(ctx: Ctx, n: Node): void {
  if (n.type !== ELEMENT_NODE || !n.name) return;
  const ex = exhibitSentence(n);
  if (ex) {
    para(ctx, 'p', `<span class="twin-exhibit-k">Exhibit.</span> ${esc(ex)}`, 'twin-exhibit');
    return;
  }
  if (dropped(n)) return;
  const name = n.name;
  if (/^h[1-6]$/.test(name)) {
    const buf: string[] = [];
    inline(n, buf);
    ctx.headings++;
    para(ctx, name, buf.join(''));
    return;
  }
  if (name === 'p' || name === 'figcaption' || name === 'dt' || name === 'dd' || name === 'pre' || name === 'address') {
    const buf: string[] = [];
    inline(n, buf);
    para(ctx, name === 'figcaption' ? 'p' : name === 'pre' ? 'p' : name === 'address' ? 'p' : name, buf.join(''), name === 'figcaption' ? 'twin-caption' : undefined);
    return;
  }
  if (name === 'hr') {
    ctx.out.push('<hr>');
    return;
  }
  if (name === 'blockquote') {
    const inner: Ctx = { out: [], headings: ctx.headings };
    children(inner, n);
    if (inner.out.length) ctx.out.push(`<blockquote>${inner.out.join('')}</blockquote>`);
    return;
  }
  if (name === 'ul' || name === 'ol') {
    const items: string[] = [];
    for (const li of n.children ?? []) {
      if (li.type !== ELEMENT_NODE || li.name !== 'li' || dropped(li)) continue;
      const inner: Ctx = { out: [], headings: ctx.headings };
      children(inner, li);
      const html = inner.out.join('');
      /* A one-paragraph item reads as the item itself. */
      const one = inner.out.length === 1 && html.startsWith('<p>') ? html.slice(3, -4) : html;
      if (hasText(one)) items.push(`<li>${one}</li>`);
    }
    if (items.length) ctx.out.push(`<${name}>${items.join('')}</${name}>`);
    return;
  }
  if (name === 'table') {
    const rows: string[] = [];
    const walkRows = (x: Node) => {
      for (const c of x.children ?? []) {
        if (c.type !== ELEMENT_NODE || dropped(c)) continue;
        if (c.name === 'tr') {
          const cells: string[] = [];
          for (const cell of c.children ?? []) {
            if (cell.type !== ELEMENT_NODE || (cell.name !== 'td' && cell.name !== 'th') || dropped(cell)) continue;
            const buf: string[] = [];
            inline(cell, buf);
            cells.push(`<${cell.name}>${tidy(buf.join(''))}</${cell.name}>`);
          }
          if (cells.some((c) => hasText(c))) rows.push(`<tr>${cells.join('')}</tr>`);
        } else walkRows(c);
      }
    };
    walkRows(n);
    if (rows.length) ctx.out.push(`<table>${rows.join('')}</table>`);
    return;
  }
  if (name === 'dl') {
    const inner: Ctx = { out: [], headings: ctx.headings };
    children(inner, n);
    if (inner.out.length) ctx.out.push(`<dl>${inner.out.join('')}</dl>`);
    return;
  }
  children(ctx, n);
}

/** Children of a block: inline runs become paragraphs, blocks recurse. */
function children(ctx: Ctx, n: Node): void {
  const run: Node[] = [];
  for (const c of n.children ?? []) {
    if (c.type === TEXT_NODE) {
      run.push(c);
      continue;
    }
    if (c.type !== ELEMENT_NODE || !c.name) continue;
    const isExhibit = !!exhibitSentence(c);
    if (!isExhibit && dropped(c)) continue;
    const isBlock = BLOCK.has(c.name) || isExhibit;
    if (isBlock) {
      flushRun(ctx, run);
      block(ctx, c);
    } else {
      run.push(c);
    }
  }
  flushRun(ctx, run);
}

export interface Twin {
  /** The twin's body as semantic HTML. */
  html: string;
  /** The page's h1, as text, when it has one. */
  title?: string;
  headings: number;
  /** Exhibit sentences in order, for review. */
  exhibits: string[];
}

/**
 * Build the twin from a scroll page's full HTML. `title` is the piece's
 * title: the page's own h1 is left out when it repeats it, since the twin
 * page sets the title on its placard.
 */
export function twinFromHtml(pageHtml: string, title?: string): Twin {
  const doc = parse(pageHtml) as Node;
  let body: Node | undefined;
  const find = (x: Node) => {
    if (body) return;
    if (x.type === ELEMENT_NODE && x.name === 'body') body = x;
    else (x.children ?? []).forEach(find);
  };
  if (doc.type === DOCUMENT_NODE) find(doc);
  const root = body ?? doc;
  const ctx: Ctx = { out: [], headings: 0 };
  children(ctx, root);
  /* Collapse runs of identical adjacent paragraphs (a label repeated by a live region). */
  const out: string[] = [];
  const norm = (x: string) => x.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim().toLowerCase();
  for (const b of ctx.out) {
    if (out[out.length - 1] === b) continue;
    if (title && b.startsWith('<h1>') && norm(b) === norm(title)) continue;
    out.push(b);
  }
  const html = out.join('\n');
  const h1 = html.match(/<h1>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]+>/g, '');
  const exhibits = [...html.matchAll(/<p class="twin-exhibit"><span class="twin-exhibit-k">Exhibit\.<\/span> ([\s\S]*?)<\/p>/g)].map((m) => m[1]);
  return { html, title: h1 ?? title, headings: ctx.headings, exhibits };
}
