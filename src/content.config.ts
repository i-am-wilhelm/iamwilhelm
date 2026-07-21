import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { SYMBOL_IDS } from './lib/symbols';

const writings = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writings' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    /** The post's governing symbol — its constellation heads the page. */
    symbol: z.enum(SYMBOL_IDS as [string, ...string[]]),
    /** Override accent; defaults to the symbol's smoke. */
    accent: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { writings };
