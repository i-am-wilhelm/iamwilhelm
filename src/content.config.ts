import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Local markdown collections. A Ghost backend can be wired in later by
 * swapping this glob loader for a Ghost Content API loader — the schema is
 * the stable interface the pages depend on.
 */
const writings = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writings' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    /** Symbols chosen for thematic relevance to the piece (spec §4.6). */
    symbols: z.array(z.string()).default([]),
    /** Accent token id from src/design/tokens.ts. */
    accent: z.string().default('writings'),
    draft: z.boolean().default(false),
    description: z.string().optional(),
  }),
});

export const collections = { writings };
