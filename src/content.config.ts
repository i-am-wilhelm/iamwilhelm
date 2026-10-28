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

/**
 * The Gallery of Visualized Poetry. One markdown file per framed poem in
 * src/content/gallery; the homepage's Room IV and /gallery both render
 * every entry, sorted by `order`. To hang a new poem, add a file: title,
 * year, a one-line epigraph, and `href` pointing at its interactive page.
 * Entries with `status: forthcoming` render as an empty frame with no link.
 */
const gallery = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/gallery' }),
  schema: z.object({
    title: z.string(),
    /** Display form of the title inside the frame (e.g. spaced caps). */
    plateTitle: z.string().optional(),
    year: z.coerce.string().optional(),
    epigraph: z.string().optional(),
    /** The poem's full interactive page. Required once the poem is on view. */
    href: z.string().optional(),
    medium: z.string().default('Visualized poem; interactive page'),
    order: z.number().default(100),
    status: z.enum(['on-view', 'forthcoming']).default('on-view'),
    /** Zodiac sign for the frame's wayfinding mark (components/museum/zodiac.ts). */
    sign: z
      .enum([
        'aries',
        'taurus',
        'gemini',
        'cancer',
        'leo',
        'virgo',
        'libra',
        'scorpio',
        'sagittarius',
        'capricorn',
        'aquarius',
        'pisces',
      ])
      .default('pisces'),
    /** Plate colour inside the frame; a muted, dark hue reads best. */
    plate: z.string().default('#2b2230'),
  }),
});

export const collections = { writings, gallery };
