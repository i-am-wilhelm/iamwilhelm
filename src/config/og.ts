import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SITE_URL } from './site';

/**
 * The absolute share-image URL for a page, versioned with a short hash of
 * the file's bytes (`/og/the-dual-thing.jpg?v=3f9a1c02be`). Platforms cache
 * share images by URL, so a re-rendered card gets a new URL the moment its
 * pixels change, and the next scrape of the page fetches it fresh.
 *
 * `preferred` is a site-root path (a piece's own render under public/og/);
 * when that file is missing the museum card stands in. Runs at build time,
 * where the working directory is the repo root.
 */
export function ogImage(preferred?: string, fallback = '/og.png'): string {
  if (preferred && /^https?:\/\//.test(preferred)) return preferred;
  for (const path of [preferred, fallback]) {
    if (!path) continue;
    const file = resolve(process.cwd(), 'public', path.replace(/^\//, ''));
    if (!existsSync(file)) continue;
    const v = createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 10);
    return new URL(`${path}?v=${v}`, SITE_URL).href;
  }
  return new URL(fallback, SITE_URL).href;
}
