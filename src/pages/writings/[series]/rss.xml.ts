/** /writings/<series>/rss.xml: one RSS 2.0 feed per series, newest first. */
import type { APIRoute, GetStaticPaths } from 'astro';
import { series, seriesFeed, seriesIds } from '../../../config/series';
import { SITE_NAME, SITE_URL } from '../../../config/site';
import { getSeriesPieces } from '../../../lib/pieces';
import { rss } from '../../../lib/feeds';

export const getStaticPaths: GetStaticPaths = () => seriesIds.map((id) => ({ params: { series: id } }));

export const GET: APIRoute = async ({ params }) => {
  const id = params.series as (typeof seriesIds)[number];
  const s = series[id];
  const xml = rss({
    title: `${s.title} · ${SITE_NAME}`,
    description: s.statement,
    home: `${SITE_URL}${s.href}`,
    self: `${SITE_URL}${seriesFeed(id)}`,
    items: await getSeriesPieces(id),
  });
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
