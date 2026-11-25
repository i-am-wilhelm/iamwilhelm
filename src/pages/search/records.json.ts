/**
 * What search indexes, as one list: every piece (scroll pages and
 * readings), every series, and the rooms in src/config/search.ts. Built
 * with the site and read once by the search integration
 * (src/integrations/search.ts), which reads each record's text from its
 * built page, writes the Pagefind index to /pagefind/ and deletes this
 * file. Nothing on the site fetches it.
 */
import type { APIRoute } from 'astro';
import { getPieces, getSeriesPieces } from '../../lib/pieces';
import { series, seriesIds } from '../../config/series';
import { tags } from '../../config/tags';
import { SEARCH_ROOMS, type SearchRecord } from '../../config/search';

export const GET: APIRoute = async () => {
  const records: SearchRecord[] = [];
  for (const p of await getPieces()) {
    records.push({
      url: p.path,
      source: p.kind === 'scroll' ? p.twinPath! : p.path,
      read: p.kind === 'scroll' ? 'twin' : 'main',
      kind: p.kind,
      title: p.title,
      label: p.label ?? (p.kind === 'scroll' ? 'Elsewhere' : 'Reading'),
      line: p.line,
      series: p.series ?? (p.kind === 'scroll' ? 'elsewhere' : ''),
      tags: p.tags,
      date: p.date.toISOString().slice(0, 10),
      image: p.ogPath ?? '',
    });
  }
  for (const id of seriesIds) {
    const pieces = await getSeriesPieces(id);
    if (!pieces.length) continue;
    records.push({
      url: series[id].href,
      source: series[id].href,
      read: 'none',
      kind: 'series',
      title: series[id].title,
      label: `A series · ${pieces.length === 1 ? 'one piece' : `${pieces.length} pieces`}`,
      line: series[id].statement,
      series: id,
      tags: [],
      date: pieces[0].date.toISOString().slice(0, 10),
      image: '',
    });
  }
  for (const r of SEARCH_ROOMS) {
    records.push({
      url: r.url,
      source: r.source ?? r.url,
      read: r.section ? 'section' : 'main',
      section: r.section,
      kind: 'room',
      title: r.title,
      label: r.label,
      line: r.line,
      series: '',
      tags: [],
      date: '',
      image: '',
    });
  }
  return new Response(JSON.stringify({ records }), { headers: { 'Content-Type': 'application/json' } });
};
