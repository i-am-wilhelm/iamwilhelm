/**
 * Worker entry. The site is a static Astro build served from the ASSETS
 * binding; this script only sees requests matched by `run_worker_first` in
 * the wrangler config (/api/* and the Search Console file below). Everything
 * else is answered by the asset layer before the script runs, so static
 * pages cost no invocations.
 *
 * Routes
 *   GET /api/room/:code                  WebSocket upgrade into the PoemRoom for that code.
 *   GET /google8b497834161e9abd.html     Google Search Console verification file.
 */
export { PoemRoom } from './poem-room';

export interface Env {
  ASSETS: Fetcher;
  POEM_ROOM: DurableObjectNamespace;
}

const ROOM_PATH = /^\/api\/room\/([^/]+)\/?$/;
const CODE = /^[a-z0-9]{4}$/;

/* Google Search Console ownership file. KEEP IT: Google re-checks it
   periodically and the site's verification lapses if it ever 404s or
   redirects. It lives here, not in public/, because html_handling
   "auto-trailing-slash" answers /<name>.html with a 307 to /<name>, and
   Google needs a plain 200 at the .html URL. Not an Astro page, so it stays
   out of dist/, the sitemap, the nav, the gallery and og:scrollies. The path
   is also listed in run_worker_first in both wrangler configs. */
const GSC_PATH = '/google8b497834161e9abd.html';
const GSC_BODY = 'google-site-verification: google8b497834161e9abd.html';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === GSC_PATH) {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
      }
      return new Response(request.method === 'HEAD' ? null : GSC_BODY, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const m = url.pathname.match(ROOM_PATH);

    if (m) {
      const code = m[1];
      if (!CODE.test(code)) return new Response('bad room code', { status: 400 });
      if (request.method !== 'GET') return new Response('method not allowed', { status: 405 });
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return new Response('expected a websocket upgrade', { status: 426 });
      }
      const stub = env.POEM_ROOM.get(env.POEM_ROOM.idFromName(code));
      return stub.fetch(request);
    }

    if (url.pathname.startsWith('/api/')) return new Response('not found', { status: 404 });
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
