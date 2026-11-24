/**
 * The engine words its readings as HTML strings. The share system needs
 * them as plain text: paragraphs for an embed, and single lines to pull
 * onto a card. Nothing here needs a DOM, so it runs on the Worker too.
 */

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** HTML to plain text: tags out, entities decoded, whitespace settled. */
export function strip(html: string): string {
  return String(html)
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e.toLowerCase()] ?? m))
    .replace(/\s+/g, ' ')
    .replace(/ on screen\b/g, ' in this chart')
    .trim();
}

export const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

export interface Block {
  attrs: Record<string, string>;
  /** The heading's name, before any epithet or note. */
  name: string;
  /** The epithet in the original (the <em class="ep">), when the heading has one. */
  ep: string;
  /** The small note that closes the heading. */
  note: string;
  /** Paragraphs, as plain text. */
  paras: string[];
  /** The paragraphs' HTML, for lifting marked spans. */
  html: string;
}

/** Split a reading into its blocks: each `<div class="god …">` with its heading and paragraphs. */
export function blocks(html: string): Block[] {
  const out: Block[] = [];
  const parts = html.split(/(?=<div class="god[ "])/);
  for (const part of parts) {
    const open = part.match(/^<div class="god[^"]*"([^>]*)>/);
    if (!open) continue;
    const attrs: Record<string, string> = {};
    for (const m of open[1].matchAll(/data-([a-z]+)="([^"]*)"/g)) attrs[m[1]] = m[2];
    const h5 = part.match(/<h5[^>]*>([\s\S]*?)<\/h5>/);
    const head = h5 ? h5[1] : '';
    const ep = head.match(/<em class="ep"[^>]*>([\s\S]*?)<\/em>/);
    const notes = [...head.matchAll(/<span(?! class="hn")[^>]*>([\s\S]*?)<\/span>/g)];
    const name = strip(head.replace(/<span class="hn">[\s\S]*?<\/span>/, '').replace(/<em class="ep"[\s\S]*$/, '').replace(/<span[\s\S]*$/, ''));
    /* A paragraph can end where the next block begins (the engine closes some mid-string), so cut on the tags themselves. */
    const body = part.slice(h5 ? part.indexOf('</h5>') + 5 : open[0].length);
    const paras = body.split(/<p class="rd[^"]*">/).slice(1).map((p) => strip(p.split('</p>')[0])).filter(Boolean);
    out.push({ attrs, name, ep: ep ? strip(ep[1]) : '', note: notes.length ? strip(notes[notes.length - 1][1]) : '', paras, html: body });
  }
  return out;
}

/** Sentences of a paragraph. A bold lead-in ("A T-square.") stays with the sentence it introduces. */
export function sentences(text: string): string[] {
  const raw = text.match(/[^.!?]+(?:[.!?]+["”’)]*|$)/g) || [text];
  const out: string[] = [];
  for (const piece of raw.map((s) => s.trim()).filter(Boolean)) {
    const last = out[out.length - 1];
    if (last && (last.length < 28 || /\b(?:No|St|vs|cf)\.$/.test(last) || /^\d/.test(piece) && /\d\.$/.test(last))) out[out.length - 1] = last + ' ' + piece;
    else out.push(piece);
  }
  return out;
}

export interface Line { text: string; by?: string }

/** Lines worth pulling onto a card: single sentences, and neighbouring pairs short enough to sit together. */
export function pullLines(paras: string[], by?: string, max = 230): Line[] {
  const seen = new Set<string>(), out: Array<Line & { score: number; at: number }> = [];
  let at = 0;
  const add = (text: string, bonus: number) => {
    const t = text.trim().replace(/^In (this|your) chart\. /, '');
    if (t.length < 24 || t.length > max || seen.has(t)) return;
    seen.add(t);
    let score = bonus;
    if (/\b(you|your)\b/i.test(t)) score += 2;
    if (/^(I |I’m|In you)/.test(t)) score += 1;
    if (t.length >= 60 && t.length <= 170) score += 1;
    out.push({ text: t, by, score, at: at++ });
  };
  for (const p of paras) {
    const ss = sentences(p);
    for (let i = 0; i < ss.length; i++) {
      add(ss[i], 0);
      if (i + 1 < ss.length) add(ss[i] + ' ' + ss[i + 1], 0.5);
    }
  }
  return out.sort((a, b) => b.score - a.score || a.at - b.at).slice(0, 14).map(({ text, by: who }) => ({ text, ...(who ? { by: who } : {}) }));
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Signs a text font may lack, spelled out, so a card never depends on a fallback font. */
const WORDS: Array<[RegExp, string]> = [[/\s*☌\s*/g, ' conjunct '], [/\s*☍\s*/g, ' opposite '], [/\s*△\s*/g, ' trine '], [/\s*□\s*/g, ' square '], [/\s*✶\s*/g, ' sextile '], [/♯/g, ' sharp'], [/♭/g, ' flat'], [/[↓→←↑]/g, '']];
export function plain(text: string): string {
  let t = text;
  for (const [re, w] of WORDS) t = t.replace(re, w);
  return t.replace(/\s+/g, ' ').trim();
}
