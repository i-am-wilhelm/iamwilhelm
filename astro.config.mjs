import { defineConfig } from 'astro/config';

// Static-first build. Interactive layers (WebGL pipeline, orchestra pit,
// easter-egg engine) hydrate as client-side islands from src/scripts.
// A Ghost backend can later replace the local content collections without
// touching the page layer: swap the loaders in src/content.config.ts.
export default defineConfig({
  site: 'https://iamwilhelm.com',
  output: 'static',
  build: {
    inlineStylesheets: 'auto',
  },
});
