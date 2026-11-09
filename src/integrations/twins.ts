/**
 * Fills the plain-text twins after the build. Each twin page
 * (src/pages/gallery/[slug]/twin.astro) renders the museum layout, the
 * placard, the schema and an empty `.twin__text[data-twin-body]`; once
 * every page is in dist/, this hook reads the scroll page beside each twin,
 * reduces it with src/lib/twin.ts and writes the result into that element.
 *
 * Done here rather than in the page because importing a scroll page into
 * the twin page's module graph would hand the twin every scroll page's
 * global stylesheet (Astro collects CSS across dynamic imports too). The
 * built HTML is the one source the twin needs, and it exists only when the
 * build is done. In `astro dev` the page fetches itself from the dev server
 * instead, so the twin reads the same there.
 */
import type { AstroIntegration } from 'astro';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { twinFromHtml } from '../lib/twin';

const PLACEHOLDER = /(<div class="twin__text"[^>]*data-twin-body[^>]*>)(<\/div>)/;
const TITLE = /data-twin-title="([^"]*)"/;
const unescapeAttr = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

export default function twins(): AstroIntegration {
  return {
    name: 'iamwilhelm:twins',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const dist = fileURLToPath(dir);
        const gallery = join(dist, 'gallery');
        if (!existsSync(gallery)) return;
        let filled = 0;
        for (const slug of readdirSync(gallery)) {
          const twinFile = join(gallery, slug, 'twin', 'index.html');
          const pageFile = join(gallery, slug, 'index.html');
          if (!existsSync(twinFile) || !statSync(twinFile).isFile()) continue;
          if (!existsSync(pageFile)) throw new Error(`twins: ${slug} has a twin but no scroll page in dist/.`);
          const twinHtml = readFileSync(twinFile, 'utf8');
          const m = twinHtml.match(PLACEHOLDER);
          if (!m) throw new Error(`twins: ${slug}: the twin page has no empty .twin__text[data-twin-body] to fill.`);
          const title = unescapeAttr(m[1].match(TITLE)?.[1] ?? '');
          const twin = twinFromHtml(readFileSync(pageFile, 'utf8'), title || undefined);
          if (!twin.html.trim()) throw new Error(`twins: ${slug} reduced to nothing.`);
          writeFileSync(twinFile, twinHtml.replace(PLACEHOLDER, `$1\n${twin.html}\n$2`));
          filled++;
          logger.info(`${slug}: ${twin.headings} headings, ${twin.exhibits.length} exhibits`);
        }
        logger.info(`${filled} plain-text twin(s) filled.`);
      },
    },
  };
}
