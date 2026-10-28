import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Static-first build. Interactive layers (WebGL pipeline, orchestra pit,
// easter-egg engine) hydrate as client-side islands from src/scripts.
// A Ghost backend can later replace the local content collections without
// touching the page layer: swap the loaders in src/content.config.ts.
//
// The sitemap lists the public museum only: the archived homepage
// (/atelier) and the lab workbench stay out, alongside their noindex tags.
const PRIVATE = ['/atelier', '/lab/'];

export default defineConfig({
  site: 'https://iamwilhelm.com',
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    // Inline every stylesheet: no render-blocking CSS requests on first paint.
    inlineStylesheets: 'always',
  },
  integrations: [
    sitemap({
      filter: (page) => !PRIVATE.some((p) => new URL(page).pathname.startsWith(p)),
    }),
  ],
});
