// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// Static-first: every page is prerendered. The Cloudflare adapter is present so
// on-demand rendering (live weather, Ghost swap) can be enabled per-page later
// without re-architecting.
export default defineConfig({
  site: 'https://iamwilhelm.com',
  output: 'static',
  adapter: cloudflare(),
  devToolbar: { enabled: false },
});
