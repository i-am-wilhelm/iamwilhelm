/**
 * Worker entry. The site is a static Astro build served from the ASSETS
 * binding; this script only sees requests matched by `run_worker_first` in
 * the wrangler config (today, /api/*). Everything else is answered by the
 * asset layer before the script runs, so static pages cost no invocations.
 *
 * Routes
 *   GET /api/room/:code   WebSocket upgrade into the PoemRoom for that code.
 */
export { PoemRoom } from './poem-room';

export interface Env {
  ASSETS: Fetcher;
  POEM_ROOM: DurableObjectNamespace;
}

const ROOM_PATH = /^\/api\/room\/([^/]+)\/?$/;
const CODE = /^[a-z0-9]{4}$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
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
