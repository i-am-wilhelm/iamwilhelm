/**
 * The one view of everything on the site. Two collections feed it:
 *
 *   gallery   every framed piece is a scroll page (its own page under
 *             /gallery/, on Poem.astro or the descent treatment);
 *   writings  every `museum`-treatment entry is a reading, wall text at
 *             /writings/<id>/. The `descent` and `scrolly` entries are the
 *             scroll pages' meta and are represented by their gallery entry.
 *
 * Cards, rows, headers, series indexes, next-in-series and the feeds all
 * read from here, so a piece is numbered once and listed everywhere.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { series as registry, seriesLabel, type SeriesId } from '../config/series';
import { SITE_URL } from '../config/site';

export type PieceKind = 'scroll' | 'reading';

export interface Piece {
  id: string;
  kind: PieceKind;
  title: string;
  /** Site-root path, with trailing slash. */
  path: string;
  url: string;
  date: Date;
  /** One line: the gallery epigraph, or the reading's description. */
  line: string;
  /** Longer summary for feeds and meta. */
  description: string;
  verb?: string;
  series?: SeriesId;
  seriesNo?: number;
  /** "Futurist · No. 1", when in a series. */
  label?: string;
  /** Share image path under public/, when the piece renders its own. */
  ogPath?: string;
  /** The plain-text twin (/gallery/<id>/twin/), for scroll pages. */
  twinPath?: string;
  gallery?: CollectionEntry<'gallery'>;
  writing?: CollectionEntry<'writings'>;
}

let cache: Promise<Piece[]> | undefined;

export function getPieces(): Promise<Piece[]> {
  return (cache ??= build());
}

async function build(): Promise<Piece[]> {
  const gallery = await getCollection('gallery');
  const writings = await getCollection('writings', ({ data }) => !data.draft);
  const byId = new Map(writings.map((w) => [w.id, w]));
  const pieces: Piece[] = [];

  for (const g of gallery) {
    if (g.data.status !== 'on-view' || !g.data.href) continue;
    const w = byId.get(g.id);
    if (w && (w.data.series !== g.data.series || w.data.seriesNo !== g.data.seriesNo)) {
      throw new Error(`${g.id}: the gallery and writings entries disagree on series/seriesNo.`);
    }
    const date = g.data.date ?? w?.data.date;
    if (!date) throw new Error(`${g.id}: the gallery entry needs a date.`);
    const line = g.data.epigraph ?? g.data.description ?? w?.data.description ?? '';
    pieces.push({
      id: g.id,
      kind: 'scroll',
      title: g.data.title,
      path: g.data.href,
      url: new URL(g.data.href, SITE_URL).href,
      date,
      line,
      description: g.data.description ?? w?.data.description ?? line,
      verb: g.data.verb,
      series: g.data.series,
      seriesNo: g.data.seriesNo,
      label: g.data.series && g.data.seriesNo ? seriesLabel(g.data.series, g.data.seriesNo) : undefined,
      ogPath: `/og/${g.id}.jpg`,
      twinPath: `${g.data.href.replace(/\/?$/, '/')}twin/`,
      gallery: g,
      writing: w,
    });
  }

  for (const w of writings) {
    if (w.data.treatment !== 'museum') continue;
    const path = `/writings/${w.id}/`;
    pieces.push({
      id: w.id,
      kind: 'reading',
      title: w.data.title,
      path,
      url: new URL(path, SITE_URL).href,
      date: w.data.date,
      line: w.data.description ?? '',
      description: w.data.description ?? '',
      series: w.data.series,
      seriesNo: w.data.seriesNo,
      label: w.data.series && w.data.seriesNo ? seriesLabel(w.data.series, w.data.seriesNo) : undefined,
      writing: w,
    });
  }

  return pieces.sort(newestFirst);
}

export const newestFirst = (a: Piece, b: Piece) => b.date.valueOf() - a.date.valueOf();

/** Scroll pages only, in wall order (the catalogue `order`, a sort key). */
export async function getScrollPieces(): Promise<Piece[]> {
  return (await getPieces())
    .filter((p) => p.kind === 'scroll')
    .sort((a, b) => a.gallery!.data.order - b.gallery!.data.order);
}

/** Readings only, newest first: the shelf at /writings/. */
export async function getReadings(): Promise<Piece[]> {
  return (await getPieces()).filter((p) => p.kind === 'reading');
}

/**
 * One series, newest first. A piece with a scroll page and a reading under
 * the same id (PHARMAKON and its headnote) appears once, as the scroll page,
 * with the reading reachable as `companion`.
 */
export async function getSeriesPieces(id: SeriesId): Promise<(Piece & { companion?: Piece })[]> {
  const all = (await getPieces()).filter((p) => p.series === id);
  const out: (Piece & { companion?: Piece })[] = [];
  for (const p of all) {
    const twin = all.find((q) => q !== p && q.id === p.id);
    if (twin && p.kind === 'reading') continue;
    out.push(twin ? { ...p, companion: twin } : p);
  }
  return out.sort(newestFirst);
}

/** The piece by id and kind (a scroll page unless `kind` says otherwise). */
export async function getPiece(id: string, kind: PieceKind = 'scroll'): Promise<Piece> {
  const p = (await getPieces()).find((q) => q.id === id && q.kind === kind);
  if (!p) throw new Error(`No ${kind} piece with id "${id}".`);
  return p;
}

/**
 * The next piece in a series by number, or the series index when the piece
 * is the last (so the chain wraps to the shelf rather than to No. 1).
 */
export async function nextInSeries(p: Piece): Promise<{ title: string; path: string; label: string; isIndex: boolean } | undefined> {
  if (!p.series || !p.seriesNo) return undefined;
  const s = registry[p.series];
  /* The next number hung, which need not be the next integer: Seen runs
     No. 1 to 3, then No. 7 on, the numbers its pages print. */
  const next = (await getSeriesPieces(p.series))
    .filter((q) => (q.seriesNo ?? 0) > p.seriesNo!)
    .sort((x, y) => x.seriesNo! - y.seriesNo!)[0];
  if (next) return { title: next.title, path: next.path, label: next.label!, isIndex: false };
  return { title: s.title, path: s.href, label: `${s.name} · the series`, isIndex: true };
}
