/**
 * Writes the Horoskopos engine as an ES module (worker/gen/, not committed)
 * at the start of every `astro dev` and `astro build`, so the Worker bundle
 * that follows always carries the engine exactly as public/machines/natal/
 * has it. The Worker imports that module for share previews
 * (worker/horoskopos.ts); scripts/horoskopos-engine-module.mjs does the work
 * and explains it.
 */
import type { AstroIntegration } from 'astro';
import { buildEngineModule } from '../../scripts/horoskopos-engine-module.mjs';

export default function horoskoposEngine(): AstroIntegration {
  return {
    name: 'iamwilhelm:horoskopos-engine',
    hooks: {
      'astro:config:setup': ({ logger }) => {
        buildEngineModule();
        logger.info('engine module written to worker/gen/.');
      },
    },
  };
}
