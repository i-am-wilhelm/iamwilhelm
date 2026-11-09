/** /rss.xml: every piece on the site, scroll pages and readings, newest first. */
import type { APIRoute } from 'astro';
import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL } from '../config/site';
import { getPieces } from '../lib/pieces';
import { rss } from '../lib/feeds';

export const GET: APIRoute = async () =>
  new Response(
    rss({
      title: SITE_NAME,
      description: DEFAULT_DESCRIPTION,
      home: `${SITE_URL}/`,
      self: `${SITE_URL}/rss.xml`,
      items: await getPieces(),
    }),
    { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } },
  );
