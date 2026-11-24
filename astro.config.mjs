import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import twins from './src/integrations/twins';
import horoskoposEngine from './src/integrations/horoskopos-engine';

// Static-first build. Interactive layers (WebGL pipeline, orchestra pit,
// easter-egg engine) hydrate as client-side islands from src/scripts.
// A Ghost backend can later replace the local content collections without
// touching the page layer: swap the loaders in src/content.config.ts.
//
// The sitemap lists the public museum only: the archived homepage
// (/atelier) and the lab workbench stay out, alongside their noindex tags,
// and so do the plain-text twins (/gallery/<slug>/twin/), whose canonical
// is the scroll page they mirror. The Horoskopos embed route (/horoskopos/embed/)
// is a frame for other sites, not a page of this one, and stays out too.
const PRIVATE = ['/atelier', '/lab/', '/horoskopos/embed'];
const isTwin = (pathname) => /\/twin\/?$/.test(pathname);

export default defineConfig({
  site: 'https://iamwilhelm.com',
  output: 'static',
  trailingSlash: 'ignore',
  // A short address for the Threshold ("What brought you here?"), for bios
  // and cards: /welcome lands on the homepage at #welcome, which opens the
  // Threshold's popup.
  redirects: {
    '/welcome': '/#welcome',
  },
  build: {
    // Inline every stylesheet: no render-blocking CSS requests on first paint.
    inlineStylesheets: 'always',
  },
  integrations: [
    twins(),
    horoskoposEngine(),
    sitemap({
      filter: (page) => {
        const { pathname } = new URL(page);
        return !PRIVATE.some((p) => pathname.startsWith(p)) && !isTwin(pathname);
      },
    }),
  ],
});
