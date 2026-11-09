/** /atom.xml: the same feed as /rss.xml, as Atom. */
import type { APIRoute } from 'astro';
import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL } from '../config/site';
import { getPieces } from '../lib/pieces';
import { atom } from '../lib/feeds';

export const GET: APIRoute = async () =>
  new Response(
    atom({
      title: SITE_NAME,
      description: DEFAULT_DESCRIPTION,
      home: `${SITE_URL}/`,
      self: `${SITE_URL}/atom.xml`,
      items: await getPieces(),
    }),
    { headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' } },
  );
