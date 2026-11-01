/**
 * PoemRoom: one Durable Object per four-character room code, used by the
 * two-phone mode of Equal Volume. It relays presence only (who is in the
 * room, who is holding). There is no chat and no free text, and nothing is
 * written to storage: each socket's state lives in its own attachment, so
 * when the last socket closes the object holds nothing.
 *
 * Uses the WebSocket Hibernation API, so an idle room with readers sitting
 * on a page is evicted from memory and bills no duration while it waits.
 *
 * Protocol (JSON text frames)
 *   client -> server  {"t":"presence","holding":true|false}
 *   server -> client  {"t":"peers","you":"<id>","peers":[{"id","holding"}...]}
 * The full peers list is broadcast on every join, leave and presence change.
 */
import { DurableObject } from 'cloudflare:workers';

const MAX_SOCKETS = 4;
const ROOM_FULL = 4001;
const RATE_WINDOW_MS = 1000;
const RATE_MAX = 10;

interface Attachment {
  id: string;
  holding: boolean;
}

function newId(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export class PoemRoom extends DurableObject {
  /**
   * Rate-limit buckets, in memory only. They reset if the object hibernates,
   * which is harmless: hibernation only happens once traffic has stopped.
   */
  private rate = new WeakMap<WebSocket, { start: number; n: number }>();

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('expected a websocket upgrade', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    if (this.ctx.getWebSockets().length >= MAX_SOCKETS) {
      // Accept, then close with the application code so the browser sees 4001
      // (a plain HTTP refusal reaches the page only as an anonymous 1006).
      server.accept();
      server.close(ROOM_FULL, 'room full');
      return new Response(null, { status: 101, webSocket: client });
    }

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id: newId(), holding: false } satisfies Attachment);
    this.broadcast();

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string' || message.length > 256) return;
    if (!this.allow(ws)) return;

    let msg: unknown;
    try {
      msg = JSON.parse(message);
    } catch {
      return;
    }
    if (
      !msg ||
      typeof msg !== 'object' ||
      (msg as { t?: unknown }).t !== 'presence' ||
      typeof (msg as { holding?: unknown }).holding !== 'boolean'
    ) {
      return;
    }

    const att = ws.deserializeAttachment() as Attachment | null;
    if (!att) return;
    const holding = (msg as { holding: boolean }).holding;
    if (att.holding === holding) return;
    att.holding = holding;
    ws.serializeAttachment(att);
    this.broadcast();
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    try {
      ws.close(code === 1005 || code === 1006 ? 1000 : code, 'bye');
    } catch {
      /* already closed */
    }
    this.broadcast(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.broadcast(ws);
  }

  /** Drop presence frames beyond RATE_MAX per RATE_WINDOW_MS per socket. */
  private allow(ws: WebSocket): boolean {
    const now = Date.now();
    const b = this.rate.get(ws);
    if (!b || now - b.start >= RATE_WINDOW_MS) {
      this.rate.set(ws, { start: now, n: 1 });
      return true;
    }
    b.n += 1;
    return b.n <= RATE_MAX;
  }

  /** Send every open socket the full peers list. `gone` is excluded. */
  private broadcast(gone?: WebSocket): void {
    const open = this.ctx
      .getWebSockets()
      .filter((ws) => ws !== gone && ws.readyState === WebSocket.OPEN);
    const peers = open
      .map((ws) => ws.deserializeAttachment() as Attachment | null)
      .filter((a): a is Attachment => !!a)
      .map(({ id, holding }) => ({ id, holding }));

    for (const ws of open) {
      const me = ws.deserializeAttachment() as Attachment | null;
      if (!me) continue;
      try {
        ws.send(JSON.stringify({ t: 'peers', you: me.id, peers }));
      } catch {
        /* socket went away mid-broadcast; its close handler will rebroadcast */
      }
    }
  }
}
